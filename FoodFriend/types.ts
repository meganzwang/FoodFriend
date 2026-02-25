// FoodFriend/types.ts

export type RootStackParamList = {
  Welcome: undefined;
  EHRLogin: undefined;
  Goals: undefined;
  MainApp: undefined;
  Preferences: undefined; // Adding a new screen for preferences
};

export type MainTabParamList = {
  Recommendations: undefined;
  Profile: undefined;
};

// Define enums for specific choices to ensure consistency and prevent typos
export enum DietaryRestriction {
  Vegetarian = 'Vegetarian',
  Vegan = 'Vegan',
  Pescatarian = 'Pescatarian',
  Halal = 'Halal',
  Kosher = 'Kosher',
  GlutenFree = 'Gluten-Free',
  DairyFree = 'Dairy-Free',
  NutFree = 'Nut-Free',
  ShellfishFree = 'Shellfish-Free',
}

export enum HealthGoal {
  OptimizeProtein = 'Optimize Protein',
  DiabetesManagement = 'Diabetes Management',
  MinimizeSugar = 'Minimize Sugar',
  WeightLoss = 'Weight Loss',
  WeightGain = 'Weight Gain',
  HeartHealth = 'Heart Health',
  BoostImmunity = 'Boost Immunity',
  QuickPrep = 'Quick Prep', // Added as a goal based on user's input
  TryNewFoods = 'Try New Foods', // Added as a goal based on user's input
}

export enum CookingStyle {
  QuickEasyMeals = 'Quick & Easy Meals',
  SimplePrep = 'Simple Prep',
  MealPrepFocus = 'Meal Prep Focus',
  ExploreNewCuisines = 'Explore New Cuisines',
  Baking = 'Baking',
  Grilling = 'Grilling',
  NoCook = 'No-Cook Meals',
}

// Interface to capture all user-defined preferences for the food recommendation model
export interface UserPreferences {
  allergies: string[]; // List of specific allergens (e.g., "Peanuts", "Soy")
  preferredFoods: string[]; // Foods the user feels comfortable eating
  dislikedIngredients: string[]; // User's food aversions, renamed for clarity
  dietaryRestrictions: DietaryRestriction[];
  healthGoals: HealthGoal[];
  cookingStyle: CookingStyle[];
  // Add other preferences here as they are identified, e.g., preferredCuisines, mealTypes, etc.
}
