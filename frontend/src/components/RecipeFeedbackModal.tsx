import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Recipe, FLAVORS, NUTRIENT_GOALS, TEXTURES } from "../../types";

type NutrientDirection = "more" | "less";
type SectionKey = "ingredients" | "flavors" | "textures" | "nutrients";

interface RecipeFeedbackModalProps {
  visible: boolean;
  recipe: Recipe | null;
  feedbackType: "liked" | "disliked";
  onClose: () => void;
  onSubmit: (feedback: {
    ingredients: string[];
    flavors: string[];
    textures: string[];
    nutrientsMore: string[];
    nutrientsLess: string[];
  }) => void;
}

const nutrientLabels: Record<string, { label: string }> = {
  calories: { label: "Calories" },
  protein: { label: "Protein" },
  fat: { label: "Fat" },
  sodium: { label: "Sodium" },
  fiber: { label: "Fiber" },
  sugar: { label: "Sugar" },
  saturated_fat: { label: "Saturated Fat" },
  iron: { label: "Iron" },
};

const formatNutrientChoice = (label: string, direction: NutrientDirection) => {
  const directionLabel = direction === "more" ? "High" : "Low";
  return `${directionLabel} ${label}`;
};

const RecipeFeedbackModal: React.FC<RecipeFeedbackModalProps> = ({
  visible,
  recipe,
  feedbackType,
  onClose,
  onSubmit,
}) => {
  const defaultExpandedSections: Record<SectionKey, boolean> = {
    ingredients: false,
    flavors: false,
    textures: false,
    nutrients: false,
  };

  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedTextures, setSelectedTextures] = useState<string[]>([]);
  const [selectedNutrientsMore, setSelectedNutrientsMore] = useState<string[]>(
    [],
  );
  const [selectedNutrientsLess, setSelectedNutrientsLess] = useState<string[]>(
    [],
  );
  const [expandedSections, setExpandedSections] = useState<
    Record<SectionKey, boolean>
  >(defaultExpandedSections);

  const title =
    feedbackType === "liked"
      ? "What did you like about this dish?"
      : "What didn't you like about this dish?";

  const buttonColor = feedbackType === "liked" ? "#4CAF50" : "#D32F2F";

  const recipeIngredients = useMemo(() => recipe?.ingredients || [], [recipe]);

  const nutrientPrompt =
    feedbackType === "liked"
      ? "What did you like about nutrients?"
      : "What did you dislike about nutrients?";

  const recipeNutrients = useMemo(
    () =>
      NUTRIENT_GOALS.map((nutrient) => {
        const info = nutrientLabels[nutrient];
        return {
          nutrient,
          label: info.label,
        };
      }),
    [],
  );

  const toggleSelection = (
    item: string,
    list: string[],
    setList: (items: string[]) => void,
  ) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const toggleNutrientSelection = (
    nutrient: string,
    direction: NutrientDirection,
  ) => {
    const setCurrent =
      direction === "more"
        ? setSelectedNutrientsMore
        : setSelectedNutrientsLess;
    const setOpposite =
      direction === "more"
        ? setSelectedNutrientsLess
        : setSelectedNutrientsMore;

    setCurrent((current) => {
      if (current.includes(nutrient)) {
        return current.filter((item) => item !== nutrient);
      }

      setOpposite((items) => items.filter((item) => item !== nutrient));
      return [...current, nutrient];
    });
  };

  const resetSelections = () => {
    setSelectedIngredients([]);
    setSelectedFlavors([]);
    setSelectedTextures([]);
    setSelectedNutrientsMore([]);
    setSelectedNutrientsLess([]);
  };

  const handleSubmit = () => {
    onSubmit({
      ingredients: selectedIngredients,
      flavors: selectedFlavors,
      textures: selectedTextures,
      nutrientsMore: selectedNutrientsMore,
      nutrientsLess: selectedNutrientsLess,
    });
    resetSelections();
  };

  const handleClose = () => {
    resetSelections();
    setExpandedSections(defaultExpandedSections);
    onClose();
  };

  useEffect(() => {
    if (visible) {
      setExpandedSections(defaultExpandedSections);
    }
  }, [visible]);

  const toggleSection = (section: SectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatSelectedSummary = (items: string[]) => {
    const count = items.length;
    if (count === 0) return "None selected";
    if (count === 1) return `1 selected: ${items[0]}`;
    if (count === 2) return `2 selected: ${items[0]} and ${items[1]}`;
    return `${count} selected: ${items[0]}, ${items[1]}, and ${items[2]}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.recipeName}>{recipe?.title}</Text>
            <Text style={styles.helperText}>
              Expand any section below if you want to share more. You can submit
              without selecting additional feedback.
            </Text>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => toggleSection("ingredients")}
            >
              <View style={styles.dropdownHeaderLeft}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <Text style={styles.selectionSummary}>
                  {formatSelectedSummary(selectedIngredients)}
                </Text>
              </View>
              <Text style={styles.dropdownIndicator}>
                {expandedSections.ingredients ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
            {expandedSections.ingredients && (
              <>
                {recipeIngredients.length > 0 ? (
                  <View style={styles.chipContainer}>
                    {recipeIngredients.map((ingredient, index) => (
                      <TouchableOpacity
                        key={`${ingredient}-${index}`}
                        style={[
                          styles.chip,
                          selectedIngredients.includes(ingredient) && {
                            backgroundColor: buttonColor,
                            borderColor: buttonColor,
                          },
                        ]}
                        onPress={() =>
                          toggleSelection(
                            ingredient,
                            selectedIngredients,
                            setSelectedIngredients,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedIngredients.includes(ingredient) &&
                              styles.chipTextSelected,
                          ]}
                        >
                          {ingredient.charAt(0).toUpperCase() +
                            ingredient.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
                    No ingredient details available for this dish.
                  </Text>
                )}
              </>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => toggleSection("flavors")}
            >
              <View style={styles.dropdownHeaderLeft}>
                <Text style={styles.sectionTitle}>Flavors</Text>
                <Text style={styles.selectionSummary}>
                  {formatSelectedSummary(selectedFlavors)}
                </Text>
              </View>
              <Text style={styles.dropdownIndicator}>
                {expandedSections.flavors ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
            {expandedSections.flavors && (
              <View style={styles.chipContainer}>
                {FLAVORS.map((flavor) => (
                  <TouchableOpacity
                    key={flavor}
                    style={[
                      styles.chip,
                      selectedFlavors.includes(flavor) && {
                        backgroundColor: buttonColor,
                        borderColor: buttonColor,
                      },
                    ]}
                    onPress={() =>
                      toggleSelection(
                        flavor,
                        selectedFlavors,
                        setSelectedFlavors,
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedFlavors.includes(flavor) &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {flavor}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => toggleSection("textures")}
            >
              <View style={styles.dropdownHeaderLeft}>
                <Text style={styles.sectionTitle}>Textures</Text>
                <Text style={styles.selectionSummary}>
                  {formatSelectedSummary(selectedTextures)}
                </Text>
              </View>
              <Text style={styles.dropdownIndicator}>
                {expandedSections.textures ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
            {expandedSections.textures && (
              <View style={styles.chipContainer}>
                {TEXTURES.map((texture) => (
                  <TouchableOpacity
                    key={texture}
                    style={[
                      styles.chip,
                      selectedTextures.includes(texture) && {
                        backgroundColor: buttonColor,
                        borderColor: buttonColor,
                      },
                    ]}
                    onPress={() =>
                      toggleSelection(
                        texture,
                        selectedTextures,
                        setSelectedTextures,
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedTextures.includes(texture) &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {texture}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => toggleSection("nutrients")}
            >
              <View style={styles.dropdownHeaderLeft}>
                <Text style={styles.sectionTitle}>Nutrients</Text>
                <Text style={styles.selectionSummary}>
                  {selectedNutrientsMore.length === 0 &&
                  selectedNutrientsLess.length === 0
                    ? "None selected"
                    : `${selectedNutrientsMore.length} high + ${selectedNutrientsLess.length} low selected`}
                </Text>
              </View>
              <Text style={styles.dropdownIndicator}>
                {expandedSections.nutrients ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
            {expandedSections.nutrients && (
              <View style={styles.nutrientSection}>
                <Text style={styles.nutrientHelperText}>
                  {nutrientPrompt} Example: High Protein, Low Calories.
                </Text>
                <View style={styles.chipContainer}>
                  {recipeNutrients.map((nutrient) => {
                    const highSelected = selectedNutrientsMore.includes(
                      nutrient.nutrient,
                    );
                    const lowSelected = selectedNutrientsLess.includes(
                      nutrient.nutrient,
                    );

                    return (
                      <React.Fragment key={nutrient.nutrient}>
                        <TouchableOpacity
                          key={`high-${nutrient.nutrient}`}
                          style={[
                            styles.chip,
                            styles.nutrientChip,
                            highSelected && {
                              backgroundColor: buttonColor,
                              borderColor: buttonColor,
                            },
                          ]}
                          onPress={() =>
                            toggleNutrientSelection(nutrient.nutrient, "more")
                          }
                        >
                          <Text
                            style={[
                              styles.chipText,
                              styles.nutrientChipText,
                              highSelected && styles.chipTextSelected,
                            ]}
                          >
                            {formatNutrientChoice(nutrient.label, "more")}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          key={`low-${nutrient.nutrient}`}
                          style={[
                            styles.chip,
                            styles.nutrientChip,
                            lowSelected && {
                              backgroundColor: buttonColor,
                              borderColor: buttonColor,
                            },
                          ]}
                          onPress={() =>
                            toggleNutrientSelection(nutrient.nutrient, "less")
                          }
                        >
                          <Text
                            style={[
                              styles.chipText,
                              styles.nutrientChipText,
                              lowSelected && styles.chipTextSelected,
                            ]}
                          >
                            {formatNutrientChoice(nutrient.label, "less")}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#ccc" }]}
            onPress={handleClose}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonColor }]}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>Submit Feedback</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  helperText: {
    color: "#666",
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  nutrientSection: {
    marginTop: 10,
  },
  nutrientHelperText: {
    color: "#666",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  dropdownHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  selectionSummary: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  dropdownIndicator: {
    fontSize: 13,
    color: "#1976D2",
    fontWeight: "600",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  nutrientChip: {
    alignItems: "flex-start",
  },
  chipText: {
    fontSize: 13,
    color: "#333",
  },
  nutrientChipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 12,
    color: "#777",
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

export { RecipeFeedbackModal };
export default RecipeFeedbackModal;
