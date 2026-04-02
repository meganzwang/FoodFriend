import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Recipe, RootStackParamList, UserPreferences } from "../../types";
import RecipeFeedbackModal from "../components/RecipeFeedbackModal";
import { CONFIG } from "../config";

type RecipeFeedbackRouteProp = RouteProp<RootStackParamList, "RecipeFeedback">;
type RecipeFeedbackNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "RecipeFeedback"
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

const mergeUnique = (existing: string[] = [], incoming: string[] = []) =>
  Array.from(new Set([...(existing || []), ...(incoming || [])]));

const RecipeFeedbackScreen: React.FC<RecipeFeedbackScreenProps> = ({
  route,
  navigation,
}) => {
  const selectedRecipes = route.params?.selectedRecipes || [];

  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [activeType, setActiveType] = useState<FeedbackType>("liked");
  const [feedbackByRecipe, setFeedbackByRecipe] = useState<
    Record<number, RecipeFeedbackEntry>
  >({});
  const [isSaving, setIsSaving] = useState(false);

  const completedCount = useMemo(
    () =>
      selectedRecipes.filter(
        (recipe) => recipe?.id != null && feedbackByRecipe[recipe.id],
      ).length,
    [selectedRecipes, feedbackByRecipe],
  );

  const openFeedbackModal = (recipe: Recipe, type: FeedbackType) => {
    setActiveRecipe(recipe);
    setActiveType(type);
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
      const [savedRaw, userId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(USER_ID_KEY),
      ]);

      const saved = savedRaw
        ? (JSON.parse(savedRaw) as Partial<UserPreferences>)
        : {};

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
      };

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...updatedPrefs, user_id: userId || undefined }),
      );

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

      Alert.alert(
        "Saved",
        "Feedback recorded. Future recipes will avoid repeats.",
        [
          {
            text: "OK",
            onPress: () =>
              navigation.navigate("MainApp", { screen: "Recommendations" }),
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", "Failed to save recipe feedback.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recipe Feedback</Text>
      <Text style={styles.subtitle}>
        Mark each selected recipe as liked or disliked, then choose why.
      </Text>

      <Text style={styles.progressText}>
        Reviewed {completedCount} of {selectedRecipes.length}
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {selectedRecipes.map((recipe) => {
          const feedback = recipe?.id ? feedbackByRecipe[recipe.id] : undefined;
          return (
            <View key={`${recipe.id}-${recipe.title}`} style={styles.card}>
              <Text style={styles.recipeTitle}>{recipe.title}</Text>
              <Text style={styles.recipeMeta}>
                {recipe.readyInMinutes
                  ? `${recipe.readyInMinutes} min`
                  : "Time N/A"}
                {recipe.calories
                  ? ` • ${Math.round(recipe.calories)} kcal`
                  : ""}
              </Text>

              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.choiceButton, styles.likeButton]}
                  onPress={() => openFeedbackModal(recipe, "liked")}
                >
                  <Text style={styles.choiceButtonText}>Liked</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.choiceButton, styles.dislikeButton]}
                  onPress={() => openFeedbackModal(recipe, "disliked")}
                >
                  <Text style={styles.choiceButtonText}>Disliked</Text>
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
          {isSaving ? "Saving..." : "Save Feedback"}
        </Text>
      </TouchableOpacity>

      <RecipeFeedbackModal
        visible={!!activeRecipe}
        recipe={activeRecipe}
        feedbackType={activeType}
        onClose={() => setActiveRecipe(null)}
        onSubmit={handleModalSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
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
  row: {
    flexDirection: "row",
    gap: 8,
  },
  choiceButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  likeButton: {
    backgroundColor: "#2E7D32",
  },
  dislikeButton: {
    backgroundColor: "#D32F2F",
  },
  choiceButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  statusText: {
    marginTop: 10,
    color: "#444",
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: "#1976D2",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
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
