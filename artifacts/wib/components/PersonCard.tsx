import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "./GlassCard";
import { Feather } from "@expo/vector-icons";

const ROLE_LABELS: Record<string, string> = {
  cliente: "Cliente", tecnico: "Técnico", parceiro: "Parceiro",
  prefeitura: "Prefeitura", cartorio: "Cartório", orgao_publico: "Órgão Público", fornecedor: "Fornecedor",
};

const ROLE_COLORS: Record<string, string> = {
  cliente: "#cbf157", tecnico: "#d9b9ff", parceiro: "#86efac",
  prefeitura: "#fbbf24", cartorio: "#f9a8d4", orgao_publico: "#fbbf24", fornecedor: "#94a3b8",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface PersonCardProps {
  person: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    organization?: string | null;
  };
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PersonCard({ person, onEdit, onDelete }: PersonCardProps) {
  const colors = useColors();
  const roleColor = ROLE_COLORS[person.role] ?? colors.muted;

  const handleDelete = () => {
    Alert.alert(
      "Excluir pessoa",
      `Deseja excluir "${person.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: onDelete },
      ]
    );
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: roleColor + "20" }]}>
          <Text style={[styles.initials, { color: roleColor }]}>{getInitials(person.name)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.onSurface }]}>{person.name}</Text>
          {person.organization ? <Text style={[styles.org, { color: colors.muted }]}>{person.organization}</Text> : null}
          {person.email ? <Text style={[styles.contact, { color: colors.onSurfaceVariant }]}>{person.email}</Text> : null}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleColor + "20", borderColor: roleColor + "40" }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{ROLE_LABELS[person.role] ?? person.role}</Text>
        </View>
        <View style={styles.actions}>
          {onEdit ? (
            <TouchableOpacity onPress={onEdit} style={[styles.actionBtn, { backgroundColor: colors.surfaceContainer }]}>
              <Feather name="edit-2" size={14} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity onPress={handleDelete} style={[styles.actionBtn, { backgroundColor: colors.surfaceContainer }]}>
              <Feather name="trash-2" size={14} color={colors.error} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  initials: { fontSize: 16, fontWeight: "700" as const },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600" as const },
  org: { fontSize: 13 },
  contact: { fontSize: 12 },
  roleBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  roleText: { fontSize: 11, fontWeight: "600" as const },
  actions: { flexDirection: "column", gap: 6 },
  actionBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
