import React, { useEffect, useRef, useState } from "react";
import {
  Alert, Animated, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showCaptureShortcut, hideCaptureShortcut } from "@/services/notifications";

// ─── Types ───────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "recording";
const SHORTCUT_KEY = "wib_capture_shortcut";

// ─── Upload progress overlay ─────────────────────────────────────────────────

function UploadOverlay({
  status, progress, error, fileName, onCancel, onClose, colors,
}: {
  status: "idle" | "sending" | "processing" | "done" | "error";
  progress: number;
  error: string | null;
  fileName: string;
  onCancel: () => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: progress,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const pct = Math.round(progress * 100);

  const icon =
    status === "done" ? { name: "check-circle" as const, color: colors.lime } :
    status === "error" ? { name: "x-circle" as const, color: colors.error } :
    status === "processing" ? { name: "cpu" as const, color: colors.lime } :
    { name: "upload-cloud" as const, color: colors.lime };

  const label =
    status === "sending" ? `Enviando... ${pct}%` :
    status === "processing" ? "Processando com IA..." :
    status === "done" ? "Enviado com sucesso!" :
    status === "error" ? "Falha no envio" : "";

  const sublabel =
    status === "done" ? "A IA está analisando o arquivo na Inbox" :
    status === "processing" ? "Aguardando confirmação do servidor..." :
    status === "error" ? (error ?? "Ocorreu um erro desconhecido") : "";

  return (
    <View style={overlayStyles.backdrop}>
      <View style={[overlayStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

        {/* Icon + status */}
        <View style={overlayStyles.topRow}>
          <View style={[overlayStyles.iconWrap, {
            backgroundColor: status === "error" ? colors.error + "20" : colors.lime + "15",
          }]}>
            <Feather name={icon.name} size={26} color={icon.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[overlayStyles.label, { color: colors.onSurface }]}>{label}</Text>
            {fileName ? (
              <Text style={[overlayStyles.fileName, { color: colors.muted }]} numberOfLines={1}>
                {fileName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Progress bar */}
        {(status === "sending" || status === "processing" || status === "done") && (
          <View style={[overlayStyles.trackWrap, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Animated.View
              style={[
                overlayStyles.fill,
                {
                  backgroundColor: status === "error" ? colors.error : colors.lime,
                  width: animProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        )}

        {/* Sub-label */}
        {sublabel ? (
          <Text style={[overlayStyles.sublabel, {
            color: status === "error" ? colors.error : colors.muted,
          }]}>
            {sublabel}
          </Text>
        ) : null}

        {/* Actions */}
        <View style={overlayStyles.actions}>
          {status === "sending" && (
            <TouchableOpacity
              onPress={onCancel}
              style={[overlayStyles.btn, { backgroundColor: colors.error + "18", borderColor: colors.error + "40" }]}
              activeOpacity={0.8}
            >
              <Feather name="x" size={14} color={colors.error} />
              <Text style={[overlayStyles.btnText, { color: colors.error }]}>Cancelar</Text>
            </TouchableOpacity>
          )}

          {status === "done" && (
            <TouchableOpacity
              onPress={onClose}
              style={[overlayStyles.btn, { backgroundColor: colors.lime + "20", borderColor: colors.lime + "50" }]}
              activeOpacity={0.8}
            >
              <Feather name="inbox" size={14} color={colors.lime} />
              <Text style={[overlayStyles.btnText, { color: colors.lime }]}>Ver na Inbox</Text>
            </TouchableOpacity>
          )}

          {status === "error" && (
            <TouchableOpacity
              onPress={onClose}
              style={[overlayStyles.btn, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={[overlayStyles.btnText, { color: colors.muted }]}>Fechar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CapturaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { upload, uploadStatus, progress, error, cancel, reset } = useUpload();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [shortcutEnabled, setShortcutEnabled] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const showOverlay = uploadStatus !== "idle";

  useEffect(() => {
    AsyncStorage.getItem(SHORTCUT_KEY).then((v) => setShortcutEnabled(v === "1"));
  }, []);

  // Auto-navigate to inbox after successful upload
  useEffect(() => {
    if (uploadStatus !== "done") return;
    const t = setTimeout(() => {
      reset();
      router.push("/inbox");
    }, 2000);
    return () => clearTimeout(t);
  }, [uploadStatus]);

  async function toggleShortcut() {
    if (shortcutEnabled) {
      await hideCaptureShortcut();
      await AsyncStorage.setItem(SHORTCUT_KEY, "0");
      setShortcutEnabled(false);
    } else {
      await showCaptureShortcut();
      await AsyncStorage.setItem(SHORTCUT_KEY, "1");
      setShortcutEnabled(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    setRecordingState("idle");

    if (uri) {
      const name = `audio_${Date.now()}.m4a`;
      setCurrentFileName(name);
      await upload(uri, name, "audio/m4a");
    }
  }

  async function pickAudioFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/*", "application/octet-stream"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCurrentFileName(asset.name);
      await upload(asset.uri, asset.name, asset.mimeType ?? "audio/mpeg");
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.fileName ?? `img_${Date.now()}.jpg`;
      setCurrentFileName(name);
      await upload(asset.uri, name, asset.mimeType ?? "image/jpeg");
    }
  }

  async function pickCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Habilite o acesso à câmera nas configurações.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = `foto_${Date.now()}.jpg`;
      setCurrentFileName(name);
      await upload(asset.uri, name, asset.mimeType ?? "image/jpeg");
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "*/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCurrentFileName(asset.name);
      await upload(asset.uri, asset.name, asset.mimeType ?? "application/octet-stream");
    }
  }

  const busy = showOverlay || recordingState === "recording";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: colors.onSurface }]}>Capturar</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>Tudo vai para a Inbox e a IA organiza automaticamente</Text>

        {/* Record button */}
        <View style={styles.center}>
          <TouchableOpacity
            onPress={recordingState === "idle" ? startRecording : stopRecording}
            disabled={showOverlay}
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
            {recordingState === "recording" ? (
              <View style={[styles.stopIcon, { backgroundColor: colors.error }]} />
            ) : (
              <Feather name="mic" size={48} color={colors.lime} />
            )}
          </TouchableOpacity>
          <Text style={[styles.recordLabel, { color: recordingState === "recording" ? colors.error : colors.muted }]}>
            {recordingState === "recording" ? "Toque para parar" : "Gravar áudio"}
          </Text>
        </View>

        {/* Quick actions grid */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>OUTRAS OPÇÕES</Text>
        <View style={styles.grid}>
          {[
            { icon: "camera", label: "Câmera", sub: "Foto ou print", color: colors.lime, onPress: pickCamera },
            { icon: "image", label: "Galeria", sub: "Imagens salvas", color: colors.purpleLight, onPress: pickImage },
            { icon: "headphones", label: "Áudio salvo", sub: "MP3, M4A, WAV...", color: colors.purpleLight, onPress: pickAudioFile },
            { icon: "file-text", label: "PDF / Arquivo", sub: "Qualquer formato", color: colors.onSurfaceVariant, onPress: pickDocument },
          ].map(({ icon, label, sub, color, onPress }) => (
            <TouchableOpacity
              key={label}
              onPress={onPress}
              disabled={busy}
              activeOpacity={0.85}
              style={[styles.gridItem, busy && { opacity: 0.4 }]}
            >
              <GlassCard style={styles.gridCard}>
                <Feather name={icon as any} size={28} color={color} />
                <Text style={[styles.gridLabel, { color: colors.onSurface }]}>{label}</Text>
                <Text style={[styles.gridSub, { color: colors.muted }]}>{sub}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Shortcut notification toggle */}
        {Platform.OS !== "web" && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted, marginTop: 28 }]}>ATALHO RÁPIDO</Text>
            <TouchableOpacity onPress={toggleShortcut} activeOpacity={0.85}>
              <GlassCard style={[styles.shortcutCard, { borderColor: shortcutEnabled ? colors.lime + "60" : colors.border }]}>
                <View style={styles.shortcutRow}>
                  <View style={[styles.shortcutIcon, { backgroundColor: shortcutEnabled ? colors.lime + "20" : colors.surfaceContainerHigh }]}>
                    <Feather name="bell" size={22} color={shortcutEnabled ? colors.lime : colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shortcutTitle, { color: colors.onSurface }]}>Notificação fixa de Capturar</Text>
                    <Text style={[styles.shortcutSub, { color: colors.muted }]}>
                      {shortcutEnabled ? "Ativa — aparece na barra de notificações" : "Toque para fixar na barra de notificações"}
                    </Text>
                  </View>
                  <View style={[styles.toggle, { backgroundColor: shortcutEnabled ? colors.lime : colors.surfaceContainerHigh }]}>
                    <View style={[styles.toggleDot, {
                      transform: [{ translateX: shortcutEnabled ? 18 : 2 }],
                      backgroundColor: shortcutEnabled ? colors.onLime : colors.muted,
                    }]} />
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Upload progress overlay — rendered as absolute bottom sheet */}
      <Modal visible={showOverlay} transparent animationType="slide">
        <UploadOverlay
          status={uploadStatus}
          progress={progress}
          error={error}
          fileName={currentFileName}
          onCancel={cancel}
          onClose={() => {
            reset();
            if (uploadStatus === "done") router.push("/inbox");
          }}
          colors={colors}
        />
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  shortcutCard: { padding: 16, borderWidth: 1 },
  shortcutRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  shortcutIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  shortcutTitle: { fontSize: 15, fontWeight: "600" as const, marginBottom: 2 },
  shortcutSub: { fontSize: 12, lineHeight: 16 },
  toggle: { width: 42, height: 24, borderRadius: 12, justifyContent: "center" },
  toggleDot: { width: 18, height: 18, borderRadius: 9, position: "absolute" },
});

const overlayStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 36,
    gap: 16,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 17, fontWeight: "700" as const },
  fileName: { fontSize: 12, marginTop: 2 },
  trackWrap: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  sublabel: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 18, paddingVertical: 11,
  },
  btnText: { fontSize: 14, fontWeight: "600" as const },
});
