// FoodFriend/App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import LoginScreen from "./src/screens/LoginScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import EHRLoginScreen from "./src/screens/EHRLoginScreen";
import GoalsScreen from "./src/screens/GoalsScreen";
import RecommendationsScreen from "./src/screens/RecommendationsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import PreferencesScreen from "./src/screens/PreferencesScreen";
import IngredientRankScreen from "./src/screens/IngredientRankScreen";
import GroceryListScreen from "./src/screens/GroceryListScreen";
import AllTriedRecipesScreen from "./src/screens/AllTriedRecipesScreen";
import { Ionicons } from "@expo/vector-icons";
import { MainTabParamList, RootStackParamList } from "./types";

const RecipeFeedbackScreen =
  require("./src/screens/RecipeFeedbackScreen").default;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main tab navigator for screens accessible after onboarding/login
function MainAppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "ThisWeekRecipes") {
            iconName = focused ? "nutrition" : "nutrition-outline";
          } else if (route.name === "ThisWeekGroceries") {
            iconName = focused ? "basket" : "basket-outline";
          } else if (route.name === "AllTriedRecipes") {
            iconName = focused ? "library" : "library-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else {
            iconName = "ellipse-outline";
          }
          // You can return any component that you like here!
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: "tomato",
        tabBarInactiveTintColor: "gray",
        headerShown: false, // Hide header for tab screens, managed by stack
      })}
    >
      <Tab.Screen
        name="ThisWeekRecipes"
        component={RecipeFeedbackScreen}
        options={{ title: "This Week's Recipes" }}
      />
      <Tab.Screen
        name="ThisWeekGroceries"
        component={GroceryListScreen}
        options={{ title: "This Week's Groceries" }}
      />
      <Tab.Screen
        name="AllTriedRecipes"
        component={AllTriedRecipesScreen}
        options={{ title: "All Tried Recipes" }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EHRLogin"
          component={EHRLoginScreen}
          options={{ title: "Connect to EHR" }}
        />
        <Stack.Screen
          name="Goals"
          component={GoalsScreen}
          options={{ title: "Your Goals" }}
        />
        <Stack.Screen
          name="Preferences"
          component={PreferencesScreen}
          options={{ title: "My Preferences" }}
        />
        <Stack.Screen
          name="IngredientRank"
          component={IngredientRankScreen}
          options={{ title: "Rankings" }}
        />
        <Stack.Screen
          name="RecipeFeedback"
          component={RecipeFeedbackScreen}
          options={{ title: "Recipe Feedback" }}
        />
        <Stack.Screen
          name="RecipePicker"
          component={RecommendationsScreen}
          options={{ title: "Pick Recipes" }}
        />
        {/* After onboarding, the user enters the main app with tabs */}
        <Stack.Screen
          name="MainApp"
          component={MainAppTabs}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
