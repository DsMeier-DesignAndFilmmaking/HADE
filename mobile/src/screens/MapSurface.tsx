import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import type { Opportunity } from "../types";
import { useDecisionStore, type MapViewport } from "../store/useDecisionStore";
import SignalDropFAB from "../components/SignalDropFAB";
import {
  getMapProviderOverride,
  type MapProviderOverride,
} from "../lib/mapProviderOverride";

const ExpoDeviceModule = (() => {
  try {
    return require("expo-device") as { isDevice?: boolean };
  } catch {
    return null;
  }
})();

function isIosSimulator(): boolean {
  if (Platform.OS !== "ios") return false;
  if (typeof ExpoDeviceModule?.isDevice === "boolean") {
    return !ExpoDeviceModule.isDevice;
  }
  return __DEV__;
}

const EMPTY_FALLBACKS: Opportunity[] = [];

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

export default function MapSurface(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [providerOverride, setProviderOverride] = useState<MapProviderOverride>("auto");

  const decisionPrimary = useDecisionStore((s) => s.decision?.primary);
  const decisionFallbacks = useDecisionStore((s) => s.decision?.fallbacks ?? EMPTY_FALLBACKS);
  const setLastMapViewport = useDecisionStore((s) => s.setLastMapViewport);
  
  const opportunity = decisionPrimary || (route.params?.opportunity as Opportunity);
  const opportunityId = opportunity?.id;

  const [userPoint, setUserPoint] = useState<any>(null);
  const viewportRef = useRef<MapViewport>(FALLBACK_VIEWPORT);
  const isAnimatingRef = useRef(false);

  const mapProvider = useMemo(() => {
    if (providerOverride === "apple") return undefined;
    if (providerOverride === "google") return PROVIDER_GOOGLE;
    if (Platform.OS !== "ios") return PROVIDER_GOOGLE;
    return isIosSimulator() ? undefined : PROVIDER_GOOGLE;
  }, [providerOverride]);

  const isGoogleProvider = mapProvider === PROVIDER_GOOGLE;

  // Load provider override
  useEffect(() => {
    let mounted = true;
    (async () => {
      const override = await getMapProviderOverride();
      if (mounted) setProviderOverride(override);
    })();
    return () => { mounted = false; };
  }, []);

  const commitViewport = useCallback((nextRegion: MapViewport) => {
    if (isAnimatingRef.current) return;
    if (isSameViewport(viewportRef.current, nextRegion)) return;
    viewportRef.current = nextRegion;
    const timer = setTimeout(() => { setLastMapViewport(nextRegion); }, 400);
    return () => clearTimeout(timer);
  }, [setLastMapViewport]);

  // Handle focusing on an Opportunity (Signal)
  useEffect(() => {
    if (!opportunity?.geo) return;
    const target: MapViewport = {
      latitude: opportunity.geo.lat,
      longitude: opportunity.geo.lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    viewportRef.current = target;
    isAnimatingRef.current = true;
    mapRef.current?.animateToRegion(target, 1000);
    const timer = setTimeout(() => { isAnimatingRef.current = false; }, 1200);
    return () => clearTimeout(timer);
  }, [opportunityId]);

  // Handle live location watching (The Simulator Austin Fix)
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let isFirstFix = true; // NEW: Track the first time we get a location

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          const coords = { 
            latitude: location.coords.latitude, 
            longitude: location.coords.longitude 
          };
          
          setUserPoint(coords);

          // Force the map to Austin if it's the first time we're getting data
          if ((isFirstFix || !opportunity) && !isAnimatingRef.current) {
            mapRef.current?.animateToRegion({
              ...coords,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            }, isFirstFix ? 0 : 1000); // 0ms for instant jump on boot
            isFirstFix = false; 
          }
        }
      );
    })();

    return () => subscription?.remove();
  }, [opportunityId]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={mapProvider}
        // Change: Use the userPoint if we have it, otherwise fallback
        initialRegion={userPoint ? { ...userPoint, latitudeDelta: 0.01, longitudeDelta: 0.01 } : viewportRef.current}
        userInterfaceStyle="dark" 
        showsUserLocation={true}
        followsUserLocation={true} // Forces the camera to the puck on boot
        onRegionChangeComplete={commitViewport}
      >
        {opportunity && (
          <Marker
            key={`main-${opportunityId}`}
            coordinate={{ latitude: opportunity.geo.lat, longitude: opportunity.geo.lng }}
          >
            <HadePulseMarker />
          </Marker>
        )}

        {decisionFallbacks.slice(0, 3).map((fb) => (
          <Marker
            key={`fb-${fb.id}`}
            coordinate={{ latitude: fb.geo.lat, longitude: fb.geo.lng }}
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