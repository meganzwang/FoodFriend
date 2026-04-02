import React from "react";
import { View, Text, StyleSheet } from "react-native";

const GroceryListScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week's Groceries</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
      <Text style={styles.body}>
        Grocery list generation will be added here.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1976D2",
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});

export default GroceryListScreen;
