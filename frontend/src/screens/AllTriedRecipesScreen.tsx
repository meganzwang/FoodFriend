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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TriedRecipe, UserPreferences } from "../../types";

type FilterType = "all" | "liked" | "disliked";

const STORAGE_KEY = "@user_preferences";

const AllTriedRecipesScreen: React.FC = () => {
  const [recipes, setRecipes] = useState<TriedRecipe[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const prefs: Partial<UserPreferences> = saved ? JSON.parse(saved) : {};
        setRecipes(prefs.tried_recipes || []);
      } catch (error) {
        console.error("Failed to load tried recipes", error);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Tried Recipes</Text>

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
                Status: {recipe.feedbackType} • Tried{" "}
                {new Date(recipe.triedAt).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => openRecipe(recipe.sourceUrl)}
              >
                <Text style={styles.linkButtonText}>View Recipe</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
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
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
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
    backgroundColor: "#1976D2",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  linkButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});

export default AllTriedRecipesScreen;
