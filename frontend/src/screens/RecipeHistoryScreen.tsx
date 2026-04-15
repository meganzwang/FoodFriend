import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TriedRecipe, UserPreferences, Recipe } from "../../types";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../types";
import {
  getCurrentUserId,
  loadWeeklySelectedRecipes,
  saveWeeklySelectedRecipes,
} from "../utils/weeklySelectedRecipes";

type FilterType = "all" | "liked" | "disliked";

const STORAGE_KEY = "@user_preferences";

type RecipeHistoryNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "RecipePicker"
>;

const RecipeHistoryScreen: React.FC = () => {
  const navigation = useNavigation<RecipeHistoryNavigationProp>();
  const [recipes, setRecipes] = useState<TriedRecipe[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const prefs: Partial<UserPreferences> = saved ? JSON.parse(saved) : {};
        setRecipes(prefs.tried_recipes || []);
      } catch (error) {
        console.error("Failed to load recipe history", error);
      }
    };

    load();
  }, []);

  const filteredRecipes = useMemo(() => {
    if (filter === "all") return recipes;
    return recipes.filter((recipe) => recipe.feedbackType === filter);
  }, [recipes, filter]);

  const openRecipe = async (url: string) => {
    if (!url) {
      Alert.alert("No link", "Recipe link is unavailable.");
      return;
    }

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Error", "Cannot open this recipe link.");
      return;
    }

    await Linking.openURL(url);
  };

  const toggleRecipeSelection = (recipeId: number) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId],
    );
  };

  const handleAddToWeekly = async () => {
    if (selectedRecipeIds.length === 0) {
      Alert.alert(
        "Select Recipes",
        "Choose at least one recipe to add to this week.",
      );
      return;
    }

    const selectedRecipes: Recipe[] = recipes
      .filter((recipe) => selectedRecipeIds.includes(recipe.id))
      .map((triedRecipe) => ({
        id: triedRecipe.id,
        title: triedRecipe.title,
        image: triedRecipe.image,
        sourceUrl: triedRecipe.sourceUrl,
        calories: triedRecipe.calories,
        protein: triedRecipe.protein,
        fat: triedRecipe.fat,
        sodium: triedRecipe.sodium,
        fiber: triedRecipe.fiber,
        sugar: triedRecipe.sugar,
        saturated_fat: triedRecipe.saturated_fat,
        iron: triedRecipe.iron,
        readyInMinutes: triedRecipe.readyInMinutes,
        ingredients: triedRecipe.ingredients,
        diets: triedRecipe.diets,
        summary: triedRecipe.summary,
      }));

    try {
      const currentUserId = await getCurrentUserId();
      const existingRecipes = await loadWeeklySelectedRecipes(currentUserId);

      // Merge, removing duplicates by ID
      const recipeMap = new Map<number, Recipe>();
      [...existingRecipes, ...selectedRecipes].forEach((recipe) => {
        recipeMap.set(recipe.id, recipe);
      });

      const mergedRecipes = Array.from(recipeMap.values());

      await saveWeeklySelectedRecipes(mergedRecipes, currentUserId);

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "MainApp",
            state: {
              routes: [
                {
                  name: "ThisWeekRecipes",
                  params: { selectedRecipes: mergedRecipes },
                },
              ],
            },
          },
        ],
      });
    } catch (error) {
      Alert.alert("Error", "Failed to add recipes. Please try again.");
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{"←"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recipe History</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, filter === "all" && styles.filterActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={styles.filterText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === "liked" && styles.filterActive,
              styles.filterLiked,
            ]}
            onPress={() => setFilter("liked")}
          >
            <Text style={styles.filterText}>Liked</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === "disliked" && styles.filterActive,
              styles.filterDisliked,
            ]}
            onPress={() => setFilter("disliked")}
          >
            <Text style={styles.filterText}>Disliked</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filteredRecipes.length === 0 ? (
          <Text style={styles.emptyText}>
            No recipes found for this filter.
          </Text>
        ) : (
          filteredRecipes.map((recipe, index) => (
            <View key={`${recipe.id}-${index}`} style={styles.card}>
              {!!recipe.image && (
                <Image source={{ uri: recipe.image }} style={styles.image} />
              )}
              <Text style={styles.recipeTitle}>{recipe.title}</Text>
              <Text style={styles.recipeMeta}>
                Status: {recipe.feedbackType} • In History{" "}
                {new Date(recipe.triedAt).toLocaleDateString()}
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => openRecipe(recipe.sourceUrl)}
                >
                  <Text style={styles.linkButtonText}>View Recipe</Text>
                </TouchableOpacity>
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
                      ? "Added"
                      : "Add to Week"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {selectedRecipeIds.length > 0 && (
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleAddToWeekly}
        >
          <Text style={styles.confirmButtonText}>
            Add {selectedRecipeIds.length} Recipe
            {selectedRecipeIds.length > 1 ? "s" : ""} to This Week
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
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
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
    alignItems: "center",
  },
  filterActive: {
    borderWidth: 2,
    borderColor: "#333",
  },
  filterLiked: {
    backgroundColor: "#E8F5E9",
  },
  filterDisliked: {
    backgroundColor: "#FFEBEE",
  },
  filterText: {
    color: "#333",
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    marginTop: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  recipeMeta: {
    marginTop: 4,
    color: "#666",
    marginBottom: 10,
  },
  linkButton: {
    flex: 1,
    backgroundColor: "#1976D2",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  linkButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  selectButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#1976D2",
    alignItems: "center",
  },
  selectButtonActive: {
    backgroundColor: "#1976D2",
  },
  selectButtonText: {
    color: "#1976D2",
    fontWeight: "700",
  },
  selectButtonTextActive: {
    color: "#fff",
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});

export default RecipeHistoryScreen;
