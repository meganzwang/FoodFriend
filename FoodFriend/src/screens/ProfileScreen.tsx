// FoodFriend/src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MainTabParamList, RootStackParamList } from '../../types';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';

type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  StackNavigationProp<RootStackParamList>
>;

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

interface PatientData {
  patientId: string;
  name: string;
  birthDate?: string;
  accessToken: string;
  sessionId?: string;
  fhirData?: {
    allergies?: any[];
    conditions?: any[];
    medications?: any[];
    observations?: any[];
  };
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const storedData = await AsyncStorage.getItem("patientData");
        if (storedData) {
          setPatientData(JSON.parse(storedData));
        }
      } catch (error) {
        console.error("Error fetching patient data from AsyncStorage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientData();
  }, []);

  const handleDisconnectEHR = async () => {
    // Clear patient data from storage
    await AsyncStorage.removeItem("patientData");
    setPatientData(null);
    // Optionally navigate back to the EHR login screen or welcome screen
    navigation.replace('Welcome');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading profile data...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      {patientData ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>EHR Connection Status</Text>
          <Text style={styles.detailText}><Text style={styles.label}>Patient Name:</Text> {patientData.name || 'N/A'}</Text>
          <Text style={styles.detailText}><Text style={styles.label}>Patient ID:</Text> {patientData.patientId || 'N/A'}</Text>
          {/* Add more patient data fields as needed */}

          <Text style={styles.fhirDataTitle}>FHIR Data Overview (Placeholder)</Text>
          {patientData.fhirData && (
            <>
              <Text style={styles.detailText}><Text style={styles.label}>Allergies:</Text> {patientData.fhirData.allergies?.length || 0}</Text>
              <Text style={styles.detailText}><Text style={styles.label}>Conditions:</Text> {patientData.fhirData.conditions?.length || 0}</Text>
              <Text style={styles.detailText}><Text style={styles.label}>Medications:</Text> {patientData.fhirData.medications?.length || 0}</Text>
              <Text style={styles.detailText}><Text style={styles.label}>Observations:</Text> {patientData.fhirData.observations?.length || 0}</Text>
            </>
          )}

          <Button title="Disconnect EHR" onPress={handleDisconnectEHR} color="red" />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>EHR Not Connected</Text>
          <Text style={styles.detailText}>
            Connect your Electronic Health Record to get personalized, medically informed food recommendations.
          </Text>
          <Button title="Connect EHR" onPress={() => navigation.navigate('EHRLogin')} />
        </View>
      )}

      {/* Placeholder for other profile settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>App Preferences</Text>
        <Button title="Edit Goals" onPress={() => navigation.navigate('Goals')} />
        <View style={{ marginVertical: 5 }} />
        <Button title="Edit Dietary Preferences" onPress={() => navigation.navigate('Preferences')} />
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  detailText: {
    fontSize: 16,
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    color: '#555',
  },
  fhirDataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  }
});

export default ProfileScreen;
