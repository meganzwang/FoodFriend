import requests

class SpoonacularClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.spoonacular.com/recipes"

    def get_recipes_by_model_ingredients(self, ingredients, n=20):
        find_url = f"{self.base_url}/findByIngredients"
        params = {
            "apiKey": self.api_key,
            "ingredients": ",".join(ingredients),
            "number": n,
            "ranking": 1,
            "ignorePantry": "true"
        }
        
        response = requests.get(find_url, params=params, timeout=20)
        if response.status_code != 200:
            print(f"Spoonacular Error {response.status_code}: {response.text}")
            return []

        candidate_recipes = response.json()
        if isinstance(candidate_recipes, dict) and candidate_recipes.get("status") == "failure":
            print(f"API Failure: {candidate_recipes.get('message')}")
            return []
        
        if not isinstance(candidate_recipes, list) or not candidate_recipes:
            return []

        recipe_ids = [str(r['id']) for r in candidate_recipes]
        bulk_url = f"{self.base_url}/informationBulk"
        bulk_params = {
            "apiKey": self.api_key,
            "ids": ",".join(recipe_ids),
            "includeNutrition": "true"
        }
        
        full_info = requests.get(bulk_url, params=bulk_params, timeout=20)
        if full_info.status_code != 200:
            print(f"Spoonacular Bulk Error {full_info.status_code}: {full_info.text}")
            return []

        bulk_recipes = full_info.json()
        return bulk_recipes if isinstance(bulk_recipes, list) else []