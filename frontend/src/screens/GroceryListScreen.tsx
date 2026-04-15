import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Recipe } from "../../types";
import {
  getCurrentUserId,
  loadWeeklySelectedRecipes,
} from "../utils/weeklySelectedRecipes";

const GroceryListScreen: React.FC = () => {
  const [selectedRecipes, setSelectedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSelectedRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const currentUserId = await getCurrentUserId();
      const recipes = await loadWeeklySelectedRecipes(currentUserId);
      setSelectedRecipes(recipes);
    } catch (error) {
      console.warn("Unable to load weekly selected recipes", error);
      setSelectedRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSelectedRecipes();
    }, [loadSelectedRecipes]),
  );

  useEffect(() => {
    void loadSelectedRecipes();
  }, [loadSelectedRecipes]);

  const groceryItems = useMemo(() => {
    const rawIngredients = selectedRecipes.flatMap(
      (recipe) => recipe.ingredients || [],
    );
    const cleaned = rawIngredients
      .map((ingredient) => ingredient?.toString().trim())
      .filter((ingredient): ingredient is string => !!ingredient);

    const uniqueMap = new Map<string, string>();
    cleaned.forEach((ingredient) => {
      const key = ingredient.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ingredient);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b));
  }, [selectedRecipes]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>This Week's Groceries</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Ingredients from your selected recipes
        </Text>

      {selectedRecipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.body}>
            No recipes selected yet. Pick recipes from "This Week's Recipes"
            first, and this tab will build a grocery list automatically.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              {selectedRecipes.length} recipe
              {selectedRecipes.length === 1 ? "" : "s"} selected
            </Text>
            <Text style={styles.summaryText}>
              {groceryItems.length} grocery item
              {groceryItems.length === 1 ? "" : "s"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected Recipes</Text>
            {selectedRecipes.map((recipe) => (
              <View
                key={`${recipe.id}-${recipe.title}`}
                style={styles.recipeRow}
              >
                <Text style={styles.recipeName}>{recipe.title}</Text>
                <Text style={styles.recipeMeta}>
                  {recipe.readyInMinutes
                    ? `${recipe.readyInMinutes} min`
                    : "Time N/A"}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grocery List</Text>
            {groceryItems.length === 0 ? (
              <Text style={styles.body}>
                Selected recipes don’t include ingredient details yet. Try
                selecting recipes that return ingredient lists.
              </Text>
            ) : (
              groceryItems.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.listItem}>
                  <Text style={styles.listIndex}>{index + 1}.</Text>
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={loadSelectedRecipes}
      >
        <Text style={styles.refreshButtonText}>Refresh grocery list</Text>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1976D2",
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 14,
  },
  emptyContainer: {
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 18,
  },
  summaryText: {
    fontSize: 15,
    color: "#333",
    marginBottom: 4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 10,
  },
  recipeRow: {
    marginBottom: 10,
  },
  recipeName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  recipeMeta: {
    fontSize: 13,
    color: "#777",
    marginTop: 4,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  listIndex: {
    fontSize: 14,
    color: "#4CAF50",
    width: 26,
    fontWeight: "700",
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  refreshButton: {
    marginTop: 10,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#4CAF50",
  },
  refreshButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default GroceryListScreen;
