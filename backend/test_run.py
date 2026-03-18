try:
    from backend.updated_model import FoodFriendModel
except ModuleNotFoundError:
    from updated_model import FoodFriendModel

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