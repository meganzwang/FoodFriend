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
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Main tab navigator for screens accessible after onboarding/login
function MainAppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "Recommendations") {
            iconName = focused ? "nutrition" : "nutrition-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }
          // You can return any component that you like here!
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: "tomato",
        tabBarInactiveTintColor: "gray",
        headerShown: false, // Hide header for tab screens, managed by stack
      })}
    >
      <Tab.Screen name="Recommendations" component={RecommendationsScreen} />
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
