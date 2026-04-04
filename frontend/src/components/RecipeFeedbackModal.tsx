import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Recipe, FLAVORS, TEXTURES } from "../../types";

interface RecipeFeedbackModalProps {
  visible: boolean;
  recipe: Recipe | null;
  feedbackType: "liked" | "disliked";
  onClose: () => void;
  onSubmit: (feedback: {
    ingredients: string[];
    flavors: string[];
    textures: string[];
  }) => void;
}

const RecipeFeedbackModal: React.FC<RecipeFeedbackModalProps> = ({
  visible,
  recipe,
  feedbackType,
  onClose,
  onSubmit,
}) => {
  type SectionKey = "ingredients" | "flavors" | "textures";
  const defaultExpandedSections: Record<SectionKey, boolean> = {
    ingredients: false,
    flavors: false,
    textures: false,
  };

  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedTextures, setSelectedTextures] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<
    Record<SectionKey, boolean>
  >(defaultExpandedSections);

  const title =
    feedbackType === "liked"
      ? "What did you like about this dish?"
      : "What didn't you like about this dish?";

  const buttonColor = feedbackType === "liked" ? "#4CAF50" : "#D32F2F";

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

  const handleSubmit = () => {
    onSubmit({
      ingredients: selectedIngredients,
      flavors: selectedFlavors,
      textures: selectedTextures,
    });
    resetSelections();
  };

  const resetSelections = () => {
    setSelectedIngredients([]);
    setSelectedFlavors([]);
    setSelectedTextures([]);
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

  const recipeIngredients = useMemo(
    () => recipe?.ingredients || [],
    [recipe?.ingredients],
  );

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
        </ScrollView>

        {/* Action Buttons */}
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
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },
  helperText: {
    marginTop: 10,
    fontSize: 13,
    color: "#616161",
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingBottom: 8,
    marginBottom: 12,
  },
  dropdownHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  selectionSummary: {
    marginTop: 4,
    fontSize: 12,
    color: "#616161",
  },
  dropdownIndicator: {
    color: "#1976D2",
    fontSize: 13,
    fontWeight: "600",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  emptyText: {
    color: "#777",
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    margin: 4,
  },
  chipText: {
    color: "#666",
    fontSize: 14,
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default RecipeFeedbackModal;
