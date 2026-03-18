// src/config/smart-config.ts
export const smartConfig = {
  // Replace with your actual Client ID from your SMART on FHIR app registration
  clientId: "your-client-id",

  // Your app's redirect URI. This must be registered with your EHR's SMART on FHIR client.
  // For Expo, this is typically `exp://your-expo-project-id.expo.dev` or a custom scheme.
  // *** IMPORTANT: When running Expo Go, get your actual development URL (e.g., from terminal output)
  // *** it often looks like `exp://your-local-ip:19000` or `exp://your-username.yourprojectname.exp.direct:80`.
  // *** Make sure this EXACT URL is registered as a redirect URI with your EHR's SMART on FHIR client.
  redirectUri: "exp://192.168.1.XX:19000", // <<< Placeholder - YOU MUST UPDATE THIS!

  // The FHIR server's Issuer URL (e.g., Epic's Sandbox URL).
  // This identifies the FHIR server you're connecting to.
  iss: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4", // Example Epic Sandbox

  // The scopes your app needs. For lab results (Observations),
  // `patient/Observation.read` is essential. `patient/Patient.read` for patient demographics.
  // `launch/patient` is for launching from within the EHR.
  scope: "patient/Observation.read patient/Patient.read launch/patient openid fhirUser profile",

  // Other optional configuration parameters for FHIR client
  // serviceUri: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4", // Same as iss for Epic
};