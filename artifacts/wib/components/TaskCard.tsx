import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  };
  onToggle?: () => void;
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const colors = useColors();
  const isDone = task.status === "concluida";

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle?.();
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <TouchableOpacity onPress={handleToggle} style={[styles.checkbox, { borderColor: isDone ? colors.lime : colors.border }]}>
          {isDone && <Feather name="check" size={12} color={colors.lime} />}
        </TouchableOpacity>
        <View style={styles.content}>
          <Text style={[styles.title, { color: isDone ? colors.muted : colors.onSurface, textDecorationLine: isDone ? "line-through" : "none" }]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.projectName ? (
            <Text style={[styles.project, { color: colors.lime }]}>{task.projectName}</Text>
          ) : null}
          {task.dueDate ? (
            <Text style={[styles.due, { color: colors.muted }]}>{task.dueDate}</Text>
          ) : null}
        </View>
        <PriorityBadge priority={task.priority} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  content: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: "500" as const, lineHeight: 20 },
  project: { fontSize: 12, fontWeight: "600" as const },
  due: { fontSize: 12 },
});
