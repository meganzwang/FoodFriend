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

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const MultiSelectGroup: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (option: any) => void;
}> = ({ options, selected, onToggle }) => (
  <View style={styles.groupContainer}>
    {options.map((option) => (
      <TouchableOpacity
        key={option}
        style={[
          styles.chip,
          (selected || []).includes(option) && styles.chipSelected,
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

const GoalsScreen: React.FC<GoalsScreenProps> = ({ navigation }) => {
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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      navigation.navigate("Preferences");
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
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>What are your goals?</Text>
        <Text style={styles.subtitle}>
          Help us understand your nutritional needs and diet.
        </Text>

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
        />

        <SectionHeader title="Goals to Decrease" />
        <Text style={styles.helperText}>
          Select nutrients you want to limit.
        </Text>
        <MultiSelectGroup
          options={NUTRIENT_GOALS}
          selected={preferences.decrease_goals}
          onToggle={(val) => toggleSelection("decrease_goals", val)}
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
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
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
  continueButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 40,
    alignItems: "center",
    shadowColor: "#4CAF50",
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
