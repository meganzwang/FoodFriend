// FoodFriend/src/screens/GoalsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Switch } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types';

type GoalsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Goals'>;

interface GoalsScreenProps {
  navigation: GoalsScreenNavigationProp;
}

const GoalsScreen: React.FC<GoalsScreenProps> = ({ navigation }) => {
  const [selectedGoals, setSelectedGoals] = useState<{ [key: string]: boolean }>({
    broadenEatingPalette: false,
    arfidSupport: false,
    meetNutritionalGoals: false,
    exploreNewRecipes: false,
  });

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev => ({ ...prev, [goal]: !prev[goal] }));
  };

  const handleContinue = () => {
    // Here you would save the selected goals, e.g., to AsyncStorage or send to backend
    console.log("Selected Goals:", selectedGoals);
    navigation.navigate('SafeFoods'); // Move to the next onboarding step
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What are your goals?</Text>
      <Text style={styles.subtitle}>Select all that apply.</Text>

      <ScrollView style={styles.goalsList}>
        <View style={styles.goalItem}>
          <Text style={styles.goalText}>Broaden my eating palette</Text>
          <Switch
            onValueChange={() => toggleGoal('broadenEatingPalette')}
            value={selectedGoals.broadenEatingPalette}
          />
        </View>
        <View style={styles.goalItem}>
          <Text style={styles.goalText}>Support for ARFID (Avoidant/Restrictive Food Intake Disorder)</Text>
          <Switch
            onValueChange={() => toggleGoal('arfidSupport')}
            value={selectedGoals.arfidSupport}
          />
        </View>
        <View style={styles.goalItem}>
          <Text style={styles.goalText}>Meet specific nutritional goals (e.g., iron, vitamins)</Text>
          <Switch
            onValueChange={() => toggleGoal('meetNutritionalGoals')}
            value={selectedGoals.meetNutritionalGoals}
          />
        </View>
        <View style={styles.goalItem}>
          <Text style={styles.goalText}>Explore new recipes</Text>
          <Switch
            onValueChange={() => toggleGoal('exploreNewRecipes')}
            value={selectedGoals.exploreNewRecipes}
          />
        </View>
      </ScrollView>

      <Button title="Continue" onPress={handleContinue} />
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
    marginBottom: 30,
    color: '#666',
  },
  goalsList: {
    flexGrow: 1,
    width: '100%',
    marginBottom: 20,
  },
  goalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  goalText: {
    fontSize: 16,
    flexShrink: 1,
    marginRight: 10,
  },
});

export default GoalsScreen;
