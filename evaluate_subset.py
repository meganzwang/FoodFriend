import csv
import sys
import os

# Ensure the backend directory is in the path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from model import FoodFriendModel

# 1. Define the Ingredient Subset with attributes
ingredients = [
    {"name": "Chicken Breast", "protein": "high", "fat": "low", "calories": "low", "sugar": "none", "iron": "low", "fiber": "none", "flavors": ["savory", "neutral"], "texture": ["tender"], "cuisines": ["American", "Asian"]},
    {"name": "Peanut Butter", "protein": "high", "fat": "high", "calories": "high", "sugar": "low", "iron": "low", "fiber": "medium", "flavors": ["savory", "sweet"], "texture": ["creamy", "crunchy"], "cuisines": ["American"]},
    {"name": "Banana", "protein": "low", "fat": "none", "calories": "medium", "sugar": "high", "iron": "none", "fiber": "medium", "flavors": ["sweet"], "texture": ["soft"], "cuisines": ["Caribbean"]},
    {"name": "Celery", "protein": "none", "fat": "none", "calories": "low", "sugar": "low", "iron": "none", "fiber": "low", "flavors": ["mild", "neutral"], "texture": ["crunchy"], "cuisines": ["American", "French"]},
    {"name": "Salmon", "protein": "high", "fat": "high", "calories": "medium", "sugar": "none", "iron": "medium", "fiber": "none", "flavors": ["savory", "fatty"], "texture": ["tender", "flaky"], "cuisines": ["Nordic", "Japanese"]},
    {"name": "Milk", "protein": "medium", "fat": "medium", "calories": "medium", "sugar": "medium", "iron": "none", "fiber": "none", "flavors": ["sweet", "neutral"], "texture": ["liquid", "smooth"], "cuisines": ["European"]},
    {"name": "Almond", "protein": "medium", "fat": "high", "calories": "high", "sugar": "low", "iron": "medium", "fiber": "high", "flavors": ["mild"], "texture": ["crunchy"], "cuisines": ["Mediterranean"]},
    {"name": "Broccoli", "protein": "low", "fat": "none", "calories": "low", "sugar": "low", "iron": "medium", "fiber": "high", "flavors": ["savory", "bitter", "neutral"], "texture": ["crunchy"], "cuisines": ["Asian", "Italian"]},
    {"name": "Tofu", "protein": "high", "fat": "medium", "calories": "medium", "sugar": "none", "iron": "high", "fiber": "low", "flavors": ["mild", "neutral"], "texture": ["soft"], "cuisines": ["Asian"]},
    {"name": "Shrimp", "protein": "high", "fat": "low", "calories": "low", "sugar": "none", "iron": "medium", "fiber": "none", "flavors": ["savory"], "texture": ["tender", "chewy"], "cuisines": ["Asian", "Mexican"]}
]

# 2. User Profiles
users = [
    {"id": "User 1", "desc": "Nut-Free Vegan", "intolerances": ["peanut", "tree_nut"], "diet": "vegan", "increase_goals": ["protein", "fiber"], "decrease_goals": ["sodium"], "flavors": ["sweet"], "texture": ["crunchy"], "cuisines": ["Asian"]},
    {"id": "User 2", "desc": "Dairy-Free Vegetarian", "intolerances": ["dairy"], "diet": "vegetarian", "increase_goals": ["protein", "iron"], "decrease_goals": ["fat"], "flavors": ["savory"], "texture": ["tender"], "cuisines": ["Mediterranean"]},
    {"id": "User 3", "desc": "Seafood-Free Omnivore", "intolerances": ["seafood", "shellfish"], "diet": "none", "increase_goals": ["protein", "iron"], "decrease_goals": ["calories"], "flavors": ["spicy"], "texture": ["chewy"], "cuisines": ["Mexican"]},
    {"id": "User 4", "desc": "Keto Meat-Lover", "intolerances": [], "diet": "ketogenic", "increase_goals": ["fat", "protein"], "decrease_goals": ["sugar"], "flavors": ["savory"], "texture": ["crispy"], "cuisines": ["American"]}
]

def run_evaluation():
    model = FoodFriendModel()
    evaluation_report = []

    for user in users:
        # Run the model! Returns (ranked, filtered)
        ranked, filtered = model.rank(ingredients, user)
        
        # Format strings for CSV
        ranking_string = " > ".join([f"{item['name']} ({item['score']})" for item in ranked])
        filtered_string = ", ".join([f"{item['name']} (Reason: {item['reason']})" for item in filtered])
        
        evaluation_report.append({
            "User": user["id"],
            "Profile": user["desc"],
            "Intolerances": ", ".join(user["intolerances"]) if user["intolerances"] else "None",
            "Diet": user["diet"],
            "Inc Goals": ", ".join(user["increase_goals"]),
            "Dec Goals": ", ".join(user["decrease_goals"]),
            "Ranked Ingredients (Score)": ranking_string,
            "Filtered Out": filtered_string
        })

    # Save to CSV
    if evaluation_report:
        with open("model_evaluation.csv", "w", newline='') as f:
            writer = csv.DictWriter(f, fieldnames=evaluation_report[0].keys())
            writer.writeheader()
            writer.writerows(evaluation_report)

    print("Success: Model rankings generated in model_evaluation.csv")

if __name__ == "__main__":
    run_evaluation()
