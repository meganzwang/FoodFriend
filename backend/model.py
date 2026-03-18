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
            "dairy": ["dairy","milk", "butter", "cream", "cheese", "yogurt", "whey", "casein", "ghee", "lactose", "half-and-half", "kefir", "mascarpone", "ricotta", "custard", "cupcake", "cake"],
            "egg": ["egg", "albumin", "yolk", "meringue", "mayo", "mayonnaise", "lysozyme", "lecithin", "cupcake", "cake"],
            "gluten": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko", "bread", "cupcake", "cake", "cracker", "pasta"],
            "grain": ["grain","rice", "corn", "oats", "quinoa", "millet", "amaranth", "sorghum", "buckwheat"],
            "peanut": ["peanut", "groundnut"],
            "seafood": ["anchovy", "tilapia", "salmon", "tuna", "cod", "bass", "bonito", "worcestershire", "fish sauce"],
            "sesame": ["tahini", "gomasio", "til", "sesame oil", "benne seed"],
            "shellfish": ["shrimp", "prawn", "crab", "lobster", "crawfish", "mussels", "clams", "oysters", "scallops", "krill", "scampi"],
            "soy": ["tofu", "tempeh", "edamame", "miso", "tamari", "shoyu", "natto", "lecithin", "glycine max"],
            "sulfite": ["sulfur dioxide", "sodium bisulfite", "potassium metabisulfite"],
            "tree_nut": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan", "gianduja"],
            "wheat": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko", "bread", "cupcake", "cake", "cracker", "pasta"],

            # Diet Filters
            "gluten_free": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko", "brewer's yeast", "brewer’s yeast", "graham flour", "udon", "matzo", "orzo", "bread", "cupcake", "cake", "cracker", "pasta"],
            "ketogenic": ["sugar", "honey", "maple syrup", "flour", "bread", "pasta", "rice", "corn", "potatoes", "beans", "lentils", "apples", "bananas", "grapes", "cupcake", "cake"],
            "vegetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet", "lobster"],
            "vegan": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet", "milk", "butter", "cream", "cheese", "yogurt", "whey", "casein", "ghee", "lactose", "half-and-half", "kefir", "mascarpone", "ricotta", "custard", "albumin", "yolk", "meringue", "mayo", "mayonnaise", "honey", "lobster", "cupcake", "cake"],
            "pescetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "gelatin", "lard", "suet", "lobster"],
            "lacto_vegetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet", "lobster", "egg"],
            "ovo_vegetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet", "lobster", "milk", "butter", "cream", "cheese", "yogurt", "whey", "casein", "ghee", "lactose", "half-and-half", "kefir", "mascarpone", "ricotta", "custard"],
            "paleo": ["grain", "rice", "corn", "oats", "wheat", "flour", "bread", "pasta", "legumes", "beans", "lentils", "soy", "tofu", "dairy", "sugar", "honey", "processed", "cupcake", "cake", "cheese"],
            "primal": ["grain", "rice", "corn", "oats", "wheat", "flour", "bread", "pasta", "legumes", "beans", "lentils", "soy", "tofu", "sugar", "processed", "cupcake", "cake"],
            "low_fodmap": ["garlic", "onion", "wheat", "flour", "bread", "pasta", "milk", "beans", "honey", "apple", "pear", "cheese", "cupcake", "cake"],
            "whole30": ["sugar", "honey", "maple syrup", "alcohol", "grain", "rice", "corn", "oats", "wheat", "flour", "bread", "pasta", "legumes", "beans", "lentils", "soy", "tofu", "dairy", "cheese", "processed", "cupcake", "cake"]
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

    def _get_forbidden_mask(self, df, active_filters):
        is_forbidden = pd.Series(False, index=df.index)
        is_gf = df['name'].str.contains(r'gluten[ -]free', case=False, na=False)
        is_df = df['name'].str.contains(r'dairy[ -]free', case=False, na=False)
        is_ef = df['name'].str.contains(r'egg[ -]free', case=False, na=False)
        is_v = df['name'].str.contains(r'vegan', case=False, na=False)
        
        cake_pattern = re.compile(r'\b(cupcake|cake)\b', re.IGNORECASE)
        is_cake = df['name'].str.contains(cake_pattern, na=False)

        for f_key in active_filters:
            keywords = self.HARD_FILTERS.get(f_key, [])
            if not keywords: continue
            
            pattern = re.compile(r'\b(' + '|'.join(map(re.escape, keywords)) + r')', re.IGNORECASE)
            matches = df['name'].str.contains(pattern, na=False)
            
            # Apply exemptions
            if f_key in ["gluten", "wheat", "gluten_free"]:
                matches &= ~is_gf
            
            if f_key == "dairy":
                matches &= ~(is_df & is_cake)
                matches &= ~is_v
                
            if f_key == "egg":
                matches &= ~(is_ef & is_cake)
                matches &= ~is_v
                
            if f_key == "vegan":
                matches &= ~is_v
                # For cakes, allow if labeled dairy-free AND egg-free
                matches &= ~(is_df & is_ef & is_cake)
                
            is_forbidden |= matches
        return is_forbidden

    def rank(self, ingredient_names, user_profile):
        """Ranks a specific subset of ingredients for a user."""
        # 1. Get the subset of the dataframe
        subset_df = self.df[self.df['name'].isin(ingredient_names)].copy()
        
        # 2. Identify active filters
        intolerances = user_profile.get("intolerances", [])
        if isinstance(intolerances, str): intolerances = [i.strip() for i in intolerances.split(',')]
        
        diet = user_profile.get("diet", [])
        if isinstance(diet, str): diet = [d.strip() for d in diet.split(',')]
        
        active_filters = [self._normalize_filter_key(i) for i in intolerances] + [self._normalize_filter_key(d) for d in diet]

        # 3. Filter
        is_forbidden = self._get_forbidden_mask(subset_df, active_filters)
        
        filtered_df = subset_df[is_forbidden].copy()
        ranked_candidates = subset_df[~is_forbidden].copy()
        
        if not filtered_df.empty:
            filtered_df['reason'] = "Dietary Restriction"
        else:
            # Create an empty reason column if needed
            filtered_df['reason'] = pd.Series(dtype='str')

        # 4. Score ranked candidates
        user_vector = self._create_user_vector(user_profile)
        feature_cols = self.tag_cols + self.nutrition_cols + self.macro_pct_cols
        
        if not ranked_candidates.empty:
            scores = []
            user_norm = np.linalg.norm(user_vector)
            for val in ranked_candidates[feature_cols].values:
                val_norm = np.linalg.norm(val)
                if user_norm == 0 or val_norm == 0:
                    scores.append(0)
                else:
                    scores.append(1 - cosine(user_vector, val))
            ranked_candidates['score'] = scores
            ranked_candidates = ranked_candidates.sort_values(by='score', ascending=False)
        
        return ranked_candidates[['name', 'score']].to_dict(orient='records'), filtered_df[['name', 'reason']].to_dict(orient='records')

    def recommend(self, user_profile, top_n=10):
        # 1. Get active filters
        intolerances = user_profile.get("intolerances", [])
        if isinstance(intolerances, str): intolerances = [intolerances]
        
        diets = user_profile.get("diet", [])
        if isinstance(diets, str): diets = [diets]
        
        active_filters = [self._normalize_filter_key(i) for i in intolerances] + [self._normalize_filter_key(d) for d in diets]

        # 2. Filter
        is_forbidden = self._get_forbidden_mask(self.df, active_filters)
        candidates = self.df[~is_forbidden].copy()

        # 3. Vector Match
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
