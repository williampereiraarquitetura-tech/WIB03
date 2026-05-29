import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "./GlassCard";
import { PriorityBadge } from "./PriorityBadge";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description?: string | null;
    priority: string;
    status: string;
    projectName?: string | null;
    dueDate?: string | null;
    source?: string | null;
  };
  onToggle?: () => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onEdit?: () => void;
}

function dueDateLabel(dueDate: string): { text: string; overdue: boolean; today: boolean } {
  const today = new Date().toISOString().split("T")[0]!;
  if (dueDate === today) return { text: "Hoje", overdue: false, today: true };
  if (dueDate < today) {
    const days = Math.round((Date.now() - new Date(dueDate).getTime()) / 86400000);
    return { text: `${days}d atraso`, overdue: true, today: false };
  }
  const d = new Date(dueDate);
  return { text: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), overdue: false, today: false };
}

export function TaskCard({ task, onToggle, onDelete, onEdit }: TaskCardProps) {
  const colors = useColors();
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDone = optimisticDone !== null ? optimisticDone : task.status === "concluida";
  const isAI = task.source === "ia";
  const due = task.dueDate ? dueDateLabel(task.dueDate) : null;

  const handleToggle = async () => {
    if (toggling) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOptimisticDone(!isDone);
    setToggling(true);
    try { await onToggle?.(); }
    catch { setOptimisticDone(isDone); }
    finally { setToggling(false); }
  };

  const handleDelete = () => {
    Alert.alert("Excluir tarefa", `Deseja excluir "${task.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive", onPress: async () => {
          setDeleting(true);
          try { await onDelete?.(); }
          finally { setDeleting(false); }
        },
      },
    ]);
  };

  return (
    <GlassCard style={[styles.card, due?.overdue && { borderLeftWidth: 3, borderLeftColor: colors.error }]}>
      <View style={styles.row}>
        {/* Checkbox */}
        <TouchableOpacity
          onPress={handleToggle}
          disabled={toggling}
          style={[
            styles.checkbox,
            { borderColor: isDone ? colors.lime : colors.border, backgroundColor: isDone ? colors.lime + "20" : "transparent" },
          ]}
        >
          {toggling
            ? <ActivityIndicator size={10} color={colors.lime} />
            : isDone ? <Feather name="check" size={12} color={colors.lime} /> : null}
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: isDone ? colors.muted : colors.onSurface, textDecorationLine: isDone ? "line-through" : "none" },
              ]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            {isAI && (
              <View style={[styles.aiBadge, { backgroundColor: colors.lime + "20" }]}>
                <Feather name="cpu" size={9} color={colors.lime} />
                <Text style={[styles.aiBadgeText, { color: colors.lime }]}>IA</Text>
              </View>
            )}
          </View>

          {task.description && (
            <Text style={[styles.description, { color: colors.muted }]} numberOfLines={1}>
              {task.description}
            </Text>
          )}

          <View style={styles.meta}>
            {task.projectName && (
              <Text style={[styles.project, { color: colors.lime }]} numberOfLines={1}>
                <Feather name="folder" size={10} /> {task.projectName}
              </Text>
            )}
            {due && (
              <Text style={[
                styles.due,
                { color: due.overdue ? colors.error : due.today ? colors.lime : colors.muted },
              ]}>
                <Feather name="calendar" size={10} /> {due.text}
              </Text>
            )}
          </View>
        </View>

        {/* Right side */}
        <View style={styles.right}>
          <PriorityBadge priority={task.priority} />
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Feather name="edit-2" size={13} color={colors.muted} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={handleDelete} disabled={deleting} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                {deleting
                  ? <ActivityIndicator size={13} color={colors.error} />
                  : <Feather name="trash-2" size={13} color={colors.error} />
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 13, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", marginTop: 2, flexShrink: 0,
  },
  content: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  title: { fontSize: 14, fontWeight: "500" as const, lineHeight: 20, flex: 1 },
  aiBadge: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 0, marginTop: 2 },
  aiBadgeText: { fontSize: 9, fontWeight: "700" as const },
  description: { fontSize: 12, lineHeight: 16 },
  meta: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  project: { fontSize: 11, fontWeight: "600" as const },
  due: { fontSize: 11 },
  right: { alignItems: "flex-end", gap: 8, flexShrink: 0 },
  actions: { flexDirection: "row", gap: 10 },
});
