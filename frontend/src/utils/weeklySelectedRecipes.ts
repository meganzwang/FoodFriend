import AsyncStorage from "@react-native-async-storage/async-storage";
import { Recipe } from "../../types";

export const USER_ID_KEY = "@food_friend_user_id";
export const WEEKLY_SELECTED_RECIPES_KEY = "@weekly_selected_recipes";

type WeeklySelectedRecipesPayload = {
  user_id?: string;
  recipes: Recipe[];
};

const asRecipeArray = (value: unknown): Recipe[] =>
  Array.isArray(value) ? (value as Recipe[]) : [];

export const getCurrentUserId = async (): Promise<string | null> =>
  AsyncStorage.getItem(USER_ID_KEY);

export const loadWeeklySelectedRecipes = async (
  currentUserId?: string | null,
): Promise<Recipe[]> => {
  const stored = await AsyncStorage.getItem(WEEKLY_SELECTED_RECIPES_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as
      | WeeklySelectedRecipesPayload
      | Recipe[];

    // Legacy format: plain array without user ownership. Ignore to prevent cross-user leaks.
    if (Array.isArray(parsed)) {
      await AsyncStorage.removeItem(WEEKLY_SELECTED_RECIPES_KEY);
      return [];
    }

    const ownerUserId = parsed?.user_id;
    if (currentUserId && ownerUserId && ownerUserId !== currentUserId) {
      return [];
    }

    if (currentUserId && !ownerUserId) {
      return [];
    }

    return asRecipeArray(parsed?.recipes);
  } catch {
    await AsyncStorage.removeItem(WEEKLY_SELECTED_RECIPES_KEY);
    return [];
  }
};

export const saveWeeklySelectedRecipes = async (
  recipes: Recipe[],
  currentUserId?: string | null,
): Promise<void> => {
  const payload: WeeklySelectedRecipesPayload = {
    recipes: asRecipeArray(recipes),
  };

  if (currentUserId) {
    payload.user_id = currentUserId;
  }

  await AsyncStorage.setItem(
    WEEKLY_SELECTED_RECIPES_KEY,
    JSON.stringify(payload),
  );
};
