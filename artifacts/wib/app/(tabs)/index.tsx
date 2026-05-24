import React from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { TimelineItem } from "@/components/TimelineItem";
import { TaskCard } from "@/components/TaskCard";
import { useGetToday, useUpdateTask } from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTodayQueryKey } from "@workspace/api-client-react";

export default function HojeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: today, isLoading, refetch } = useGetToday();
  const updateTask = useUpdateTask();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lime} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.muted }]}>WIB · Segundo Cérebro</Text>
          <Text style={[styles.heading, { color: colors.onSurface }]}>Hoje</Text>
        </View>
        <TouchableOpacity
          style={[styles.inboxBtn, { backgroundColor: colors.lime + "20", borderColor: colors.lime + "40" }]}
          onPress={() => router.push("/inbox")}
          activeOpacity={0.8}
        >
          <Feather name="inbox" size={16} color={colors.lime} />
          {today?.pendingInbox ? (
            <View style={[styles.badge, { backgroundColor: colors.lime }]}>
              <Text style={[styles.badgeText, { color: colors.onLime }]}>{today.pendingInbox}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* AI Summary */}
          {today?.aiSummary ? (
            <GlassCard style={styles.aiCard} accent>
              <View style={styles.aiHeader}>
                <Feather name="zap" size={14} color={colors.lime} />
                <Text style={[styles.aiLabel, { color: colors.lime }]}>IA · RESUMO DO DIA</Text>
              </View>
              <Text style={[styles.aiText, { color: colors.onSurface }]}>{today.aiSummary}</Text>
              <View style={styles.statsRow}>
                <View style={[styles.stat, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[styles.statNum, { color: today.blockedProjects > 0 ? colors.error : colors.lime }]}>{today.blockedProjects}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>bloqueados</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[styles.statNum, { color: colors.lime }]}>{today.pendingInbox}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>na inbox</Text>
                </View>
                <View style={[styles.stat, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text style={[styles.statNum, { color: colors.lime }]}>{today.urgentTasks?.length ?? 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.muted }]}>urgentes</Text>
                </View>
              </View>
            </GlassCard>
          ) : null}

          {/* Urgent Tasks */}
          {today?.urgentTasks && today.urgentTasks.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.muted }]}>PRIORIDADES</Text>
                <TouchableOpacity onPress={() => router.push("/tarefas")}>
                  <Text style={[styles.seeAll, { color: colors.lime }]}>Ver todas</Text>
                </TouchableOpacity>
              </View>
              {today.urgentTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={() =>
                    updateTask.mutate(
                      { id: task.id, data: { status: task.status === "concluida" ? "pendente" : "concluida" } },
                      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetTodayQueryKey() }) }
                    )
                  }
                />
              ))}
            </View>
          ) : null}

          {/* Recent Activity */}
          {today?.recentEvents && today.recentEvents.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.muted }]}>ATIVIDADE RECENTE</Text>
              <GlassCard style={styles.timelineCard}>
                {today.recentEvents.map((event, i) => (
                  <TimelineItem
                    key={event.id}
                    event={event}
                    isLast={i === today.recentEvents.length - 1}
                  />
                ))}
              </GlassCard>
            </View>
          ) : (
            !isLoading && (
              <GlassCard style={styles.emptyCard}>
                <Feather name="sun" size={32} color={colors.muted} />
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Tudo limpo por aqui</Text>
                <Text style={[styles.emptyText, { color: colors.muted }]}>Capture algo novo para começar</Text>
              </GlassCard>
            )
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 },
  greeting: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 1, marginBottom: 4 },
  heading: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -0.5 },
  inboxBtn: { borderWidth: 1, borderRadius: 12, padding: 10, position: "relative" },
  badge: { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "700" as const },
  aiCard: { padding: 16, marginBottom: 20 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  aiLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1 },
  aiText: { fontSize: 16, fontWeight: "500" as const, lineHeight: 24, marginBottom: 14 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "700" as const },
  statLabel: { fontSize: 11, marginTop: 2 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1 },
  seeAll: { fontSize: 13, fontWeight: "600" as const },
  timelineCard: { padding: 16 },
  emptyCard: { padding: 32, alignItems: "center", gap: 8, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, marginTop: 8 },
  emptyText: { fontSize: 14 },
});
