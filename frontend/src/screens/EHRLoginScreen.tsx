// FoodFriend/src/screens/EHRLoginScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import FHIR from "fhirclient";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { smartConfig } from "../config/smart-config";
import { RootStackParamList } from "../../types";
import { CONFIG } from "../config";

type EHRLoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EHRLogin"
>;
type EHRLoginScreenRouteProp = RouteProp<RootStackParamList, "EHRLogin">;

interface EHRLoginScreenProps {
  navigation: EHRLoginScreenNavigationProp;
  route: EHRLoginScreenRouteProp;
}

// Ensure WebBrowser is dismissed
WebBrowser.maybeCompleteAuthSession();

const EHRLoginScreen: React.FC<EHRLoginScreenProps> = ({ navigation }) => {
  const [status, setStatus] = useState("Ready to connect to FHIR server.");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addDebug = (msg: string) => {
    console.log("[EHRLoginScreen]", msg);
    setDebugInfo((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${msg}`,
    ]);
  };

  const startAuthorization = async (launchToken?: string) => {
    addDebug("Starting OAuth authorization flow...");
    setIsLoading(true);
    setError(null);

    // Dynamic redirectUri for Expo Go development
    const redirectUri = AuthSession.makeRedirectUri();
    addDebug(`Using Redirect URI: ${redirectUri}`);

    // Update smartConfig with dynamic redirectUri
    const currentSmartConfig = { ...smartConfig, redirectUri };

    const authorizeParams: AuthSession.AuthRequestConfig = {
      clientId: currentSmartConfig.clientId,
      redirectUri: currentSmartConfig.redirectUri,
      responseType: "code",
      scopes: currentSmartConfig.scope.split(" "),
      extraParams: {
        aud: currentSmartConfig.iss,
        ...(launchToken && { launch: launchToken }),
      },
    };

    addDebug("=== AUTHORIZATION PARAMETERS ===");
    addDebug(`Client ID: ${authorizeParams.clientId}`);
    addDebug(`Redirect URI: ${authorizeParams.redirectUri}`);
    if (authorizeParams.scopes) {
      addDebug(`Scopes: ${authorizeParams.scopes.join(" ")}`);
    }
    addDebug(`Issuer (aud): ${authorizeParams.extraParams?.aud}`);
    addDebug(`Launch Token: ${launchToken || "NONE"}`);
    addDebug("================================");

    setStatus("Redirecting to Epic for authentication...");

    try {
      const authResult = await (AuthSession as any).startAsync(authorizeParams);

      if (authResult.type === "success") {
        addDebug("OAuth success! Handling callback...");
        setStatus("Finalizing authentication...");
        const { code, state } = authResult.params;

        const dummyAccessToken = "YOUR_DUMMY_ACCESS_TOKEN_AFTER_EXCHANGE";
        const dummyPatientId = "example-patient-id";
        const fhirBaseUrl = currentSmartConfig.iss;

        addDebug(`Calling backend proxy to fetch FHIR data...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          CONFIG.TIMEOUT_MS,
        );

        const proxyResponse = await fetch(
          `${CONFIG.API_URL}/api/fetch-fhir-data`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: dummyAccessToken,
              patientId: dummyPatientId,
              fhirBaseUrl: fhirBaseUrl,
            }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json();
          throw new Error(
            `Proxy failed: ${errorData.details || proxyResponse.statusText}`,
          );
        }

        const proxyData = await proxyResponse.json();
        const patientName = proxyData.patient?.name?.[0]
          ? `${proxyData.patient.name[0].given?.[0] || ""} ${proxyData.patient.name[0].family || ""}`.trim()
          : "Patient";

        const patientData = {
          patientId: dummyPatientId,
          name: patientName,
          accessToken: dummyAccessToken,
          fhirData: {
            allergies: proxyData.fhirData?.allergies || [],
            conditions: proxyData.fhirData?.conditions || [],
            medications: proxyData.fhirData?.medications || [],
            observations: proxyData.fhirData?.observations || [],
          },
        };

        await AsyncStorage.setItem("patientData", JSON.stringify(patientData));
        addDebug(`Stored patient data for: ${patientName}`);

        setStatus("FHIR data fetched and stored. Navigating to Goals.");
        Alert.alert("Success", `Connected to EHR. Welcome, ${patientName}!`);
        navigation.navigate("MainApp", {
          screen: "Goals",
        });
      } else if (authResult.type === "cancel") {
        addDebug("OAuth cancelled by user.");
        setStatus("Authentication cancelled.");
        setIsLoading(false);
        Alert.alert("Cancelled", "EHR connection cancelled by user.");
      } else {
        throw new Error(`OAuth failed with type: ${authResult.type}`);
      }
    } catch (err: any) {
      console.error("SMART launch error:", err);
      addDebug(`ERROR: ${err.message}`);
      setError(err.message);
      setStatus("Error connecting to FHIR server");
      setIsLoading(false);
      Alert.alert("Error", `Failed to connect to EHR: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    addDebug("Skipping EHR connection.");
    Alert.alert("Skipped", "You can connect your EHR later in your profile.");
    navigation.navigate("MainApp", {
      screen: "Goals",
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to your EHR</Text>
      <Text style={styles.subtitle}>
        Allow Food Friend to securely access your lab results and medical
        history for personalized recommendations.
      </Text>

      <Button
        title={
          isLoading ? "Connecting..." : "Connect with Epic (SMART on FHIR)"
        }
        onPress={() => startAuthorization()}
        disabled={isLoading}
      />

      <View style={{ marginVertical: 10 }} />

      <Button
        title="Skip for now"
        onPress={handleSkip}
        disabled={isLoading}
        color="#888"
      />

      {error && <Text style={styles.errorText}>Error: {error}</Text>}

      {isLoading && (
        <ActivityIndicator
          size="large"
          color="#0000ff"
          style={{ marginTop: 20 }}
        />
      )}

      <ScrollView style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Debug Log:</Text>
        {debugInfo.map((line, idx) => (
          <Text key={idx} style={styles.debugLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#eee",
    borderRadius: 8,
    maxHeight: 200,
    width: "100%",
  },
  debugTitle: {
    fontWeight: "bold",
    marginBottom: 5,
  },
  debugLine: {
    fontSize: 12,
  },
  errorText: {
    color: "red",
    marginTop: 20,
    textAlign: "center",
  },
});

export default EHRLoginScreen;
