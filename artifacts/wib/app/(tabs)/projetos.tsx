import React, { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { ProjectCard } from "@/components/ProjectCard";
import { useListProjects } from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";

const STATUSES = ["todos", "em_andamento", "aguardando", "bloqueado", "aprovado", "concluido"];
const STATUS_LABELS: Record<string, string> = {
  todos: "Todos",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  bloqueado: "Bloqueado",
  aprovado: "Aprovado",
  concluido: "Concluído",
};

export default function ProjetosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeStatus, setActiveStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: projects, isLoading, refetch } = useListProjects(
    activeStatus !== "todos" ? { status: activeStatus } : {}
  );

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.clientName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: colors.onSurface }]}>Projetos</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.lime }]}
            onPress={() => router.push("/novo-projeto")}
            activeOpacity={0.8}
          >
            <Feather name="plus" size={18} color={colors.onLime} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Buscar projeto ou cliente..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          horizontal
          data={STATUSES}
          keyExtractor={(s) => s}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => setActiveStatus(s)}
              style={[
                styles.filterBtn,
                {
                  backgroundColor: activeStatus === s ? colors.lime : colors.surfaceContainer,
                  borderColor: activeStatus === s ? colors.lime : colors.border,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, { color: activeStatus === s ? colors.onLime : colors.onSurfaceVariant }]}>
                {STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* List */}
      {isLoading ? (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={colors.lime} />}
          renderItem={({ item }) => (
            <ProjectCard project={item} onPress={() => router.push(`/projeto/${item.id}`)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="folder" size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Nenhum projeto</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Toque em + para criar seu primeiro projeto</Text>
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  heading: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15 },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: "500" as const },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
