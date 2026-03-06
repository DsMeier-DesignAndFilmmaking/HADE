import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import type { Opportunity } from "../types";
import { useDecisionStore, type MapViewport } from "../store/useDecisionStore";
import SignalDropFAB from "../components/SignalDropFAB";

/** Stable empty array to prevent useSyncExternalStore snapshot instability. */
const EMPTY_FALLBACKS: Opportunity[] = [];

// --- Logic Helpers ---
const FALLBACK_VIEWPORT: MapViewport = {
  latitude: 39.7541,
  longitude: -104.9998,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

const REGION_EPSILON = 0.00001;

function isSameViewport(a: MapViewport, b: MapViewport): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < REGION_EPSILON &&
    Math.abs(a.longitude - b.longitude) < REGION_EPSILON
  );
}

// --- Pulse Marker Components ---
const ReanimatedLib = (() => {
  try { return require("react-native-reanimated"); } catch { return null; }
})();

const hasReanimatedPulse = Boolean(ReanimatedLib?.default && ReanimatedLib?.useSharedValue);

function ReanimatedPulseMarker(): React.JSX.Element {
  const AnimatedView = ReanimatedLib.default;
  const scale = ReanimatedLib.useSharedValue(1);
  const opacity = ReanimatedLib.useSharedValue(0.34);

  useEffect(() => {
    scale.value = ReanimatedLib.withRepeat(ReanimatedLib.withTiming(1.95, { duration: 1300 }), -1, false);
    opacity.value = ReanimatedLib.withRepeat(ReanimatedLib.withTiming(0.02, { duration: 1300 }), -1, false);
  }, []);

  const ringStyle = ReanimatedLib.useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.pulseWrap}>
      <AnimatedView style={[styles.pulseRing, ringStyle]} />
      <View style={styles.pulseCore} />
    </View>
  );
}

function AnimatedPulseFallbackMarker(): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.34)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.loop(Animated.timing(scale, { toValue: 1.95, duration: 1300, useNativeDriver: true })),
      Animated.loop(Animated.timing(opacity, { toValue: 0.02, duration: 1300, useNativeDriver: true }))
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.pulseCore} />
    </View>
  );
}

function HadePulseMarker() {
  return hasReanimatedPulse ? <ReanimatedPulseMarker /> : <AnimatedPulseFallbackMarker />;
}

// --- Main Map Component ---
export default function MapSurface(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  // Store & State
  const decisionPrimary = useDecisionStore((s) => s.decision?.primary);
  const decisionFallbacks = useDecisionStore((s) => s.decision?.fallbacks ?? EMPTY_FALLBACKS);
  const setLastMapViewport = useDecisionStore((s) => s.setLastMapViewport);
  
  const opportunity = decisionPrimary || (route.params?.opportunity as Opportunity);
  const opportunityId = opportunity?.id;

  const [userPoint, setUserPoint] = useState<any>(null);
  const viewportRef = useRef<MapViewport>(FALLBACK_VIEWPORT);

  // 1. Decoupled Viewport Sync
  const commitViewport = useCallback((nextRegion: MapViewport) => {
    if (isSameViewport(viewportRef.current, nextRegion)) return;
    viewportRef.current = nextRegion;
    
    // Push store update to next tick to break render loop
    requestAnimationFrame(() => {
      setLastMapViewport(nextRegion);
    });
  }, [setLastMapViewport]);

  // 2. Fly to Destination (Triggered ONLY by ID change)
  useEffect(() => {
    if (!opportunity?.geo) return;

    const target: MapViewport = {
      latitude: opportunity.geo.lat,
      longitude: opportunity.geo.lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };

    viewportRef.current = target;
    mapRef.current?.animateToRegion(target, 1000);
  }, [opportunityId]);

  // 3. Initial GPS Lock
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      
      const pos = await Location.getCurrentPositionAsync({});
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      
      setUserPoint(coords);
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={viewportRef.current}
        customMapStyle={HADE_MAP_STYLE}
        showsUserLocation
        onRegionChangeComplete={commitViewport}
      >
        {opportunity && (
          <Marker
            key={`main-${opportunityId}`}
            coordinate={{
              latitude: opportunity.geo.lat,
              longitude: opportunity.geo.lng,
            }}
          >
            <HadePulseMarker />
          </Marker>
        )}

        {decisionFallbacks.slice(0, 3).map((fb) => (
          <Marker
            key={`fb-${fb.id}`}
            coordinate={{
              latitude: fb.geo.lat,
              longitude: fb.geo.lng,
            }}
            opacity={0.4}
            pinColor="#78716C"
          />
        ))}
      </MapView>

      <TouchableOpacity 
        style={[styles.backButton, { top: insets.top + 16 }]} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backChevron}>‹</Text>
      </TouchableOpacity>

      <SignalDropFAB opportunity={opportunity} />
    </View>
  );
}

const HADE_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1A1A1A" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { flex: 1 },
  backButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  backChevron: { fontSize: 32, color: "#000" },
  pulseWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(245, 158, 11, 0.4)' },
  pulseCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F59E0B', borderWidth: 2, borderColor: '#FFF' }
});