// FoodFriend/src/screens/RecommendationsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Recipe, RootStackParamList, UserPreferences } from "../../types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CONFIG } from "../config";

const STORAGE_KEY = "@user_preferences";
const USER_ID_KEY = "@food_friend_user_id";
const WEEKLY_SELECTED_RECIPES_KEY = "@weekly_selected_recipes";
const ACTIVE_RECOMMENDATION_RUN_KEY = "@active_recommendation_run_id";
const PAGE_SIZE = 5;
const MAX_VISIBLE_RECIPES = 20;

type StoredUserPreferences = UserPreferences & { user_id?: string };

type RecommendationsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "RecipePicker"
>;

interface RecommendationsScreenProps {
  navigation: RecommendationsScreenNavigationProp;
}

const RecommendationsScreen: React.FC<RecommendationsScreenProps> = ({
  navigation,
}) => {
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [recommendedIngredients, setRecommendedIngredients] = useState<
    string[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const prefs: StoredUserPreferences = saved ? JSON.parse(saved) : {};

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
      setVisibleCount(PAGE_SIZE);
      setSelectedRecipeIds([]);

      if (data.recommendation_run_id) {
        await AsyncStorage.setItem(
          ACTIVE_RECOMMENDATION_RUN_KEY,
          String(data.recommendation_run_id),
        );
      } else {
        await AsyncStorage.removeItem(ACTIVE_RECOMMENDATION_RUN_KEY);
      }
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

  const toggleRecipeSelection = (recipeId: number) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId],
    );
  };

  const handleContinueToFeedback = async () => {
    if (selectedRecipeIds.length === 0) {
      Alert.alert(
        "Select Recipes",
        "Choose at least one recipe to continue to feedback.",
      );
      return;
    }

    const selectedRecipes = recommendations.filter((recipe) =>
      selectedRecipeIds.includes(recipe.id),
    );

    try {
      const [saved, userIdFromKey, recommendationRunId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
        AsyncStorage.getItem(ACTIVE_RECOMMENDATION_RUN_KEY),
      ]);

      const savedPrefs: StoredUserPreferences = saved ? JSON.parse(saved) : {};
      const resolvedUserId = userIdFromKey || savedPrefs.user_id;

      if (recommendationRunId && resolvedUserId) {
        await fetch(
          `${CONFIG.API_URL}/api/recommendation-runs/${recommendationRunId}/selected-recipes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: resolvedUserId,
              selected_recipe_ids: selectedRecipeIds,
            }),
          },
        );
      }
    } catch (error) {
      console.warn("Could not sync selected recipes to backend history");
    }

    await AsyncStorage.setItem(
      WEEKLY_SELECTED_RECIPES_KEY,
      JSON.stringify(selectedRecipes),
    );
    navigation.navigate("MainApp", {
      screen: "ThisWeekRecipes",
      params: { selectedRecipes },
    });
  };

  const maxLoadedRecipes = Math.min(
    recommendations.length,
    MAX_VISIBLE_RECIPES,
  );
  const visibleRecipes = useMemo(
    () => recommendations.slice(0, Math.min(visibleCount, maxLoadedRecipes)),
    [recommendations, visibleCount, maxLoadedRecipes],
  );

  const canLoadMore = visibleCount < maxLoadedRecipes;

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, maxLoadedRecipes));
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
          {recommendedIngredients.length > 0 && (
            <View style={styles.ingredientsCard}>
              <Text style={styles.ingredientsTitle}>
                Recommended Ingredients
              </Text>
              <Text style={styles.ingredientsList}>
                {recommendedIngredients.join(" • ")}
              </Text>
            </View>
          )}

          {recommendations.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyText}>
                No recipes found right now. Please update your goals and
                preferences, then try generating recipes again.
              </Text>
              <TouchableOpacity
                style={styles.adjustGoalsButton}
                onPress={() => navigation.navigate("Goals")}
              >
                <Text style={styles.adjustGoalsButtonText}>Go to Goals</Text>
              </TouchableOpacity>
            </View>
          ) : (
            visibleRecipes.map((recipe) => (
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
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    selectedRecipeIds.includes(recipe.id) &&
                      styles.selectButtonActive,
                  ]}
                  onPress={() => toggleRecipeSelection(recipe.id)}
                >
                  <Text
                    style={[
                      styles.selectButtonText,
                      selectedRecipeIds.includes(recipe.id) &&
                        styles.selectButtonTextActive,
                    ]}
                  >
                    {selectedRecipeIds.includes(recipe.id)
                      ? "Selected"
                      : "Select for This Week"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {canLoadMore && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
            >
              <Text style={styles.loadMoreButtonText}>Add More Recipes</Text>
            </TouchableOpacity>
          )}

          {recommendations.length > 0 && (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => void handleContinueToFeedback()}
            >
              <Text style={styles.continueButtonText}>
                Continue to Feedback ({selectedRecipeIds.length} selected)
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    width: "100%",
    maxWidth: 400,
    marginTop: 40,
    alignItems: "center",
    gap: 14,
  },
  adjustGoalsButton: {
    backgroundColor: "#1976D2",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: "center",
  },
  adjustGoalsButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
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
  selectButton: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  selectButtonActive: {
    backgroundColor: "#E8F5E9",
  },
  selectButtonText: {
    color: "#2E7D32",
    fontWeight: "700",
  },
  selectButtonTextActive: {
    color: "#1B5E20",
  },
  loadMoreButton: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1976D2",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  loadMoreButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  continueButton: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#2E7D32",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default RecommendationsScreen;
