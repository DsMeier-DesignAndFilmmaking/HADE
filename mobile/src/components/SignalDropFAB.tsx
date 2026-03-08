import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Opportunity } from '../types';

// This interface is what TypeScript is complaining about
interface SignalDropFABProps {
  opportunity?: Opportunity;
  onPress: () => void; // Add this line to fix the ts(2322) error
}

export default function SignalDropFAB({ opportunity, onPress }: SignalDropFABProps) {
  const handlePress = async () => {
    // Heavy haptic to signal a "physical" drop action
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      console.log("Haptics unavailable");
    }
    
    onPress(); // Trigger the bottom sheet in MapSurface
  };

  return (
    <TouchableOpacity 
      style={styles.fab} 
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.content}>
        <Text style={styles.plus}>+</Text>
        <Text style={styles.label}>DROP SIGNAL</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#F59E0B', // HADE Primary Orange
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    // Modern elevation/shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plus: {
    color: '#0D0D0D',
    fontSize: 20,
    fontWeight: '900',
  },
  label: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});