import React, { useState } from "react";
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "./GlassCard";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useListProjects } from "@workspace/api-client-react";

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
  onConfirm: (projectId?: number) => void;
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
  const [showPicker, setShowPicker] = useState(false);
  const { data: projects } = useListProjects();

  const icon = TYPE_ICONS[item.type] ?? "file";
  const label = TYPE_LABELS[item.type] ?? item.type;
  const suggestions = item.aiSuggestions;
  const preview = item.rawTranscription ?? item.content ?? "";

  const handleConfirmPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPicker(true);
  };

  const handleSelectProject = (projectId?: number) => {
    setShowPicker(false);
    onConfirm(projectId);
  };

  return (
    <>
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
            <Text style={[styles.previewText, { color: colors.onSurfaceVariant }]} numberOfLines={3}>
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
            {suggestions.tasks.slice(0, 3).map((t, i) => (
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
            onPress={handleConfirmPress}
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

      {/* Project Picker Modal */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Vincular a um projeto</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Feather name="x" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetSub, { color: colors.muted }]}>
              As tarefas serão criadas como pendentes na esteira do projeto escolhido.
            </Text>

            {/* Sem projeto option */}
            <TouchableOpacity
              style={[styles.projectRow, { borderColor: colors.border }]}
              onPress={() => handleSelectProject(undefined)}
              activeOpacity={0.8}
            >
              <View style={[styles.projectIcon, { backgroundColor: colors.surfaceContainer }]}>
                <Feather name="inbox" size={18} color={colors.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.projectName, { color: colors.onSurface }]}>Sem projeto</Text>
                <Text style={[styles.projectSub, { color: colors.muted }]}>Tarefa avulsa — associe depois</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </TouchableOpacity>

            {/* Project list */}
            <FlatList
              data={projects ?? []}
              keyExtractor={(p) => String(p.id)}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={
                <ActivityIndicator color={colors.lime} style={{ marginTop: 20 }} />
              }
              renderItem={({ item: project }) => (
                <TouchableOpacity
                  style={[styles.projectRow, { borderColor: colors.border }]}
                  onPress={() => handleSelectProject(project.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.projectIcon, { backgroundColor: colors.lime + "20" }]}>
                    <Feather name="folder" size={18} color={colors.lime} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.projectName, { color: colors.onSurface }]} numberOfLines={1}>
                      {project.name}
                    </Text>
                    {project.clientName ? (
                      <Text style={[styles.projectSub, { color: colors.muted }]} numberOfLines={1}>
                        {project.clientName}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 18, fontWeight: "700" as const },
  sheetSub: { fontSize: 13, paddingHorizontal: 20, paddingVertical: 12, lineHeight: 18 },
  projectRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  projectIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  projectName: { fontSize: 15, fontWeight: "600" as const },
  projectSub: { fontSize: 12, marginTop: 2 },
});
