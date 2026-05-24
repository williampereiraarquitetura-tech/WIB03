import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "./GlassCard";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { Feather } from "@expo/vector-icons";

const TYPE_LABELS: Record<string, string> = {
  viabilidade: "Viabilidade",
  aprovacao_municipal: "Aprovação Municipal",
  aprovacao_estadual: "Aprovação Estadual",
  graprohab: "GRAPROHAB",
  projeto_urbanistico: "Projeto Urbanístico",
  incorporacao: "Incorporação",
  regularizacao: "Regularização",
  loteamento: "Loteamento",
  desmembramento: "Desmembramento",
  consulta_previa: "Consulta Prévia",
};

interface ProjectCardProps {
  project: {
    id: number;
    name: string;
    clientName?: string | null;
    type: string;
    status: string;
    priority: string;
    progress?: number | null;
  };
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const colors = useColors();
  const progress = project.progress ?? 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <GlassCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.type, { color: colors.muted }]}>
              {TYPE_LABELS[project.type] ?? project.type}
            </Text>
            <PriorityBadge priority={project.priority} />
          </View>
          <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={2}>
            {project.name}
          </Text>
          {project.clientName ? (
            <Text style={[styles.client, { color: colors.muted }]}>{project.clientName}</Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <StatusBadge status={project.status} />
          <View style={styles.progressRow}>
            <View style={[styles.progressBg, { backgroundColor: colors.surfaceContainerHigh }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.lime, width: `${progress}%` as any }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.muted }]}>{progress}%</Text>
          </View>
        </View>

        <View style={[styles.chevron]}>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
    position: "relative",
  },
  header: { gap: 4, marginBottom: 12 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  type: { fontSize: 11, fontWeight: "500" as const, letterSpacing: 0.3 },
  name: { fontSize: 17, fontWeight: "600" as const, lineHeight: 22 },
  client: { fontSize: 13 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  progressBg: { height: 4, borderRadius: 2, flex: 1, maxWidth: 80 },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 11, fontWeight: "600" as const, minWidth: 28 },
  chevron: { position: "absolute", right: 16, top: "50%" },
});
