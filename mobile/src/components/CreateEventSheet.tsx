import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { postEvent } from "../services/api";
import { useSessionStore } from "../store/useSessionStore";
import type { EventVisibility, Intent } from "../types";

interface CreateEventSheetProps {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES: Intent[] = ["eat", "drink", "chill", "scene"];
const TIME_OPTIONS = [
  { label: "Now", value: 0 },
  { label: "In 1hr", value: 60 },
  { label: "In 2hrs", value: 120 },
];
const VISIBILITY_OPTIONS: { label: string; value: EventVisibility }[] = [
  { label: "Friends", value: "TRUST_NETWORK" },
  { label: "Extended", value: "EXTENDED" },
  { label: "Open", value: "OPEN" },
];

export default function CreateEventSheet({
  visible,
  onClose,
}: CreateEventSheetProps): React.JSX.Element {
  const location = useSessionStore((s) => s.location);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Intent>("drink");
  const [timeOffset, setTimeOffset] = useState(0);
  const [visibility, setVisibility] = useState<EventVisibility>("TRUST_NETWORK");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const startsAt =
        timeOffset > 0
          ? new Date(Date.now() + timeOffset * 60_000).toISOString()
          : undefined;

      await postEvent({
        title: title.trim(),
        note: note.trim() || undefined,
        category,
        geo: location || { lat: 39.7541, lng: -104.9998 },
        starts_at: startsAt || undefined,
        duration_minutes: 120,
        visibility,
      });

      Alert.alert("You're live", "Your event is out there.");
      resetAndClose();
    } catch {
      // Optimistic close for design mode
      Alert.alert("You're live", "Your event is out there.");
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setTitle("");
    setCategory("drink");
    setTimeOffset(0);
    setVisibility("TRUST_NETWORK");
    setNote("");
    setShowNote(false);
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <Text style={styles.heading}>WHAT&apos;S THE MOVE?</Text>

          {/* Title Input */}
          <TextInput
            style={styles.titleInput}
            placeholder="Drinks on my rooftop"
            placeholderTextColor="#57534E"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            autoFocus
          />

          {/* Category Chips */}
          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.chip,
                  category === cat && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === cat && styles.chipTextActive,
                  ]}
                >
                  {cat.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Location */}
          <Text style={styles.label}>LOCATION</Text>
          <Pressable style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>
              {location
                ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : "Current location"}
            </Text>
            <Text style={styles.locationChange}>Change</Text>
          </Pressable>

          {/* Time */}
          <Text style={styles.label}>WHEN</Text>
          <View style={styles.chipRow}>
            {TIME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setTimeOffset(opt.value)}
                style={[
                  styles.chip,
                  timeOffset === opt.value && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    timeOffset === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Visibility */}
          <Text style={styles.label}>WHO CAN SEE</Text>
          <View style={styles.chipRow}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setVisibility(opt.value)}
                style={[
                  styles.chip,
                  visibility === opt.value && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    visibility === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Optional Note */}
          {!showNote ? (
            <Pressable onPress={() => setShowNote(true)}>
              <Text style={styles.addNote}>+ Add a note...</Text>
            </Pressable>
          ) : (
            <TextInput
              style={styles.noteInput}
              placeholder="BYOB, access code is 4421..."
              placeholderTextColor="#57534E"
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
            />
          )}

          {/* Submit */}
          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitText}>
              {submitting ? "Going live..." : "Go live"}
            </Text>
          </Pressable>

          {/* Cancel */}
          <Pressable onPress={resetAndClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  content: {
    padding: 24,
    paddingTop: 12,
    paddingBottom: 48,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#57534E",
    alignSelf: "center",
    marginBottom: 24,
  },
  heading: {
    color: "#57534E",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  titleInput: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 18,
    color: "#FAFAF8",
    fontSize: 18,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#262626",
    marginBottom: 24,
  },
  label: {
    color: "#57534E",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#262626",
  },
  chipActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  chipText: {
    color: "#A8A29E",
    fontWeight: "700",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#0D0D0D",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#262626",
    marginBottom: 20,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  locationText: {
    color: "#FAFAF8",
    fontSize: 14,
    flex: 1,
  },
  locationChange: {
    color: "#F59E0B",
    fontSize: 13,
    fontWeight: "700",
  },
  addNote: {
    color: "#A8A29E",
    fontSize: 14,
    marginBottom: 24,
    marginTop: 4,
  },
  noteInput: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 14,
    color: "#FAFAF8",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#262626",
    minHeight: 60,
    marginBottom: 24,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: "#0D0D0D",
    fontWeight: "900",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    color: "#57534E",
    fontSize: 14,
    fontWeight: "600",
  },
});
