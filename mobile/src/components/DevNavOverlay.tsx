import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSessionStore } from "../store/useSessionStore";
import {
  getMapProviderOverride,
  setMapProviderOverride,
  type MapProviderOverride,
} from "../lib/mapProviderOverride";

export default function DevNavOverlay() {
  const [expanded, setExpanded] = useState(false);
  const [providerOverride, setProviderOverrideState] =
    useState<MapProviderOverride>("auto");
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const override = await getMapProviderOverride();
      if (mounted) setProviderOverrideState(override);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!__DEV__) return null;

  const isForceGoogle = providerOverride === "google";

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.triggerText}>DEV</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.menu}>
          <Text style={styles.label}>HADE DEBUG</Text>

          <TouchableOpacity
            style={styles.btn}
            onPress={async () => {
              const nextOverride: MapProviderOverride = isForceGoogle
                ? "auto"
                : "google";
              setProviderOverrideState(nextOverride);
              await setMapProviderOverride(nextOverride);
              Alert.alert(
                "Reload required",
                "Map provider changed. Reload the app before opening MapSurface to swap native engines safely."
              );
            }}
          >
            <Text style={styles.btnText}>
              Force Provider: {isForceGoogle ? "Google" : "Hybrid Auto"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              if (!user) return;
              useSessionStore.getState().setUser({
                ...user,
                onboarding_complete: false,
              } as any);
            }}
          >
            <Text style={styles.btnText}>Reset Onboarding</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", bottom: 100, right: 20, zIndex: 9999 },
  trigger: { backgroundColor: "#F59E0B", padding: 10, borderRadius: 20 },
  triggerText: { color: "black", fontWeight: "bold", fontSize: 10 },
  menu: {
    backgroundColor: "#1A1A1A",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    width: 220,
  },
  label: { color: "#78716C", fontSize: 10, marginBottom: 10, fontWeight: "800" },
  btn: { backgroundColor: "#333", padding: 8, borderRadius: 5, marginBottom: 5 },
  btnText: { color: "white", fontSize: 12 },
});
