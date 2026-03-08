import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { getDistance } from "geolib";

import type { Opportunity } from "../types";
import { useDecisionStore, type MapViewport } from "../store/useDecisionStore";
import SignalDropFAB from "../components/SignalDropFAB";
import VibeGrid from "../components/VibeGrid";
import {
  getMapProviderOverride,
  type MapProviderOverride,
} from "../lib/mapProviderOverride";

// --- Pulse Marker Components ---
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming 
} from 'react-native-reanimated';

function HadePulseMarker(): React.JSX.Element {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.34);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.95, { duration: 1300 }), -1, false);
    opacity.value = withRepeat(withTiming(0.02, { duration: 1300 }), -1, false);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <View style={styles.pulseCore} />
    </View>
  );
}

const REGION_EPSILON = 0.00001;
function isSameViewport(a: MapViewport, b: MapViewport): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < REGION_EPSILON &&
    Math.abs(a.longitude - b.longitude) < REGION_EPSILON
  );
}

export default function MapSurface(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [providerOverride, setProviderOverride] = useState<MapProviderOverride>("auto");
  const [isVibeSheetOpen, setIsVibeSheetOpen] = useState(false);
  const [userPoint, setUserPoint] = useState<{latitude: number, longitude: number} | null>(null);

  const decisionPrimary = useDecisionStore((s) => s.decision?.primary);
  const decisionFallbacks = useDecisionStore((s) => s.decision?.fallbacks ?? []);
  const setLastMapViewport = useDecisionStore((s) => s.setLastMapViewport);
  
  const opportunity = decisionPrimary || (route.params?.opportunity as Opportunity);
  const opportunityId = opportunity?.id;

  const viewportRef = useRef<MapViewport>({
    latitude: 39.7541,
    longitude: -104.9998,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const isAnimatingRef = useRef(false);

  const snapPoints = useMemo(() => ["55%"], []);

  // --- Handlers ---
  const handleOpenVibeGrid = useCallback(() => {
    if (!userPoint || !opportunity?.geo) {
      Alert.alert("Location Required", "Acquiring your coordinates...");
      return;
    }

    const distance = getDistance(
      { latitude: userPoint.latitude, longitude: userPoint.longitude },
      { latitude: opportunity.geo.lat, longitude: opportunity.geo.lng }
    );

    // Engine Constraint: 200m for production, 10,000km for Debug/Simulator testing
    const maxAllowedDistance = __DEV__ ? 10000000 : 200;

    if (distance > maxAllowedDistance) {
      Alert.alert(
        "Too Far Away",
        `You're ${Math.round(distance / 1000)}km away. You need to be closer to drop a vibe report.`
      );
      return;
    }

    setIsVibeSheetOpen(true);
    bottomSheetRef.current?.expand();
  }, [userPoint, opportunity]);

  const handleCloseVibeGrid = useCallback(() => {
    bottomSheetRef.current?.close();
    setIsVibeSheetOpen(false);
  }, []);

  const commitViewport = useCallback((nextRegion: MapViewport) => {
    if (isAnimatingRef.current) return;
    if (isSameViewport(viewportRef.current, nextRegion)) return;
    viewportRef.current = nextRegion;
    setLastMapViewport(nextRegion);
  }, [setLastMapViewport]);

  const mapProvider = useMemo(() => {
    // Force Apple Maps on iOS Simulator to resolve "weird" rendering issues
    if (Platform.OS === 'ios') return PROVIDER_DEFAULT;
    
    if (providerOverride === "apple") return undefined;
    if (providerOverride === "google") return PROVIDER_GOOGLE;
    return PROVIDER_GOOGLE;
  }, [providerOverride]);

  // Load provider preference
  useEffect(() => {
    getMapProviderOverride().then(setProviderOverride);
  }, []);

  // Sync camera to opportunity if focused
  useEffect(() => {
    if (!opportunity?.geo) return;
    const target = {
      latitude: opportunity.geo.lat,
      longitude: opportunity.geo.lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    isAnimatingRef.current = true;
    mapRef.current?.animateToRegion(target, 1000);
    setTimeout(() => { isAnimatingRef.current = false; }, 1200);
  }, [opportunityId]);

  // Live Location Watch
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let isFirstFix = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (location) => {
          const coords = { 
            latitude: location.coords.latitude, 
            longitude: location.coords.longitude 
          };
          setUserPoint(coords);

          if ((isFirstFix || !opportunity) && !isAnimatingRef.current) {
            mapRef.current?.animateToRegion({
              ...coords,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008
            }, isFirstFix ? 0 : 1000);
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
        customMapStyle={Platform.OS === 'ios' ? [] : HADE_MAP_STYLE} // Apple Maps doesn't support Google JSON styles
        initialRegion={viewportRef.current}
        userInterfaceStyle="dark" 
        showsUserLocation={true}
        showsPointsOfInterest={false}
        showsBuildings={false} // Reduces simulator lag
        onRegionChangeComplete={commitViewport}
      >
        {opportunity && (
          <Marker
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

      {!isVibeSheetOpen && (
        <SignalDropFAB 
          opportunity={opportunity} 
          onPress={handleOpenVibeGrid} 
        />
      )}

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => setIsVibeSheetOpen(false)}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={{ backgroundColor: "#404040" }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {opportunity && (
            <VibeGrid 
              opportunity={opportunity} 
              userPoint={userPoint}
              onComplete={handleCloseVibeGrid} 
            />
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const HADE_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1A1A1A" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
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
    backgroundColor: "rgba(23, 23, 23, 0.9)",
    borderWidth: 1,
    borderColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  backChevron: { fontSize: 32, color: "#FAFAF8" },
  sheetBackground: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  pulseWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(245, 158, 11, 0.4)' },
  pulseCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F59E0B', borderWidth: 2, borderColor: '#FFF' }
});