/**
 * HADE Navigation Helper
 * Deep-links the user to their OS maps app with a pre-built walking route.
 *
 * iOS:  uses native maps: scheme (Apple Maps) or comgooglemaps:// if installed.
 *       Offers a chooser when Google Maps is detected.
 * Android: uses geo: intent, resolved by the OS to the user's default maps app.
 *          Falls back to universal Google Maps HTTPS link if no geo handler exists.
 *
 * Walking vs. driving is determined by a 1km distance threshold:
 * < 1 000 m → walking mode; ≥ 1 000 m → driving mode.
 */
import { Alert, Linking, Platform } from "react-native";

const WALK_THRESHOLD_METERS = 1_000;

/**
 * Triggers external navigation to the given coordinates.
 *
 * @param lat              Destination latitude
 * @param lng              Destination longitude
 * @param label            Venue name — displayed in the maps app and in the iOS chooser
 * @param distanceMeters   Optional pre-computed distance used to pick walk vs. drive mode
 */
export async function triggerNavigation(
  lat: number,
  lng: number,
  label: string,
  distanceMeters?: number,
): Promise<void> {
  const isWalking = (distanceMeters ?? Infinity) < WALK_THRESHOLD_METERS;
  const encodedLabel = encodeURIComponent(label);

  // Apple Maps native scheme — maps:0,0 routes from current location; no HTTP redirect
  const appleUrl = `maps:0,0?q=${encodedLabel}@${lat},${lng}&dirflg=${isWalking ? "w" : "d"}`;

  // Google Maps universal fallback — always works; opens browser if app not installed
  const googleUniversal =
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

  // Google Maps native scheme — richer hand-off when the app IS installed
  const googleNative =
    `comgooglemaps://?daddr=${lat},${lng}&directionsmode=${isWalking ? "walking" : "driving"}`;

  // Android geo: intent — resolved by the OS to the user's default maps app
  const androidGeo = `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;

  console.log("[HADE Navigation] Handing off to OS Maps");

  if (Platform.OS === "ios") {
    // canOpenURL requires "comgooglemaps" in LSApplicationQueriesSchemes (app.json)
    const hasGoogleMaps = await Linking.canOpenURL("comgooglemaps://");

    if (hasGoogleMaps) {
      Alert.alert(
        label,
        isWalking ? "Walking route" : "Driving route",
        [
          { text: "Google Maps", onPress: () => Linking.openURL(googleNative) },
          { text: "Apple Maps", onPress: () => {
            const httpApple =
              `http://maps.apple.com/?daddr=${lat},${lng}` +
              `&dirflg=${isWalking ? "w" : "d"}&q=${encodedLabel}`;
            Linking.openURL(appleUrl)
              .catch(() => Linking.openURL(httpApple))
              .catch(() => Linking.openURL(googleUniversal));
          }},
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true },
      );
    } else {
      // Attempt native maps: scheme directly — works on real device and Simulator.
      // canOpenURL is intentionally skipped: it requires a native rebuild to pick up
      // the LSApplicationQueriesSchemes change, but openURL works without it.
      // Falls back through HTTP Apple Maps → universal Google Maps HTTPS.
      const httpApple =
        `http://maps.apple.com/?daddr=${lat},${lng}` +
        `&dirflg=${isWalking ? "w" : "d"}&q=${encodedLabel}`;
      await Linking.openURL(appleUrl)
        .catch(() => Linking.openURL(httpApple))
        .catch(() => Linking.openURL(googleUniversal));
    }
  } else {
    // Android: prefer native geo: intent; fall back to universal HTTPS link
    const canOpenGeo = await Linking.canOpenURL("geo:0,0");
    await Linking.openURL(canOpenGeo ? androidGeo : googleUniversal);
  }
}
