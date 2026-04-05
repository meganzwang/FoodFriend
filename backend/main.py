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


def diversify_recipes_by_ingredient_overlap(recipes, top_n=20, penalty_weight=0.35):
    """Return recipes reordered to favor diversity over ingredient overlap."""
    if not recipes:
        return []

    normalized_recipes = []
    for idx, recipe in enumerate(recipes):
        ingredients = {
            ing.strip().lower()
            for ing in (recipe.get("ingredients") or [])
            if isinstance(ing, str) and ing.strip()
        }
        normalized_recipes.append(
            {
                **recipe,
                "_ingredient_set": ingredients,
                "_base_score": float(len(recipes) - idx),
            }
        )

    selected = []
    selected_ingredient_union = set()
    remaining = normalized_recipes.copy()

    while remaining and len(selected) < top_n:
        best = None
        best_score = float("-inf")

        for recipe in remaining:
            ingredients = recipe["_ingredient_set"]
            overlap = 0.0
            if ingredients and selected_ingredient_union:
                overlap = len(ingredients & selected_ingredient_union) / float(
                    len(ingredients)
                )
            score = recipe["_base_score"] * (1.0 - penalty_weight * overlap)
            if score > best_score:
                best_score = score
                best = recipe

        if best is None:
            break

        selected.append(best)
        selected_ingredient_union.update(best["_ingredient_set"])
        remaining.remove(best)

    return [
        {
            k: v
            for k, v in recipe.items()
            if k not in ("_ingredient_set", "_base_score")
        }
        for recipe in selected
    ]


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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recommendation_runs (
            run_id            TEXT PRIMARY KEY,
            user_id           TEXT,
            created_at        TEXT NOT NULL,
            input_profile     TEXT NOT NULL DEFAULT '{}',
            top_ingredients   TEXT NOT NULL DEFAULT '[]'
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recommended_recipes (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id            TEXT NOT NULL,
            user_id           TEXT,
            recipe_id         TEXT NOT NULL,
            rank_position     INTEGER NOT NULL,
            title             TEXT NOT NULL,
            image             TEXT,
            source_url        TEXT,
            ready_in_minutes  INTEGER,
            calories          REAL,
            diets_json        TEXT NOT NULL DEFAULT '[]',
            ingredients_json  TEXT NOT NULL DEFAULT '[]',
            was_selected      INTEGER NOT NULL DEFAULT 0,
            selected_at       TEXT,
            feedback_type     TEXT,
            feedback_at       TEXT,
            FOREIGN KEY(run_id) REFERENCES recommendation_runs(run_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recipe_feedback_events (
            id                        INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id                    TEXT NOT NULL,
            user_id                   TEXT NOT NULL,
            recipe_id                 TEXT NOT NULL,
            recipe_title              TEXT,
            feedback_type             TEXT NOT NULL,
            recipe_ingredients_json   TEXT NOT NULL DEFAULT '[]',
            selected_ingredients_json TEXT NOT NULL DEFAULT '[]',
            selected_flavors_json     TEXT NOT NULL DEFAULT '[]',
            selected_textures_json    TEXT NOT NULL DEFAULT '[]',
            created_at                TEXT NOT NULL,
            FOREIGN KEY(run_id) REFERENCES recommendation_runs(run_id)
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_reco_runs_user_created ON recommendation_runs(user_id, created_at DESC)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_reco_recipes_run ON recommended_recipes(run_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_reco_recipes_user ON recommended_recipes(user_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON recipe_feedback_events(user_id, created_at DESC)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_feedback_run ON recipe_feedback_events(run_id)"
    )
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
        user_id = (user_profile.get("user_id") or "").upper() or None

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
            def nutrient_amount(name):
                return next(
                    (n.get('amount') for n in nutrients if str(n.get('name', '')).lower() == name),
                    None,
                )

            calories = nutrient_amount('calories')
            protein = nutrient_amount('protein')
            fat = nutrient_amount('fat')
            sodium = nutrient_amount('sodium')
            fiber = nutrient_amount('fiber')
            sugar = nutrient_amount('sugar')
            saturated_fat = nutrient_amount('saturated fat')
            iron = nutrient_amount('iron')

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
                "protein": protein,
                "fat": fat,
                "sodium": sodium,
                "fiber": fiber,
                "sugar": sugar,
                "saturated_fat": saturated_fat,
                "iron": iron,
                "summary": recipe.get("summary", ""),
                "ingredients": ingredients,
            })

            if len(recipes) >= 20:
                break

        recipes = diversify_recipes_by_ingredient_overlap(
            recipes,
            top_n=20,
            penalty_weight=0.35,
        )

        recommendation_run_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        conn = get_db()
        try:
            conn.execute(
                """
                INSERT INTO recommendation_runs (run_id, user_id, created_at, input_profile, top_ingredients)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    recommendation_run_id,
                    user_id,
                    now,
                    json.dumps(user_profile),
                    json.dumps(top_ingredient_names),
                ),
            )

            for idx, recipe in enumerate(recipes, start=1):
                conn.execute(
                    """
                    INSERT INTO recommended_recipes (
                        run_id, user_id, recipe_id, rank_position, title, image, source_url,
                        ready_in_minutes, calories, diets_json, ingredients_json
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        recommendation_run_id,
                        user_id,
                        str(recipe.get("id")),
                        idx,
                        recipe.get("title", "Untitled Recipe"),
                        recipe.get("image", ""),
                        recipe.get("sourceUrl", ""),
                        recipe.get("readyInMinutes"),
                        recipe.get("calories"),
                        json.dumps(recipe.get("diets", []) or []),
                        json.dumps(recipe.get("ingredients", []) or []),
                    ),
                )

            conn.commit()
        finally:
            conn.close()

        return {
            "recommendation_run_id": recommendation_run_id,
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


@app.post("/api/recommendation-runs/{run_id}/selected-recipes")
async def mark_selected_recipes(run_id: str, request: Request):
    """
    Mark which recipes from a recommendation run were selected.
    """
    try:
        body = await request.json()
        user_id = (body.get("user_id") or "").upper() or None
        selected_recipe_ids = [
            str(recipe_id)
            for recipe_id in (body.get("selected_recipe_ids") or [])
            if recipe_id is not None
        ]

        conn = get_db()
        try:
            run = conn.execute(
                "SELECT run_id, user_id FROM recommendation_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            if not run:
                raise HTTPException(status_code=404, detail="Recommendation run not found")

            if user_id and run["user_id"] and user_id != run["user_id"]:
                raise HTTPException(status_code=403, detail="Run does not belong to this user")

            conn.execute(
                "UPDATE recommended_recipes SET was_selected = 0, selected_at = NULL WHERE run_id = ?",
                (run_id,),
            )

            now = datetime.now().isoformat()
            for recipe_id in selected_recipe_ids:
                conn.execute(
                    """
                    UPDATE recommended_recipes
                    SET was_selected = 1, selected_at = ?
                    WHERE run_id = ? AND recipe_id = ?
                    """,
                    (now, run_id, recipe_id),
                )

            conn.commit()
        finally:
            conn.close()

        return {
            "status": "success",
            "run_id": run_id,
            "selected_count": len(selected_recipe_ids),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


@app.post("/api/log-recipe-feedback")
async def log_recipe_feedback(request: Request):
    """
    Persist per-recipe liked/disliked feedback for a recommendation run.
    """
    try:
        body = await request.json()
        run_id = (body.get("run_id") or "").strip()
        user_id = (body.get("user_id") or "").upper()
        feedback_entries = body.get("feedback") or []

        if not run_id:
            raise HTTPException(status_code=400, detail="run_id is required")
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        conn = get_db()
        try:
            run = conn.execute(
                "SELECT run_id, user_id FROM recommendation_runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
            if not run:
                raise HTTPException(status_code=404, detail="Recommendation run not found")
            if run["user_id"] and run["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Run does not belong to this user")

            now = datetime.now().isoformat()
            inserted = 0
            for entry in feedback_entries:
                recipe_id = entry.get("recipe_id")
                feedback_type = str(entry.get("feedback_type") or "").lower().strip()
                if recipe_id is None or feedback_type not in {"liked", "disliked"}:
                    continue

                recipe_id_str = str(recipe_id)

                conn.execute(
                    """
                    INSERT INTO recipe_feedback_events (
                        run_id, user_id, recipe_id, recipe_title, feedback_type,
                        recipe_ingredients_json, selected_ingredients_json,
                        selected_flavors_json, selected_textures_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        user_id,
                        recipe_id_str,
                        entry.get("recipe_title", ""),
                        feedback_type,
                        json.dumps(entry.get("recipe_ingredients", []) or []),
                        json.dumps(entry.get("selected_ingredients", []) or []),
                        json.dumps(entry.get("selected_flavors", []) or []),
                        json.dumps(entry.get("selected_textures", []) or []),
                        now,
                    ),
                )

                conn.execute(
                    """
                    UPDATE recommended_recipes
                    SET feedback_type = ?, feedback_at = ?
                    WHERE run_id = ? AND recipe_id = ?
                    """,
                    (feedback_type, now, run_id, recipe_id_str),
                )
                inserted += 1

            conn.commit()
        finally:
            conn.close()

        return {
            "status": "success",
            "run_id": run_id,
            "logged_feedback_count": inserted,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


@app.get("/api/admin/users/{user_id}/recipe-history")
async def get_user_recipe_history(user_id: str, include_details: bool = False):
    """
    Author-only data endpoint: returns a compact per-recipe status view.
    Set include_details=true for the full run-by-run payload.
    """
    normalized_user_id = user_id.upper()
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT id, name, created_at, updated_at FROM users WHERE id = ?",
            (normalized_user_id,),
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        run_rows = conn.execute(
            """
            SELECT run_id, created_at, top_ingredients
            FROM recommendation_runs
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (normalized_user_id,),
        ).fetchall()

        preferences_row = conn.execute(
            "SELECT preferences FROM users WHERE id = ?",
            (normalized_user_id,),
        ).fetchone()
        preferences = json.loads(preferences_row["preferences"] or "{}") if preferences_row else {}

        tried_recipe_ids = {
            str(recipe_id)
            for recipe_id in (preferences.get("tried_recipe_ids") or [])
            if recipe_id is not None
        }
        tried_recipes = preferences.get("tried_recipes") or []
        tried_recipe_feedback = {
            str(recipe.get("id")): str(recipe.get("feedbackType") or "").lower()
            for recipe in tried_recipes
            if isinstance(recipe, dict) and recipe.get("id") is not None
        }

        recipe_status_map = {}
        recipe_title_lookup = {}
        recipe_seen_at = {}

        for run in run_rows:
            recipe_rows = conn.execute(
                """
                SELECT recipe_id, rank_position, title, image, source_url, ready_in_minutes,
                       calories, diets_json, ingredients_json, was_selected, selected_at,
                       feedback_type, feedback_at
                FROM recommended_recipes
                WHERE run_id = ?
                ORDER BY rank_position ASC
                """,
                (run["run_id"],),
            ).fetchall()

            for row in recipe_rows:
                recipe_id = str(row["recipe_id"])
                title = row["title"]

                recipe_title_lookup.setdefault(recipe_id, title)
                recipe_seen_at[recipe_id] = min(
                    recipe_seen_at.get(recipe_id, row["selected_at"] or run["created_at"]),
                    row["selected_at"] or run["created_at"],
                ) if recipe_id in recipe_seen_at else (row["selected_at"] or run["created_at"])

                status_set = recipe_status_map.setdefault(recipe_id, set())
                status_set.add("recommended")

                if row["was_selected"]:
                    status_set.add("selected")
                if row["feedback_type"] == "liked":
                    status_set.add("liked")
                    status_set.add("selected")
                elif row["feedback_type"] == "disliked":
                    status_set.add("disliked")
                    status_set.add("selected")

                if recipe_id in tried_recipe_ids:
                    status_set.add("selected")

                feedback_from_preferences = tried_recipe_feedback.get(recipe_id)
                if feedback_from_preferences == "liked":
                    status_set.add("liked")
                    status_set.add("selected")
                elif feedback_from_preferences == "disliked":
                    status_set.add("disliked")
                    status_set.add("selected")

        feedback_rows = conn.execute(
            """
            SELECT recipe_id, recipe_title, feedback_type, created_at
            FROM recipe_feedback_events
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (normalized_user_id,),
        ).fetchall()

        for feedback in feedback_rows:
            recipe_id = str(feedback["recipe_id"])
            title = feedback["recipe_title"] or recipe_title_lookup.get(recipe_id) or recipe_id
            recipe_title_lookup.setdefault(recipe_id, title)
            status_set = recipe_status_map.setdefault(recipe_id, set())
            status_set.add("selected")
            status_set.add(str(feedback["feedback_type"]).lower())

        compact_recipes = []
        for recipe_id, statuses in recipe_status_map.items():
            compact_recipes.append(
                {
                    "recipe_id": recipe_id,
                    "recipe_name": recipe_title_lookup.get(recipe_id, recipe_id),
                    "statuses": sorted(statuses),
                    "first_seen_at": recipe_seen_at.get(recipe_id),
                }
            )

        compact_recipes.sort(key=lambda item: (item["recipe_name"].lower(), item["recipe_id"]))

        summary = {
            "recipes": len(compact_recipes),
            "recommended": sum(1 for recipe in compact_recipes if "recommended" in recipe["statuses"]),
            "selected": sum(1 for recipe in compact_recipes if "selected" in recipe["statuses"]),
            "liked": sum(1 for recipe in compact_recipes if "liked" in recipe["statuses"]),
            "disliked": sum(1 for recipe in compact_recipes if "disliked" in recipe["statuses"]),
        }

        response = {
            "user": {
                "id": user["id"],
                "name": user["name"],
                "created_at": user["created_at"],
                "updated_at": user["updated_at"],
            },
            "summary": summary,
            "recipes": compact_recipes,
        }

        if include_details:
            runs = []
            for run in run_rows:
                recipe_rows = conn.execute(
                    """
                    SELECT recipe_id, rank_position, title, image, source_url, ready_in_minutes,
                           calories, diets_json, ingredients_json, was_selected, selected_at,
                           feedback_type, feedback_at
                    FROM recommended_recipes
                    WHERE run_id = ?
                    ORDER BY rank_position ASC
                    """,
                    (run["run_id"],),
                ).fetchall()

                runs.append(
                    {
                        "run_id": run["run_id"],
                        "created_at": run["created_at"],
                        "top_ingredients": json.loads(run["top_ingredients"] or "[]"),
                        "recommended_recipes": [
                            {
                                "recipe_id": row["recipe_id"],
                                "rank_position": row["rank_position"],
                                "title": row["title"],
                                "image": row["image"],
                                "source_url": row["source_url"],
                                "ready_in_minutes": row["ready_in_minutes"],
                                "calories": row["calories"],
                                "diets": json.loads(row["diets_json"] or "[]"),
                                "ingredients": json.loads(row["ingredients_json"] or "[]"),
                                "was_selected": bool(row["was_selected"]),
                                "selected_at": row["selected_at"],
                                "feedback_type": row["feedback_type"],
                                "feedback_at": row["feedback_at"],
                            }
                            for row in recipe_rows
                        ],
                    }
                )

            response["runs"] = runs

        return response
    finally:
        conn.close()


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