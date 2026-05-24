import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { useUpload } from "@/hooks/useUpload";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Audio } from "expo-av";

type RecordingState = "idle" | "recording" | "processing";

export default function CapturaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { upload, uploading } = useUpload();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [lastResult, setLastResult] = useState<{ title: string; type: string } | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setRecordingState("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("Erro", "Não foi possível acessar o microfone");
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setRecordingState("processing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      const result = await upload(uri, `audio_${Date.now()}.m4a`, "audio/m4a");
      if (result) {
        setLastResult({ title: result.title, type: result.type });
        router.push("/inbox");
      }
    }
    setRecordingState("idle");
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uploaded = await upload(asset.uri, asset.fileName ?? `img_${Date.now()}.jpg`, asset.mimeType ?? "image/jpeg");
      if (uploaded) router.push("/inbox");
    }
  }

  async function pickCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permissão necessária", "Habilite o acesso à câmera nas configurações."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uploaded = await upload(asset.uri, `foto_${Date.now()}.jpg`, asset.mimeType ?? "image/jpeg");
      if (uploaded) router.push("/inbox");
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "*/*"], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uploaded = await upload(asset.uri, asset.name, asset.mimeType ?? "application/octet-stream");
      if (uploaded) router.push("/inbox");
    }
  }

  const isProcessing = uploading || recordingState === "processing";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: colors.onSurface }]}>Capturar</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Tudo vai para a Inbox e a IA organiza automaticamente</Text>

      {/* Main Record Button */}
      <View style={styles.center}>
        <TouchableOpacity
          onPress={recordingState === "idle" ? startRecording : stopRecording}
          disabled={isProcessing}
          activeOpacity={0.85}
          style={[
            styles.recordBtn,
            {
              backgroundColor: recordingState === "recording" ? colors.error + "30" : colors.lime + "20",
              borderColor: recordingState === "recording" ? colors.error : colors.lime,
              borderWidth: recordingState === "recording" ? 2 : 1,
            },
          ]}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.lime} size="large" />
          ) : recordingState === "recording" ? (
            <View style={[styles.stopIcon, { backgroundColor: colors.error }]} />
          ) : (
            <Feather name="mic" size={48} color={colors.lime} />
          )}
        </TouchableOpacity>
        <Text style={[styles.recordLabel, { color: recordingState === "recording" ? colors.error : colors.muted }]}>
          {isProcessing ? "Processando com IA..." : recordingState === "recording" ? "Toque para parar" : "Gravar áudio"}
        </Text>
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>OUTRAS OPÇÕES</Text>

      <View style={styles.grid}>
        <TouchableOpacity onPress={pickCamera} disabled={isProcessing} activeOpacity={0.85} style={styles.gridItem}>
          <GlassCard style={styles.gridCard}>
            <Feather name="camera" size={28} color={colors.lime} />
            <Text style={[styles.gridLabel, { color: colors.onSurface }]}>Câmera</Text>
            <Text style={[styles.gridSub, { color: colors.muted }]}>Foto ou print</Text>
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity onPress={pickImage} disabled={isProcessing} activeOpacity={0.85} style={styles.gridItem}>
          <GlassCard style={styles.gridCard}>
            <Feather name="image" size={28} color={colors.purpleLight} />
            <Text style={[styles.gridLabel, { color: colors.onSurface }]}>Galeria</Text>
            <Text style={[styles.gridSub, { color: colors.muted }]}>Imagens salvas</Text>
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity onPress={pickDocument} disabled={isProcessing} activeOpacity={0.85} style={styles.gridItem}>
          <GlassCard style={styles.gridCard}>
            <Feather name="file-text" size={28} color={colors.onSurfaceVariant} />
            <Text style={[styles.gridLabel, { color: colors.onSurface }]}>PDF / Arquivo</Text>
            <Text style={[styles.gridSub, { color: colors.muted }]}>Qualquer formato</Text>
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/inbox")} disabled={isProcessing} activeOpacity={0.85} style={styles.gridItem}>
          <GlassCard style={styles.gridCard}>
            <Feather name="inbox" size={28} color={colors.lime} />
            <Text style={[styles.gridLabel, { color: colors.onSurface }]}>Inbox</Text>
            <Text style={[styles.gridSub, { color: colors.muted }]}>Ver capturas</Text>
          </GlassCard>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  heading: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 32 },
  center: { alignItems: "center", marginBottom: 40 },
  recordBtn: { width: 140, height: 140, borderRadius: 70, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  stopIcon: { width: 32, height: 32, borderRadius: 6 },
  recordLabel: { fontSize: 14, fontWeight: "500" as const },
  sectionLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem: { width: "47%" },
  gridCard: { padding: 18, alignItems: "flex-start", gap: 8 },
  gridLabel: { fontSize: 16, fontWeight: "600" as const },
  gridSub: { fontSize: 13 },
});
