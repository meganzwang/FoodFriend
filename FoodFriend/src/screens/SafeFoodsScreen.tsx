// FoodFriend/src/screens/SafeFoodsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, TextInput, ScrollView, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types';

type SafeFoodsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SafeFoods'>;

interface SafeFoodsScreenProps {
  navigation: SafeFoodsScreenNavigationProp;
}

const SafeFoodsScreen: React.FC<SafeFoodsScreenProps> = ({ navigation }) => {
  const [safeFoodsInput, setSafeFoodsInput] = useState('');
  const [safeFoods, setSafeFoods] = useState<string[]>([]);

  const addSafeFood = () => {
    const food = safeFoodsInput.trim();
    if (food && !safeFoods.includes(food)) {
      setSafeFoods(prev => [...prev, food]);
      setSafeFoodsInput('');
    } else if (safeFoods.includes(food)) {
      Alert.alert("Already Added", `${food} is already in your safe foods list.`);
    }
  };

  const removeSafeFood = (foodToRemove: string) => {
    setSafeFoods(prev => prev.filter(food => food !== foodToRemove));
  };

  const handleContinue = () => {
    // Here you would save the safe foods, e.g., to AsyncStorage or send to backend
    console.log("User's Safe Foods:", safeFoods);
    navigation.navigate('MainApp'); // Navigate to the main tabbed app
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What are your current safe foods?</Text>
      <Text style={styles.subtitle}>
        Tell us about foods you feel comfortable eating. This helps us suggest similar options.
        Add them one by one.
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., plain pasta, apples, chicken nuggets"
          value={safeFoodsInput}
          onChangeText={setSafeFoodsInput}
          onSubmitEditing={addSafeFood} // Add food on enter
          returnKeyType="done"
        />
        <Button title="Add Food" onPress={addSafeFood} />
      </View>

      <ScrollView style={styles.foodList}>
        {safeFoods.length === 0 ? (
          <Text style={styles.noFoodsText}>No safe foods added yet. Start typing!</Text>
        ) : (
          safeFoods.map((food, index) => (
            <View key={index} style={styles.foodItem}>
              <Text style={styles.foodItemText}>{food}</Text>
              <Button title="Remove" onPress={() => removeSafeFood(food)} color="red" />
            </View>
          ))
        )}
      </ScrollView>

      <Button title="Continue to App" onPress={handleContinue} disabled={safeFoods.length === 0} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    width: '100%',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  foodList: {
    flex: 1,
    width: '100%',
    marginBottom: 20,
  },
  noFoodsText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#888',
    marginTop: 20,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  foodItemText: {
    fontSize: 16,
  },
});

export default SafeFoodsScreen;
