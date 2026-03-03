import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Intent } from "../types";

interface IntentSelectorProps {
  onSelect: (intent: Intent) => void;
}

const INTENTS: { label: string; value: Intent }[] = [
  { label: "Eat", value: "eat" },
  { label: "Drink", value: "drink" },
  { label: "Chill", value: "chill" },
  { label: "Scene", value: "scene" },
  { label: "Anything", value: "anything" },
];

/**
 * Quick-tap intent selector: Eat / Drink / Chill / Scene / Anything.
 */
export default function IntentSelector({
  onSelect,
}: IntentSelectorProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {INTENTS.map((item) => (
        <TouchableOpacity
          key={item.value}
          style={styles.button}
          onPress={() => onSelect(item.value)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <Text style={styles.label}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
  },
  button: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
  },
  label: {
    color: "#FAFAF8",
    fontSize: 14,
    fontWeight: "600",
  },
});
