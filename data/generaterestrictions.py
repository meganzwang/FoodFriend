import os
import json
import re
import sys
import pandas as pd
from google import genai
from dotenv import load_dotenv

# Load environment variables from .env file in current directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

# Or try loading from current working directory
if not os.getenv("API_KEY"):
    load_dotenv()

# -----------------------------
# CONFIGURE GEMINI
# -----------------------------
api_key = os.getenv("API_KEY")
if api_key:
    api_key = api_key.strip().strip('"').strip("'")

if not api_key:
    print("❌ Error: API_KEY not found.")
    print("Make sure .env file has: API_KEY=your_key")
    exit(1)

client = genai.Client(api_key=api_key)

# Preferred supported models (API may vary by account; use one that exists in your ListModels output)
PREFERRED_MODELS = [

    "models/gemini-2.5-flash", # USE THIS MODEL

]

# Use a default that is supported in most new accounts
model_name = PREFERRED_MODELS[0]  # fallback value


# -----------------------------
# LABEL SETS (STRICT)
# -----------------------------
ALLERGEN_LABELS = [
    "dairy","egg","gluten","grain","peanut","seafood",
    "sesame","shellfish","soy","sulfite","tree_nut","wheat"
]

DIET_LABELS = [
    "gluten_free","ketogenic","vegetarian","vegan",
    "pescetarian","lacto_vegetarian","ovo_vegetarian",
    "paleo","primal","low_fodmap","whole30"
]

# -----------------------------
# STRONG PROMPT (VERY IMPORTANT)
# -----------------------------
SYSTEM_PROMPT = """
You are an expert food ingredient classifier.

Task: analyze ONE ingredient and return JSON exactly as:
{"allergens": [...], "diet": [...]}

Allergen labels: dairy, egg, gluten, grain, peanut, seafood, sesame, shellfish, soy, sulfite, tree_nut, wheat
Diet labels: gluten_free, ketogenic, vegetarian, vegan, pescetarian, lacto_vegetarian, ovo_vegetarian, paleo, primal, low_fodmap, whole30

Rules:
- Use only these label values.
- Always include allergens that are present; do not leave them empty.
- Milk, cheese, cream, butter, yogurt, and other dairy products must have "dairy" in allergens.
- Eggs must have "egg" in allergens.
- Nuts must have their corresponding allergen.
- Only omit a label if it clearly does NOT apply.
- Output raw JSON only, nothing else.

Examples:
Ingredient: milk
{"allergens": ["dairy"], "diet": []}

Ingredient: chocolate milk
{"allergens": ["dairy"], "diet": []}

Ingredient: almond milk
{"allergens": ["tree_nut"], "diet": ["vegan","vegetarian"]}
"""
# -----------------------------
# SAFE JSON PARSER
# -----------------------------
def safe_json_parse(text):
    """
    Safely extract the first JSON object from AI output, even if truncated
    or has extra text around it. Falls back to empty lists.
    """
    text = re.sub(r"```json|```", "", text).strip()

    # Extract first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {"allergens": [], "diet": []}
# -----------------------------
# AI CALL
# -----------------------------
def parse_response_text(response):
    if getattr(response, 'output_text', None):
        return response.output_text

    if getattr(response, 'candidates', None):
        if len(response.candidates) > 0:
            candidate = response.candidates[0]
            if getattr(candidate, 'content', None):
                content = candidate.content
                if getattr(content, 'parts', None) and len(content.parts) > 0:
                    return ''.join([p.text for p in content.parts if getattr(p, 'text', None)])

    return None
def call_ai(ingredient):
    try:
        prompt = f"{SYSTEM_PROMPT}\n\nIngredient: {ingredient}\nAnswer:"
        response = client.models.generate_content(
            model=PREFERRED_MODELS[0],
            contents=prompt,
            config={"temperature": 0, "max_output_tokens": 1024}
        )

        text = parse_response_text(response)
        print(f"\n🟢 Extracted text for '{ingredient}':\n{text}")

        # Fix truncated JSON
        text = text.strip()
        if text.endswith(':'):
            text += ' []}'
        elif text.endswith(','):
            text += ' []}'
        elif text.count('{') > text.count('}'):
            text += '}'

        return safe_json_parse(text)

    except Exception as e:
        print(f"Error on {ingredient}: {e}")
        return {"allergens": [], "diet": []}
# -----------------------------
# CACHE (VERY IMPORTANT)
# -----------------------------
cache = {}

# -----------------------------
# CLEAN OUTPUT (ENFORCE LABELS)
# -----------------------------
def clean_labels(output):
    allergens = [a for a in output.get("allergens", []) if a in ALLERGEN_LABELS]
    diet = [d for d in output.get("diet", []) if d in DIET_LABELS]

    return {
        "allergens": sorted(list(set(allergens))),
        "diet": sorted(list(set(diet)))
    }

def process_ingredient(ingredient):
    if ingredient in cache:
        return cache[ingredient]

    ai_output = call_ai(ingredient)
    cleaned = clean_labels(ai_output)

    result = pd.Series({
        "allergens": ",".join(cleaned["allergens"]),
        "diet": ",".join(cleaned["diet"])
    })

    cache[ingredient] = result
    return result

# -----------------------------
# MAIN
# -----------------------------
def test_ingredient(ingredient_name):
    """Test a single ingredient to see its labels"""
    print(f"\n🧪 Testing: {ingredient_name}")
    print("-" * 60)
    
    result = process_ingredient(ingredient_name)
    allergens = result["allergens"] if result["allergens"] else "none"
    diet = result["diet"] if result["diet"] else "none"
    
    print(f"Allergens: {allergens}")
    print(f"Diet:      {diet}")
    print("-" * 60)

import pickle
from concurrent.futures import ThreadPoolExecutor, as_completed

CACHE_FILE = "ingredient_cache.pkl"
MAX_WORKERS = 5  # Number of parallel threads (tune based on your API quota)

# -----------------------------
# Load persistent cache
# -----------------------------
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "rb") as f:
        cache = pickle.load(f)
else:
    cache = {}

# -----------------------------
# Thread-safe ingredient processor
# -----------------------------
def process_ingredient_threadsafe(ingredient):
    """Process ingredient using cache, thread-safe for parallel execution"""
    if ingredient in cache:
        return ingredient, cache[ingredient]

    ai_output = call_ai(ingredient)
    cleaned = clean_labels(ai_output)

    result = pd.Series({
        "allergens": ",".join(cleaned["allergens"]),
        "diet": ",".join(cleaned["diet"])
    })

    cache[ingredient] = result
    return ingredient, result

# -----------------------------
# Main function
# -----------------------------
def main():
    # Load cleaned restricted ingredients CSV
    df = pd.read_csv("data/restricted_ingredients_clean.csv")
    print(f"📋 Processing {len(df)} ingredients from restricted_ingredients_clean.csv...\n")

    allergens_list = []
    diet_list = []

    # Use ThreadPoolExecutor to process multiple ingredients in parallel
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Submit all tasks
        futures = {executor.submit(process_ingredient_threadsafe, ing): ing for ing in df["name"]}

        for idx, future in enumerate(as_completed(futures), 1):
            ingredient = futures[future]
            try:
                ing_name, result = future.result()
            except Exception as e:
                print(f"❌ Error processing {ingredient}: {e}")
                result = pd.Series({"allergens": "", "diet": ""})

            allergens_list.append(result["allergens"])
            diet_list.append(result["diet"])

            # Show progress
            print(f"[{idx}/{len(df)}] {ingredient:30} | Allergens: {result['allergens'] or 'none':20} | Diet: {result['diet'] or 'none'}")

    # Append results to DataFrame
    df["allergens"] = allergens_list
    df["diet"] = diet_list

    # Save labeled CSV with new name
    df.to_csv("data/final_restricted_ingredients_clean.csv", index=False)
    print(f"\n✅ Done! Labeled {len(df)} ingredients and saved to final_restricted_ingredients_clean.csv.")

    # Save cache for future runs
    with open(CACHE_FILE, "wb") as f:
        pickle.dump(cache, f)
    print(f"💾 Cache saved to {CACHE_FILE}")

# -----------------------------
# Entry point
# -----------------------------
if __name__ == "__main__":
    main()
