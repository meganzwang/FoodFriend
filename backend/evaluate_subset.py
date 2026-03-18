import csv
import sys
import os
import pandas as pd
import numpy as np
from scipy.stats import spearmanr

# Ensure the backend directory is in the path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from model import FoodFriendModel

# 1. Define the Ingredient Subset (Exact names from CSV)
target_ingredients = [
    "tofu", "water", "table salt", "baby spinach", "white bread", 
    "almonds", "whole chicken", "lobster", "cheese", "cupcakes"
]

# 2. User Profiles
users = [
    {"id": 1, "intolerances": "tree_nut", "diet": "vegan", "increase_nutrients": ["protein"], "decrease_nutrients": ["sugar"], "liked_flavors": ["savory"], "liked_textures": ["soft"]},
    {"id": 2, "intolerances": "dairy, egg", "diet": "ketogenic", "increase_nutrients": ["fat"], "decrease_nutrients": ["sugar"], "liked_flavors": ["fatty"], "liked_textures": ["juicy"]},
    {"id": 3, "intolerances": "gluten, soy", "diet": "paleo", "increase_nutrients": ["iron"], "decrease_nutrients": ["sodium"], "liked_flavors": ["salty"], "liked_textures": ["chewy"]},
    {"id": 4, "intolerances": "peanut, sesame", "diet": "whole30", "increase_nutrients": ["fiber"], "decrease_nutrients": ["calories"], "liked_flavors": ["neutral"], "liked_textures": ["crunchy"]},
    {"id": 5, "intolerances": "shellfish", "diet": "pescetarian", "increase_nutrients": ["protein"], "decrease_nutrients": ["sat_fat"], "liked_flavors": ["savory"], "liked_textures": ["tender"]},
    {"id": 6, "intolerances": "none", "diet": "low_fodmap", "increase_nutrients": ["fiber"], "decrease_nutrients": ["sugar"], "liked_flavors": ["bitter"], "liked_textures": ["crisp"]},
    {"id": 7, "intolerances": "dairy", "diet": "lacto_vegetarian", "increase_nutrients": ["protein"], "decrease_nutrients": ["fat"], "liked_flavors": ["salty"], "liked_textures": ["creamy"]},
    {"id": 8, "intolerances": "wheat", "diet": "gluten_free", "increase_nutrients": ["calories"], "decrease_nutrients": ["sodium"], "liked_flavors": ["sweet"], "liked_textures": ["fluffy"]},
    {"id": 9, "intolerances": "none", "diet": "primal", "increase_nutrients": ["sat_fat"], "decrease_nutrients": ["sugar"], "liked_flavors": ["fatty"], "liked_textures": ["hard"]},
    {"id": 10, "intolerances": "sulfite", "diet": "ovo_vegetarian", "increase_nutrients": ["iron"], "decrease_nutrients": ["calories"], "liked_flavors": ["sour"], "liked_textures": ["moist"]}
]

# 3. Ground Truth Data
ground_truth = {
    1: {"ranked": ["tofu", "baby spinach", "white bread", "water", "table salt"], "filtered": ["almonds", "whole chicken", "lobster", "cheese", "cupcakes"]},
    2: {"ranked": ["whole chicken", "almonds", "lobster", "tofu", "baby spinach", "water", "table salt"], "filtered": ["white bread", "cupcakes", "cheese"]},
    3: {"ranked": ["whole chicken", "lobster", "almonds", "baby spinach", "water", "table salt"], "filtered": ["tofu", "white bread", "cupcakes", "cheese"]},
    4: {"ranked": ["almonds", "baby spinach", "whole chicken", "lobster", "water", "table salt"], "filtered": ["cupcakes", "white bread", "tofu", "cheese"]},
    5: {"ranked": ["tofu", "cheese", "almonds", "baby spinach", "cupcakes", "white bread", "water", "table salt"], "filtered": ["whole chicken", "lobster"]},
    6: {"ranked": ["almonds", "baby spinach", "tofu", "whole chicken", "lobster", "water", "table salt"], "filtered": ["cupcakes", "white bread", "cheese"]},
    7: {"ranked": ["tofu", "almonds", "baby spinach", "white bread", "water", "table salt"], "filtered": ["whole chicken", "lobster", "cheese", "cupcakes"]},
    8: {"ranked": ["baby spinach", "water", "tofu", "almonds", "whole chicken", "lobster", "cheese", "table salt"], "filtered": ["white bread", "cupcakes"]},
    9: {"ranked": ["almonds", "whole chicken", "cheese", "lobster", "baby spinach", "water", "table salt"], "filtered": ["tofu", "white bread", "cupcakes"]},
    10: {"ranked": ["baby spinach", "almonds", "tofu", "white bread", "cupcakes", "water", "table salt"], "filtered": ["cheese", "whole chicken", "lobster"]}
}

def calculate_metrics(model_ranked, model_filtered, gt_ranked, gt_filtered, all_items):
    # --- Filtering Metrics ---
    # Model's filtered set
    m_f = set([item['name'] for item in model_filtered])
    # GT's filtered set
    gt_f = set(gt_filtered)
    
    # All potential items
    all_set = set(all_items)
    
    # True Positives: correctly filtered
    tp = len(m_f.intersection(gt_f))
    # False Positives: filtered but shouldn't be
    fp = len(m_f - gt_f)
    # False Negatives: not filtered but should be
    fn = len(gt_f - m_f)
    # True Negatives: correctly not filtered
    tn = len((all_set - m_f).intersection(all_set - gt_f))
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    accuracy = (tp + tn) / len(all_set)
    
    # --- Spearman Correlation ---
    # Only calculate for items that are in BOTH ranked lists
    m_ranked_names = [item['name'] for item in model_ranked]
    common_ranked = [item for item in gt_ranked if item in m_ranked_names]
    
    if len(common_ranked) > 1:
        # Get ranks for common items
        gt_ranks = [gt_ranked.index(item) for item in common_ranked]
        model_ranks = [m_ranked_names.index(item) for item in common_ranked]
        corr, _ = spearmanr(gt_ranks, model_ranks)
    else:
        corr = 0.0
        
    return precision, accuracy, corr

def run_evaluation():
    model = FoodFriendModel(csv_name='final_vectorized_ingredients.csv')
    evaluation_report = []

    for user in users:
        # Get Model results
        ranked, filtered = model.rank(target_ingredients, user)
        
        # Get GT
        gt = ground_truth[user['id']]
        
        # Calculate Metrics
        precision, accuracy, spearman = calculate_metrics(ranked, filtered, gt['ranked'], gt['filtered'], target_ingredients)
        
        # Formatting for CSV
        ranking_string = ", ".join([item['name'] for item in ranked])
        filtered_string = ", ".join([item['name'] for item in filtered])
        
        evaluation_report.append({
            "User": user["id"],
            "Intolerances": user["intolerances"],
            "Diet": user["diet"],
            "Model Ranked": ranking_string,
            "Ground Truth Ranked": ", ".join(gt['ranked']),
            "Model Filtered": filtered_string,
            "Ground Truth Filtered": ", ".join(gt['filtered']),
            "Filter Precision": round(precision, 4),
            "Filter Accuracy": round(accuracy, 4),
            "Spearman Correlation": round(spearman, 4)
        })

    # Save to CSV
    if evaluation_report:
        with open("model_evaluation.csv", "w", newline='') as f:
            writer = csv.DictWriter(f, fieldnames=evaluation_report[0].keys())
            writer.writeheader()
            writer.writerows(evaluation_report)

    print("Success: Model evaluation generated in model_evaluation.csv")

if __name__ == "__main__":
    run_evaluation()
