// FoodFriend/types.ts

import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Login: undefined;
  Welcome: undefined;
  EHRLogin: undefined;
  Goals: undefined;
  MainApp: NavigatorScreenParams<MainTabParamList> | undefined;
  Preferences: undefined;
  IngredientRank: undefined;
  RecipeFeedback: { selectedRecipes: Recipe[] };
};

export type MainTabParamList = {
  Recommendations: undefined;
  Goals: undefined;
  Preferences: undefined;
  Profile: undefined;
};

// Define enums for specific choices to ensure consistency and prevent typos
export enum DietaryRestriction {
  Vegetarian = "Vegetarian",
  Vegan = "Vegan",
  Pescatarian = "Pescatarian",
  Halal = "Halal",
  Kosher = "Kosher",
  GlutenFree = "Gluten-Free",
  DairyFree = "Dairy-Free",
  NutFree = "Nut-Free",
  ShellfishFree = "Shellfish-Free",
}

export enum HealthGoal {
  OptimizeProtein = "Optimize Protein",
  DiabetesManagement = "Diabetes Management",
  MinimizeSugar = "Minimize Sugar",
  WeightLoss = "Weight Loss",
  WeightGain = "Weight Gain",
  HeartHealth = "Heart Health",
  BoostImmunity = "Boost Immunity",
  QuickPrep = "Quick Prep", // Added as a goal based on user's input
  TryNewFoods = "Try New Foods", // Added as a goal based on user's input
}

export enum CookingStyle {
  QuickEasyMeals = "Quick & Easy Meals",
  SimplePrep = "Simple Prep",
  MealPrepFocus = "Meal Prep Focus",
  ExploreNewCuisines = "Explore New Cuisines",
  Baking = "Baking",
  Grilling = "Grilling",
  NoCook = "No-Cook Meals",
}

export const INTOLERANCES = [
  "dairy",
  "egg",
  "gluten",
  "grain",
  "peanut",
  "seafood",
  "sesame",
  "shellfish",
  "soy",
  "sulfite",
  "tree_nut",
  "wheat",
];

export const DIETS = [
  "gluten_free",
  "ketogenic",
  "vegetarian",
  "lacto_vegetarian",
  "ovo_vegetarian",
  "vegan",
  "pescetarian",
  "paleo",
  "primal",
  "low_fodmap",
  "whole30",
];

export const NUTRIENT_GOALS = [
  "calories",
  "protein",
  "fat",
  "sodium",
  "fiber",
  "sugar",
  "saturated_fat",
  "iron",
];

export const FLAVORS = [
  "sweet",
  "salty",
  "sour",
  "bitter",
  "savory",
  "fatty",
  "spicy",
  "neutral",
];

export const TEXTURES = [
  "Tender",
  "Juicy",
  "Smooth",
  "Chewy",
  "Crunchy",
  "Liquid",
  "Creamy",
  "Crispy",
  "Powdery",
  "Flaky",
  "Gooey",
  "Soft",
  "Slimy",
  "Crumbly",
  "Fluffy",
  "Moist",
  "Sticky",
  "Dry",
  "Oily",
  "Hard",
];

export const CUISINES = [
  "African",
  "Asian",
  "American",
  "British",
  "Cajun",
  "Caribbean",
  "Chinese",
  "Eastern European",
  "European",
  "French",
  "German",
  "Greek",
  "Indian",
  "Irish",
  "Italian",
  "Japanese",
  "Jewish",
  "Korean",
  "Latin American",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Nordic",
  "Southern",
  "Spanish",
  "Thai",
  "Vietnamese",
];

export interface Recipe {
  id: number;
  title: string;
  image: string;
  sourceUrl: string;
  readyInMinutes?: number;
  calories?: number | null;
  diets?: string[];
  summary?: string;
  ingredients?: string[];
}

// Interface to capture all user-defined preferences for the food recommendation model
export interface UserPreferences {
  name?: string;
  intolerances: string[];
  diet: string[];
  increase_goals: string[];
  decrease_goals: string[];
  preferred_foods: string[];
  disliked_foods: string[];
  liked_flavors: string[];
  disliked_flavors: string[];
  liked_textures: string[];
  disliked_textures: string[];
  liked_recipe_ingredients: string[];
  disliked_recipe_ingredients: string[];
  liked_recipe_flavors: string[];
  disliked_recipe_flavors: string[];
  liked_recipe_textures: string[];
  disliked_recipe_textures: string[];
  cuisines: string[];
  tried_recipe_ids?: number[];

  // Legacy fields (optional for backward compatibility)
  flavors?: string[];
  texture?: string[];
  allergies?: string[];
  preferredFoods?: string[];
  dislikedIngredients?: string[];
  dietaryRestrictions?: DietaryRestriction[];
  healthGoals?: HealthGoal[];
  cookingStyle?: CookingStyle[];
}
