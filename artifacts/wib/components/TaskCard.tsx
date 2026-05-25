import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  onToggle?: () => Promise<void> | void;
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const colors = useColors();
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const isDone = optimisticDone !== null ? optimisticDone : task.status === "concluida";

  const handleToggle = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isDone;
    setOptimisticDone(next);
    setLoading(true);
    try {
      await onToggle?.();
    } catch {
      // Revert on error
      setOptimisticDone(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={handleToggle}
          disabled={loading}
          style={[
            styles.checkbox,
            { borderColor: isDone ? colors.lime : colors.border, backgroundColor: isDone ? colors.lime + "20" : "transparent" },
          ]}
        >
          {loading ? (
            <ActivityIndicator size={10} color={colors.lime} />
          ) : isDone ? (
            <Feather name="check" size={12} color={colors.lime} />
          ) : null}
        </TouchableOpacity>
        <View style={styles.content}>
          <Text
            style={[
              styles.title,
              { color: isDone ? colors.muted : colors.onSurface, textDecorationLine: isDone ? "line-through" : "none" },
            ]}
            numberOfLines={2}
          >
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
    width: 22,
    height: 22,
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
