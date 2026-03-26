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
import { MainTabParamList } from "../../types";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../types";
import { CONFIG } from "../config";

const STORAGE_KEY = "@user_preferences";

type RecommendationsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Recommendations">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface RecommendationsScreenProps {
  navigation: RecommendationsScreenNavigationProp;
}

interface Recipe {
  id: number;
  title: string;
  image: string;
  sourceUrl: string;
  readyInMinutes?: number;
  calories?: number | null;
  diets?: string[];
  summary?: string;
}

const RecommendationsScreen: React.FC<RecommendationsScreenProps> = ({
  navigation,
}) => {
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const preferences = saved ? JSON.parse(saved) : {};

        const response = await fetch(
          `${CONFIG.API_URL}/api/recommend-recipes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(preferences),
          },
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(
            data.error || `Request failed with status ${response.status}`,
          );
        }

        setRecommendations(data.recipes || []);
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        Alert.alert("Error", "Could not fetch recommendations.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  const handleTryRecipe = (recipe: Recipe) => {
    Alert.alert(
      "Try Recipe",
      `You've decided to try "${recipe.title}". We'll track your progress!`,
      [{ text: "OK" }],
    );
    // In a real app, you'd send this feedback to your backend
  };

  const handleFeedback = (recipe: Recipe, liked: boolean) => {
    const feedbackType = liked ? "Liked" : "Disliked";
    Alert.alert(
      feedbackType,
      `You ${feedbackType.toLowerCase()} "${recipe.title}". Thanks for your feedback!`,
      [{ text: "OK" }],
    );
    // In a real app, you'd send this feedback to your backend to refine the model
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
                  <Button
                    title="Try It"
                    onPress={() => handleTryRecipe(recipe)}
                  />
                  <Button
                    title="👍 Liked"
                    onPress={() => handleFeedback(recipe, true)}
                    color="green"
                  />
                  <Button
                    title="👎 Disliked"
                    onPress={() => handleFeedback(recipe, false)}
                    color="red"
                  />
                </View>
              </View>
            ))
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
});

export default RecommendationsScreen;
