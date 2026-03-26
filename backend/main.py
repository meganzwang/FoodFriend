# backend/main.py
import csv
import os
import json
import re
import socket
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

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "final_vectorized_ingredients.csv")
AGGREGATE_CSV = os.path.join(os.path.dirname(__file__), "..", "user_testing_aggregate.csv")
USER_PROFILES_CSV = os.path.join(os.path.dirname(__file__), "..", "user_profiles.csv")

# Initialize CSVs with headers if they don't exist
if not os.path.isfile(AGGREGATE_CSV):
    with open(AGGREGATE_CSV, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Timestamp", "Intolerances", "Diet", "Inc Goals", "Dec Goals", "Liked Flavors", "Disliked Flavors", "Liked Texture", "Disliked Texture", "Ranked Result", "Filtered Out"])

if not os.path.isfile(USER_PROFILES_CSV):
    with open(USER_PROFILES_CSV, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Timestamp", "Name", "Intolerances", "Diet", "Inc Goals", "Dec Goals", "Liked Flavors", "Disliked Flavors", "Liked Textures", "Disliked Textures", "Preferred Foods", "Disliked Foods"])

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
    return {"status": "online", "message": "Food Friend Backend API"}

@app.get("/api/ping")
async def ping():
    return {"status": "pong", "timestamp": datetime.now().isoformat()}

@app.post("/api/rank-ingredients")
async def rank_ingredients(request: Request):
    try:
        user_profile = await request.json()
        print(f"DEBUG: Ranking for profile: {user_profile}")
        
        ingredients = load_experimental_subset()
        # Ensure we pass the raw lowercase names to the model for matching
        ingredient_names = [i['name'].lower() for i in ingredients]
        ranked, filtered = model.rank(ingredient_names, user_profile)
        
        # --- LOG TO AGGREGATE CSV ---
        with open(AGGREGATE_CSV, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                ", ".join(user_profile.get("intolerances", [])),
                ", ".join(user_profile.get("diet", [])),
                ", ".join(user_profile.get("increase_goals", [])),
                ", ".join(user_profile.get("decrease_goals", [])),
                ", ".join(user_profile.get("liked_flavors", []) or user_profile.get("flavors", [])),
                ", ".join(user_profile.get("disliked_flavors", [])),
                ", ".join(user_profile.get("liked_textures", []) or user_profile.get("texture", [])),
                ", ".join(user_profile.get("disliked_textures", [])),
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
    try:
        payload = await request.json()
        print(f"Received preferences: {payload}")
        
        # Log to user_profiles.csv
        with open(USER_PROFILES_CSV, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                payload.get("name", "Unknown"),
                ", ".join(payload.get("intolerances", [])),
                ", ".join(payload.get("diet", [])),
                ", ".join(payload.get("increase_goals", [])),
                ", ".join(payload.get("decrease_goals", [])),
                ", ".join(payload.get("liked_flavors", []) or payload.get("flavors", [])),
                ", ".join(payload.get("disliked_flavors", [])),
                ", ".join(payload.get("liked_textures", []) or payload.get("texture", [])),
                ", ".join(payload.get("disliked_textures", [])),
                ", ".join(payload.get("preferred_foods", [])),
                ", ".join(payload.get("disliked_foods", []))
            ])
            
        return {"status": "success", "message": "Preferences saved to server"}
    except Exception as e:
        print(f"ERROR in save_preferences: {str(e)}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    # More reliable way to get local IP on Mac/Linux
    def get_ip():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # doesn't even have to be reachable
            s.connect(('10.255.255.255', 1))
            IP = s.getsockname()[0]
        except Exception:
            IP = '127.0.0.1'
        finally:
            s.close()
        return IP
    
    local_ip = get_ip()
    print("\n" + "!"*60)
    print(f"!!! BACKEND IS RUNNING !!!")
    print(f"!!! YOUR MAC IP IS: {local_ip}")
    print(f"!!! YOUR API_URL SHOULD BE: http://{local_ip}:3001")
    print(f"!!! Try opening http://{local_ip}:3001 on your PHONE browser")
    print("!"*60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=3001)
