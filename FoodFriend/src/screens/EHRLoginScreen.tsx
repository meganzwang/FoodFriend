// FoodFriend/src/screens/EHRLoginScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import FHIR from 'fhirclient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { smartConfig } from '../config/smart-config';
import { RootStackParamList } from '../../types';

type EHRLoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EHRLogin'>;
type EHRLoginScreenRouteProp = RouteProp<RootStackParamList, 'EHRLogin'>;

interface EHRLoginScreenProps {
  navigation: EHRLoginScreenNavigationProp;
  route: EHRLoginScreenRouteProp;
}

// Ensure WebBrowser is dismissed
WebBrowser.maybeCompleteAuthSession();

const API_URL = 'http://localhost:3001'; // Backend proxy URL

const EHRLoginScreen: React.FC<EHRLoginScreenProps> = ({ navigation }) => {
  const [status, setStatus] = useState('Ready to connect to FHIR server.');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addDebug = (msg: string) => {
    console.log('[EHRLoginScreen]', msg);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
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
      responseType: 'code',
      scopes: currentSmartConfig.scope.split(' '),
      extraParams: {
        aud: currentSmartConfig.iss,
        ...(launchToken && { launch: launchToken }),
      },
    };

    addDebug("=== AUTHORIZATION PARAMETERS ===");
    addDebug(`Client ID: ${authorizeParams.clientId}`);
    addDebug(`Redirect URI: ${authorizeParams.redirectUri}`);
    addDebug(`Scopes: ${authorizeParams.scopes.join(' ')}`);
    addDebug(`Issuer (aud): ${authorizeParams.extraParams?.aud}`);
    addDebug(`Launch Token: ${launchToken || 'NONE'}`);
    addDebug("================================");

    setStatus("Redirecting to Epic for authentication...");

    try {
      const authResult = await AuthSession.startAsync(authorizeParams);

      if (authResult.type === 'success') {
        addDebug("OAuth success! Handling callback...");
        setStatus("Finalizing authentication...");
        const { code, state } = authResult.params;

        // Simulate FHIR.oauth2.ready() by directly handling the token exchange
        // In a real app, you'd send `code` and `redirectUri` to your backend
        // to securely exchange for tokens. For simplicity, we'll try to do it
        // client-side if fhirclient allows it directly, but typically this is server-side.
        // Given fhirclient is designed for browser, we'll need to adapt.

        // The fhirclient library expects `window.location` to parse the code/state.
        // We'll manually construct what fhirclient.oauth2.ready() expects.
        // This part is the trickiest for React Native.
        // A more robust solution would be to send the `code` to the FastAPI backend
        // and let the backend perform the token exchange.
        // For now, let's assume fhirclient might handle it if we simulate the URL well enough,
        // but be aware this might need a server-side token exchange.

        // For now, let's proceed to proxy the data assuming we have the access token.
        // The `code` needs to be exchanged for an `access_token`. This usually happens server-side.
        // Given the user's provided code uses a backend proxy to fetch FHIR data AFTER token exchange,
        // we'll *simiulate* that the token exchange happened and we received an access token.
        // You would integrate the actual token exchange here, likely via the backend.

        // Placeholder for token exchange - THIS IS WHERE YOUR BACKEND WOULD EXCHANGE THE CODE
        // For the bare bones, we'll skip the actual token exchange here and assume a dummy access token
        // to test the proxy call. In a real scenario, you'd pass `code` to your backend.

        const dummyAccessToken = "YOUR_DUMMY_ACCESS_TOKEN_AFTER_EXCHANGE";
        const dummyPatientId = "example-patient-id"; // This would come from the token response as well
        const fhirBaseUrl = currentSmartConfig.iss; // Or client.state.serverUrl

        // Instead of FHIR.oauth2.ready(), we'll directly call our backend proxy
        addDebug(`Calling backend proxy to fetch FHIR data...`);

        const proxyResponse = await fetch(`${API_URL}/api/fetch-fhir-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: dummyAccessToken, // Replace with actual token
            patientId: dummyPatientId, // Replace with actual patient ID
            fhirBaseUrl: fhirBaseUrl
          })
        });

        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json();
          throw new Error(`Proxy failed: ${errorData.details || proxyResponse.statusText}`);
        }

        const proxyData = await proxyResponse.json();
        const patientName = proxyData.patient?.name?.[0]
          ? `${proxyData.patient.name[0].given?.[0] || ''} ${proxyData.patient.name[0].family || ''}`.trim()
          : "Patient";

        const patientData = {
          patientId: dummyPatientId, // Use actual patient ID from token
          name: patientName,
          // birthDate: patient.birthDate, // Add from proxyData
          accessToken: dummyAccessToken, // Use actual token
          // sessionId: 'smart_session_' + Date.now(), // Use actual session ID
          fhirData: {
            allergies: proxyData.fhirData?.allergies || [],
            conditions: proxyData.fhirData?.conditions || [],
            medications: proxyData.fhirData?.medications || [],
            observations: proxyData.fhirData?.observations || [] // Ensure observations are handled
          }
        };

        await AsyncStorage.setItem("patientData", JSON.stringify(patientData));
        addDebug(`Stored patient data for: ${patientName}`);

        setStatus("FHIR data fetched and stored. Navigating to Goals.");
        Alert.alert("Success", `Connected to EHR. Welcome, ${patientName}!`);
        navigation.navigate('Goals'); // Navigate to the next screen

      } else if (authResult.type === 'cancel') {
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
    navigation.navigate('Goals');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to your EHR</Text>
      <Text style={styles.subtitle}>
        Allow Food Friend to securely access your lab results and medical history for personalized recommendations.
      </Text>

      <Button
        title={isLoading ? "Connecting..." : "Connect with Epic (SMART on FHIR)"}
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

      {error && (
        <Text style={styles.errorText}>Error: {error}</Text>
      )}

      {isLoading && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 20 }} />}

      <ScrollView style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Debug Log:</Text>
        {debugInfo.map((line, idx) => (
          <Text key={idx} style={styles.debugLine}>{line}</Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 8,
    maxHeight: 200,
    width: '100%',
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugLine: {
    fontSize: 12,
  },
  errorText: {
    color: 'red',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default EHRLoginScreen;
