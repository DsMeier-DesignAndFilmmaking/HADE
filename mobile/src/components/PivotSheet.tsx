import React, { useCallback } from "react";
import { Platform, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";

// ─── Types ────────────────────────────────────────────────────────────────────
export type PivotType = "energy" | "distance" | "vibe";

interface PivotSheetProps {
  sheetRef: React.RefObject<BottomSheet>;
  onPivot: (type: PivotType) => void;
}

// ─── Pivot options ────────────────────────────────────────────────────────────
const PIVOTS: Array<{ type: PivotType; icon: string; label: string; desc: string }> = [
  {
    type: "energy",
    icon:  "🌿",
    label: "Too much energy",
    desc:  "Find something quieter",
  },
  {
    type: "distance",
    icon:  "📍",
    label: "Too far away",
    desc:  "Look within 500m",
  },
  {
    type: "vibe",
    icon:  "↺",
    label: "Change the vibe",
    desc:  "Pick a different intent",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function PivotSheet({
  sheetRef,
  onPivot,
}: PivotSheetProps): React.JSX.Element {
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.35}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["38%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Not the move?</Text>
        <Text style={styles.subtitle}>Tell HADE what's off.</Text>

        {/* Pivot options */}
        {PIVOTS.map(({ type, icon, label, desc }, idx) => (
          <TouchableOpacity
            key={type}
            style={[styles.row, idx === PIVOTS.length - 1 && styles.rowLast]}
            onPress={() => {
              sheetRef.current?.close();
              onPivot(type);
            }}
            activeOpacity={0.65}
          >
            <Text style={styles.rowIcon}>{icon}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowDesc}>{desc}</Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </BottomSheetView>
    </BottomSheet>
  );
}

// ─── Styles — "Modern McGee" warm cream palette ───────────────────────────────
const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#F9F7F2",   // Linen — contrasts dark HADE bg
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: "#D4CFC9",   // Warm taupe drag handle
    width: 40,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 40,
  },
  title: {
    color: "#1A1A1A",
    fontSize: 20,
    fontWeight: "800",
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
    fontStyle: "italic",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    color: "#6B6B6B",
    fontSize: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E5E0",
    gap: 14,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: "#1A1A1A",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  rowDesc: {
    color: "#A8A29E",
    fontSize: 12,
  },
  rowChevron: {
    color: "#A8A29E",
    fontSize: 22,
    fontWeight: "300",
  },
});
