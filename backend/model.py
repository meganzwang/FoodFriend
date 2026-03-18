import pandas as pd
import numpy as np
import re
import os
from scipy.spatial.distance import cosine

class FoodFriendModel:
    def __init__(self, csv_name='final_vectorized_ingredients.csv'):
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

        # Stage 1: Hard-coded Filtering Criteria (Safety & Diet)
        self.HARD_FILTERS = {
            "dairy": ["dairy","milk", "butter", "cream", "cheese", "yogurt", "whey", "casein", "ghee", "lactose", "half-and-half", "kefir", "mascarpone", "ricotta", "custard"],
            "egg": ["egg", "albumin", "yolk", "meringue", "mayo", "mayonnaise", "lysozyme", "lecithin"],
            "gluten": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko"],
            "grain": ["grain","rice", "corn", "oats", "quinoa", "millet", "amaranth", "sorghum", "buckwheat"],
            "peanut": ["peanut", "groundnut"],
            "seafood": ["anchovy", "tilapia", "salmon", "tuna", "cod", "bass", "bonito", "worcestershire", "fish sauce"],
            "sesame": ["tahini", "gomasio", "til", "sesame oil", "benne seed"],
            "shellfish": ["shrimp", "prawn", "crab", "lobster", "crawfish", "mussels", "clams", "oysters", "scallops", "krill", "scampi"],
            "soy": ["tofu", "tempeh", "edamame", "miso", "tamari", "shoyu", "natto", "lecithin", "glycine max"],
            "sulfite": ["sulfur dioxide", "sodium bisulfite", "potassium metabisulfite"],
            "tree_nut": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan", "gianduja"],
            "wheat": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko"],

            # Diet Filters
            "gluten_free": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko", "brewer's yeast", "brewer’s yeast", "graham flour", "udon", "matzo", "orzo"],
            "ketogenic": ["sugar", "honey", "maple syrup", "flour", "bread", "pasta", "rice", "corn", "potatoes", "beans", "lentils", "apples", "bananas", "grapes"],
            "vegetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet"],
            "vegan": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet", "milk", "butter", "cream", "cheese", "yogurt", "whey", "casein", "ghee", "lactose", "half-and-half", "kefir", "mascarpone", "ricotta", "custard", "albumin", "yolk", "meringue", "mayo", "mayonnaise", "honey"],
            "pescetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "gelatin", "lard", "suet"]
        }

        self.FILTER_KEY_ALIASES = {
            "peanuts": "peanut",
            "tree_nuts": "tree_nut",
            "treenut": "tree_nut",
            "tree nut": "tree_nut",
            "tree nuts": "tree_nut",
            "gluten-free": "gluten_free",
            "gluten free": "gluten_free",
            "shell fish": "shellfish"
        }

    def _normalize_filter_key(self, value):
        normalized = str(value).strip().lower().replace('-', '_')
        normalized = re.sub(r'\s+', '_', normalized)
        return self.FILTER_KEY_ALIASES.get(normalized, normalized)

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

        intolerances = user_profile.get("intolerances", [])
        if isinstance(intolerances, str):
            intolerances = [intolerances]
        for intolerance in intolerances:
            filter_key = self._normalize_filter_key(intolerance)
            forbidden.update(self.HARD_FILTERS.get(filter_key, []))

        diets = user_profile.get("diet", [])
        if isinstance(diets, str):
            diets = [diets]
        for diet in diets:
            filter_key = self._normalize_filter_key(diet)
            forbidden.update(self.HARD_FILTERS.get(filter_key, []))

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