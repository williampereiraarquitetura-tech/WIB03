import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

const EVENT_ICONS: Record<string, string> = {
  audio_enviado: "mic",
  arquivo_analisado: "file-text",
  documento_anexado: "paperclip",
  tarefa_criada: "check-square",
  pessoa_vinculada: "user",
  decisao_registrada: "bookmark",
  pendencia_identificada: "alert-circle",
  status_atualizado: "refresh-cw",
  projeto_criado: "folder-plus",
};

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

interface TimelineItemProps {
  event: {
    id: number;
    type: string;
    title: string;
    description?: string | null;
    projectName?: string | null;
    createdAt: string;
  };
  isLast?: boolean;
}

export function TimelineItem({ event, isLast = false }: TimelineItemProps) {
  const colors = useColors();
  const icon = EVENT_ICONS[event.type] ?? "circle";

  return (
    <View style={styles.container}>
      <View style={styles.leftCol}>
        <View style={[styles.iconCircle, { backgroundColor: colors.lime + "20", borderColor: colors.lime + "40" }]}>
          <Feather name={icon as any} size={12} color={colors.lime} />
        </View>
        {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{event.title}</Text>
        {event.description ? (
          <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={2}>{event.description}</Text>
        ) : null}
        <View style={styles.meta}>
          {event.projectName ? (
            <Text style={[styles.project, { color: colors.lime }]}>{event.projectName}</Text>
          ) : null}
          <Text style={[styles.time, { color: colors.muted }]}>{timeAgo(event.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", gap: 12, paddingBottom: 16 },
  leftCol: { alignItems: "center", width: 28 },
  iconCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  line: { width: 1, flex: 1, marginTop: 4 },
  content: { flex: 1, paddingTop: 4, gap: 3 },
  title: { fontSize: 14, fontWeight: "500" as const },
  desc: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 },
  project: { fontSize: 12, fontWeight: "600" as const },
  time: { fontSize: 12 },
});
