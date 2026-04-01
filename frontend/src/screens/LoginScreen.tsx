// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../types";
import { CONFIG } from "../config";

const USER_ID_KEY = "@food_friend_user_id";
const STORAGE_KEY = "@user_preferences";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [mode, setMode] = useState<"new" | "returning">("new");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true); // start true to check stored ID
  const [isSaving, setIsSaving] = useState(false);

  // On mount: if there's already a stored user ID, skip straight to the app.
  useEffect(() => {
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem(USER_ID_KEY);
        if (storedId) {
          // Verify it still exists on the backend
          const res = await fetch(`${CONFIG.API_URL}/api/users/${storedId}`);
          if (res.ok) {
            const data = await res.json();
            // Hydrate local preferences from server
            if (data.preferences && Object.keys(data.preferences).length > 0) {
              await AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                  ...data.preferences,
                  name: data.name,
                  user_id: storedId,
                }),
              );
            }
            navigation.replace("MainApp");
            return;
          }
          // If not found (e.g. DB reset), clear stale ID and show login
          await AsyncStorage.removeItem(USER_ID_KEY);
        }
      } catch {
        // Network error — still let them log in manually
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleCreateUser = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Please enter a display name to continue.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${CONFIG.API_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create account");
      }

      const data = await res.json();

      // Persist user ID and seed local prefs with name
      await AsyncStorage.setItem(USER_ID_KEY, data.user_id);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name: trimmed, user_id: data.user_id }),
      );

      Alert.alert(
        "Welcome, " + trimmed + "! 🎉",
        `Your personal ID is:\n\n${data.user_id}\n\nIt's your name + a number, e.g. ALEX-42. Write it down — you can use it to log back in on any device.`,
        [{ text: "Got it!", onPress: () => navigation.navigate("Goals") }],
      );
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.message || "Could not reach server. Check your connection.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturningUser = async () => {
    const trimmedId = userId.trim().toUpperCase();
    if (!trimmedId) {
      Alert.alert("ID required", "Please enter your user ID.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${CONFIG.API_URL}/api/users/${trimmedId}`);

      if (res.status === 404) {
        Alert.alert(
          "Not found",
          "No account found with that ID. Double-check and try again.",
        );
        return;
      }
      if (!res.ok) throw new Error("Server error");

      const data = await res.json();

      // Restore preferences from server into local storage
      await AsyncStorage.setItem(USER_ID_KEY, data.user_id);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...data.preferences,
          name: data.name,
          user_id: data.user_id,
        }),
      );

      navigation.replace("MainApp");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not reach server.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.logo}>🥗</Text>
        <Text style={styles.title}>Food Friend</Text>
        <Text style={styles.subtitle}>
          Your personal food recommendation companion
        </Text>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "new" && styles.toggleBtnActive]}
            onPress={() => setMode("new")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "new" && styles.toggleTextActive,
              ]}
            >
              I'm new here
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              mode === "returning" && styles.toggleBtnActive,
            ]}
            onPress={() => setMode("returning")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "returning" && styles.toggleTextActive,
              ]}
            >
              I have an ID
            </Text>
          </TouchableOpacity>
        </View>

        {/* New user */}
        {mode === "new" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create your profile</Text>
            <Text style={styles.cardSubtitle}>
              Enter a display name and we'll generate a personal ID for you.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Your name (e.g. Alex)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreateUser}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateUser}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Get Started →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Returning user */}
        {mode === "returning" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back!</Text>
            <Text style={styles.cardSubtitle}>
              Enter the 8-character ID you received when you first signed up.
            </Text>
            <TextInput
              style={[styles.input, styles.idInput]}
              placeholder="e.g. ALEX-42"
              value={userId}
              onChangeText={setUserId}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={handleReturningUser}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleReturningUser}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Load My Profile →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 72,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#777",
    textAlign: "center",
    marginBottom: 36,
    paddingHorizontal: 20,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
    width: "100%",
    maxWidth: 380,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  toggleTextActive: {
    color: "#2E7D32",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 16,
  },
  idInput: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    letterSpacing: 4,
    fontSize: 18,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default LoginScreen;
