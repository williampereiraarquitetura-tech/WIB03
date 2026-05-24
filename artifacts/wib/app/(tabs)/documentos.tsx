import React, { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { useListFiles } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";

const TYPE_ICONS: Record<string, string> = {
  audio: "mic",
  image: "image",
  pdf: "file-text",
  document: "paperclip",
};

const TYPE_LABELS: Record<string, string> = {
  audio: "Áudio",
  image: "Imagem",
  pdf: "PDF",
  document: "Documento",
};

function FileCard({ file }: { file: { id: number; name: string; fileType: string; size?: number | null; aiSummary?: string | null; createdAt: string } }) {
  const colors = useColors();
  const icon = TYPE_ICONS[file.fileType] ?? "file";
  const label = TYPE_LABELS[file.fileType] ?? file.fileType;

  const sizeStr = file.size
    ? file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`
    : "";

  const date = new Date(file.createdAt).toLocaleDateString("pt-BR");

  return (
    <GlassCard style={styles.fileCard}>
      <View style={styles.fileRow}>
        <View style={[styles.fileIcon, { backgroundColor: colors.surfaceContainerHigh }]}>
          <Feather name={icon as any} size={20} color={colors.lime} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: colors.onSurface }]} numberOfLines={1}>{file.name}</Text>
          <Text style={[styles.fileMeta, { color: colors.muted }]}>{label} · {sizeStr} · {date}</Text>
          {file.aiSummary ? (
            <Text style={[styles.fileSummary, { color: colors.onSurfaceVariant }]} numberOfLines={2}>{file.aiSummary}</Text>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}

const FILE_TYPES = ["todos", "audio", "image", "pdf", "document"];

export default function DocumentosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeType, setActiveType] = useState("todos");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: files, isLoading, refetch } = useListFiles(
    activeType !== "todos" ? { fileType: activeType } : {}
  );

  const filtered = (files ?? []).filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.aiSummary ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.heading, { color: colors.onSurface }]}>Documentos</Text>

        <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.onSurface }]}
            placeholder="Buscar arquivo ou conteúdo..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <FlatList
          horizontal
          data={FILE_TYPES}
          keyExtractor={(t) => t}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: t }) => (
            <TouchableOpacity
              onPress={() => setActiveType(t)}
              style={[styles.filterBtn, { backgroundColor: activeType === t ? colors.lime : colors.surfaceContainer, borderColor: activeType === t ? colors.lime : colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, { color: activeType === t ? colors.onLime : colors.onSurfaceVariant }]}>
                {t === "todos" ? "Todos" : TYPE_LABELS[t] ?? t}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(f) => String(f.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={colors.lime} />}
          renderItem={({ item }) => <FileCard file={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="archive" size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Sem documentos</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Use a aba Capturar para enviar arquivos</Text>
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
  heading: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -0.5, marginBottom: 14 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15 },
  filterRow: { gap: 8, paddingBottom: 10 },
  filterBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontWeight: "500" as const },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  fileCard: { padding: 14, marginBottom: 8 },
  fileRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  fileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  fileInfo: { flex: 1, gap: 4 },
  fileName: { fontSize: 15, fontWeight: "600" as const },
  fileMeta: { fontSize: 12 },
  fileSummary: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const, marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
