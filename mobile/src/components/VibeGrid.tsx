import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useEmitSignal } from '../hooks/useSignals'; // Ensure this path is correct
import type { Opportunity } from '../types';

const { width } = Dimensions.get('window');

const VIBES = [
  { label: 'Solid', icon: '🔥', vibeValue: 'fire' },
  { label: 'Chill', icon: '✨', vibeValue: 'chill' },
  { label: 'Packed', icon: '👥', vibeValue: 'fire' },
  { label: 'Too Loud', icon: '🔊', vibeValue: 'chill' }, 
  { label: 'Great Light', icon: '🕯️', vibeValue: 'chill' },
  { label: 'Dead', icon: '📭', vibeValue: 'chill' },
];

interface VibeGridProps {
  opportunity: Opportunity;
  userPoint: { latitude: number; longitude: number } | null;
  onComplete: () => void;
}

export default function VibeGrid({ opportunity, userPoint, onComplete }: VibeGridProps) {
  const { mutate, isPending, isSuccess } = useEmitSignal();

  // Watch for isSuccess to close the sheet after the animation
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onComplete]);

  const dropSignal = (vibe: typeof VIBES[0]) => {
    mutate({
      venue_id: opportunity.id,
      vibe: vibe.vibeValue as 'fire' | 'chill',
      content: vibe.label,
      geo: {
        lat: userPoint?.latitude ?? opportunity.geo.lat,
        lng: userPoint?.longitude ?? opportunity.geo.lng,
      },
    });
  };

  return (
    <View style={styles.container}>
      <AnimatePresence exitBeforeEnter>
        {isSuccess ? (
          <MotiView
            key="success"
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            style={styles.confirmationContainer}
          >
            <MotiView
              from={{ scale: 0.5, rotate: '45deg' }}
              animate={{ scale: 1, rotate: '0deg' }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <Ionicons name="checkmark-circle" size={80} color="#F59E0B" />
            </MotiView>
            <Text style={styles.successTitle}>SIGNAL BROADCASTED</Text>
            <Text style={styles.successSub}>The engine has updated the vibe.</Text>
          </MotiView>
        ) : (
          <MotiView 
            key="grid"
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Text style={styles.title}>What's the vibe at {opportunity.venue_name}?</Text>
            
            <View style={styles.grid}>
              {VIBES.map((vibe) => (
                <TouchableOpacity
                  key={vibe.label}
                  style={[styles.vibeCard, isPending && styles.vibeCardDisabled]}
                  onPress={() => !isPending && dropSignal(vibe)}
                  activeOpacity={0.7}
                  disabled={isPending}
                >
                  <Text style={styles.icon}>{vibe.icon}</Text>
                  <Text style={styles.label}>{vibe.label.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {isPending && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator color="#F59E0B" />
              </View>
            )}
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 24, 
    backgroundColor: '#0D0D0D', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32,
    minHeight: 400,
    paddingBottom: 40 
  },
  title: { 
    color: '#FAFAF8', 
    fontSize: 16, 
    fontWeight: '800', 
    marginBottom: 24, 
    textAlign: 'center',
    letterSpacing: 0.5
  },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 12, 
    justifyContent: 'center' 
  },
  vibeCard: {
    width: (width - 60) / 2,
    backgroundColor: '#171717',
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  vibeCardDisabled: {
    opacity: 0.5,
    borderColor: '#171717',
  },
  icon: { 
    fontSize: 28, 
    marginBottom: 10 
  },
  label: { 
    color: '#A8A29E', 
    fontSize: 11, 
    fontWeight: '900', 
    letterSpacing: 1.2 
  },
  loaderContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 13, 13, 0.4)',
  },
  confirmationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  successTitle: {
    color: '#FAFAF8',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 20,
    letterSpacing: 2,
  },
  successSub: {
    color: '#737373',
    fontSize: 14,
    marginTop: 8,
  }
});