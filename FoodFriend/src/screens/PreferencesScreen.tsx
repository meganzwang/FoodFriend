// FoodFriend/src/screens/PreferencesScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  DietaryRestriction,
  HealthGoal,
  CookingStyle,
  UserPreferences,
  RootStackParamList,
} from '../../types';

// Assuming we moved the JSON here or import it directly
import ingredientData from '../ingredients.json';

const API_URL = 'http://localhost:3001'; // Backend proxy URL
const STORAGE_KEY = '@user_preferences';

const BIG_9_ALLERGENS = [
  'Milk',
  'Eggs',
  'Fish',
  'Shellfish',
  'Tree Nuts',
  'Peanuts',
  'Wheat',
  'Soybeans',
  'Sesame',
];

type PreferencesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Preferences'>;

interface PreferencesScreenProps {
  navigation: PreferencesScreenNavigationProp;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

const MultiSelectGroup: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (option: any) => void;
}> = ({ options, selected, onToggle }) => (
  <View style={styles.groupContainer}>
    {options.map((option) => (
      <TouchableOpacity
        key={option}
        style={[
          styles.chip,
          selected.includes(option) && styles.chipSelected,
        ]}
        onPress={() => onToggle(option)}
      >
        <Text
          style={[
            styles.chipText,
            selected.includes(option) && styles.chipTextSelected,
          ]}
        >
          {option}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const PreferencesScreen: React.FC<PreferencesScreenProps> = ({ navigation }) => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    allergies: [],
    preferredFoods: [],
    dislikedIngredients: [],
    dietaryRestrictions: [],
    healthGoals: [],
    cookingStyle: [],
  });
  const [loading, setLoading] = useState(true);
  const [preferredSearch, setPreferredSearch] = useState('');
  const [dislikeSearch, setDislikeSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load preferences', e);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (isContinue: boolean = false) => {
    setIsSaving(true);
    try {
      // 1. Save locally
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      
      // 2. Save to backend
      try {
        const response = await fetch(`${API_URL}/api/save-preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences),
        });
        
        if (!response.ok) {
          console.warn('Backend save failed, but local save succeeded');
        }
      } catch (backendError) {
        console.warn('Could not reach backend, preferences saved locally only', backendError);
      }

      if (isContinue) {
        navigation.navigate('MainApp');
      } else {
        Alert.alert('Success', 'Preferences saved successfully!');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to save preferences.');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (key: keyof UserPreferences, value: any) => {
    setPreferences((prev) => {
      const current = prev[key] as any[];
      if (current.includes(value)) {
        return { ...prev, [key]: current.filter((item) => item !== value) };
      } else {
        return { ...prev, [key]: [...current, value] };
      }
    });
  };

  const getFilteredIngredients = (query: string, excludeList: string[]) => {
    if (query.length < 2) return [];
    return ingredientData
      .filter((ing) =>
        ing.toLowerCase().includes(query.toLowerCase()) &&
        !excludeList.includes(ing)
      )
      .slice(0, 10);
  };

  const filteredPreferred = useMemo(() => 
    getFilteredIngredients(preferredSearch, preferences.preferredFoods), 
    [preferredSearch, preferences.preferredFoods]
  );

  const filteredDisliked = useMemo(() => 
    getFilteredIngredients(dislikeSearch, preferences.dislikedIngredients), 
    [dislikeSearch, preferences.dislikedIngredients]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Your Preferences</Text>
        <Text style={styles.subtitle}>Help us personalize your food recommendations</Text>

        <SectionHeader title="Allergies" />
        <Text style={styles.helperText}>Select any common allergies you have.</Text>
        <MultiSelectGroup
          options={BIG_9_ALLERGENS}
          selected={preferences.allergies}
          onToggle={(val) => toggleSelection('allergies', val)}
        />

        <SectionHeader title="Dietary Restrictions" />
        <MultiSelectGroup
          options={Object.values(DietaryRestriction)}
          selected={preferences.dietaryRestrictions}
          onToggle={(val) => toggleSelection('dietaryRestrictions', val)}
        />

        <SectionHeader title="Health Goals" />
        <MultiSelectGroup
          options={Object.values(HealthGoal)}
          selected={preferences.healthGoals}
          onToggle={(val) => toggleSelection('healthGoals', val)}
        />

        <SectionHeader title="Cooking Style" />
        <MultiSelectGroup
          options={Object.values(CookingStyle)}
          selected={preferences.cookingStyle}
          onToggle={(val) => toggleSelection('cookingStyle', val)}
        />

        <SectionHeader title="Preferred Foods" />
        <Text style={styles.helperText}>Foods you enjoy and feel comfortable eating.</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search preferred foods..."
            value={preferredSearch}
            onChangeText={setPreferredSearch}
          />
          {filteredPreferred.length > 0 && (
            <View style={styles.resultsContainer}>
              {filteredPreferred.map((ing) => (
                <TouchableOpacity
                  key={ing}
                  style={styles.resultItem}
                  onPress={() => {
                    toggleSelection('preferredFoods', ing);
                    setPreferredSearch('');
                  }}
                >
                  <Text>{ing}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.selectedIngredients}>
          {preferences.preferredFoods.map((ing) => (
            <TouchableOpacity
              key={ing}
              style={[styles.selectedChip, { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' }]}
              onPress={() => toggleSelection('preferredFoods', ing)}
            >
              <Text style={[styles.selectedChipText, { color: '#2E7D32' }]}>{ing} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader title="Disliked Ingredients" />
        <Text style={styles.helperText}>Foods or ingredients you want to avoid.</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search ingredients to avoid..."
            value={dislikeSearch}
            onChangeText={setDislikeSearch}
          />
          {filteredDisliked.length > 0 && (
            <View style={styles.resultsContainer}>
              {filteredDisliked.map((ing) => (
                <TouchableOpacity
                  key={ing}
                  style={styles.resultItem}
                  onPress={() => {
                    toggleSelection('dislikedIngredients', ing);
                    setDislikeSearch('');
                  }}
                >
                  <Text>{ing}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.selectedIngredients}>
          {preferences.dislikedIngredients.map((ing) => (
            <TouchableOpacity
              key={ing}
              style={styles.selectedChip}
              onPress={() => toggleSelection('dislikedIngredients', ing)}
            >
              <Text style={styles.selectedChipText}>{ing} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => savePreferences(false)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: '#2196F3', marginTop: 12 }]}
          onPress={() => savePreferences(true)}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>Continue to App</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
  },
  helperText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  groupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    margin: 4,
  },
  chipSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  chipText: {
    color: '#666',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  searchContainer: {
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  resultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedIngredients: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginBottom: 8,
  },
  selectedChip: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  selectedChipText: {
    color: '#D32F2F',
    fontSize: 12,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default PreferencesScreen;
