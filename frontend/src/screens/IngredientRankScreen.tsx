import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../types";
import { CONFIG } from "../config";

const STORAGE_KEY = "@user_preferences";

type IngredientRankScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "IngredientRank"
>;

interface IngredientRankScreenProps {
  navigation: IngredientRankScreenNavigationProp;
}

const IngredientRankScreen: React.FC<IngredientRankScreenProps> = ({
  navigation,
}) => {
  const [rankedIngredients, setRankedIngredients] = useState<any[]>([]);
  const [filteredOut, setFilteredOut] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setRankedIngredients([]);
        setFilteredOut([]);
        setError(
          "No preferences found. Please complete your preferences first.",
        );
        return;
      }

      const preferences = JSON.parse(saved);

      console.log(
        "[IngredientRankScreen] Fetching rankings from:",
        `${CONFIG.API_URL}/api/rank-ingredients`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

      const response = await fetch(`${CONFIG.API_URL}/api/rank-ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log(
        "[IngredientRankScreen] Raw response:",
        responseText.substring(0, 200),
      );

      if (!response.ok) {
        setError(`Server returned status: ${response.status}`);
        return;
      }

      try {
        const data = JSON.parse(responseText);
        if (data.error) {
          console.error(
            "[IngredientRankScreen] Backend returned error:",
            data.error,
          );
          setError(data.error);
          Alert.alert("Ranking Error", data.error);
          return;
        }

        setRankedIngredients((data.ranked || []).slice(0, 5));
        setFilteredOut(data.filtered || []);
        setError(null);
      } catch (parseError) {
        console.error(
          "[IngredientRankScreen] Failed to parse string as JSON:",
          parseError,
        );
        setError("Failed to parse server response. Please try again later.");
      }
    } catch (e: any) {
      console.error("[IngredientRankScreen] Network or other error:", e);
      setError("Network or server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Ranking ingredients for you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchRankings} style={styles.continueButton}>
          <Text style={styles.continueButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Personalized Rankings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Based on your goals and preferences, here is how we rank our test
          ingredients:
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Matches</Text>
        </View>

        <View style={styles.listContainer}>
          {rankedIngredients.length > 0 ? (
            rankedIngredients.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.rankItem}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>
                <View style={styles.infoContainer}>
                  <Text style={styles.ingredientName}>{item.name}</Text>
                  <Text style={styles.scoreText}>
                    Personalized Score: {item.score}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No ingredients match your current filters.
            </Text>
          )}
        </View>

        {filteredOut.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={[styles.sectionTitle, { color: "#D32F2F" }]}>
                Filtered Out (Safety/Diet)
              </Text>
            </View>
            <View style={styles.listContainer}>
              {filteredOut.map((item, index) => (
                <View
                  key={`${item.name}-${item.reason || "filtered"}-${index}`}
                  style={[styles.rankItem, styles.filteredItem]}
                >
                  <View style={styles.infoContainer}>
                    <Text style={[styles.ingredientName, { color: "#999" }]}>
                      {item.name}
                    </Text>
                    <Text style={styles.reasonText}>
                      Reason: Matched keyword "{item.reason}"
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => navigation.navigate("RecipePicker")}
        >
          <Text style={styles.continueButtonText}>Proceed to Recipes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: "#1976D2",
    fontWeight: "600",
    marginBottom: 12,
  },
  sectionHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4CAF50",
  },
  listContainer: {
    marginBottom: 12,
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filteredItem: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    elevation: 0,
    shadowOpacity: 0,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  rankNumber: {
    color: "#fff",
    fontWeight: "bold",
  },
  infoContainer: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  scoreText: {
    fontSize: 14,
    color: "#888",
    marginTop: 2,
  },
  reasonText: {
    fontSize: 13,
    color: "#D32F2F",
    marginTop: 2,
    fontStyle: "italic",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 16,
    color: "#999",
    marginTop: 20,
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default IngredientRankScreen;
