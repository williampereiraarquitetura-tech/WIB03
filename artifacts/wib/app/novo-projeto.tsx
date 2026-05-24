import React, { useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCreateProject } from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { KeyboardAwareScrollViewCompat } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

const PROJECT_TYPES = ["viabilidade", "aprovacao_municipal", "aprovacao_estadual", "graprohab", "projeto_urbanistico", "incorporacao", "regularizacao", "loteamento", "desmembramento", "consulta_previa"];
const TYPE_LABELS: Record<string, string> = {
  viabilidade: "Viabilidade", aprovacao_municipal: "Aprovação Municipal", aprovacao_estadual: "Aprovação Estadual",
  graprohab: "GRAPROHAB", projeto_urbanistico: "Projeto Urbanístico", incorporacao: "Incorporação",
  regularizacao: "Regularização", loteamento: "Loteamento", desmembramento: "Desmembramento", consulta_previa: "Consulta Prévia",
};
const PRIORITIES = ["urgente", "importante", "baixa"];
const PRIORITY_LABELS: Record<string, string> = { urgente: "Urgente", importante: "Importante", baixa: "Baixa" };

export default function NovoProjetoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const create = useCreateProject();
  const [form, setForm] = useState({ name: "", clientName: "", type: "aprovacao_municipal", priority: "importante", description: "" });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await create.mutateAsync({ data: { name: form.name, clientName: form.clientName || undefined, type: form.type, priority: form.priority, description: form.description || undefined } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  return (
    <KeyboardAwareScrollViewCompat style={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled" bottomOffset={20}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Novo Projeto</Text>
      </View>

      <View style={[styles.form, { paddingBottom: botPad + 40 }]}>
        {[
          { key: "name", label: "Nome do projeto *", placeholder: "Ex: Loteamento Vale Verde" },
          { key: "clientName", label: "Cliente", placeholder: "Nome do cliente ou empresa" },
          { key: "description", label: "Descrição", placeholder: "Detalhes adicionais..." },
        ].map(({ key, label, placeholder }) => (
          <View key={key} style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.onSurface }]}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              value={(form as any)[key]}
              onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
              multiline={key === "description"}
              numberOfLines={key === "description" ? 3 : 1}
            />
          </View>
        ))}

        <Text style={[styles.label, { color: colors.muted }]}>Tipo *</Text>
        <View style={styles.grid}>
          {PROJECT_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setForm((f) => ({ ...f, type: t }))}
              style={[styles.gridBtn, { backgroundColor: form.type === t ? colors.lime + "20" : colors.surfaceContainer, borderColor: form.type === t ? colors.lime : colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.gridText, { color: form.type === t ? colors.lime : colors.muted }]}>{TYPE_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>Prioridade</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setForm((f) => ({ ...f, priority: p }))}
              style={[styles.priorityBtn, { backgroundColor: form.priority === p ? colors.lime + "20" : colors.surfaceContainer, borderColor: form.priority === p ? colors.lime : colors.border, flex: 1 }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.gridText, { color: form.priority === p ? colors.lime : colors.muted }]}>{PRIORITY_LABELS[p]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.lime, opacity: create.isPending ? 0.6 : 1 }]}
          onPress={handleCreate}
          disabled={create.isPending}
          activeOpacity={0.85}
        >
          {create.isPending ? <ActivityIndicator color={colors.onLime} /> : <Text style={[styles.saveBtnText, { color: colors.onLime }]}>Criar Projeto</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 20 },
  backBtn: { padding: 4 },
  heading: { fontSize: 24, fontWeight: "700" as const },
  form: { paddingHorizontal: 20, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  gridText: { fontSize: 13, fontWeight: "500" as const },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const },
});
