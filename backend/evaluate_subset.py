import csv
import sys
import os
import pandas as pd
import numpy as np
from scipy.stats import spearmanr
import re
from scipy.spatial.distance import cosine

# Ensure the backend directory is in the path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from model import FoodFriendModel

RESTRICTED_INGREDIENTS_CSV = os.path.join(
    os.path.dirname(__file__), "..", "data", "restricted_ingredients_clean.csv"
)


def _normalize_token(model, value):
    token = str(value or "").strip().lower().replace("-", "_")
    token = re.sub(r"\s+", "_", token)
    return model._normalize_filter_key(token)


def _normalize_ingredient_name(value):
    normalized = str(value or "").strip().lower()
    return re.sub(r"\s+", " ", normalized)


def _parse_csv_labels(model, value):
    if value is None:
        return set()
    labels = set()
    for part in str(value).split(","):
        cleaned = _normalize_token(model, part)
        if cleaned:
            labels.add(cleaned)
    return labels


def _load_restriction_rows(model, csv_path):
    rows_by_name = {}
    if not os.path.exists(csv_path):
        return rows_by_name

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = _normalize_ingredient_name(row.get("name"))
            if not name:
                continue

            allergens = _parse_csv_labels(model, row.get("allergens"))
            diets = _parse_csv_labels(model, row.get("diet"))

            existing = rows_by_name.get(name)
            if existing is None:
                rows_by_name[name] = {
                    "allergens": set(allergens),
                    "diets": set(diets),
                }
            else:
                existing["allergens"].update(allergens)
                existing["diets"].update(diets)

    return rows_by_name


def _lookup_restriction_row(rows_by_name, ingredient_name):
    normalized = _normalize_ingredient_name(ingredient_name)
    if not normalized:
        return None

    exact = rows_by_name.get(normalized)
    if exact is not None:
        return exact

    for known_name, data in rows_by_name.items():
        if normalized in known_name or known_name in normalized:
            return data

    return None


def _keyword_violation(model, ingredient_name, active_keys):
    lowered_name = _normalize_ingredient_name(ingredient_name)
    for key in active_keys:
        keywords = model.HARD_FILTERS.get(key, [])
        if not keywords:
            continue
        pattern = re.compile(
            r"\\b(?:" + "|".join(map(re.escape, keywords)) + r")",
            re.IGNORECASE,
        )
        if re.search(pattern, lowered_name):
            return key
    return None


def _active_restrictions(model, user_profile):
    intolerances = user_profile.get("intolerances", []) or []
    diets = user_profile.get("diet", []) or []

    if isinstance(intolerances, str):
        intolerances = [part.strip() for part in intolerances.split(",") if part.strip()]
    if isinstance(diets, str):
        diets = [part.strip() for part in diets.split(",") if part.strip()]

    normalized_intolerances = [_normalize_token(model, value) for value in intolerances]
    normalized_diets = [_normalize_token(model, value) for value in diets]

    return normalized_intolerances, normalized_diets


def _check_ingredient_restrictions(model, rows_by_name, ingredient_name, active_intolerances, active_diets):
    data = _lookup_restriction_row(rows_by_name, ingredient_name)

    if data is not None:
        allergens = data["allergens"]
        diets = data["diets"]

        violating_allergens = [key for key in active_intolerances if key in allergens]
        if violating_allergens:
            return False, f"allergen conflict: {', '.join(violating_allergens)}"

        missing_diets = [key for key in active_diets if key not in diets]
        if missing_diets:
            return False, f"not marked safe for diet: {', '.join(missing_diets)}"

        return True, None

    allergen_hit = _keyword_violation(model, ingredient_name, active_intolerances)
    if allergen_hit:
        return False, f"keyword allergen conflict: {allergen_hit}"

    diet_hit = _keyword_violation(model, ingredient_name, active_diets)
    if diet_hit:
        return False, f"keyword diet conflict: {diet_hit}"

    return True, None


def rank_targets_with_csv_restrictions(model, restriction_rows, user_profile, ingredient_names):
    subset_df = model.df[model.df['name'].isin(ingredient_names)].copy()
    user_vector = model._create_user_vector(user_profile)
    user_norm = np.linalg.norm(user_vector)

    scored = []
    for _, row in subset_df.iterrows():
        item_vector = row[model.feature_cols].to_numpy(dtype=np.float64)
        item_norm = np.linalg.norm(item_vector)
        if user_norm == 0 or item_norm == 0:
            score = 0.0
        else:
            score = 1 - cosine(user_vector, item_vector)
        scored.append({"name": row['name'], "score": score})

    scored.sort(key=lambda item: item["score"], reverse=True)

    active_intolerances, active_diets = _active_restrictions(model, user_profile)
    accepted = []
    rejected = []

    for ingredient in scored:
        ingredient_name = ingredient.get("name")
        is_allowed, reason = _check_ingredient_restrictions(
            model,
            restriction_rows,
            ingredient_name,
            active_intolerances,
            active_diets,
        )
        if is_allowed:
            accepted.append(ingredient)
        else:
            rejected.append({"name": ingredient_name, "reason": reason})

    present_names = {item["name"] for item in scored}
    for target in ingredient_names:
        if target not in present_names:
            rejected.append({"name": target, "reason": "missing from vectorized dataset"})

    ranked_with_filtered_at_end = accepted + [
        {"name": item["name"], "score": -999.0} for item in rejected
    ]

    return ranked_with_filtered_at_end, rejected

# 1. Define the Ingredient Subset (Exact names from CSV)
target_ingredients = [
    "tofu", "water", "table salt", "baby spinach", "white bread", 
    "almonds", "whole chicken", "lobster", "cheese", "cupcakes"
]

# 2. User Profiles
users = [
    {"id": 1, "intolerances": "tree_nut", "diet": "vegan", "increase_nutrients": ["protein"], "decrease_nutrients": ["sugar"], "liked_flavors": ["savory"], "liked_textures": ["soft"], "preferred_foods": [], "disliked_foods": []},
    {"id": 2, "intolerances": "dairy, egg", "diet": "ketogenic", "increase_nutrients": ["fat"], "decrease_nutrients": ["sugar"], "liked_flavors": ["fatty"], "liked_textures": ["juicy"], "preferred_foods": [], "disliked_foods": []},
    {"id": 3, "intolerances": "gluten, soy", "diet": "paleo", "increase_nutrients": ["iron"], "decrease_nutrients": ["sodium"], "liked_flavors": ["salty"], "liked_textures": ["chewy"], "preferred_foods": ["whole turkey"], "disliked_foods": []},
    {"id": 4, "intolerances": "peanut, sesame", "diet": "whole30", "increase_nutrients": ["fiber"], "decrease_nutrients": ["calories"], "liked_flavors": ["neutral"], "liked_textures": ["crunchy"], "preferred_foods": ["lettuce"], "disliked_foods": []},
    {"id": 5, "intolerances": "shellfish", "diet": "pescetarian", "increase_nutrients": ["protein"], "decrease_nutrients": ["sat_fat"], "liked_flavors": ["savory", "fatty", "salty"], "liked_textures": ["tender", "soft"], "preferred_foods": [], "disliked_foods": []},
    {"id": 6, "intolerances": "none", "diet": "low_fodmap", "increase_nutrients": ["fiber"], "decrease_nutrients": ["sugar"], "liked_flavors": ["bitter"], "liked_textures": ["crisp"], "preferred_foods": [], "disliked_foods": []},
    {"id": 7, "intolerances": "dairy", "diet": "lacto_vegetarian", "increase_nutrients": ["protein"], "decrease_nutrients": ["fat", "sodium"], "liked_flavors": ["salty"], "liked_textures": ["creamy", "soft"], "preferred_foods": ["peanuts"], "disliked_foods": []},
    {"id": 8, "intolerances": "wheat", "diet": "gluten_free", "increase_nutrients": ["calories"], "decrease_nutrients": ["sodium"], "liked_flavors": ["sweet"], "liked_textures": ["fluffy"], "preferred_foods": [], "disliked_foods": []},
    {"id": 9, "intolerances": "none", "diet": "primal", "increase_nutrients": ["sat_fat"], "decrease_nutrients": ["sugar"], "liked_flavors": ["fatty"], "liked_textures": ["hard"], "preferred_foods": ["whole turkey"], "disliked_foods": []},
    {"id": 10, "intolerances": "sulfite", "diet": "ovo_vegetarian", "increase_nutrients": ["iron"], "decrease_nutrients": ["calories"], "liked_flavors": ["sour"], "liked_textures": ["moist"], "preferred_foods": [], "disliked_foods": []}
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
    8: {"ranked": ["tofu", "whole chicken", "lobster", "almonds", "baby spinach", "cheese", "water", "table salt"], "filtered": ["white bread", "cupcakes"]},
    9: {"ranked": ["almonds", "whole chicken", "cheese", "lobster", "baby spinach", "water", "table salt"], "filtered": ["tofu", "white bread", "cupcakes"]},
    10: {"ranked": ["baby spinach", "tofu", "white bread", "cupcakes", "almonds", "water", "table salt"], "filtered": ["cheese", "whole chicken", "lobster"]}
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
    restriction_rows = _load_restriction_rows(model, RESTRICTED_INGREDIENTS_CSV)
    evaluation_report = []

    for user in users:
        ranked, filtered = rank_targets_with_csv_restrictions(
            model,
            restriction_rows,
            user,
            target_ingredients,
        )
        
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
            "Preferred Foods": ", ".join(user.get("preferred_foods", []) or []),
            "Disliked Foods": ", ".join(user.get("disliked_foods", []) or []),
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
        with open("new_model_evaluation.csv", "w", newline='') as f:
            writer = csv.DictWriter(f, fieldnames=evaluation_report[0].keys())
            writer.writeheader()
            writer.writerows(evaluation_report)

    print("Success: Model evaluation generated in new_model_evaluation.csv")

if __name__ == "__main__":
    run_evaluation()
