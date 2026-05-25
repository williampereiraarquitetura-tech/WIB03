import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { TaskCard } from "@/components/TaskCard";
import { useListTasks, useUpdateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

const PRIORITIES = ["todas", "urgente", "importante", "aguardando_terceiro", "bloqueada", "baixa"];
const PRIORITY_LABELS: Record<string, string> = {
  todas: "Todas",
  urgente: "Urgente",
  importante: "Importante",
  aguardando_terceiro: "Aguardando",
  bloqueada: "Bloqueada",
  baixa: "Baixa",
};

export default function TarefasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [activePriority, setActivePriority] = useState("todas");
  const [showDone, setShowDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: tasks, isLoading, refetch } = useListTasks(
    activePriority !== "todas" ? { priority: activePriority } : {}
  );

  const updateTask = useUpdateTask();

  const filtered = (tasks ?? []).filter((t) => showDone || t.status !== "concluida");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.heading, { color: colors.onSurface }]}>Tarefas</Text>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: showDone ? colors.lime + "20" : colors.surfaceContainer, borderColor: showDone ? colors.lime : colors.border }]}
            onPress={() => setShowDone(!showDone)}
            activeOpacity={0.8}
          >
            <Text style={[styles.doneBtnText, { color: showDone ? colors.lime : colors.muted }]}>Concluídas</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          horizontal
          data={PRIORITIES}
          keyExtractor={(p) => p}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: p }) => (
            <TouchableOpacity
              onPress={() => setActivePriority(p)}
              style={[styles.filterBtn, { backgroundColor: activePriority === p ? colors.lime : colors.surfaceContainer, borderColor: activePriority === p ? colors.lime : colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, { color: activePriority === p ? colors.onLime : colors.onSurfaceVariant }]}>
                {PRIORITY_LABELS[p]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={colors.lime} />}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onToggle={async () => {
                await updateTask.mutateAsync(
                  { id: item.id, data: { status: item.status === "concluida" ? "pendente" : "concluida" } },
                ).catch((err) => {
                  Alert.alert("Erro", `Não foi possível atualizar a tarefa.\n${err?.message ?? ""}`);
                  throw err;
                });
                await qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-square" size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Sem tarefas</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>As tarefas geradas pela IA aparecerão aqui</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  backBtn: { padding: 4 },
  heading: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3, flex: 1 },
  doneBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  doneBtnText: { fontSize: 13, fontWeight: "500" as const },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: "500" as const },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
