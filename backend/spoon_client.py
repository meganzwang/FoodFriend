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
        
        response = requests.get(find_url, params=params)
        
        # DEBUG: If it's not a 200 OK, print the error and stop
        if response.status_code != 200:
            print(f"Spoonacular Error {response.status_code}: {response.text}")
            return []

        candidate_recipes = response.json()
        
        # Check if we got a dictionary with an error message instead of a list
        if isinstance(candidate_recipes, dict) and candidate_recipes.get("status") == "failure":
            print(f"API Failure: {candidate_recipes.get('message')}")
            return []

        recipe_ids = [str(r['id']) for r in candidate_recipes]
        # ... rest of your code
        
        # Step 1: Find recipes that best match your 5 ingredients
        find_url = f"{self.base_url}/findByIngredients"
        params = {
            "apiKey": self.api_key,
            "ingredients": ",".join(ingredients),
            "number": n,
            "ranking": 1, # Maximize used ingredients
            "ignorePantry": "true"
        }
        
        response = requests.get(find_url, params=params)
        candidate_recipes = response.json()
        
        if not candidate_recipes:
            return []

        # Step 2: Get full details (Diet, Nutrients, etc.) for these IDs
        recipe_ids = [str(r['id']) for r in candidate_recipes]
        bulk_url = f"{self.base_url}/informationBulk"
        bulk_params = {
            "apiKey": self.api_key,
            "ids": ",".join(recipe_ids),
            "includeNutrition": "true"
        }
        
        full_info = requests.get(bulk_url, params=bulk_params)
        return full_info.json()