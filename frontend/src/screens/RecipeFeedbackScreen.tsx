// (removed accidental top-level openTellUsMore)
// ...existing code...
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  MainTabParamList,
  Recipe,
  RootStackParamList,
  TriedRecipe,
  UserPreferences,
} from "../../types";
import RecipeFeedbackModal from "../components/RecipeFeedbackModal";
import { CONFIG } from "../config";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

type RecipeFeedbackRouteProp =
  | RouteProp<RootStackParamList, "RecipeFeedback">
  | RouteProp<MainTabParamList, "ThisWeekRecipes">;
type RecipeFeedbackNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "ThisWeekRecipes">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface RecipeFeedbackScreenProps {
  route: RecipeFeedbackRouteProp;
  navigation: RecipeFeedbackNavigationProp;
}

type FeedbackType = "liked" | "disliked";

interface RecipeFeedbackEntry {
  type: FeedbackType;
  ingredients: string[];
  flavors: string[];
  textures: string[];
}

const STORAGE_KEY = "@user_preferences";
const USER_ID_KEY = "@food_friend_user_id";
const WEEKLY_SELECTED_RECIPES_KEY = "@weekly_selected_recipes";
const ACTIVE_RECOMMENDATION_RUN_KEY = "@active_recommendation_run_id";

type StoredUserPreferences = Partial<UserPreferences> & { user_id?: string };

const mergeUnique = (existing: string[] = [], incoming: string[] = []) =>
  Array.from(new Set([...(existing || []), ...(incoming || [])]));

const RecipeFeedbackScreen: React.FC<RecipeFeedbackScreenProps> = ({
  route,
  navigation,
}) => {
  const routedRecipes = route.params?.selectedRecipes || [];
  const [selectedRecipes, setSelectedRecipes] =
    useState<Recipe[]>(routedRecipes);

  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [activeType, setActiveType] = useState<FeedbackType>("liked");
  const [feedbackByRecipe, setFeedbackByRecipe] = useState<
    Record<number, RecipeFeedbackEntry>
  >({});
  const [isSaving, setIsSaving] = useState(false);

    // Handler for "Tell us more" button
    const openTellUsMore = (recipe: Recipe) => {
      setActiveRecipe(recipe);
      setActiveType(feedbackByRecipe[recipe.id]?.type || "liked");
    };

  useEffect(() => {
    const loadSelectedRecipes = async () => {
      if (routedRecipes.length > 0) {
        setSelectedRecipes(routedRecipes);
        await AsyncStorage.setItem(
          WEEKLY_SELECTED_RECIPES_KEY,
          JSON.stringify(routedRecipes),
        );
        return;
      }

      const stored = await AsyncStorage.getItem(WEEKLY_SELECTED_RECIPES_KEY);
      if (stored) {
        try {
          setSelectedRecipes(JSON.parse(stored));
        } catch (error) {
          console.warn("Failed to parse weekly selected recipes");
        }
      }
    };

    void loadSelectedRecipes();
  }, [routedRecipes]);

  const completedCount = useMemo(
    () =>
      selectedRecipes.filter(
        (recipe) => recipe?.id != null && feedbackByRecipe[recipe.id],
      ).length,
    [selectedRecipes, feedbackByRecipe],
  );

  const setRecipeReaction = (recipe: Recipe, type: FeedbackType) => {
    if (!recipe?.id) return;

    setFeedbackByRecipe((prev) => ({
      ...prev,
      [recipe.id]: {
        type,
        ingredients: prev[recipe.id]?.ingredients || [],
        flavors: prev[recipe.id]?.flavors || [],
        textures: prev[recipe.id]?.textures || [],
      },
    }));
  };

  const removeRecipe = async (recipeToRemove: Recipe) => {
    Alert.alert(
      "Remove Recipe",
      `Remove "${recipeToRemove.title}" from this week's recipes?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const updatedRecipes = selectedRecipes.filter(
              (recipe) => recipe.id !== recipeToRemove.id
            );
            setSelectedRecipes(updatedRecipes);

            // Update AsyncStorage
            await AsyncStorage.setItem(
              WEEKLY_SELECTED_RECIPES_KEY,
              JSON.stringify(updatedRecipes),
            );

            // Remove any feedback for this recipe
            setFeedbackByRecipe((prev) => {
              const updated = { ...prev };
              delete updated[recipeToRemove.id];
              return updated;
            });
          },
        },
      ],
    );
  };

  const handleModalSubmit = (feedback: {
    ingredients: string[];
    flavors: string[];
    textures: string[];
  }) => {
    if (!activeRecipe?.id) return;

    setFeedbackByRecipe((prev) => ({
      ...prev,
      [activeRecipe.id]: {
        type: activeType,
        ingredients: feedback.ingredients,
        flavors: feedback.flavors,
        textures: feedback.textures,
      },
    }));

    setActiveRecipe(null);
  };

  const saveFeedback = async () => {
    if (!selectedRecipes.length) {
      Alert.alert("No recipes selected", "Please pick recipes first.");
      return;
    }

    const unreviewed = selectedRecipes.filter(
      (recipe) => recipe?.id != null && !feedbackByRecipe[recipe.id],
    );
    if (unreviewed.length > 0) {
      Alert.alert(
        "Missing feedback",
        "Please mark each selected recipe as liked or disliked before continuing.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const [savedRaw, userId, recommendationRunId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
        AsyncStorage.getItem(ACTIVE_RECOMMENDATION_RUN_KEY),
      ]);

      const saved: StoredUserPreferences = savedRaw ? JSON.parse(savedRaw) : {};

      const likedEntries = Object.values(feedbackByRecipe).filter(
        (entry) => entry.type === "liked",
      );
      const dislikedEntries = Object.values(feedbackByRecipe).filter(
        (entry) => entry.type === "disliked",
      );

      const likedIngredients = likedEntries.flatMap(
        (entry) => entry.ingredients,
      );
      const dislikedIngredients = dislikedEntries.flatMap(
        (entry) => entry.ingredients,
      );
      const likedFlavors = likedEntries.flatMap((entry) => entry.flavors);
      const dislikedFlavors = dislikedEntries.flatMap((entry) => entry.flavors);
      const likedTextures = likedEntries.flatMap((entry) => entry.textures);
      const dislikedTextures = dislikedEntries.flatMap(
        (entry) => entry.textures,
      );

      const triedRecipeIds = selectedRecipes
        .map((recipe) => recipe.id)
        .filter((id): id is number => typeof id === "number");

      const triedRecipes: TriedRecipe[] = selectedRecipes
        .filter((recipe) => recipe?.id != null && feedbackByRecipe[recipe.id])
        .map((recipe) => ({
          id: recipe.id,
          title: recipe.title,
          image: recipe.image,
          sourceUrl: recipe.sourceUrl,
          feedbackType: feedbackByRecipe[recipe.id].type,
          triedAt: new Date().toISOString(),
          calories: recipe.calories,
          protein: recipe.protein,
          fat: recipe.fat,
          sodium: recipe.sodium,
          fiber: recipe.fiber,
          sugar: recipe.sugar,
          saturated_fat: recipe.saturated_fat,
          iron: recipe.iron,
          readyInMinutes: recipe.readyInMinutes,
          ingredients: recipe.ingredients,
          diets: recipe.diets,
          summary: recipe.summary,
        }));

      const existingTried = saved.tried_recipes || [];
      const triedRecipeMap = new Map<number, TriedRecipe>();
      [...existingTried, ...triedRecipes].forEach((recipe) => {
        triedRecipeMap.set(recipe.id, recipe);
      });

      const updatedPrefs: UserPreferences = {
        intolerances: saved.intolerances || [],
        diet: saved.diet || [],
        increase_goals: saved.increase_goals || [],
        decrease_goals: saved.decrease_goals || [],
        preferred_foods: saved.preferred_foods || [],
        disliked_foods: saved.disliked_foods || [],
        liked_flavors: saved.liked_flavors || [],
        disliked_flavors: saved.disliked_flavors || [],
        liked_textures: saved.liked_textures || [],
        disliked_textures: saved.disliked_textures || [],
        liked_recipe_ingredients: mergeUnique(
          saved.liked_recipe_ingredients,
          likedIngredients,
        ),
        disliked_recipe_ingredients: mergeUnique(
          saved.disliked_recipe_ingredients,
          dislikedIngredients,
        ),
        liked_recipe_flavors: mergeUnique(
          saved.liked_recipe_flavors,
          likedFlavors,
        ),
        disliked_recipe_flavors: mergeUnique(
          saved.disliked_recipe_flavors,
          dislikedFlavors,
        ),
        liked_recipe_textures: mergeUnique(
          saved.liked_recipe_textures,
          likedTextures,
        ),
        disliked_recipe_textures: mergeUnique(
          saved.disliked_recipe_textures,
          dislikedTextures,
        ),
        cuisines: saved.cuisines || [],
        name: saved.name,
        tried_recipe_ids: Array.from(
          new Set([...(saved.tried_recipe_ids || []), ...triedRecipeIds]),
        ),
        tried_recipes: Array.from(triedRecipeMap.values()).sort((a, b) =>
          b.triedAt.localeCompare(a.triedAt),
        ),
      };

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...updatedPrefs, user_id: userId || undefined }),
      );

      try {
        if (userId && recommendationRunId) {
          const feedbackPayload = selectedRecipes
            .filter(
              (recipe) => recipe?.id != null && feedbackByRecipe[recipe.id],
            )
            .map((recipe) => ({
              recipe_id: recipe.id,
              recipe_title: recipe.title,
              feedback_type: feedbackByRecipe[recipe.id].type,
              recipe_ingredients: recipe.ingredients || [],
              selected_ingredients: feedbackByRecipe[recipe.id].ingredients,
              selected_flavors: feedbackByRecipe[recipe.id].flavors,
              selected_textures: feedbackByRecipe[recipe.id].textures,
            }));

          await fetch(`${CONFIG.API_URL}/api/log-recipe-feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              run_id: recommendationRunId,
              user_id: userId,
              feedback: feedbackPayload,
            }),
          });
        }
      } catch (error) {
        console.warn("Could not sync recipe feedback history to backend");
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          CONFIG.TIMEOUT_MS,
        );

        if (userId) {
          await fetch(`${CONFIG.API_URL}/api/users/${userId}/preferences`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedPrefs),
            signal: controller.signal,
          });
        } else {
          await fetch(`${CONFIG.API_URL}/api/save-preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedPrefs),
            signal: controller.signal,
          });
        }

        clearTimeout(timeoutId);
      } catch (error) {
        console.warn("Could not reach backend, feedback saved locally");
      }

      navigation.navigate("RecipePicker");
    } catch (error) {
      Alert.alert("Error", "Failed to save recipe feedback.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Weekly Recipes</Text>

      <Text style={styles.progressText}>
        Reviewed {completedCount} of {selectedRecipes.length}
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {selectedRecipes.map((recipe) => {
          const feedback = recipe?.id ? feedbackByRecipe[recipe.id] : undefined;
          return (
            <View key={`${recipe.id}-${recipe.title}`} style={styles.card}>
              <View style={styles.cardHeader}>
                {recipe.image ? (
                  <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
                ) : (
                  <View style={styles.recipeImagePlaceholder}>
                    <Text style={styles.placeholderText}>No image</Text>
                  </View>
                )}
                <View style={styles.cardHeaderContent}>
                  <View style={styles.titleRow}>
                    <TouchableOpacity
                      style={styles.titleTouchable}
                      onPress={() => {
                        if (recipe.sourceUrl) {
                          Linking.openURL(recipe.sourceUrl).catch(() =>
                            Alert.alert("Error", "Could not open recipe link")
                          );
                        }
                      }}
                    >
                      <Text style={[styles.recipeTitle, styles.recipeTitleLink]}>
                        {recipe.title}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeRecipe(recipe)}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.recipeMeta}>
                    {recipe.readyInMinutes
                      ? `${recipe.readyInMinutes} min`
                      : "Time N/A"}
                    {recipe.calories
                      ? ` • ${Math.round(recipe.calories)} kcal`
                      : ""}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.thumbButton,
                    feedback?.type === "liked" && styles.thumbButtonLiked,
                  ]}
                  onPress={() => setRecipeReaction(recipe, "liked")}
                >
                  <Text style={styles.thumbEmoji}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.thumbButton,
                    feedback?.type === "disliked" && styles.thumbButtonDisliked,
                  ]}
                  onPress={() => setRecipeReaction(recipe, "disliked")}
                >
                  <Text style={styles.thumbEmoji}>👎</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tellUsMoreButton}
                  onPress={() => openTellUsMore(recipe)}
                >
                  <Text style={styles.tellUsMoreText}>Tell us more</Text>
                </TouchableOpacity>
              </View>

              {feedback && (
                <Text style={styles.statusText}>
                  Saved as {feedback.type} ({feedback.ingredients.length}{" "}
                  ingredient, {feedback.flavors.length} flavor,{" "}
                  {feedback.textures.length} texture tags)
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
        onPress={saveFeedback}
        disabled={isSaving}
      >
        <Text style={styles.submitButtonText}>
          {isSaving ? "Saving..." : "Save & Continue"}
        </Text>
      </TouchableOpacity>

      <RecipeFeedbackModal
        visible={!!activeRecipe}
        recipe={activeRecipe}
        feedbackType={activeType}
        onClose={() => setActiveRecipe(null)}
        onSubmit={handleModalSubmit}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F5F5F5",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
    textAlign: "left",
  },
  progressText: {
    textAlign: "center",
    color: "#1976D2",
    fontWeight: "600",
    marginBottom: 12,
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  recipeMeta: {
    marginTop: 4,
    marginBottom: 12,
    color: "#666",
    fontSize: 13,
  },
  actionsRow: {
    color: "#1976D2",
    textDecorationLine: "underline",
  },
  recipeMeta: {
    marginTop: 4,
    marginBottom: 12,
    color: "#666",
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  recipeImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#F0F0F0",
  },
  recipeImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
  },
  cardHeaderContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleTouchable: {
    flex: 1,
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  removeButtonText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "bold",
  },
  thumbButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbButtonLiked: {
    borderColor: "#4CAF50",
    backgroundColor: "#F1F8F4",
  },
  thumbButtonDisliked: {
    borderColor: "#D32F2F",
    backgroundColor: "#FFEBEE",
  },
  thumbEmoji: {
    fontSize: 24,
  },
  tellUsMoreButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1976D2",
    alignItems: "center",
  },
  tellUsMoreText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: "#1976D2",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statusText: {
    display: "none",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default RecipeFeedbackScreen;
