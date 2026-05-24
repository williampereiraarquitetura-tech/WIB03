import React, { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { PersonCard } from "@/components/PersonCard";
import { useListPeople, useCreatePerson } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { Modal } from "react-native";
import { KeyboardAwareScrollViewCompat } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

const ROLES = ["cliente", "tecnico", "parceiro", "prefeitura", "cartorio", "orgao_publico", "fornecedor"];
const ROLE_LABELS: Record<string, string> = {
  cliente: "Cliente", tecnico: "Técnico", parceiro: "Parceiro",
  prefeitura: "Prefeitura", cartorio: "Cartório", orgao_publico: "Órgão Público", fornecedor: "Fornecedor",
};

export default function PessoasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "cliente", organization: "" });

  const { data: people, isLoading, refetch } = useListPeople({ search: search || undefined });
  const createPerson = useCreatePerson();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createPerson.mutateAsync({ data: { name: form.name, email: form.email || undefined, phone: form.phone || undefined, role: form.role, organization: form.organization || undefined } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    refetch();
    setShowAdd(false);
    setForm({ name: "", email: "", phone: "", role: "cliente", organization: "" });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: colors.onSurface }]}>Pessoas</Text>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.lime }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
            <Feather name="user-plus" size={18} color={colors.onLime} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput style={[styles.searchInput, { color: colors.onSurface }]} placeholder="Buscar pessoa..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} />
        </View>
      </View>

      {isLoading ? <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={people ?? []}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={colors.lime} />}
          renderItem={({ item }) => <PersonCard person={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Sem contatos</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Adicione clientes, técnicos e contatos</Text>
            </View>
          }
        />
      )}

      {/* Add Person Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAwareScrollViewCompat style={[styles.modal, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled" bottomOffset={20}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Nova Pessoa</Text>
            <TouchableOpacity onPress={() => setShowAdd(false)}><Feather name="x" size={22} color={colors.muted} /></TouchableOpacity>
          </View>
          <View style={styles.form}>
            {[
              { key: "name", label: "Nome *", placeholder: "Nome completo" },
              { key: "organization", label: "Organização", placeholder: "Empresa, órgão..." },
              { key: "email", label: "E-mail", placeholder: "email@exemplo.com" },
              { key: "phone", label: "Telefone", placeholder: "(11) 99999-9999" },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.onSurface }]}
                  placeholder={placeholder}
                  placeholderTextColor={colors.muted}
                  value={(form as any)[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                />
              </View>
            ))}

            <Text style={[styles.label, { color: colors.muted }]}>Tipo *</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setForm((f) => ({ ...f, role: r }))}
                  style={[styles.roleBtn, { backgroundColor: form.role === r ? colors.lime + "20" : colors.surfaceContainer, borderColor: form.role === r ? colors.lime : colors.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleText, { color: form.role === r ? colors.lime : colors.muted }]}>{ROLE_LABELS[r]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.lime, opacity: createPerson.isPending ? 0.6 : 1 }]}
              onPress={handleCreate}
              disabled={createPerson.isPending}
              activeOpacity={0.85}
            >
              {createPerson.isPending ? <ActivityIndicator color={colors.onLime} /> : <Text style={[styles.saveBtnText, { color: colors.onLime }]}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollViewCompat>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  heading: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: "700" as const },
  form: { padding: 20, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  roleText: { fontSize: 13, fontWeight: "500" as const },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const },
});
