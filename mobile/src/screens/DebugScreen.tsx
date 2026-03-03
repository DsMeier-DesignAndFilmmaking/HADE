import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSessionStore } from "../store/useSessionStore";
import { getHealth, getMe } from "../services/api";
import { signOut } from "../services/auth";

interface EndpointResult {
  status: number | null;
  body: unknown;
  latency: number | null;
  error: string | null;
}

const EMPTY_RESULT: EndpointResult = {
  status: null,
  body: null,
  latency: null,
  error: null,
};

async function probeHealth(): Promise<EndpointResult> {
  const start = Date.now();
  try {
    const data = await getHealth();
    return { status: 200, body: data, latency: Date.now() - start, error: null };
  } catch (err) {
    return {
      status: null,
      body: null,
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeUserMe(): Promise<EndpointResult> {
  const start = Date.now();
  try {
    const data = await getMe();
    return { status: 200, body: data, latency: Date.now() - start, error: null };
  } catch (err) {
    const status =
      err != null &&
      typeof err === "object" &&
      "response" in err &&
      err.response != null &&
      typeof err.response === "object" &&
      "status" in err.response
        ? (err.response as { status: number }).status
        : null;
    return {
      status,
      body: null,
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function StatusDot({ status }: { status: number | null }): React.JSX.Element {
  let color = "#A8A29E";
  if (status !== null) {
    color = status >= 200 && status < 300 ? "#22C55E" : "#F59E0B";
  }
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function ResultCard({
  label,
  result,
}: {
  label: string;
  result: EndpointResult;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <StatusDot status={result.status} />
        <Text style={styles.cardLabel}>{label}</Text>
        {result.latency !== null && (
          <Text style={styles.latency}>{result.latency}ms</Text>
        )}
      </View>

      {result.error !== null ? (
        <View style={styles.responseBox}>
          <Text style={styles.errorText}>{result.error}</Text>
        </View>
      ) : result.body !== null ? (
        <View style={styles.responseBox}>
          <Text style={styles.statusLine}>HTTP {result.status}</Text>
          <Text style={styles.json}>
            {JSON.stringify(result.body, null, 2)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DebugScreen(): React.JSX.Element {
  const user = useSessionStore((s) => s.user);
  const [health, setHealth] = useState<EndpointResult>(EMPTY_RESULT);
  const [userMe, setUserMe] = useState<EndpointResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);

  const runTests = useCallback(async () => {
    setLoading(true);
    setHealth(EMPTY_RESULT);
    setUserMe(EMPTY_RESULT);

    const healthResult = await probeHealth();
    setHealth(healthResult);

    const userResult = await probeUserMe();
    setUserMe(userResult);

    setLoading(false);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>First Contact</Text>
        <Text style={styles.subtitle}>
          Signed in{user?.name ? ` as ${user.name}` : ""} (
          {user?.id.slice(0, 8)}...)
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={runTests}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Run handshake tests"
        >
          {loading ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Text style={styles.buttonText}>Run Tests</Text>
          )}
        </Pressable>

        <ResultCard label="Health Check" result={health} />
        <ResultCard label="GET /user/me (Authenticated)" result={userMe} />

        {health.status !== null && userMe.status !== null && (
          <View style={styles.verdict}>
            <Text style={styles.verdictText}>
              {health.status === 200 && userMe.status === 200
                ? "Full handshake successful. Backend + Auth working."
                : health.status === 200
                  ? `Backend reachable. Auth returned ${userMe.status}.`
                  : "Connection issue — check API_URL and backend server."}
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 24, paddingBottom: 64 },
  title: {
    color: "#FAFAF8",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#A8A29E",
    fontSize: 14,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 24,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  cardLabel: {
    color: "#FAFAF8",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  latency: { color: "#A8A29E", fontSize: 12 },
  responseBox: {
    backgroundColor: "#0D0D0D",
    borderRadius: 8,
    padding: 12,
  },
  statusLine: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  json: { color: "#FAFAF8", fontSize: 12, fontFamily: "monospace" },
  errorText: { color: "#EF4444", fontSize: 13 },
  verdict: {
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
    paddingTop: 20,
    marginTop: 8,
  },
  verdictText: { color: "#22C55E", fontSize: 14, textAlign: "center" },
  signOutButton: {
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    minHeight: 48,
    justifyContent: "center",
  },
  signOutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
});
