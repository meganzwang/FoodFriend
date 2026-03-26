import os
from dotenv import load_dotenv
from spoon_client import SpoonacularClient

load_dotenv()
api_key = os.getenv("SPOONACULAR_API_KEY")

if not api_key:
    raise ValueError("API Key not found! Make sure it is in your .env file.")

# Initialize your client with the safe key
spoon = SpoonacularClient(api_key=api_key)

try:
    from backend.model import FoodFriendModel
except ModuleNotFoundError:
    from model import FoodFriendModel

# Initialize using a CSV that exists in data/
model = FoodFriendModel(csv_name='final_vectorized_ingredients.csv')

user_input = {
    "diet": ["vegetarian"],
    "intolerances": [],
    "liked_flavors": ["savory"],
    "disliked_flavors": ["sweet"],
    "liked_textures": ["crunchy"],
    "disliked_textures": ["soft"],
    "increase_nutrients": ["protein_amount_g"],
    "decrease_nutrients": ["sodium_amount_mg"]
}

print("Searching for the perfect match...")
results = model.recommend(user_input, top_n=5)

for i, res in enumerate(results, 1):
    print(f"{i}. {res['name']} (Match: {res['score']:.2%})")

ingredient_names = [res['name'] for res in results]

print(f"Feeding ingredients to Spoonacular: {', '.join(ingredient_names)}")

# Fetch 20 recipes based on those 5 ingredients
recipes = spoon.get_recipes_by_model_ingredients(ingredient_names, n=20)

print(f"\nFound {len(recipes)} recipes matching your AI model's suggestions:")
for i, recipe in enumerate(recipes, 1):
    # This is where you can check your diet/intolerance logic
    diet_str = " | ".join(recipe.get('diets', []))
    calories = next((n['amount'] for n in recipe['nutrition']['nutrients'] if n['name'] == 'Calories'), 'N/A')
    
    print(f"{i}. {recipe['title']}")
    print(f"   Diets: {diet_str}")
    print(f"   Calories: {calories}kcal | Ready in: {recipe['readyInMinutes']} mins")
    print(f"   Link: {recipe['sourceUrl']}\n")