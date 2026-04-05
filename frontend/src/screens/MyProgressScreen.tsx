import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
// import { Picker } from '@react-native-picker/picker';
import Modal from 'react-native-modal';
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { NUTRIENT_GOALS, TriedRecipe, UserPreferences } from "../../types";

const STORAGE_KEY = "@user_preferences";
const WEEKLY_SELECTED_RECIPES_KEY = "@weekly_selected_recipes";

type StatisticType =
  | "new_foods_tried"
  | "recipes_liked"
  | "recipes_disliked"
  | "total_recipes"
  | "repeat_recipes";

type NutrientGoal = typeof NUTRIENT_GOALS[number];

type TrendPoint = {
  label: string;
  value: number;
  count: number;
};

interface Statistic {
  id: StatisticType;
  label: string;
  value: string | number;
  subtitle?: string;
}

const nutrientLabels: Record<NutrientGoal, string> = {
  calories: "Calories",
  protein: "Protein",
  fat: "Fat",
  sodium: "Sodium",
  fiber: "Fiber",
  sugar: "Sugar",
  saturated_fat: "Saturated Fat",
  iron: "Iron",
};

const nutrientUnits: Record<NutrientGoal, string> = {
  calories: "kcal",
  protein: "g",
  fat: "g",
  sodium: "mg",
  fiber: "g",
  sugar: "g",
  saturated_fat: "g",
  iron: "mg",
};

const MyProgressScreen: React.FC = () => {
  const [preferences, setPreferences] = useState<Partial<UserPreferences> | null>(null);
  const [weeklyRecipes, setWeeklyRecipes] = useState<TriedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportStats, setSelectedReportStats] = useState<StatisticType[]>([
    "new_foods_tried",
    "recipes_liked",
    "total_recipes",
  ]);
  // Only show nutrients that are in user's goals, fallback to all if none
  const userGoalNutrients: NutrientGoal[] = useMemo(() => {
    const inc = (preferences?.increase_goals || []) as string[];
    const dec = (preferences?.decrease_goals || []) as string[];
    const allGoals = Array.from(new Set([...(inc || []), ...(dec || [])]));
    // Map goal names to nutrient keys if needed
    const mapping: Record<string, NutrientGoal> = {
      protein: 'protein',
      fat: 'fat',
      sodium: 'sodium',
      fiber: 'fiber',
      sugar: 'sugar',
      calories: 'calories',
      'saturated fat': 'saturated_fat',
      iron: 'iron',
    };
    const filtered = allGoals.map(g => mapping[g.toLowerCase()]).filter(Boolean) as NutrientGoal[];
    return filtered.length > 0 ? filtered : NUTRIENT_GOALS;
  }, [preferences]);

  const [selectedNutrient, setSelectedNutrient] = useState<NutrientGoal>("calories");
  const [includeIngredientsInPdf, setIncludeIngredientsInPdf] = useState(true);
  const [includeNutrientInPdf, setIncludeNutrientInPdf] = useState(false);
  // For PDF, allow multi-select
  const [selectedPdfNutrients, setSelectedPdfNutrients] = useState<NutrientGoal[]>(["calories"]);
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [includeRecipesLiked, setIncludeRecipesLiked] = useState(false);
  const [includeRecipesDisliked, setIncludeRecipesDisliked] = useState(false);
  const [includeTotalRecipes, setIncludeTotalRecipes] = useState(false);
  const [includeRepeatRecipesInPdf, setIncludeRepeatRecipesInPdf] = useState(false);

  const availableStatistics: Array<{ id: StatisticType; label: string }> = [
    { id: "new_foods_tried", label: "New Foods Tried" },
    { id: "recipes_liked", label: "Recipes Liked" },
    { id: "recipes_disliked", label: "Recipes Disliked" },
    { id: "total_recipes", label: "Total Recipes Tried" },
    { id: "repeat_recipes", label: "Recipes Re-added to Week" },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [saved, weekly] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(WEEKLY_SELECTED_RECIPES_KEY),
        ]);

        if (saved) setPreferences(JSON.parse(saved));
        if (weekly) setWeeklyRecipes(JSON.parse(weekly));
      } catch (error) {
        console.warn("Could not load progress data", error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const triedRecipes = useMemo(() => {
    return ((preferences?.tried_recipes || []) as TriedRecipe[]).sort((a, b) =>
      b.triedAt.localeCompare(a.triedAt),
    );
  }, [preferences]);

  const weeklyRecipeIds = useMemo(
    () => new Set(weeklyRecipes.map((recipe) => recipe.id)),
    [weeklyRecipes],
  );

  const repeatRecipes = useMemo(
    () => triedRecipes.filter((recipe) => weeklyRecipeIds.has(recipe.id)),
    [triedRecipes, weeklyRecipeIds],
  );

  const uniqueIngredients = useMemo(() => {
    const ingredients = new Set<string>();
    triedRecipes.forEach((recipe) => {
      (recipe.ingredients || []).forEach((ingredient) => {
        if (ingredient && typeof ingredient === "string") {
          ingredients.add(ingredient.toLowerCase().trim());
        }
      });
    });
    return Array.from(ingredients).sort();
  }, [triedRecipes]);

  const statistics = useMemo((): Statistic[] => {
    const liked_count = triedRecipes.filter((r) => r.feedbackType === "liked").length;
    const disliked_count = triedRecipes.filter((r) => r.feedbackType === "disliked").length;
    const total_count = triedRecipes.length;
    const repeat_count = repeatRecipes.length;

    return [
      {
        id: "new_foods_tried",
        label: "New Foods Tried",
        value: uniqueIngredients.length,
      },
      {
        id: "recipes_liked",
        label: "Recipes Liked",
        value: liked_count,
      },
      {
        id: "recipes_disliked",
        label: "Recipes Disliked",
        value: disliked_count,
      },
      {
        id: "total_recipes",
        label: "Total Recipes Tried",
        value: total_count,
      },
      {
        id: "repeat_recipes",
        label: "Recipes Re-added to Week",
        value: repeat_count,
      },
    ];
  }, [repeatRecipes.length, triedRecipes.length, uniqueIngredients.length]);

  const nutrientAverage = useMemo(() => {
    if (triedRecipes.length === 0) return 0;
    const total = triedRecipes.reduce((sum, recipe) => {
      const value = Number((recipe as any)[selectedNutrient] ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    return total / triedRecipes.length;
  }, [selectedNutrient, triedRecipes]);

  const displayedStats = statistics;
  const repeatRecipeTitles = useMemo(
    () => repeatRecipes.map((recipe) => recipe.title),
    [repeatRecipes],
  );

  const toggleStatistic = (id: StatisticType) => {
    setSelectedReportStats((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectedReportValues = useMemo(() => {
    return statistics.filter((stat) => selectedReportStats.includes(stat.id));
  }, [statistics, selectedReportStats]);

  // For PDF, compute averages for all selected nutrients
  const selectedPdfNutrientAverages = useMemo(() => {
    if (triedRecipes.length === 0) return {};
    const result: Record<NutrientGoal, number> = {};
    selectedPdfNutrients.forEach((nutrient) => {
      const total = triedRecipes.reduce((sum, recipe) => {
        const value = Number((recipe as any)[nutrient] ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      result[nutrient] = total / triedRecipes.length;
    });
    return result;
  }, [selectedPdfNutrients, triedRecipes]);

  const trendPoints = useMemo<TrendPoint[]>(() => {
    const grouped: Record<string, { total: number; count: number }> = {};
    triedRecipes.forEach((recipe) => {
      const dateKey = recipe.triedAt ? recipe.triedAt.slice(0, 10) : "Unknown";
      const value = Number((recipe as any)[selectedNutrient] ?? 0);
      if (!grouped[dateKey]) {
        grouped[dateKey] = { total: 0, count: 0 };
      }
      grouped[dateKey].total += Number.isFinite(value) ? value : 0;
      grouped[dateKey].count += 1;
    });

    return Object.entries(grouped)
      .map(([date, stats]) => ({
        label: date,
        value: stats.count > 0 ? stats.total / stats.count : 0,
        count: stats.count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedNutrient, triedRecipes]);

  // For PDF, compute trend points for all selected nutrients
  const pdfTrendPoints = useMemo(() => {
    const result: Record<NutrientGoal, TrendPoint[]> = {};
    selectedPdfNutrients.forEach((nutrient) => {
      const grouped: Record<string, { total: number; count: number }> = {};
      triedRecipes.forEach((recipe) => {
        const dateKey = recipe.triedAt ? recipe.triedAt.slice(0, 10) : "Unknown";
        const value = Number((recipe as any)[nutrient] ?? 0);
        if (!grouped[dateKey]) {
          grouped[dateKey] = { total: 0, count: 0 };
        }
        grouped[dateKey].total += Number.isFinite(value) ? value : 0;
        grouped[dateKey].count += 1;
      });
      result[nutrient] = Object.entries(grouped)
        .map(([date, stats]) => ({
          label: date,
          value: stats.count > 0 ? stats.total / stats.count : 0,
          count: stats.count,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });
    return result;
  }, [selectedPdfNutrients, triedRecipes]);

  const buildReportHtml = () => {
    const sections: string[] = [];
    sections.push(`<h1>FoodFriend Progress Report</h1>`);
    sections.push(`<p>Generated on ${new Date().toLocaleDateString()}</p>`);

    // Ingredients tried
    if (includeIngredientsInPdf) {
      sections.push(`<h2>New ingredients you have tried</h2>`);
      if (uniqueIngredients.length > 0) {
        sections.push(`<p>${uniqueIngredients.length} unique ingredients tried.</p>`);
        sections.push(`<p>${uniqueIngredients.slice(0, 20).join(", ")}${uniqueIngredients.length > 20 ? ", ..." : ""}</p>`);
      } else {
        sections.push(`<p>No ingredient history available yet.</p>`);
      }
    }

    // Nutrient progress and ingredient trend
    if (includeNutrientInPdf) {
      sections.push(`<h2>Nutrient Progress</h2>`);
      selectedPdfNutrients.forEach((nutrient) => {
        const avg = selectedPdfNutrientAverages[nutrient] ?? 0;
        sections.push(`<p>Average <strong>${nutrientLabels[nutrient]}</strong> per meal: <strong>${avg.toFixed(0)}</strong></p>`);
      });
    }


    // Comprehensive summary for recipes
    if (includeRecipesLiked || includeRecipesDisliked || includeTotalRecipes || includeRepeatRecipesInPdf) {
      const liked = triedRecipes.filter(r => r.feedbackType === "liked");
      const disliked = triedRecipes.filter(r => r.feedbackType === "disliked");
      const total = triedRecipes.length;
      const readded = repeatRecipeTitles.length;
      sections.push(`<h2>Recipes Tried</h2>`);
      sections.push(`<p>${total} total &mdash; ${liked.length} liked, ${disliked.length} disliked, ${readded} re-added to this week's plan.</p>`);
      if (liked.length > 0) {
        sections.push(`<strong>Liked:</strong> <ul>`);
        liked.forEach(r => sections.push(`<li>${r.title}</li>`));
        sections.push(`</ul>`);
      }
      if (disliked.length > 0) {
        sections.push(`<strong>Disliked:</strong> <ul>`);
        disliked.forEach(r => sections.push(`<li>${r.title}</li>`));
        sections.push(`</ul>`);
      }
      if (readded > 0) {
        sections.push(`<strong>Re-added:</strong> <ul>`);
        repeatRecipeTitles.forEach((title) => {
          sections.push(`<li>${title}</li>`);
        });
        sections.push(`</ul>`);
      }
    }

    if (
      !includeIngredientsInPdf &&
      !includeNutrientInPdf &&
      !includeRecipesLiked &&
      !includeRecipesDisliked &&
      !includeTotalRecipes &&
      !includeRepeatRecipesInPdf
    ) {
      sections.push(`<p>No report options selected. Please enable content before generating the PDF.</p>`);
    }

    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>FoodFriend Progress Report</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #222; background: #f8fafc; }
          h1 { color: #2d6cdf; margin-bottom: 0.5em; }
          h2 { color: #222; margin-top: 1.5em; margin-bottom: 0.5em; }
          ul { padding-left: 20px; }
          li { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #e0e0e0; padding: 8px; text-align: left; }
          th { background: #e3f2fd; color: #1976d2; }
          td { background: #fff; }
          strong { color: #222; }
          p { margin: 0.5em 0; }
        </style>
      </head>
      <body>
        ${sections.join("")}
      </body>
      </html>`;
  };

  const handleGeneratePDF = async () => {
    if (
      selectedReportValues.length === 0 &&
      !includeNutrientInPdf &&
      !includeIngredientsInPdf &&
      !includeRepeatRecipesInPdf &&
      !includeTrendInPdf
    ) {
      Alert.alert(
        "Report Incomplete",
        "Please select at least one content section before generating the PDF.",
      );
      return;
    }

    try {
      const html = buildReportHtml();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share your FoodFriend progress report",
        });
      } else {
        Alert.alert(
          "PDF generated",
          `Your report is saved at ${uri}`,
        );
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("PDF Error", "Could not generate the PDF report.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>My Progress</Text>
        <Text style={styles.subtitle}>Track your food journey</Text>

        <View style={styles.statsGrid}>
          {displayedStats.map((stat) => (
            <View key={stat.id} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {stat.subtitle && (
                <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrient Progress</Text>
          <Text style={styles.sectionSubtitle}>Select nutrient to view progress:</Text>
          <View style={styles.nutrientButtonsRow}>
            {userGoalNutrients.map((nutrient) => (
              <TouchableOpacity
                key={nutrient}
                style={
                  nutrient === selectedNutrient
                    ? styles.nutrientButtonSelected
                    : styles.nutrientButton
                }
                onPress={() => setSelectedNutrient(nutrient)}
              >
                <Text
                  style={
                    nutrient === selectedNutrient
                      ? styles.nutrientButtonTextSelected
                      : styles.nutrientButtonText
                  }
                >
                  {nutrientLabels[nutrient]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.nutrientCard}>
            <Text style={styles.nutrientAmount}>
              {nutrientAverage.toFixed(0)} {nutrientUnits[selectedNutrient]}
            </Text>
            <Text style={styles.nutrientLabel}>
              Average {nutrientLabels[selectedNutrient]} per meal (weekly)
            </Text>
          </View>
          {trendPoints.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontWeight: '600', marginBottom: 6, color: '#333' }}>Weekly trend</Text>
              {trendPoints.map((point, idx) => (
                <View key={point.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ width: 80, fontSize: 12, color: '#555' }}>{point.label}</Text>
                  <View style={{ flex: 1, height: 12, backgroundColor: '#e3f2fd', borderRadius: 6, marginHorizontal: 8 }}>
                    <View
                      style={{
                        width: `${Math.min((point.value / Math.max(...trendPoints.map(p => p.value || 1))) * 100, 100)}%`,
                        height: 12,
                        backgroundColor: '#1976d2',
                        borderRadius: 6,
                      }}
                    />
                  </View>
                  <Text style={{ width: 40, fontSize: 12, color: '#333', textAlign: 'right' }}>{point.value.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Contents</Text>
          {/* Show all ingredients tried */}
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.checkbox, includeIngredientsInPdf && styles.checkboxChecked]}
              onPress={() => setIncludeIngredientsInPdf((prev) => !prev)}
            >
              {includeIngredientsInPdf && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.optionLabel}>Show all ingredients tried</Text>
          </View>

          {/* Nutrient progress + ingredient selection */}
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.checkbox, includeNutrientInPdf && styles.checkboxChecked]}
              onPress={() => setIncludeNutrientInPdf((prev) => !prev)}
            >
              {includeNutrientInPdf && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.optionLabel}>Include nutrient progress</Text>
          </View>
          {includeNutrientInPdf && (
            <View style={{ marginLeft: 32, marginBottom: 8 }}>
              <Text style={styles.sectionSubtitle}>Select nutrients (multi-select):</Text>
              <View style={styles.nutrientButtonsRow}>
                {userGoalNutrients.map((nutrient) => {
                  const selected = selectedPdfNutrients.includes(nutrient);
                  return (
                    <TouchableOpacity
                      key={nutrient}
                      style={selected ? styles.nutrientButtonSelected : styles.nutrientButton}
                      onPress={() => {
                        setSelectedPdfNutrients((prev) =>
                          prev.includes(nutrient)
                            ? prev.filter((n) => n !== nutrient)
                            : [...prev, nutrient]
                        );
                      }}
                    >
                      <Text style={selected ? styles.nutrientButtonTextSelected : styles.nutrientButtonText}>
                        {nutrientLabels[nutrient]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Recipes liked */}
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.checkbox, includeRecipesLiked && styles.checkboxChecked]}
              onPress={() => setIncludeRecipesLiked((prev) => !prev)}
            >
              {includeRecipesLiked && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.optionLabel}>Recipes liked</Text>
          </View>

          {/* Recipes disliked */}
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.checkbox, includeRecipesDisliked && styles.checkboxChecked]}
              onPress={() => setIncludeRecipesDisliked((prev) => !prev)}
            >
              {includeRecipesDisliked && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.optionLabel}>Recipes disliked</Text>
          </View>

          {/* Total recipes */}
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.checkbox, includeTotalRecipes && styles.checkboxChecked]}
              onPress={() => setIncludeTotalRecipes((prev) => !prev)}
            >
              {includeTotalRecipes && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.optionLabel}>Total recipes</Text>
          </View>

          {/* Recipes re-added */}
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.checkbox, includeRepeatRecipesInPdf && styles.checkboxChecked]}
              onPress={() => setIncludeRepeatRecipesInPdf((prev) => !prev)}
            >
              {includeRepeatRecipesInPdf && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <Text style={styles.optionLabel}>Recipes re-added</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleGeneratePDF}
        >
          <Text style={styles.exportButtonText}>Generate PDF Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ingredientSelectButton: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  ingredientSelectButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  ingredientModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    minHeight: 200,
  },
  ingredientModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  ingredientModalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ingredientModalItemText: {
    fontSize: 15,
    color: '#333',
  },
  ingredientModalCancel: {
    marginTop: 16,
    alignItems: 'center',
  },
  ingredientModalCancelText: {
    color: '#1976D2',
    fontWeight: '700',
    fontSize: 15,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 18,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4CAF50",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  statSubtitle: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#666",
    marginBottom: 10,
  },
  nutrientButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F0F4F8",
    marginRight: 8,
    marginBottom: 8,
  },
  nutrientButtonSelected: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#4CAF50",
    marginRight: 8,
    marginBottom: 8,
  },
  nutrientButtonText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "600",
  },
  nutrientButtonTextSelected: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  nutrientCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  nutrientAmount: {
    fontSize: 30,
    fontWeight: "700",
    color: "#4CAF50",
    marginBottom: 4,
  },
  nutrientLabel: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
  nutrientButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  statisticRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#999",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  checkmark: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  statisticLabel: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  divider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 16,
  },
  trendSection: {
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  trendTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  trendLabel: {
    width: 80,
    fontSize: 12,
    color: "#555",
  },
  trendBarBackground: {
    flex: 1,
    height: 10,
    backgroundColor: "#E8F0FE",
    borderRadius: 6,
    overflow: "hidden",
    marginHorizontal: 10,
  },
  trendBarFill: {
    height: 10,
    backgroundColor: "#4CAF50",
    borderRadius: 6,
  },
  trendValue: {
    width: 40,
    fontSize: 12,
    color: "#333",
    textAlign: "right",
  },
  exportButton: {
    paddingVertical: 14,
    backgroundColor: "#1976D2",
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default MyProgressScreen;
