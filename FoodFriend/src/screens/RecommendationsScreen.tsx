// FoodFriend/src/screens/RecommendationsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Button, Alert } from 'react-native';
import { MainTabParamList } from '../../types';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';

type RecommendationsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Recommendations'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface RecommendationsScreenProps {
  navigation: RecommendationsScreenNavigationProp;
}

interface Recipe {
  id: string;
  title: string;
  image: string;
  description: string;
}

const mockRecommendations: Recipe[] = [
  {
    id: '1',
    title: 'Simple Chicken and Rice',
    image: 'https://images.unsplash.com/photo-1519708227418-d36c01740524?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjVlMzF8MHwxfGFsbHwxfHx8fHx8fHwxNjQyNjk5MjQy&ixlib=rb-1.2.1&q=80&w=400',
    description: 'A comforting and familiar dish, easy to digest and prepare. Great for broadening palettes with gentle flavors.'
  },
  {
    id: '2',
    title: 'Creamy Tomato Pasta',
    image: 'https://images.unsplash.com/photo-1555939594-58d7ab87130f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjVlMzF8MHwxfGFsbHwxfHx8fHx8fHwxNjQyNjk5MjQy&ixlib=rb-1.2.1&q=80&w=400',
    description: 'Smooth texture with a mild tomato flavor, good for those sensitive to strong tastes.'
  },
  {
    id: '3',
    title: 'Crispy Baked Sweet Potato Fries',
    image: 'https://images.unsplash.com/photo-1620703816766-3d2315b9c037?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjVlMzF8MHwxfGFsbHwxfHx8fHx8fHwxNjY2MTA4ODMy&ixlib=rb-4.0.3&q=80&w=400',
    description: 'Sweet and crunchy, a great way to introduce a new vegetable with a preferred texture.'
  },
];

const RecommendationsScreen: React.FC<RecommendationsScreenProps> = ({ navigation }) => {
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching recommendations from the backend
    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        // Replace with actual API call to your FastAPI backend
        // const response = await fetch('http://localhost:3001/api/recommendations');
        // const data = await response.json();
        // setRecommendations(data);

        // For now, use mock data
        setTimeout(() => {
          setRecommendations(mockRecommendations);
          setIsLoading(false);
        }, 1500); // Simulate network delay
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        Alert.alert("Error", "Could not fetch recommendations.");
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  const handleTryRecipe = (recipe: Recipe) => {
    Alert.alert(
      "Try Recipe",
      `You've decided to try "${recipe.title}". We'll track your progress!`,
      [{ text: "OK" }]
    );
    // In a real app, you'd send this feedback to your backend
  };

  const handleFeedback = (recipe: Recipe, liked: boolean) => {
    const feedbackType = liked ? "Liked" : "Disliked";
    Alert.alert(
      feedbackType,
      `You ${feedbackType.toLowerCase()} "${recipe.title}". Thanks for your feedback!`,
      [{ text: "OK" }]
    );
    // In a real app, you'd send this feedback to your backend to refine the model
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Weekly Recommendations</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loadingIndicator} />
      ) : (
        <ScrollView contentContainerStyle={styles.recommendationsList}>
          {recommendations.map(recipe => (
            <View key={recipe.id} style={styles.recipeCard}>
              <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
              <Text style={styles.recipeTitle}>{recipe.title}</Text>
              <Text style={styles.recipeDescription}>{recipe.description}</Text>
              <View style={styles.buttonRow}>
                <Button title="Try It" onPress={() => handleTryRecipe(recipe)} />
                <Button title="👍 Liked" onPress={() => handleFeedback(recipe, true)} color="green" />
                <Button title="👎 Disliked" onPress={() => handleFeedback(recipe, false)} color="red" />
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  loadingIndicator: {
    marginTop: 50,
  },
  recommendationsList: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    width: '100%',
    maxWidth: 400, // Optional: for larger screens
    elevation: 3, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  recipeImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  }
});

export default RecommendationsScreen;
