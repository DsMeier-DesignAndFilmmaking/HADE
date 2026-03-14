import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

interface LiveTranscriptProps {
  text: string;
}

export default function LiveTranscript({ text }: LiveTranscriptProps): React.JSX.Element {
  const cleaned = text.trim();
  const words = cleaned ? cleaned.split(/\s+/) : [];

  return (
    <View style={styles.container}>
      {words.length === 0 ? (
        <Text style={[styles.word, styles.ghost]}>Say the vibe you want.</Text>
      ) : (
        <Text style={styles.text}>
          {words.map((word, index) => {
            const isLatest = index === words.length - 1;
            return (
              <Text
                key={`${word}-${index}`}
                style={[styles.word, !isLatest && styles.ghost]}
              >
                {word}{index < words.length - 1 ? " " : ""}
              </Text>
            );
          })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  text: {
    textAlign: "center",
  },
  word: {
    color: "#F5F1E8",
    fontSize: 28,
    lineHeight: 36,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  ghost: {
    opacity: 0.4,
  },
});
