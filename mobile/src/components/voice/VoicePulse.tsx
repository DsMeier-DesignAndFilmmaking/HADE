import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, Platform } from "react-native";
import * as Haptics from 'expo-haptics';

const AMBER = "#FFB800";
const BG_COLOR = "#0A0A0A"; 

interface VoicePulseProps {
  isListening: boolean;
  onPressIn?: () => void;
  onPressOut?: () => void;
  size?: number;
}

export default function VoicePulse({
  isListening,
  onPressIn,
  onPressOut,
  size = 180,
}: VoicePulseProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Helper to trigger the physical feedback
  const triggerHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(style);
    }
  };

  useEffect(() => {
    if (isListening) {
      // Physical confirmation of the start
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loopRef.current.start();
    } else {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }

    return () => loopRef.current?.stop();
  }, [isListening]);

  return (
    <View style={styles.container}>
      {/* Visual Feedback: Status Indicator */}
      <Animated.Text 
        style={[
          styles.statusText, 
          { opacity: isListening ? 1 : 0.4 }
        ]}
      >
        {isListening ? "LISTENING..." : "HOLD TO SPEAK"}
      </Animated.Text>

      <Pressable 
        onPressIn={onPressIn} 
        onPressOut={onPressOut} 
        style={styles.wrap}
      >
        {/* The "Confirmation" Ripple */}
        <Animated.View
          style={[
            styles.ripple,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ scale: rippleScale }],
              opacity: rippleOpacity,
            },
          ]}
        />

        {/* Static Shadow Base (No Performance Warnings) */}
        <View style={[styles.shadowUnderlay, { width: size, height: size, borderRadius: size / 2 }]} />

        {/* The Pulse Ring */}
        <Animated.View
          style={[
            styles.outer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ scale }],
              borderColor: isListening ? AMBER : "rgba(255, 184, 0, 0.3)",
              backgroundColor: isListening ? "rgba(255, 184, 0, 0.15)" : "rgba(255, 184, 0, 0.05)",
            },
          ]}
        >
          <View
            style={[
              styles.core,
              {
                width: size * 0.5,
                height: size * 0.5,
                borderRadius: (size * 0.5) / 2,
                backgroundColor: isListening ? AMBER : "#222",
              },
            ]}
          >
            <Text style={[styles.label, { color: isListening ? "#000" : "#555" }]}>
              H
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontFamily: "Georgia", // Maintaining that editorial vibe
    fontStyle: "italic",
    color: AMBER,
    fontSize: 14,
    marginBottom: 20,
    letterSpacing: 1,
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ripple: {
    position: "absolute",
    backgroundColor: AMBER,
    zIndex: 0,
  },
  shadowUnderlay: {
    position: "absolute",
    backgroundColor: BG_COLOR,
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10,
  },
  outer: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  core: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 20,
    fontWeight: "900",
  },
});