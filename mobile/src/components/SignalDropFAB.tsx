import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Opportunity } from '../types';

interface SignalDropFABProps {
  opportunity?: Opportunity;
  onPress: () => void;
}

export default function SignalDropFAB({ opportunity, onPress }: SignalDropFABProps) {
  const handlePress = async () => {
    try {
      // High-end tactile feedback for the "Drop" action
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      // Silent fail for simulator
    }
    onPress(); 
  };

  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={styles.content}>
        <Text style={styles.plus}>+</Text>
        <Text style={styles.label}>DROP A VIBE</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    // REMOVED: position: 'absolute', bottom, and alignSelf
    // This allows the parent (MapSurface) to control placement perfectly.
    backgroundColor: '#F59E0B', 
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16, // Match the slightly boxier editorial feel of the Nav Card
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow - the parent container handles the primary elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plus: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
    marginRight: 8,
  },
  label: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2, // Tighter tracking for a more "pro" look
  },
});