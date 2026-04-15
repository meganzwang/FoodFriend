import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  RootStackParamList,
  UserPreferences,
  NUTRIENT_GOALS,
  DIETS,
} from "../../types";
import { SafeAreaView } from "react-native-safe-area-context";

type GoalsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Goals"
>;

interface GoalsScreenProps {
  navigation: GoalsScreenNavigationProp;
}

const STORAGE_KEY = "@user_preferences";
const USER_ID_KEY = "@food_friend_user_id";

const SectionHeader: React.FC<{ title: string; color?: string }> = ({
  title,
  color,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionHeaderText, color ? { color } : null]}>
      {title}
    </Text>
  </View>
);

interface MultiSelectGroupProps {
  options: string[];
  selected: string[];
  onToggle: (option: any) => void;
  disabledOptions?: string[];
}

const MultiSelectGroup: React.FC<
  MultiSelectGroupProps & { activeColor?: string }
> = ({
  options,
  selected,
  onToggle,
  disabledOptions = [],
  activeColor = "#4CAF50",
}) => (
  <View style={styles.groupContainer}>
    {options.map((option) => {
      const isSelected = (selected || []).includes(option);
      const isDisabled = (disabledOptions || []).includes(option);
      return (
        <TouchableOpacity
          key={option}
          style={[
            styles.chip,
            isSelected && {
              backgroundColor: activeColor,
              borderColor: activeColor,
            },
            isDisabled && { opacity: 0.4 },
          ]}
          onPress={() => !isDisabled && onToggle(option)}
          disabled={isDisabled}
        >
          <Text
            style={[
              styles.chipText,
              isSelected && { color: "#fff", fontWeight: "500" },
              isDisabled && { color: "#888" },
            ]}
          >
            {option.replace(/_/g, " ")}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const GoalsScreen: React.FC<GoalsScreenProps> = ({ navigation }) => {
  const handleBack = () => {
    navigation.goBack();
  };
  const [preferences, setPreferences] = useState<UserPreferences>({
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
    tried_recipe_ids: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          setPreferences({
            intolerances: parsed.intolerances || [],
            diet: parsed.diet || [],
            increase_goals: parsed.increase_goals || [],
            decrease_goals: parsed.decrease_goals || [],
            preferred_foods: parsed.preferred_foods || [],
            disliked_foods: parsed.disliked_foods || [],
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
            tried_recipe_ids: parsed.tried_recipe_ids || [],
          });
        }
      }
    } catch (e) {
      console.error("Failed to load preferences", e);
    } finally {
      setLoading(false);
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

  const handleContinue = async () => {
    try {
      // Preserve user_id so it doesn't get wiped on each screen save
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...preferences, user_id: userId }),
      );
      navigation.navigate("Preferences");
    } catch (e) {
      Alert.alert("Error", "Failed to save goals.");
    }
  };

  const handleSaveGoals = async () => {
    try {
      const userId = await AsyncStorage.getItem(USER_ID_KEY);
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...preferences, user_id: userId }),
      );
      Alert.alert("Saved!", "Your goals have been updated.");
    } catch (e) {
      Alert.alert("Error", "Failed to save goals.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right"]}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{"←"}</Text>
        </TouchableOpacity>
        <Text style={styles.titleHeader}>What are your goals?</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionHeader title="Diet" />
        <MultiSelectGroup
          options={DIETS}
          selected={preferences.diet}
          onToggle={(val) => toggleSelection("diet", val)}
        />

        <SectionHeader title="Goals to Increase" />
        <Text style={styles.helperText}>
          Select nutrients you want to consume more of.
        </Text>

        <MultiSelectGroup
          options={NUTRIENT_GOALS}
          selected={preferences.increase_goals}
          onToggle={(val) => toggleSelection("increase_goals", val)}
          disabledOptions={preferences.decrease_goals}
        />

        <SectionHeader title="Goals to Decrease" color="#D32F2F" />
        <Text style={styles.helperText}>
          Select nutrients you want to limit.
        </Text>

        <MultiSelectGroup
          options={NUTRIENT_GOALS}
          selected={preferences.decrease_goals}
          onToggle={(val) => toggleSelection("decrease_goals", val)}
          disabledOptions={preferences.increase_goals}
          activeColor="#D32F2F"
        />

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue to Preferences</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backButton: {
    marginRight: 10,
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: "#1976D2",
    fontWeight: "bold",
  },
  titleHeader: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    textAlign: "left",
    flex: 1,
  },
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#1976D2",
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  sectionHeader: {
    marginTop: 12,
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
  chipSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  chipText: {
    color: "#666",
    fontSize: 14,
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: "#2E7D32",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 40,
    alignItems: "center",
    shadowColor: "#2E7D32",
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
  continueButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 40,
    alignItems: "center",
    shadowColor: "#2196F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default GoalsScreen;
