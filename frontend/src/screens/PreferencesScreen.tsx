// src/screens/PreferencesScreen.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  UserPreferences,
  RootStackParamList,
  INTOLERANCES,
  DIETS,
  NUTRIENT_GOALS,
  FLAVORS,
  TEXTURES,
  CUISINES,
} from "../../types";
import { CONFIG } from "../config";

import ingredientData from "../ingredients.json";

const STORAGE_KEY = "@user_preferences";
const USER_ID_KEY = "@food_friend_user_id";

type PreferencesScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Preferences"
>;

interface PreferencesScreenProps {
  navigation: PreferencesScreenNavigationProp;
}

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
    {subtitle && <Text style={styles.sectionSubtitleText}>{subtitle}</Text>}
  </View>
);

const MultiSelectGroup: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (option: any) => void;
  activeColor?: string;
}> = ({ options, selected, onToggle, activeColor = "#4CAF50" }) => (
  <View style={styles.groupContainer}>
    {options.map((option) => (
      <TouchableOpacity
        key={option}
        style={[
          styles.chip,
          (selected || []).includes(option) && {
            backgroundColor: activeColor,
            borderColor: activeColor,
          },
        ]}
        onPress={() => onToggle(option)}
      >
        <Text
          style={[
            styles.chipText,
            (selected || []).includes(option) && styles.chipTextSelected,
          ]}
        >
          {option.replace(/_/g, " ")}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const PreferencesScreen: React.FC<PreferencesScreenProps> = ({
  navigation,
}) => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    name: "",
    intolerances: [],
    diet: [],
    increase_goals: [],
    decrease_goals: [],
    preferred_foods: [],
    disliked_foods: [],
    liked_flavors: [],
    disliked_flavors: [],
    liked_textures: [],
    disliked_textures: [],
    liked_recipe_ingredients: [],
    disliked_recipe_ingredients: [],
    liked_recipe_flavors: [],
    disliked_recipe_flavors: [],
    liked_recipe_textures: [],
    disliked_recipe_textures: [],
    cuisines: [],
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferredSearch, setPreferredSearch] = useState("");
  const [dislikeSearch, setDislikeSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const [saved, storedId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
      ]);

      if (storedId) setUserId(storedId);

      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          setPreferences({
            name: parsed.name || "",
            intolerances: parsed.intolerances || parsed.allergies || [],
            diet: parsed.diet || parsed.dietaryRestrictions || [],
            increase_goals: parsed.increase_goals || [],
            decrease_goals: parsed.decrease_goals || [],
            preferred_foods:
              parsed.preferred_foods || parsed.preferredFoods || [],
            disliked_foods:
              parsed.disliked_foods || parsed.dislikedIngredients || [],
            liked_flavors: parsed.liked_flavors || parsed.flavors || [],
            disliked_flavors: parsed.disliked_flavors || [],
            liked_textures: parsed.liked_textures || parsed.texture || [],
            disliked_textures: parsed.disliked_textures || [],
            liked_recipe_ingredients: parsed.liked_recipe_ingredients || [],
            disliked_recipe_ingredients:
              parsed.disliked_recipe_ingredients || [],
            liked_recipe_flavors: parsed.liked_recipe_flavors || [],
            disliked_recipe_flavors: parsed.disliked_recipe_flavors || [],
            liked_recipe_textures: parsed.liked_recipe_textures || [],
            disliked_recipe_textures: parsed.disliked_recipe_textures || [],
            cuisines: parsed.cuisines || [],
          });
        }
      }
    } catch (e) {
      console.error("Failed to load preferences", e);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (isContinue: boolean = false) => {
    setIsSaving(true);
    try {
      // Always save locally first
      const prefsToStore = { ...preferences, user_id: userId };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefsToStore));

      // Sync to backend
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          CONFIG.TIMEOUT_MS,
        );

        // Use the user-specific PUT endpoint when we have an ID
        const url = userId
          ? `${CONFIG.API_URL}/api/users/${userId}/preferences`
          : `${CONFIG.API_URL}/api/save-preferences`;
        const method = userId ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preferences),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn("Backend save failed, but local save succeeded");
        }
      } catch (backendError) {
        console.warn(
          "Could not reach backend — preferences saved locally only",
        );
      }

      if (isContinue) {
        navigation.navigate("IngredientRank");
      } else {
        Alert.alert("Saved!", "Your preferences have been updated.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save preferences.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (key: keyof UserPreferences, value: any) => {
    setPreferences((prev) => {
      const current = (prev[key] || []) as any[];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter((item) => item !== value) };
      } else {
        return { ...prev, [key]: [...current, value] };
      }
    });
  };

  const getFilteredIngredients = (query: string, excludeList: string[]) => {
    if (query.length < 2) return [];
    return ingredientData
      .filter(
        (ing) =>
          ing &&
          ing.toLowerCase().includes(query.toLowerCase()) &&
          !(excludeList || []).includes(ing),
      )
      .slice(0, 10);
  };

  const filteredPreferred = useMemo(
    () => getFilteredIngredients(preferredSearch, preferences.preferred_foods),
    [preferredSearch, preferences.preferred_foods],
  );

  const filteredDisliked = useMemo(
    () => getFilteredIngredients(dislikeSearch, preferences.disliked_foods),
    [dislikeSearch, preferences.disliked_foods],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Your Preferences</Text>
        <Text style={styles.subtitle}>
          Help us personalize your food recommendations
        </Text>

        {/* Show the user's ID as a subtle reminder */}
        {userId && (
          <View style={styles.idBadge}>
            <Text style={styles.idBadgeLabel}>Your ID</Text>
            <Text style={styles.idBadgeValue}>{userId}</Text>
          </View>
        )}

        <SectionHeader
          title="Your Name"
          subtitle="How should we address you?"
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Enter your name"
          value={preferences.name}
          onChangeText={(val) =>
            setPreferences((prev) => ({ ...prev, name: val }))
          }
        />

        <SectionHeader
          title="Allergies & Intolerances"
          subtitle="Ingredients I need to avoid"
        />
        <MultiSelectGroup
          options={INTOLERANCES}
          selected={preferences.intolerances}
          onToggle={(val) => toggleSelection("intolerances", val)}
          activeColor="#D32F2F"
        />

        <SectionHeader
          title="Favorite Flavors"
          subtitle="Tastes I usually look for"
        />
        <MultiSelectGroup
          options={FLAVORS}
          selected={preferences.liked_flavors}
          onToggle={(val) => toggleSelection("liked_flavors", val)}
        />

        <SectionHeader
          title="Favorite Textures"
          subtitle="Mouthfeels I enjoy"
        />
        <MultiSelectGroup
          options={TEXTURES}
          selected={preferences.liked_textures}
          onToggle={(val) => toggleSelection("liked_textures", val)}
        />

        <View style={styles.aversionContainer}>
          <SectionHeader
            title="Things I don't like"
            subtitle="I'd prefer to see fewer of these"
          />
          <Text style={styles.aversionLabel}>Flavors to limit:</Text>
          <MultiSelectGroup
            options={FLAVORS}
            selected={preferences.disliked_flavors}
            onToggle={(val) => toggleSelection("disliked_flavors", val)}
            activeColor="#D32F2F"
          />
          <Text style={[styles.aversionLabel, { marginTop: 12 }]}>
            Textures to limit:
          </Text>
          <MultiSelectGroup
            options={TEXTURES}
            selected={preferences.disliked_textures}
            onToggle={(val) => toggleSelection("disliked_textures", val)}
            activeColor="#D32F2F"
          />
        </View>

        <SectionHeader title="Preferred Cuisines" />
        <MultiSelectGroup
          options={CUISINES}
          selected={preferences.cuisines}
          onToggle={(val) => toggleSelection("cuisines", val)}
        />

        <SectionHeader title="Preferred Foods" />
        <Text style={styles.helperText}>
          Foods you enjoy and feel comfortable eating.
        </Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search preferred foods..."
            value={preferredSearch}
            onChangeText={setPreferredSearch}
          />
          {filteredPreferred.length > 0 && (
            <View style={styles.resultsContainer}>
              {filteredPreferred.map((ing) => (
                <TouchableOpacity
                  key={ing}
                  style={styles.resultItem}
                  onPress={() => {
                    toggleSelection("preferred_foods", ing);
                    setPreferredSearch("");
                  }}
                >
                  <Text>{ing}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.selectedIngredients}>
          {preferences.preferred_foods.map((ing) => (
            <TouchableOpacity
              key={ing}
              style={[
                styles.selectedChip,
                { backgroundColor: "#E8F5E9", borderColor: "#A5D6A7" },
              ]}
              onPress={() => toggleSelection("preferred_foods", ing)}
            >
              <Text style={[styles.selectedChipText, { color: "#2E7D32" }]}>
                {ing} ✕
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="Disliked Foods" />
        <Text style={styles.helperText}>
          Foods or ingredients you want to avoid.
        </Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search ingredients to avoid..."
            value={dislikeSearch}
            onChangeText={setDislikeSearch}
          />
          {filteredDisliked.length > 0 && (
            <View style={styles.resultsContainer}>
              {filteredDisliked.map((ing) => (
                <TouchableOpacity
                  key={ing}
                  style={styles.resultItem}
                  onPress={() => {
                    toggleSelection("disliked_foods", ing);
                    setDislikeSearch("");
                  }}
                >
                  <Text>{ing}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.selectedIngredients}>
          {preferences.disliked_foods.map((ing) => (
            <TouchableOpacity
              key={ing}
              style={styles.selectedChip}
              onPress={() => toggleSelection("disliked_foods", ing)}
            >
              <Text style={styles.selectedChipText}>{ing} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => savePreferences(false)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: "#2196F3", marginTop: 12 },
          ]}
          onPress={() => savePreferences(true)}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>Continue to App</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: "flex-start",
    gap: 8,
  },
  idBadgeLabel: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  idBadgeValue: {
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#2E7D32",
    letterSpacing: 2,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4CAF50",
  },
  sectionSubtitleText: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  aversionContainer: {
    backgroundColor: "#FFF5F5",
    padding: 12,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#FFEBEE",
  },
  aversionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#D32F2F",
    marginBottom: 8,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 14,
    color: "#888",
    marginBottom: 12,
    fontStyle: "italic",
  },
  groupContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    margin: 4,
  },
  chipText: {
    color: "#666",
    fontSize: 14,
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "500",
  },
  searchContainer: {
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    fontSize: 16,
  },
  resultsContainer: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    maxHeight: 200,
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  selectedIngredients: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    marginBottom: 8,
  },
  selectedChip: {
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  selectedChipText: {
    color: "#D32F2F",
    fontSize: 12,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default PreferencesScreen;
