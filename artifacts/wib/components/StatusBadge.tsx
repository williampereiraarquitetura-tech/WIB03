import React from "react";
import { StyleSheet, Text, View } from "react-native";

const STATUS_LABELS: Record<string, string> = {
  em_andamento: "EM ANDAMENTO",
  aguardando: "AGUARDANDO",
  aprovado: "APROVADO",
  bloqueado: "BLOQUEADO",
  concluido: "CONCLUÍDO",
  pendente: "PENDENTE",
  em_curso: "EM CURSO",
};

const STATUS_COLORS: Record<string, string> = {
  em_andamento: "#cbf157",
  aguardando: "#d9b9ff",
  aprovado: "#86efac",
  bloqueado: "#ffb4ab",
  concluido: "#86efac",
  pendente: "#8f937d",
  em_curso: "#cbf157",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? "#8f937d";
  const label = STATUS_LABELS[status] ?? status.toUpperCase();

  return (
    <View style={[styles.badge, { backgroundColor: color + "20", borderColor: color + "50" }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
  },
});
