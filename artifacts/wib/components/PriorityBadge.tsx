import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const PRIORITY_LABELS: Record<string, string> = {
  urgente: "URGENTE",
  importante: "IMPORTANTE",
  aguardando_terceiro: "AGUARDANDO",
  bloqueada: "BLOQUEADA",
  baixa: "BAIXA",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgente: "#ffb4ab",
  importante: "#cbf157",
  aguardando_terceiro: "#d9b9ff",
  bloqueada: "#ffb4ab",
  baixa: "#8f937d",
};

interface PriorityBadgeProps {
  priority: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const colors = useColors();
  const color = PRIORITY_COLORS[priority] ?? colors.muted;
  const label = PRIORITY_LABELS[priority] ?? priority.toUpperCase();

  return (
    <View style={[styles.badge, { borderColor: color + "40", backgroundColor: color + "15" }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.8,
  },
});
