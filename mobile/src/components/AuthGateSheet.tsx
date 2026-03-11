import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { signInWithGoogle } from "../services/auth";

interface AuthGateSheetProps {
  sheetRef: React.RefObject<BottomSheet>;
  featureLabel: string;
  onNavigateToAuth: () => void;
}

/**
 * Bottom sheet that appears when guests tap a trust-gated feature.
 * Two CTAs: Google sign-in (quick) or full auth flow.
 */
export default function AuthGateSheet({
  sheetRef,
  featureLabel,
  onNavigateToAuth,
}: AuthGateSheetProps): React.JSX.Element {
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    ),
    [],
  );

  const handleGoogleSignIn = async () => {
    try {
      sheetRef.current?.close();
      await signInWithGoogle();
    } catch (err) {
      console.warn("[AuthGate] Google sign-in failed:", err);
    }
  };

  const handleFullAuth = () => {
    sheetRef.current?.close();
    onNavigateToAuth();
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["40%"]}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Sign in to see {featureLabel}</Text>
        <Text style={styles.subtitle}>
          Your friends' signals are waiting. Sign in to unlock the trust network.
        </Text>

        <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>

        <Pressable style={styles.altButton} onPress={handleFullAuth}>
          <Text style={styles.altButtonText}>Use phone or email</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: "#57534E",
    width: 40,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  title: {
    color: "#FAFAF8",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#78716C",
    fontSize: 15,
    lineHeight: 22,
  },
  googleButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
    marginTop: 8,
  },
  googleButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
  },
  altButton: {
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  altButtonText: {
    color: "#A8A29E",
    fontSize: 15,
    fontWeight: "600",
  },
});
