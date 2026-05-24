import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "./GlassCard";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const TYPE_ICONS: Record<string, string> = {
  audio: "mic",
  image: "image",
  pdf: "file-text",
  text: "edit-3",
  document: "paperclip",
};

const TYPE_LABELS: Record<string, string> = {
  audio: "Áudio",
  image: "Imagem",
  pdf: "PDF",
  text: "Texto",
  document: "Documento",
};

interface InboxCardProps {
  item: {
    id: number;
    type: string;
    title: string;
    content?: string | null;
    rawTranscription?: string | null;
    aiSuggestions?: {
      summary?: string;
      suggestedProject?: string;
      priority?: string;
      tasks?: string[];
      tags?: string[];
    } | null;
    status: string;
    createdAt: string;
  };
  onConfirm: () => void;
  onDismiss: () => void;
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export function InboxCard({ item, onConfirm, onDismiss }: InboxCardProps) {
  const colors = useColors();
  const icon = TYPE_ICONS[item.type] ?? "file";
  const label = TYPE_LABELS[item.type] ?? item.type;
  const suggestions = item.aiSuggestions;
  const preview = item.rawTranscription ?? item.content ?? "";

  return (
    <GlassCard style={styles.card} accent>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: colors.lime + "20" }]}>
          <Feather name={icon as any} size={18} color={colors.lime} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>{label} · {timeAgo(item.createdAt)}</Text>
        </View>
      </View>

      {preview ? (
        <View style={[styles.preview, { borderLeftColor: colors.lime, backgroundColor: colors.surfaceContainerHigh + "80" }]}>
          <Text style={[styles.previewText, { color: colors.onSurfaceVariant }]} numberOfLines={3} italic>
            "{preview}"
          </Text>
        </View>
      ) : null}

      {suggestions?.summary ? (
        <Text style={[styles.summary, { color: colors.onSurface }]}>{suggestions.summary}</Text>
      ) : null}

      <View style={styles.tags}>
        {suggestions?.suggestedProject ? (
          <View style={[styles.tag, { backgroundColor: colors.lime + "20", borderColor: colors.lime + "40" }]}>
            <Feather name="folder" size={11} color={colors.lime} />
            <Text style={[styles.tagText, { color: colors.lime }]}>{suggestions.suggestedProject}</Text>
          </View>
        ) : null}
        {suggestions?.priority ? (
          <View style={[styles.tag, { backgroundColor: colors.purple + "30", borderColor: colors.purple + "50" }]}>
            <Text style={[styles.tagText, { color: colors.purpleLight }]}>{suggestions.priority}</Text>
          </View>
        ) : null}
      </View>

      {suggestions?.tasks && suggestions.tasks.length > 0 ? (
        <View style={styles.taskList}>
          {suggestions.tasks.slice(0, 2).map((t, i) => (
            <View key={i} style={styles.taskRow}>
              <Feather name="check-circle" size={12} color={colors.lime} />
              <Text style={[styles.taskText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btnConfirm, { backgroundColor: colors.lime }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConfirm(); }}
          activeOpacity={0.8}
        >
          <Feather name="check" size={16} color={colors.onLime} />
          <Text style={[styles.btnText, { color: colors.onLime }]}>Confirmar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnDismiss, { borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDismiss(); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: colors.muted }]}>Descartar</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  titleBlock: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600" as const },
  meta: { fontSize: 12, marginTop: 2 },
  preview: { borderLeftWidth: 2, paddingLeft: 12, paddingVertical: 8, borderRadius: 4, marginBottom: 10 },
  previewText: { fontSize: 14, lineHeight: 20, fontStyle: "italic" },
  summary: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: "600" as const },
  taskList: { gap: 4, marginBottom: 12 },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  taskText: { fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  btnConfirm: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 14 },
  btnDismiss: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  btnText: { fontSize: 14, fontWeight: "600" as const },
});
