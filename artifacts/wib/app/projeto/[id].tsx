import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { TaskCard } from "@/components/TaskCard";
import { TimelineItem } from "@/components/TimelineItem";
import { StatusBadge } from "@/components/StatusBadge";
import { useGetProject, useUpdateTask, getGetProjectQueryKey } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

const TYPE_LABELS: Record<string, string> = {
  viabilidade: "Viabilidade", aprovacao_municipal: "Aprovação Municipal", aprovacao_estadual: "Aprovação Estadual",
  graprohab: "GRAPROHAB", projeto_urbanistico: "Proj. Urbanístico", incorporacao: "Incorporação",
  regularizacao: "Regularização", loteamento: "Loteamento", desmembramento: "Desmembramento", consulta_previa: "Consulta Prévia",
};

type Tab = "tarefas" | "timeline" | "arquivos";

export default function ProjetoDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("tarefas");

  const { data: project, isLoading } = useGetProject(parseInt(id!));
  const updateTask = useUpdateTask();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.lime} style={{ marginTop: 80 }} /></View>;
  }

  if (!project) {
    return <View style={[styles.container, { backgroundColor: colors.background }]}><Text style={{ color: colors.error, textAlign: "center", marginTop: 80 }}>Projeto não encontrado</Text></View>;
  }

  const progress = project.progress ?? 0;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 40 }]} showsVerticalScrollIndicator={false}>
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={colors.onSurface} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.projectHeader}>
        <Text style={[styles.typeLabel, { color: colors.muted }]}>{TYPE_LABELS[project.type] ?? project.type}</Text>
        <Text style={[styles.name, { color: colors.onSurface }]}>{project.name}</Text>
        {project.clientName ? <Text style={[styles.client, { color: colors.muted }]}>{project.clientName}</Text> : null}
        <View style={styles.statusRow}>
          <StatusBadge status={project.status} />
          <View style={[styles.progressPill, { backgroundColor: colors.surfaceContainer }]}>
            <Text style={[styles.progressText, { color: colors.lime }]}>{progress}%</Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.surfaceContainer }]}>
        <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: colors.lime }]} />
      </View>

      {/* AI Summary */}
      {project.aiSummary ? (
        <GlassCard style={styles.aiCard} accent>
          <View style={styles.aiHeader}>
            <Feather name="zap" size={12} color={colors.lime} />
            <Text style={[styles.aiLabel, { color: colors.lime }]}>RESUMO IA</Text>
          </View>
          <Text style={[styles.aiText, { color: colors.onSurface }]}>{project.aiSummary}</Text>
        </GlassCard>
      ) : null}

      {/* Stats */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.lime }]}>{project.tasks?.length ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Tarefas</Text>
        </GlassCard>
        <GlassCard style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.lime }]}>{project.files?.length ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Arquivos</Text>
        </GlassCard>
        <GlassCard style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.lime }]}>{project.timeline?.length ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Eventos</Text>
        </GlassCard>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["tarefas", "timeline", "arquivos"] as Tab[]).map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && { borderBottomColor: colors.lime, borderBottomWidth: 2 }]}>
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.lime : colors.muted }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === "tarefas" && (
        <View style={styles.tabContent}>
          {project.tasks?.length === 0 ? (
            <View style={styles.empty}><Feather name="check-square" size={32} color={colors.muted} /><Text style={[styles.emptyText, { color: colors.muted }]}>Sem tarefas ainda</Text></View>
          ) : project.tasks?.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={async () => {
                await updateTask.mutateAsync(
                  { id: task.id, data: { status: task.status === "concluida" ? "pendente" : "concluida" } },
                ).catch((err) => {
                  Alert.alert("Erro", `Não foi possível atualizar a tarefa.\n${err?.message ?? ""}`);
                  throw err;
                });
                await qc.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
              }}
            />
          ))}
        </View>
      )}

      {activeTab === "timeline" && (
        <View style={styles.tabContent}>
          {project.timeline?.length === 0 ? (
            <View style={styles.empty}><Feather name="clock" size={32} color={colors.muted} /><Text style={[styles.emptyText, { color: colors.muted }]}>Sem eventos ainda</Text></View>
          ) : project.timeline?.map((event, i) => (
            <TimelineItem key={event.id} event={event} isLast={i === (project.timeline?.length ?? 0) - 1} />
          ))}
        </View>
      )}

      {activeTab === "arquivos" && (
        <View style={styles.tabContent}>
          {project.files?.length === 0 ? (
            <View style={styles.empty}><Feather name="archive" size={32} color={colors.muted} /><Text style={[styles.emptyText, { color: colors.muted }]}>Sem arquivos ainda</Text></View>
          ) : project.files?.map((file) => (
            <GlassCard key={file.id} style={styles.fileCard}>
              <View style={styles.fileRow}>
                <Feather name="file-text" size={20} color={colors.lime} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fileName, { color: colors.onSurface }]} numberOfLines={1}>{file.name}</Text>
                  {file.aiSummary ? <Text style={[styles.fileSummary, { color: colors.muted }]} numberOfLines={2}>{file.aiSummary}</Text> : null}
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  backBtn: { padding: 4, marginBottom: 16 },
  projectHeader: { gap: 6, marginBottom: 16 },
  typeLabel: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5 },
  name: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: 34 },
  client: { fontSize: 15 },
  statusRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  progressPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  progressText: { fontSize: 13, fontWeight: "700" as const },
  progressBar: { height: 4, borderRadius: 2, marginBottom: 20, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  aiCard: { padding: 14, marginBottom: 16 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  aiLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1 },
  aiText: { fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  stat: { flex: 1, padding: 12, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700" as const },
  statLabel: { fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 16 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 14, fontWeight: "600" as const },
  tabContent: { gap: 0 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14 },
  fileCard: { padding: 12, marginBottom: 8 },
  fileRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  fileName: { fontSize: 15, fontWeight: "500" as const },
  fileSummary: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
