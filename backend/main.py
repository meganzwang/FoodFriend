# backend/main.py
import csv
import os
import json
import re
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from model import FoodFriendModel
from datetime import datetime

app = FastAPI()
model = FoodFriendModel()

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "ingredients_final.csv")
AGGREGATE_CSV = os.path.join(os.path.dirname(__file__), "..", "user_testing_aggregate.csv")

# Initialize CSV with headers if it doesn't exist
if not os.path.isfile(AGGREGATE_CSV):
    with open(AGGREGATE_CSV, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Timestamp", "Intolerances", "Diet", "Inc Goals", "Dec Goals", "Flavors", "Texture", "Ranked Result", "Filtered Out"])

# Exact names from ingredients_final.csv for the 10 test items
TARGET_INGREDIENTS = {
    "Chicken Breast": "bone in chicken breast",
    "Peanut Butter": "crunchy peanut butter",
    "Banana": "banana",
    "Celery": "celery",
    "Salmon": "salmon",
    "Milk": "1 percent milk",
    "Almond": "almonds",
    "Broccoli": "broccoli",
    "Tofu": "tofu",
    "Shrimp": "shrimp"
}

def load_experimental_subset():
    subset = []
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: CSV not found at {CSV_PATH}")
        return []

    targets_lower = {v.lower() for v in TARGET_INGREDIENTS.values()}
    found_targets = set()

    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name_lower = row['name'].lower().strip()
            if name_lower in targets_lower:
                found_targets.add(name_lower)
                
                def safe_float(val):
                    try: 
                        if not val or val.strip() == "": return 0.0
                        return float(val)
                    except: return 0.0

                ingredient = {
                    "name": row['name'].title(),
                    "flavors": [f.strip().lower() for f in row.get('flavor', '').split(';') if f],
                    "texture": [t.strip().lower() for t in row.get('texture', '').split(';') if t],
                    "nutrients": {
                        "protein": "high" if safe_float(row.get('protein_amount')) > 15 else "medium" if safe_float(row.get('protein_amount')) > 5 else "low",
                        "fat": "high" if safe_float(row.get('fat_amount')) > 10 else "medium" if safe_float(row.get('fat_amount')) > 3 else "low",
                        "calories": "high" if safe_float(row.get('calories_amount')) > 200 else "medium" if safe_float(row.get('calories_amount')) > 50 else "low",
                        "sugar": "high" if safe_float(row.get('sugar_amount')) > 10 else "low",
                        "sodium": "high" if safe_float(row.get('sodium_amount')) > 400 else "low",
                        "fiber": "high" if safe_float(row.get('fiber_amount')) > 4 else "low",
                        "iron": "high" if safe_float(row.get('iron_amount')) > 2 else "low",
                    },
                    "cuisines": [] 
                }
                subset.append(ingredient)
    
    return subset

@app.get("/")
async def read_root():
    return {"message": "Food Friend Backend API"}

@app.post("/api/rank-ingredients")
async def rank_ingredients(request: Request):
    try:
        user_profile = await request.json()
        print(f"DEBUG: Ranking for profile: {user_profile}")
        
        ingredients = load_experimental_subset()
        ranked, filtered = model.rank(ingredients, user_profile)
        
        # --- LOG TO AGGREGATE CSV ---
        with open(AGGREGATE_CSV, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ", ".join(user_profile.get("intolerances", [])),
                user_profile.get("diet", ""),
                ", ".join(user_profile.get("increase_goals", [])),
                ", ".join(user_profile.get("decrease_goals", [])),
                ", ".join(user_profile.get("flavors", [])),
                ", ".join(user_profile.get("texture", [])),
                " > ".join([f"{i['name']} ({i['score']})" for i in ranked]),
                ", ".join([f"{i['name']} ({i['reason']})" for i in filtered])
            ])
        # ----------------------------

        return {"ranked": ranked, "filtered": filtered}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR in rank_ingredients: {str(e)}")
        return {"error": str(e)}

@app.post("/api/save-preferences")
async def save_preferences(request: Request):
    payload = await request.json()
    print(f"Received preferences: {payload}")
    return {"status": "success", "message": "Preferences saved to server"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
