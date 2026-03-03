import collections
import re

class FoodFriendModel:
    def __init__(self):
        # Stage 1: Hard-coded Filtering Criteria (Safety & Diet)
        self.HARD_FILTERS = {
            "dairy": ["milk", "butter", "cream", "cheese", "yogurt", "whey", "casein", "ghee", "lactose", "half-and-half", "kefir", "mascarpone", "ricotta", "custard"],
            "egg": ["albumin", "yolk", "meringue", "mayo", "mayonnaise", "lysozyme", "lecithin"],
            "gluten": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko"],
            "grain": ["rice", "corn", "oats", "quinoa", "millet", "amaranth", "sorghum", "buckwheat"],
            "peanut": ["peanut", "groundnut"],
            "seafood": ["anchovy", "tilapia", "salmon", "tuna", "cod", "bass", "bonito", "worcestershire", "fish sauce"],
            "sesame": ["tahini", "gomasio", "til", "sesame oil", "benne seed"],
            "shellfish": ["shrimp", "prawn", "crab", "lobster", "crawfish", "mussels", "clams", "oysters", "scallops", "krill", "scampi"],
            "soy": ["tofu", "tempeh", "edamame", "miso", "tamari", "shoyu", "natto", "lecithin", "glycine max"],
            "sulfite": ["sulfur dioxide", "sodium bisulfite", "potassium metabisulfite"],
            "tree_nut": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut", "chestnut", "praline", "marzipan", "gianduja"],
            "wheat": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko"],
            
            # Diet Filters
            "gluten_free": ["flour", "breadcrumbs", "semolina", "spelt", "farro", "kamut", "rye", "barley", "malt", "triticale", "couscous", "bulgur", "seitan", "panko", "brewer’s yeast", "graham flour", "udon", "matzo", "orzo"],
            "ketogenic": ["sugar", "honey", "maple syrup", "flour", "bread", "pasta", "rice", "corn", "potatoes", "beans", "lentils", "apples", "bananas", "grapes"],
            "vegetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet"],
            "vegan": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "fish", "shrimp", "shellfish", "gelatin", "lard", "suet", "milk", "butter", "cream", "cheese", "yogurt", "whey", "casein", "ghee", "lactose", "half-and-half", "kefir", "mascarpone", "ricotta", "custard", "albumin", "yolk", "meringue", "mayo", "mayonnaise", "honey"],
            "pescetarian": ["beef", "pork", "chicken", "turkey", "lamb", "venison", "gelatin", "lard", "suet"]
        }
        
        # Scoring Weights (Heuristics)
        self.WEIGHTS = {
            "nutrient_high": 3,
            "nutrient_medium": 1,
            "sensory_match": 2,
            "cuisine_match": 2,
            "interaction_bonus": 5
        }

    def filter_ingredients(self, ingredients, user_profile):
        """Stage 1: Hard-coded Filtering Step."""
        # This is a helper, but rank handles the combined return now
        return self.rank(ingredients, user_profile)[0]

    def calculate_score(self, ingredient, user_profile):
        """Stage 2: Ranking Score."""
        score = 0
        
        # 1. Nutrient Goals
        for goal in user_profile.get("increase_goals", []):
            val = ingredient.get("nutrients", {}).get(goal, "none")
            if val == "high": score += self.WEIGHTS["nutrient_high"]
            elif val == "medium": score += self.WEIGHTS["nutrient_medium"]
            
        for goal in user_profile.get("decrease_goals", []):
            val = ingredient.get("nutrients", {}).get(goal, "none")
            if val == "high": score -= self.WEIGHTS["nutrient_high"]
            elif val == "medium": score -= self.WEIGHTS["nutrient_medium"]

        # 2. Sensory Preferences (Flavor/Texture)
        # Handle case-insensitive comparisons
        user_flavors = [f.lower() for f in user_profile.get("flavors", [])]
        ing_flavors = [f.lower() for f in ingredient.get("flavors", [])]
        for f in user_flavors:
            if f in ing_flavors:
                score += self.WEIGHTS["sensory_match"]
                
        user_text = [t.lower() for t in user_profile.get("texture", [])]
        ing_text = [t.lower() for t in ingredient.get("texture", [])]
        for t in user_text:
            if t in ing_text:
                score += self.WEIGHTS["sensory_match"]

        # 3. Cuisine Preferences
        user_cuis = [c.lower() for c in user_profile.get("cuisines", [])]
        ing_cuis = [c.lower() for c in ingredient.get("cuisines", [])]
        for c in user_cuis:
            if c in ing_cuis:
                score += self.WEIGHTS["cuisine_match"]

        return score

    def rank(self, ingredients, user_profile):
        """Main entry point: returns (ranked_list, filtered_out_list)."""
        forbidden_keywords = set()
        for intolerance in user_profile.get("intolerances", []):
            keywords = self.HARD_FILTERS.get(intolerance.lower(), [])
            forbidden_keywords.update([k.lower() for k in keywords])
            
        diets = user_profile.get("diet", [])
        if isinstance(diets, str): diets = [diets]
        for diet in diets:
            if diet.lower() in self.HARD_FILTERS:
                forbidden_keywords.update([k.lower() for k in self.HARD_FILTERS[diet.lower()]])

        ranked_candidates = []
        filtered_out = []

        for ing in ingredients:
            name_lower = ing["name"].lower()
            # Use regex for whole word matching to avoid over-filtering (e.g., 'butter' in 'Peanut Butter')
            reason = None
            for word in forbidden_keywords:
                pattern = r'\b' + re.escape(word) + r'\b'
                if re.search(pattern, name_lower):
                    reason = word
                    break
            
            if reason:
                filtered_out.append({"name": ing["name"], "reason": reason})
            else:
                score = self.calculate_score(ing, user_profile)
                ranked_candidates.append({
                    "name": ing["name"],
                    "score": score
                })
            
        ranked_candidates.sort(key=lambda x: x["score"], reverse=True)
        return ranked_candidates, filtered_out
