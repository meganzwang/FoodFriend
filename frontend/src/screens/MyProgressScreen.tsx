import React, { useEffect, useState, useMemo } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { NUTRIENT_GOALS, UserPreferences, TriedRecipe } from "../../types";

const STORAGE_KEY = "@user_preferences";

type StatisticType =
  | "new_foods_tried"
  | "recipes_liked"
  | "recipes_disliked"
  | "total_recipes";

type NutrientGoal = typeof NUTRIENT_GOALS[number];

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

const MyProgressScreen: React.FC = () => {
  const [preferences, setPreferences] = useState<Partial<UserPreferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReportStats, setSelectedReportStats] = useState<StatisticType[]>([
    "new_foods_tried",
    "recipes_liked",
    "total_recipes",
  ]);
  const [selectedNutrient, setSelectedNutrient] = useState<NutrientGoal>(
    "calories",
  );
  const [includeNutrientInPdf, setIncludeNutrientInPdf] = useState(true);
  const [selectedPdfNutrient, setSelectedPdfNutrient] = useState<NutrientGoal>(
    "calories",
  );

  const availableStatistics: Array<{ id: StatisticType; label: string }> = [
    { id: "new_foods_tried", label: "New Foods Tried" },
    { id: "recipes_liked", label: "Recipes Liked" },
    { id: "recipes_disliked", label: "Recipes Disliked" },
    { id: "total_recipes", label: "Total Recipes Tried" },
  ];

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setPreferences(JSON.parse(saved));
        }
      } catch (error) {
        console.warn("Could not load preferences", error);
      } finally {
        setLoading(false);
      }
    };

    void loadPreferences();
  }, []);

  const statistics = useMemo((): Statistic[] => {
    if (!preferences) return [];

    const tried_recipes = (preferences.tried_recipes || []) as TriedRecipe[];
    const liked_count = tried_recipes.filter(
      (r) => r.feedbackType === "liked"
    ).length;
    const disliked_count = tried_recipes.filter(
      (r) => r.feedbackType === "disliked"
    ).length;
    const total_count = tried_recipes.length;

    const uniqueIngredients = new Set(
      tried_recipes.flatMap((recipe) => recipe.ingredients || []),
    );
    const new_foods_count = uniqueIngredients.size;

    const avg_cals =
      tried_recipes.length > 0
        ? (
            tried_recipes.reduce((sum, r) => {
              return sum + (r.calories || 0);
            }, 0) / tried_recipes.length
          ).toFixed(0)
        : "—";

    return [
      {
        id: "new_foods_tried",
        label: "New Foods Explored",
        value: new_foods_count,
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
    ];
  }, [preferences]);

  const nutrientAverage = useMemo(() => {
    if (!preferences) return 0;
    const tried_recipes = (preferences.tried_recipes || []) as TriedRecipe[];
    if (tried_recipes.length === 0) return 0;

    const total = tried_recipes.reduce((sum, recipe) => {
      const value = (recipe as any)[selectedNutrient] ?? 0;
      return sum + value;
    }, 0);

    return total / tried_recipes.length;
  }, [preferences, selectedNutrient]);

  const displayedStats = statistics;

  const toggleStatistic = (id: StatisticType) => {
    setSelectedReportStats((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectedReportValues = useMemo(() => {
    return statistics.filter((stat) => selectedReportStats.includes(stat.id));
  }, [statistics, selectedReportStats]);

  const selectedNutrientAverage = useMemo(() => {
    if (!preferences) return 0;
    const tried_recipes = (preferences.tried_recipes || []) as TriedRecipe[];
    if (tried_recipes.length === 0) return 0;

    const total = tried_recipes.reduce((sum, recipe) => {
      const value = (recipe as any)[selectedPdfNutrient] ?? 0;
      return sum + value;
    }, 0);

    return total / tried_recipes.length;
  }, [preferences, selectedPdfNutrient]);

  const buildReportHtml = () => {
    const sections: string[] = [];
    sections.push(`<h1>FoodFriend Progress Report</h1>`);
    sections.push(`<p>Generated on ${new Date().toLocaleDateString()}</p>`);

    if (selectedReportValues.length > 0) {
      sections.push(`<h2>Summary Stats</h2>`);
      sections.push(`<ul>`);
      selectedReportValues.forEach((stat) => {
        sections.push(
          `<li><strong>${stat.label}:</strong> ${stat.value}</li>`,
        );
      });
      sections.push(`</ul>`);
    }

    if (includeNutrientInPdf) {
      sections.push(`<h2>Nutrient Progress</h2>`);
      sections.push(
        `<p>Average <strong>${nutrientLabels[selectedPdfNutrient]}</strong> per meal: <strong>${selectedNutrientAverage.toFixed(0)}</strong></p>`,
      );
    }

    if (selectedReportValues.length === 0 && !includeNutrientInPdf) {
      sections.push(
        `<p>No report options selected. Please enable content before generating the PDF.</p>`,
      );
    }

    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>FoodFriend Progress Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
          h1 { color: #1976D2; }
          h2 { color: #4CAF50; }
          ul { padding-left: 20px; }
          li { margin-bottom: 8px; }
          strong { color: #333; }
        </style>
      </head>
      <body>
        ${sections.join("")}
      </body>
      </html>`;
  };

  const handleGeneratePDF = async () => {
    if (selectedReportValues.length === 0 && !includeNutrientInPdf) {
      Alert.alert(
        "Report Incomplete",
        "Please select at least one stat or nutrient progress option before generating the PDF.",
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
          <View style={styles.nutrientButtonsRow}>
            {NUTRIENT_GOALS.map((nutrient) => (
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
              {nutrientAverage.toFixed(0)}
            </Text>
            <Text style={styles.nutrientLabel}>
              Average {nutrientLabels[selectedNutrient]} per meal
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Contents</Text>
          <Text style={styles.sectionSubtitle}>
            Select the summary stats to include in your PDF report.
          </Text>
          <FlatList
            data={availableStatistics}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.statisticRow}
                onPress={() => toggleStatistic(item.id)}
              >
                <View
                  style={[
                    styles.checkbox,
                    selectedReportStats.includes(item.id) &&
                      styles.checkboxChecked,
                  ]}
                >
                  {selectedReportStats.includes(item.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.statisticLabel}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrient Progress in PDF</Text>
          <View style={styles.statisticRow}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setIncludeNutrientInPdf((prev) => !prev)}
            >
              {includeNutrientInPdf && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.statisticLabel}>
              Include nutrient progress in PDF
            </Text>
          </View>
          {includeNutrientInPdf && (
            <View style={styles.nutrientButtonsRow}>
              {NUTRIENT_GOALS.map((nutrient) => (
                <TouchableOpacity
                  key={`pdf-${nutrient}`}
                  style={
                    nutrient === selectedPdfNutrient
                      ? styles.nutrientButtonSelected
                      : styles.nutrientButton
                  }
                  onPress={() => setSelectedPdfNutrient(nutrient)}
                >
                  <Text
                    style={
                      nutrient === selectedPdfNutrient
                        ? styles.nutrientButtonTextSelected
                        : styles.nutrientButtonText
                    }
                  >
                    {nutrientLabels[nutrient]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
