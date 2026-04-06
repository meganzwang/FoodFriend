// FoodFriend/App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
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
import MyProgressScreen from "./src/screens/MyProgressScreen";
import { Ionicons } from "@expo/vector-icons";
import { MainTabParamList, RootStackParamList } from "./types";

const RecipeFeedbackScreen =
  require("./src/screens/RecipeFeedbackScreen").default;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main tab navigator for screens accessible after onboarding/login
function MainAppTabs() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
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
            } else if (route.name === "MyProgress") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Profile") {
              iconName = focused ? "person" : "person-outline";
            } else {
              iconName = "ellipse-outline";
            }
            return <Ionicons name={iconName as any} size={size} color={color} />;
          },
          tabBarActiveTintColor: "tomato",
          tabBarInactiveTintColor: "gray",
          tabBarLabelStyle: {
            fontSize: 11,
            marginTop: 4,
            marginBottom: 4,
          },
          headerShown: false,
        })}
      >
      <Tab.Screen
        name="ThisWeekRecipes"
        component={RecipeFeedbackScreen}
        options={{ title: "Recipes" }}
      />
      <Tab.Screen
        name="ThisWeekGroceries"
        component={GroceryListScreen}
        options={{ title: "Grocery" }}
      />
      <Tab.Screen
        name="AllTriedRecipes"
        component={AllTriedRecipesScreen}
        options={{ title: "Tried" }}
      />
      <Tab.Screen
        name="MyProgress"
        component={MyProgressScreen}
        options={{ title: "Progress" }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F5F5F5"
        translucent={false}
      />
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
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Preferences"
          component={PreferencesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RecipeFeedback"
          component={RecipeFeedbackScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RecipePicker"
          component={RecommendationsScreen}
          options={{ headerShown: false }}
        />
        {/* After onboarding, the user enters the main app with tabs */}
        <Stack.Screen
          name="MainApp"
          component={MainAppTabs}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  </>
  );
}
