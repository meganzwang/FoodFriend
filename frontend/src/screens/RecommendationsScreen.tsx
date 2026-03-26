// FoodFriend/src/screens/RecommendationsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Button,
  Alert,
  Linking,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MainTabParamList, Recipe, UserPreferences } from "../../types";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../types";
import { CONFIG } from "../config";
import RecipeFeedbackModal from "../components/RecipeFeedbackModal";

const STORAGE_KEY = "@user_preferences";

type RecommendationsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Recommendations">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface RecommendationsScreenProps {
  navigation: RecommendationsScreenNavigationProp;
}

const RecommendationsScreen: React.FC<RecommendationsScreenProps> = ({
  navigation,
}) => {
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [recommendedIngredients, setRecommendedIngredients] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"liked" | "disliked">(
    "liked",
  );
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const prefs = saved ? JSON.parse(saved) : {};
      setPreferences(prefs);

      const response = await fetch(`${CONFIG.API_URL}/api/recommend-recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error || `Request failed with status ${response.status}`,
        );
      }

      setRecommendedIngredients(data.top_ingredients || []);
      setRecommendations(data.recipes || []);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      Alert.alert("Error", "Could not fetch recommendations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleOpenFeedbackModal = (
    recipe: Recipe,
    type: "liked" | "disliked",
  ) => {
    setSelectedRecipe(recipe);
    setFeedbackType(type);
    setFeedbackModalVisible(true);
  };

  const mergeUnique = (existing: string[] = [], incoming: string[] = []) =>
    Array.from(new Set([...(existing || []), ...(incoming || [])]));

  const handleFeedbackSubmit = async (feedback: {
    ingredients: string[];
    flavors: string[];
    textures: string[];
  }) => {
    if (!preferences || !selectedRecipe) return;

    const latestSavedRaw = await AsyncStorage.getItem(STORAGE_KEY);
    const latestSaved = latestSavedRaw
      ? (JSON.parse(latestSavedRaw) as Partial<UserPreferences>)
      : {};

    const basePreferences: UserPreferences = {
      ...preferences,
      ...latestSaved,
      liked_recipe_ingredients: latestSaved.liked_recipe_ingredients || [],
      disliked_recipe_ingredients:
        latestSaved.disliked_recipe_ingredients || [],
      liked_recipe_flavors: latestSaved.liked_recipe_flavors || [],
      disliked_recipe_flavors: latestSaved.disliked_recipe_flavors || [],
      liked_recipe_textures: latestSaved.liked_recipe_textures || [],
      disliked_recipe_textures: latestSaved.disliked_recipe_textures || [],
      liked_flavors: latestSaved.liked_flavors || [],
      disliked_flavors: latestSaved.disliked_flavors || [],
      liked_textures: latestSaved.liked_textures || [],
      disliked_textures: latestSaved.disliked_textures || [],
      preferred_foods: latestSaved.preferred_foods || [],
      disliked_foods: latestSaved.disliked_foods || [],
      intolerances: latestSaved.intolerances || [],
      diet: latestSaved.diet || [],
      increase_goals: latestSaved.increase_goals || [],
      decrease_goals: latestSaved.decrease_goals || [],
      cuisines: latestSaved.cuisines || [],
    };

    const updatedPrefs: UserPreferences = {
      ...basePreferences,
      liked_recipe_ingredients:
        feedbackType === "liked"
          ? mergeUnique(
              basePreferences.liked_recipe_ingredients,
              feedback.ingredients,
            )
          : basePreferences.liked_recipe_ingredients || [],
      disliked_recipe_ingredients:
        feedbackType === "disliked"
          ? mergeUnique(
              basePreferences.disliked_recipe_ingredients,
              feedback.ingredients,
            )
          : basePreferences.disliked_recipe_ingredients || [],
      liked_recipe_flavors:
        feedbackType === "liked"
          ? mergeUnique(basePreferences.liked_recipe_flavors, feedback.flavors)
          : basePreferences.liked_recipe_flavors || [],
      disliked_recipe_flavors:
        feedbackType === "disliked"
          ? mergeUnique(
              basePreferences.disliked_recipe_flavors,
              feedback.flavors,
            )
          : basePreferences.disliked_recipe_flavors || [],
      liked_recipe_textures:
        feedbackType === "liked"
          ? mergeUnique(
              basePreferences.liked_recipe_textures,
              feedback.textures,
            )
          : basePreferences.liked_recipe_textures || [],
      disliked_recipe_textures:
        feedbackType === "disliked"
          ? mergeUnique(
              basePreferences.disliked_recipe_textures,
              feedback.textures,
            )
          : basePreferences.disliked_recipe_textures || [],
    };

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPrefs));

      // Try to save to backend
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          CONFIG.TIMEOUT_MS,
        );

        await fetch(`${CONFIG.API_URL}/api/save-preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedPrefs),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
      } catch (error) {
        console.warn("Could not reach backend, feedback saved locally");
      }

      setPreferences(updatedPrefs);
      setFeedbackModalVisible(false);
      Alert.alert(
        "Thanks!",
        "Your feedback has been saved and will help personalize your recommendations.",
      );
    } catch (error) {
      Alert.alert("Error", "Failed to save feedback.");
    }
  };

  const handleOpenRecipe = async (sourceUrl: string) => {
    if (!sourceUrl) {
      Alert.alert("Error", "Recipe link not available.");
      return;
    }
    try {
      const supported = await Linking.canOpenURL(sourceUrl);
      if (supported) {
        await Linking.openURL(sourceUrl);
      } else {
        Alert.alert("Error", "Cannot open recipe link.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open recipe link.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Weekly Recommendations</Text>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#0000ff"
          style={styles.loadingIndicator}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.recommendationsList}>
          <TouchableOpacity
            style={styles.generateMoreButton}
            onPress={fetchRecommendations}
          >
            <Text style={styles.generateMoreButtonText}>
              Generate More Ingredients
            </Text>
          </TouchableOpacity>

          {recommendedIngredients.length > 0 && (
            <View style={styles.ingredientsCard}>
              <Text style={styles.ingredientsTitle}>Recommended Ingredients</Text>
              <Text style={styles.ingredientsList}>
                {recommendedIngredients.join(" • ")}
              </Text>
            </View>
          )}

          {recommendations.length === 0 ? (
            <Text style={styles.emptyText}>
              No recipes found for your current preferences. Try adjusting your
              goals or flavor settings and refresh.
            </Text>
          ) : (
            recommendations.map((recipe) => (
              <View key={recipe.id} style={styles.recipeCard}>
                <Image
                  source={{ uri: recipe.image }}
                  style={styles.recipeImage}
                />
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                <Text style={styles.recipeDescription}>
                  {recipe.readyInMinutes
                    ? `${recipe.readyInMinutes} min`
                    : "Time N/A"}
                  {recipe.calories
                    ? ` • ${Math.round(recipe.calories)} kcal`
                    : ""}
                  {recipe.diets && recipe.diets.length > 0
                    ? ` • ${recipe.diets.join(", ")}`
                    : ""}
                </Text>
                {recipe.sourceUrl && (
                  <TouchableOpacity
                    style={styles.recipeLink}
                    onPress={() => handleOpenRecipe(recipe.sourceUrl)}
                  >
                    <Text style={styles.recipeLinkText}>View Recipe →</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.buttonRow}>
                  <Button title="Didn't Try" onPress={() => {}} color="#999" />
                  <Button
                    title="👍 Liked"
                    onPress={() => handleOpenFeedbackModal(recipe, "liked")}
                    color="green"
                  />
                  <Button
                    title="👎 Disliked"
                    onPress={() => handleOpenFeedbackModal(recipe, "disliked")}
                    color="red"
                  />
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <RecipeFeedbackModal
        visible={feedbackModalVisible}
        recipe={selectedRecipe}
        feedbackType={feedbackType}
        onClose={() => setFeedbackModalVisible(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    marginTop: 10,
  },
  loadingIndicator: {
    marginTop: 50,
  },
  recommendationsList: {
    alignItems: "center",
    paddingBottom: 20,
  },
  recipeCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    width: "100%",
    maxWidth: 400, // Optional: for larger screens
    elevation: 3, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  recipeImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  recipeDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  recipeLink: {
    marginVertical: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#2196F3",
    borderRadius: 6,
    alignItems: "center",
  },
  recipeLinkText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  generateMoreButton: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  generateMoreButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  ingredientsCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  ingredientsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  ingredientsList: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
});

export default RecommendationsScreen;
