// src/config/smart-config.example.ts
// This is an example configuration file.
// Copy this file to `smart-config.ts` (which is gitignored) and fill in your actual values.

export const smartConfig = {
  // Replace with your actual Client ID from your SMART on FHIR app registration
  clientId: "YOUR_CLIENT_ID_HERE",

  // Your app's redirect URI. This must be registered with your EHR's SMART on FHIR client.
  // For Expo, this is typically `exp://your-expo-project-id.expo.dev` or a custom scheme.
  // When running Expo Go, get your actual development URL (e.g., from terminal output).
  redirectUri: "exp://192.168.1.XX:19000", // <<< Placeholder - YOU MUST UPDATE THIS!

  // The FHIR server's Issuer URL (e.g., Epic's Sandbox URL).
  // This identifies the FHIR server you're connecting to.
  iss: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4", // Example Epic Sandbox

  // The scopes your app needs.
  scope: "patient/Observation.read patient/Patient.read launch/patient openid fhirUser profile",

  // Other optional configuration parameters for FHIR client
  // serviceUri: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4", // Same as iss for Epic
};
