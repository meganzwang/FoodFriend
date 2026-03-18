import pandas as pd
import numpy as np
import re
import os
from scipy.spatial.distance import cosine

class FoodFriendModel:
    def __init__(self, csv_name='preprocessed_ingredients_v2.csv'):
        # This looks for the CSV in FoodFriend/data/
        # __file__ is FoodFriend/backend/model.py
        # dirname(__file__) is FoodFriend/backend/
        # dirname(dirname(__file__)) is FoodFriend/
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        csv_path = os.path.join(base_path, 'data', csv_name)
        
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"Missing CSV! Checked: {csv_path}")
            
        self.df = pd.read_csv(csv_path)
        
        # Columns mapping
        self.nutrition_cols = [
            'calcium_amount_mg', 'fat_amount_g', 'iron_amount_mg', 'protein_amount_g',
            'calories_amount_kcal', 'sugar_amount_g', 'sodium_amount_mg',
            'saturated_fat_amount_g', 'fiber_amount_g', 'carbohydrates_amount_g'
        ]
        self.macro_pct_cols = ['pct_protein', 'pct_fat', 'pct_carbs']
        
        # Binary tags are everything else (excluding metadata)
        metadata = ['id', 'name', 'flavor', 'texture']
        self.tag_cols = [c for c in self.df.columns if c not in metadata + self.nutrition_cols + self.macro_pct_cols]

        # Standard Diet Filters
        self.HARD_FILTERS = {
            "dairy": ["milk", "butter", "cream", "cheese", "yogurt", "ghee", "lactose"],
            "egg": ["albumin", "yolk", "meringue", "mayo", "mayonnaise"],
            "gluten": ["flour", "breadcrumbs", "rye", "barley", "malt", "wheat"],
            "vegetarian": ["beef", "pork", "chicken", "turkey", "lamb", "fish", "shrimp", "gelatin", "lard"],
            "vegan": ["beef", "pork", "chicken", "turkey", "fish", "milk", "butter", "cheese", "egg", "honey"],
            "ketogenic": ["sugar", "honey", "flour", "bread", "pasta", "rice", "corn", "potatoes"]
        }

    def _create_user_vector(self, preferences):
        """Builds a vector where likes = 1, dislikes = -1, and nutrient goals = 1/0."""
        vec_size = len(self.tag_cols) + len(self.nutrition_cols) + len(self.macro_pct_cols)
        user_vec = np.zeros(vec_size)
        
        # 1. Map Tags (Flavors/Textures)
        for pref in preferences.get("liked_flavors", []) + preferences.get("liked_textures", []):
            if pref in self.tag_cols:
                user_vec[self.tag_cols.index(pref)] = 1.0
                
        for dislike in preferences.get("disliked_flavors", []) + preferences.get("disliked_textures", []):
            if dislike in self.tag_cols:
                user_vec[self.tag_cols.index(dislike)] = -1.0

        # 2. Map Nutritional Goals
        offset = len(self.tag_cols)
        
        for goal in preferences.get("increase_nutrients", []):
            if goal in self.nutrition_cols:
                user_vec[offset + self.nutrition_cols.index(goal)] = 1.0
            
            # Smart logic: if they want high protein/fat/carbs, target the percentage too
            macro_prefix = goal.split('_')[0] # 'protein', 'fat', or 'carbohydrates'
            if macro_prefix == 'carbohydrates': macro_prefix = 'carbs'
            pct_col = f"pct_{macro_prefix}"
            if pct_col in self.macro_pct_cols:
                user_vec[offset + len(self.nutrition_cols) + self.macro_pct_cols.index(pct_col)] = 1.0

        for goal in preferences.get("decrease_nutrients", []):
            # We target 0 for things they want to decrease
            if goal in self.nutrition_cols:
                user_vec[offset + self.nutrition_cols.index(goal)] = 0.0

        return user_vec

    def recommend(self, user_profile, top_n=10):
        # Safety Filter
        forbidden = set()
        for i in user_profile.get("intolerances", []):
            forbidden.update(self.HARD_FILTERS.get(i.lower(), []))
        for d in user_profile.get("diet", []):
            forbidden.update(self.HARD_FILTERS.get(d.lower(), []))

        # Filter candidates by name keywords
        if forbidden:
            pattern = re.compile(r'\b(' + '|'.join(map(re.escape, forbidden)) + r')\b', re.IGNORECASE)
            candidates = self.df[~self.df['name'].str.contains(pattern, na=False)].copy()
        else:
            candidates = self.df.copy()

        # Vector Match
        user_vector = self._create_user_vector(user_profile)
        feature_cols = self.tag_cols + self.nutrition_cols + self.macro_pct_cols
        
        scores = []
        user_norm = np.linalg.norm(user_vector)
        
        for val in candidates[feature_cols].values:
            val_norm = np.linalg.norm(val)
            if user_norm == 0 or val_norm == 0:
                scores.append(0)
            else:
                # 1 - cosine distance = similarity
                scores.append(1 - cosine(user_vector, val))

        candidates['score'] = scores
        return candidates[['name', 'score']].sort_values(by='score', ascending=False).head(top_n).to_dict(orient='records')