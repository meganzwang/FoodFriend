# backend/main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import requests # For making requests to the FHIR server (simulated here)

app = FastAPI()

# Allow CORS for communication with React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust this in production to specific origins (e.g., your Expo app URL)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"message": "Food Friend Backend API"}

@app.post("/api/fetch-fhir-data")
async def fetch_fhir_data(request: Request):
    """
    Acts as a proxy to fetch FHIR data from an EHR server.
    In a real scenario, this would use the accessToken to authenticate
    and make requests to the FHIR server (fhirBaseUrl).
    For this bare-bones setup, it will return mock data.
    """
    payload = await request.json()
    access_token = payload.get("accessToken")
    patient_id = payload.get("patientId")
    fhir_base_url = payload.get("fhirBaseUrl")

    if not all([access_token, patient_id, fhir_base_url]):
        raise HTTPException(status_code=400, detail="Missing accessToken, patientId, or fhirBaseUrl")

    # --- In a real implementation, you would: ---
    # 1. Validate the access_token.
    # 2. Construct FHIR API calls using the fhir_base_url and patient_id.
    # 3. Add necessary headers (e.g., Authorization: Bearer <access_token>).
    # 4. Make requests to the actual FHIR server for Observations, Patient demographics, etc.
    #    Example: requests.get(f"{fhir_base_url}/Patient/{patient_id}/Observation", headers={"Authorization": f"Bearer {access_token}"})
    # --- For now, return mock data ---

    mock_patient_data = {
        "resourceType": "Patient",
        "id": patient_id,
        "name": [{"family": "Doe", "given": ["John"]}],
        "birthDate": "1990-05-15",
    }

    mock_observations_data = {
        "resourceType": "Bundle",
        "type": "searchset",
        "entry": [
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": "obs1",
                    "status": "final",
                    "code": {"coding": [{"system": "http://loinc.org", "code": "718-7", "display": "Hemoglobin"}]},
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "valueQuantity": {"value": 14.2, "unit": "g/dL"},
                    "effectiveDateTime": "2023-01-01T10:00:00Z"
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": "obs2",
                    "status": "final",
                    "code": {"coding": [{"system": "http://loinc.org", "code": "2093-3", "display": "Cholesterol"}]},
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "valueQuantity": {"value": 180, "unit": "mg/dL"},
                    "effectiveDateTime": "2023-01-01T10:00:00Z"
                }
            },
            # Add more mock observations relevant to nutrition deficiencies
            {
                "resource": {
                    "resourceType": "Observation",
                    "id": "obs3",
                    "status": "final",
                    "code": {"coding": [{"system": "http://loinc.org", "code": "6057-8", "display": "Vitamin D 25-hydroxy"}]},
                    "subject": {"reference": f"Patient/{patient_id}"},
                    "valueQuantity": {"value": 25, "unit": "ng/mL"}, # Example of a low vitamin D level
                    "effectiveDateTime": "2023-01-01T10:00:00Z"
                }
            },
        ]
    }

    # Simulate delay
    # import asyncio
    # await asyncio.sleep(1)

    return {
        "patient": mock_patient_data,
        "fhirData": {
            "allergies": [], # Placeholder for allergies
            "conditions": [], # Placeholder for conditions
            "medications": [], # Placeholder for medications
            "observations": mock_observations_data["entry"] # Return actual observation entries
        }
    }

@app.get("/api/recommendations")
async def get_recommendations():
    """
    Returns mock food and recipe recommendations.
    This is where your AI model will eventually be integrated.
    """
    mock_recipes: List[Dict[str, Any]] = [
        {
            "id": "101",
            "title": "Creamy Avocado Pasta",
            "image": "https://images.unsplash.com/photo-1621996384218-1c4b78f4a3e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjVlMzF8MHwxfGFsbHwxfHx8fHx8fHwxNjQyNjk5MjQy&ixlib=rb-1.2.1&q=80&w=400",
            "description": "A smooth, rich pasta dish, excellent for introducing healthy fats and a creamy texture. Good for sensory aversions.",
            "nutrients": {"Vitamin D": "High", "Iron": "Medium"},
            "sensory_attributes": {"texture": "creamy", "taste": "mild"},
            "source": "Spoonacular (mock)"
        },
        {
            "id": "102",
            "title": "Crispy Chicken Tenders with Sweet Potato Mash",
            "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjVlMzF8MHwxfGFsbHwxfHx8fHx8fHwxNjQyNjk5MjQy&ixlib=rb-1.2.1&q=80&w=400",
            "description": "Familiar crunchy texture combined with a soft, sweet mash. Addresses energy density and provides iron.",
            "nutrients": {"Iron": "High", "Vitamin C": "Medium"},
            "sensory_attributes": {"texture": "crispy, soft", "taste": "sweet, savory"},
            "source": "Spoonacular (mock)"
        },
        {
            "id": "103",
            "title": "Berry Spinach Smoothie",
            "image": "https://images.unsplash.com/photo-1550989460-0adf9ea62260?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjVlMzF8MHwxfGFsbHwxfHx8fHx8fHwxNjQyNjk5MjQy&ixlib=rb-1.2.1&q=80&w=400",
            "description": "Easy to consume liquid form for nutrient boost. Good for meeting nutritional goals when solid food is challenging.",
            "nutrients": {"Folate": "High", "Vitamin K": "High"},
            "sensory_attributes": {"texture": "smooth", "taste": "sweet"},
            "source": "Spoonacular (mock)"
        },
    ]
    return mock_recipes

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
