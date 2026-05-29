import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, RefreshControl, ScrollView, SectionList,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { TaskCard } from "@/components/TaskCard";
import {
  useListTasks, useUpdateTask, useCreateTask, useDeleteTask,
  getListTasksQueryKey, useListProjects,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewKey = "todas" | "hoje" | "atrasadas" | "alta" | "por_projeto" | "ia" | "aguardando" | "concluidas";

interface Task {
  id: number;
  projectId?: number | null;
  projectName?: string | null;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  dueDate?: string | null;
  source?: string | null;
  createdAt: string;
}

// ─── View config ─────────────────────────────────────────────────────────────

const VIEWS: Array<{ key: ViewKey; label: string; icon: string; color?: string }> = [
  { key: "todas",      label: "Todas",       icon: "list" },
  { key: "hoje",       label: "Hoje",        icon: "sun",            color: "#cbf157" },
  { key: "atrasadas",  label: "Atrasadas",   icon: "alert-triangle", color: "#f87171" },
  { key: "alta",       label: "Alta prior.", icon: "zap",            color: "#fbbf24" },
  { key: "por_projeto",label: "Por projeto", icon: "folder",         color: "#86efac" },
  { key: "ia",         label: "Criadas por IA", icon: "cpu",         color: "#cbf157" },
  { key: "aguardando", label: "Aguardando",  icon: "clock",          color: "#94a3b8" },
  { key: "concluidas", label: "Concluídas",  icon: "check-circle",   color: "#6ee7b7" },
];

const PRIORITIES = [
  { key: "urgente",             label: "Urgente" },
  { key: "importante",          label: "Importante" },
  { key: "aguardando_terceiro", label: "Aguardando" },
  { key: "baixa",               label: "Baixa" },
];

// ─── Filter logic ─────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split("T")[0]!; }

function filterByView(tasks: Task[], view: ViewKey): Task[] {
  const t = today();
  switch (view) {
    case "hoje":       return tasks.filter((x) => x.dueDate === t && x.status !== "concluida");
    case "atrasadas":  return tasks.filter((x) => x.dueDate && x.dueDate < t && x.status !== "concluida");
    case "alta":       return tasks.filter((x) => (x.priority === "urgente" || x.priority === "importante") && x.status !== "concluida");
    case "por_projeto":return tasks.filter((x) => x.status !== "concluida");
    case "ia":         return tasks.filter((x) => x.source === "ia" && x.status !== "concluida");
    case "aguardando": return tasks.filter((x) => x.priority === "aguardando_terceiro" && x.status !== "concluida");
    case "concluidas": return tasks.filter((x) => x.status === "concluida");
    default:           return tasks.filter((x) => x.status !== "concluida");
  }
}

function groupByProject(tasks: Task[]): { title: string; data: Task[] }[] {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.projectName ?? "Sem projeto";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

// ─── Empty state messages ─────────────────────────────────────────────────────

const EMPTY: Record<ViewKey, { icon: string; title: string; sub: string }> = {
  todas:       { icon: "check-square", title: "Nenhuma tarefa pendente", sub: "Toque em + para criar ou confirme itens na Inbox" },
  hoje:        { icon: "sun", title: "Nada para hoje", sub: "Adicione uma data de vencimento às suas tarefas" },
  atrasadas:   { icon: "alert-triangle", title: "Nenhuma atrasada", sub: "Ótimo! Tudo em dia." },
  alta:        { icon: "zap", title: "Nenhuma de alta prioridade", sub: "Use prioridade Urgente ou Importante ao criar tarefas" },
  por_projeto: { icon: "folder", title: "Nenhuma tarefa", sub: "Crie tarefas e vincule a projetos" },
  ia:          { icon: "cpu", title: "Nenhuma tarefa criada por IA", sub: "Confirme itens da Inbox com 'Criar tarefas' ativado" },
  aguardando:  { icon: "clock", title: "Nenhuma tarefa aguardando", sub: "Use a prioridade 'Aguardando' quando depender de terceiros" },
  concluidas:  { icon: "check-circle", title: "Nenhuma concluída ainda", sub: "Toque no checkbox para concluir uma tarefa" },
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function TarefasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewKey>("todas");
  const [refreshing, setRefreshing] = useState(false);

  // Create task modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("importante");
  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [newDueDate, setNewDueDate] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: rawTasks, isLoading, refetch } = useListTasks({});
  const { data: projects } = useListProjects({});
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  const allTasks = (rawTasks ?? []) as Task[];
  const tasks = useMemo(() => filterByView(allTasks, view), [allTasks, view]);
  const sections = useMemo(() => view === "por_projeto" ? groupByProject(tasks) : [], [tasks, view]);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() });

  const handleToggle = async (task: Task) => {
    await updateTask.mutateAsync({
      id: task.id,
      data: { status: task.status === "concluida" ? "pendente" : "concluida" },
    }).catch((err) => {
      Alert.alert("Erro", err?.message ?? "Não foi possível atualizar");
      throw err;
    });
    await invalidate();
  };

  const handleDelete = async (id: number) => {
    await deleteTask.mutateAsync({ id });
    await invalidate();
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await createTask.mutateAsync({
      data: {
        title: newTitle.trim(),
        priority: newPriority,
        projectId: newProjectId ?? undefined,
        dueDate: newDueDate.trim() || undefined,
        status: "pendente",
        source: "manual",
      } as any,
    });
    await invalidate();
    setNewTitle("");
    setNewPriority("importante");
    setNewProjectId(null);
    setNewDueDate("");
    setShowCreate(false);
  };

  const viewCounts = useMemo(() =>
    Object.fromEntries(VIEWS.map((v) => [v.key, filterByView(allTasks, v.key).length])),
    [allTasks]
  );

  const renderTask = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      onToggle={() => handleToggle(task)}
      onDelete={() => handleDelete(task.id)}
    />
  );

  const emptyState = EMPTY[view];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heading, { color: colors.onSurface }]}>Tarefas</Text>
            <Text style={[styles.sub, { color: colors.muted }]}>
              {allTasks.filter((t) => t.status !== "concluida").length} pendentes · {allTasks.filter((t) => t.status === "concluida").length} concluídas
            </Text>
          </View>
        </View>

        {/* View tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {VIEWS.map((v) => {
            const active = view === v.key;
            const color = v.color ?? colors.lime;
            const count = viewCounts[v.key] ?? 0;
            return (
              <TouchableOpacity
                key={v.key}
                onPress={() => setView(v.key)}
                activeOpacity={0.75}
                style={[styles.tab, {
                  backgroundColor: active ? color + "20" : colors.surfaceContainer,
                  borderColor: active ? color : colors.border,
                }]}
              >
                <Feather name={v.icon as any} size={13} color={active ? color : colors.muted} />
                <Text style={[styles.tabLabel, { color: active ? color : colors.muted }]}>{v.label}</Text>
                {count > 0 && (
                  <View style={[styles.badge, { backgroundColor: active ? color : colors.surfaceContainerHigh }]}>
                    <Text style={[styles.badgeText, { color: active ? (v.key === "hoje" ? "#000" : colors.onSurface) : colors.muted }]}>
                      {count > 99 ? "99+" : count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      ) : view === "por_projeto" ? (
        <SectionList
          sections={sections}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={colors.lime} />}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.surfaceContainer }]}>
              <Feather name="folder" size={13} color={colors.lime} />
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{section.title}</Text>
              <Text style={[styles.sectionCount, { color: colors.muted }]}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => renderTask(item)}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={emptyState.icon as any} size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{emptyState.title}</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>{emptyState.sub}</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={colors.lime} />}
          renderItem={({ item }) => renderTask(item)}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={emptyState.icon as any} size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{emptyState.title}</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>{emptyState.sub}</Text>
            </View>
          }
        />
      )}

      {/* FAB — create task */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.lime, bottom: botPad + 20 }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color={colors.onLime} />
      </TouchableOpacity>

      {/* Create task modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            style={[styles.modal, { backgroundColor: colors.surface }]}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Nova Tarefa</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Feather name="x" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {/* Title */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>TÍTULO *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.onSurface }]}
                  placeholder="Descreva a tarefa..."
                  placeholderTextColor={colors.muted}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  autoFocus
                  multiline
                />
              </View>

              {/* Priority */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>PRIORIDADE</Text>
                <View style={styles.chipRow}>
                  {PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => setNewPriority(p.key)}
                      style={[styles.priorityChip, {
                        backgroundColor: newPriority === p.key ? colors.lime + "20" : colors.surfaceContainer,
                        borderColor: newPriority === p.key ? colors.lime : colors.border,
                      }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, { color: newPriority === p.key ? colors.lime : colors.muted }]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Project */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>PROJETO</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <TouchableOpacity
                    onPress={() => setNewProjectId(null)}
                    style={[styles.priorityChip, {
                      backgroundColor: !newProjectId ? colors.lime + "20" : colors.surfaceContainer,
                      borderColor: !newProjectId ? colors.lime : colors.border,
                    }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, { color: !newProjectId ? colors.lime : colors.muted }]}>Nenhum</Text>
                  </TouchableOpacity>
                  {(projects ?? []).map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setNewProjectId(p.id)}
                      style={[styles.priorityChip, {
                        backgroundColor: newProjectId === p.id ? colors.lime + "20" : colors.surfaceContainer,
                        borderColor: newProjectId === p.id ? colors.lime : colors.border,
                      }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, { color: newProjectId === p.id ? colors.lime : colors.muted }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Due date */}
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>VENCIMENTO</Text>
                <View style={styles.dateRow}>
                  {["Hoje", "Amanhã", "+7 dias"].map((d) => {
                    const offset = d === "Hoje" ? 0 : d === "Amanhã" ? 1 : 7;
                    const dt = new Date();
                    dt.setDate(dt.getDate() + offset);
                    const iso = dt.toISOString().split("T")[0]!;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setNewDueDate(iso)}
                        style={[styles.dateChip, {
                          backgroundColor: newDueDate === iso ? colors.lime + "20" : colors.surfaceContainer,
                          borderColor: newDueDate === iso ? colors.lime : colors.border,
                        }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, { color: newDueDate === iso ? colors.lime : colors.muted }]}>{d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TextInput
                    style={[styles.dateInput, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.onSurface }]}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={colors.muted}
                    value={newDueDate}
                    onChangeText={setNewDueDate}
                  />
                </View>
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.lime, opacity: createTask.isPending ? 0.7 : 1 }]}
                onPress={handleCreate}
                disabled={createTask.isPending || !newTitle.trim()}
                activeOpacity={0.85}
              >
                {createTask.isPending
                  ? <ActivityIndicator color={colors.onLime} />
                  : <Text style={[styles.saveBtnText, { color: colors.onLime }]}>Criar tarefa</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: 20, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  heading: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.3 },
  sub: { fontSize: 12, marginTop: 1 },

  tabs: { gap: 8, paddingBottom: 12, paddingRight: 4 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  tabLabel: { fontSize: 12, fontWeight: "600" as const },
  badge: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: "center" },
  badgeText: { fontSize: 10, fontWeight: "700" as const },

  list: { paddingHorizontal: 16, paddingTop: 8 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, marginBottom: 6, marginTop: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700" as const, flex: 1 },
  sectionCount: { fontSize: 12 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  fab: {
    position: "absolute", right: 20,
    width: 54, height: 54, borderRadius: 27,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },

  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: "700" as const },
  form: { padding: 20, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 52 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priorityChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: "500" as const },
  dateRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  dateChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  dateInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, flex: 1, minWidth: 120 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const },
});
