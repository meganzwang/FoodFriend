import React, { useState, useMemo } from "react";
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
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedTextures, setSelectedTextures] = useState<string[]>([]);

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
    onClose();
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
          </View>

          {/* Ingredients Section */}
          {recipeIngredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
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
                      {ingredient.charAt(0).toUpperCase() + ingredient.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Flavors Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flavors</Text>
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
                    toggleSelection(flavor, selectedFlavors, setSelectedFlavors)
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
          </View>

          {/* Textures Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Textures</Text>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingBottom: 8,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
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
