# backend/main.py
import csv
import os
import json
import re
import socket
import sqlite3
import uuid
import numpy as np
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model import FoodFriendModel
from spoon_client import SpoonacularClient
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

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
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "foodfriend.db")

# ─── SQLite setup ─────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            preferences TEXT NOT NULL DEFAULT '{}'
        )
    """)
    conn.commit()
    conn.close()
    print(f"SQLite DB ready at {DB_PATH}")

init_db()

# ─── Analytics CSV (kept for aggregate research logging) ─────────────────────

if not os.path.isfile(AGGREGATE_CSV):
    with open(AGGREGATE_CSV, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "Timestamp", "UserID", "Name",
            "Intolerances", "Diet", "Inc Goals", "Dec Goals",
            "Liked Flavors", "Disliked Flavors",
            "Liked Texture", "Disliked Texture",
            "Ranked Result", "Filtered Out",
        ])

# ─── Ingredient constants ─────────────────────────────────────────────────────

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
    "Shrimp": "shrimp",
}

MAX_TOP_INGREDIENTS = 5

# ─── Helpers ──────────────────────────────────────────────────────────────────

def normalize_profile_for_model(user_profile):
    normalized = dict(user_profile or {})
    if "increase_nutrients" not in normalized:
        normalized["increase_nutrients"] = normalized.get("increase_goals", [])
    if "decrease_nutrients" not in normalized:
        normalized["decrease_nutrients"] = normalized.get("decrease_goals", [])
    return normalized


def load_experimental_subset():
    subset = []
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: CSV not found at {CSV_PATH}")
        return []

    targets_lower = {v.lower() for v in TARGET_INGREDIENTS.values()}

    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name_lower = row['name'].lower().strip()
            if name_lower in targets_lower:
                def safe_float(val):
                    try:
                        if not val or val.strip() == "":
                            return 0.0
                        return float(val)
                    except:
                        return 0.0

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
                    "cuisines": [],
                }
                subset.append(ingredient)

    return subset


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/")
async def read_root():
    return {"status": "online", "message": "Food Friend Backend API"}

@app.get("/api/ping")
async def ping():
    return {"status": "pong", "timestamp": datetime.now().isoformat()}


# ─── User management ──────────────────────────────────────────────────────────

@app.post("/api/users")
async def create_user(request: Request):
    """
    Register a new tester. Supply { "name": "Alice" }.
    Returns a short 8-character ID they can use to log back in.
    """
    body = await request.json()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # Readable ID: up to 4 letters of name + 2 random digits, e.g. ALEX-42
    import random
    name_part = re.sub(r"[^A-Z]", "", name.upper())[:4] or "USER"
    conn_check = get_db()
    for _ in range(20):
        user_id = f"{name_part}-{random.randint(10, 99)}"
        if not conn_check.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone():
            break
    conn_check.close()

    now = datetime.now().isoformat()

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (id, name, created_at, updated_at, preferences) VALUES (?, ?, ?, ?, ?)",
            (user_id, name, now, now, "{}"),
        )
        conn.commit()
    finally:
        conn.close()

    return {"user_id": user_id, "name": name, "created_at": now}


@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    """
    Load a returning user's profile by their ID.
    """
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id.upper(),)
        ).fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found. Check your ID and try again.")

    return {
        "user_id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "preferences": json.loads(row["preferences"]),
    }


@app.put("/api/users/{user_id}/preferences")
async def update_user_preferences(user_id: str, request: Request):
    """
    Save the full preferences object for a user.
    """
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id FROM users WHERE id = ?", (user_id.upper(),)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        payload = await request.json()
        payload.pop("user_id", None)  # don't store the ID inside the blob

        conn.execute(
            "UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?",
            (json.dumps(payload), datetime.now().isoformat(), user_id.upper()),
        )
        conn.commit()
    finally:
        conn.close()

    return {"status": "success", "user_id": user_id.upper()}


# ─── Legacy save-preferences (backward compat + local-only saves) ─────────────

@app.post("/api/save-preferences")
async def save_preferences(request: Request):
    try:
        payload = await request.json()
        user_id = (payload.get("user_id") or "").upper()

        if user_id:
            conn = get_db()
            try:
                row = conn.execute(
                    "SELECT id FROM users WHERE id = ?", (user_id,)
                ).fetchone()
                if row:
                    prefs = {k: v for k, v in payload.items() if k != "user_id"}
                    conn.execute(
                        "UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?",
                        (json.dumps(prefs), datetime.now().isoformat(), user_id),
                    )
                    conn.commit()
            finally:
                conn.close()

        return {"status": "success", "message": "Preferences saved"}
    except Exception as e:
        print(f"ERROR in save_preferences: {e}")
        return {"error": str(e)}


# ─── Rank ingredients ─────────────────────────────────────────────────────────

@app.post("/api/rank-ingredients")
async def rank_ingredients(request: Request):
    try:
        user_profile = await request.json()
        normalized_profile = normalize_profile_for_model(user_profile)
        ranked = model.recommend(normalized_profile, top_n=MAX_TOP_INGREDIENTS)
        filtered = []

        with open(AGGREGATE_CSV, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                user_profile.get("user_id", ""),
                user_profile.get("name", ""),
                ", ".join(user_profile.get("intolerances", [])),
                ", ".join(user_profile.get("diet", [])),
                ", ".join(user_profile.get("increase_goals", [])),
                ", ".join(user_profile.get("decrease_goals", [])),
                ", ".join(user_profile.get("liked_flavors", []) or user_profile.get("flavors", [])),
                ", ".join(user_profile.get("disliked_flavors", [])),
                ", ".join(user_profile.get("liked_textures", []) or user_profile.get("texture", [])),
                ", ".join(user_profile.get("disliked_textures", [])),
                " > ".join([f"{i['name']} ({i['score']})" for i in ranked]),
                ", ".join([f"{i['name']} ({i['reason']})" for i in filtered]),
            ])

        return {"ranked": ranked, "filtered": filtered}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


# ─── Recommend recipes ────────────────────────────────────────────────────────

@app.post("/api/recommend-recipes")
async def recommend_recipes(request: Request):
    try:
        user_profile = await request.json()

        api_key = os.getenv("SPOONACULAR_API_KEY")
        if not api_key:
            return {"error": "SPOONACULAR_API_KEY is missing in backend environment."}

        normalized_profile = normalize_profile_for_model(user_profile)
        tried_recipe_ids = {
            str(recipe_id)
            for recipe_id in (user_profile.get("tried_recipe_ids") or [])
            if recipe_id is not None
        }
        top_ranked = model.recommend(normalized_profile, top_n=MAX_TOP_INGREDIENTS)
        filtered = []
        top_ingredient_names = [item.get('name') for item in top_ranked if item.get('name')]

        if not top_ingredient_names:
            return {"top_ingredients": [], "ranked": top_ranked, "filtered": filtered, "recipes": []}

        spoon = SpoonacularClient(api_key=api_key)
        spoon_recipes = spoon.get_recipes_by_model_ingredients(top_ingredient_names, n=60)

        recipes = []
        for recipe in spoon_recipes:
            recipe_id = recipe.get("id")
            if recipe_id is not None and str(recipe_id) in tried_recipe_ids:
                continue

            nutrients = recipe.get('nutrition', {}).get('nutrients', [])
            calories = next(
                (n.get('amount') for n in nutrients if str(n.get('name', '')).lower() == 'calories'),
                None,
            )
            ingredients = [
                ing.get('name', '').lower().strip()
                for ing in recipe.get('extendedIngredients', [])
                if ing.get('name', '').strip()
            ]
            recipes.append({
                "id": recipe_id,
                "title": recipe.get("title", "Untitled Recipe"),
                "image": recipe.get("image", ""),
                "sourceUrl": recipe.get("sourceUrl", ""),
                "readyInMinutes": recipe.get("readyInMinutes"),
                "diets": recipe.get("diets", []),
                "calories": calories,
                "summary": recipe.get("summary", ""),
                "ingredients": ingredients,
            })

            if len(recipes) >= 20:
                break

        return {
            "top_ingredients": top_ingredient_names,
            "ranked": top_ranked,
            "filtered": filtered,
            "recipes": recipes,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


# ─── Process Recipe Feedback ──────────────────────────────────────────────────

@app.post("/api/process-recipe-feedback")
async def process_recipe_feedback(request: Request):
    """
    Process explicit recipe feedback and intelligently update user preferences.
    
    Expected payload:
    {
      "user_id": "USER-ID",
      "recipe_id": 12345,
      "recipe_title": "Chicken Stir Fry",
      "feedback_type": "liked" or "disliked",
      "recipe_ingredients": ["chicken breast", "broccoli", "soy sauce"],
      "selected_ingredients": ["chicken breast"],
      "selected_flavors": ["spicy", "umami"],
      "selected_textures": ["crispy"]
    }
    """
    try:
        body = await request.json()
        user_id = (body.get("user_id") or "").upper()
        
        if not user_id:
            return {"error": "user_id is required"}
        
        # Fetch current user preferences
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT preferences FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            if not row:
                return {"error": "User not found"}
            
            current_prefs = json.loads(row["preferences"] or "{}")
        finally:
            conn.close()
        
        # Calculate the weighted feedback update
        feedback_data = {
            "feedback_type": body.get("feedback_type", "liked"),
            "recipe_ingredients": body.get("recipe_ingredients", []),
            "selected_ingredients": body.get("selected_ingredients", []),
            "selected_flavors": body.get("selected_flavors", []),
            "selected_textures": body.get("selected_textures", []),
        }
        
        update_vector = model.calculate_feedback_vector_update(feedback_data)
        
        # Store the update vector as a running aggregate for intelligent preference refinement
        if "feedback_vector_sum" not in current_prefs:
            current_prefs["feedback_vector_sum"] = update_vector.tolist()
        else:
            # Accumulate feedback vectors with slight decay (0.95 factor) so recent feedback matters more
            existing_vec = np.array(current_prefs["feedback_vector_sum"], dtype=np.float64)
            existing_vec *= 0.95  # Slight decay of past feedback influence
            current_prefs["feedback_vector_sum"] = (existing_vec + update_vector).tolist()
        
        # Keep the feedback-vector path as the sole signal to avoid double counting.
        feedback_type = body.get("feedback_type", "liked")
        
        # Save updated preferences to database
        conn = get_db()
        try:
            conn.execute(
                "UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?",
                (json.dumps(current_prefs), datetime.now().isoformat(), user_id),
            )
            conn.commit()
        finally:
            conn.close()
        
        return {
            "status": "success",
            "user_id": user_id,
            "feedback_type": feedback_type,
            "explicit_selections": {
                "ingredients": len(body.get("selected_ingredients", [])),
                "flavors": len(body.get("selected_flavors", [])),
                "textures": len(body.get("selected_textures", [])),
            },
            "message": "Recipe feedback processed and preference vector updated"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


# ─── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    def get_ip():
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            IP = s.getsockname()[0]
        except Exception:
            IP = '127.0.0.1'
        finally:
            s.close()
        return IP

    local_ip = get_ip()
    print("\n" + "!" * 60)
    print(f"!!! BACKEND IS RUNNING !!!")
    print(f"!!! YOUR MAC IP IS: {local_ip}")
    print(f"!!! YOUR API_URL SHOULD BE: http://{local_ip}:3001")
    print("!" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=3001)