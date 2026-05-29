import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { API_URL } from "@/config/api";
import { supabase } from "@/config/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

type MemoryType = "audio" | "documento" | "factual" | "tarefa" | "projeto" | "conversa";

interface Memory {
  id: number;
  memoryType: MemoryType;
  source: string;
  text: string;
  important: boolean;
  metadata: { originalName?: string; chunkIndex?: number; totalChunks?: number } | null;
  createdAt: string;
}

const TYPE_LABELS: Record<MemoryType, string> = {
  audio: "Áudio", documento: "Documento", factual: "Fato",
  tarefa: "Tarefa", projeto: "Projeto", conversa: "Conversa",
};

const TYPE_ICONS: Record<MemoryType, string> = {
  audio: "mic", documento: "file-text", factual: "info",
  tarefa: "check-square", projeto: "folder", conversa: "message-circle",
};

const TYPE_COLORS: Record<MemoryType, string> = {
  audio: "#cbf157", documento: "#d9b9ff", factual: "#86efac",
  tarefa: "#fbbf24", projeto: "#f9a8d4", conversa: "#94a3b8",
};

const FILTERS: Array<{ key: MemoryType | "todas"; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "audio", label: "Áudio" },
  { key: "documento", label: "Doc" },
  { key: "factual", label: "Fato" },
  { key: "tarefa", label: "Tarefa" },
  { key: "projeto", label: "Projeto" },
  { key: "conversa", label: "Conversa" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = await getToken();
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts?.headers,
    },
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

// ─── Memory card ─────────────────────────────────────────────────────────────

function MemoryCard({
  item, colors, onDelete, onToggleImportant, onChangeType,
}: {
  item: Memory;
  colors: ReturnType<typeof useColors>;
  onDelete: (id: number) => void;
  onToggleImportant: (id: number, current: boolean) => void;
  onChangeType: (id: number, current: MemoryType) => void;
}) {
  const typeColor = TYPE_COLORS[item.memoryType] ?? "#94a3b8";
  const icon = TYPE_ICONS[item.memoryType] ?? "circle";
  const label = TYPE_LABELS[item.memoryType] ?? item.memoryType;
  const chunkLabel = item.metadata?.totalChunks && item.metadata.totalChunks > 1
    ? ` · chunk ${(item.metadata.chunkIndex ?? 0) + 1}/${item.metadata.totalChunks}`
    : "";

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: item.important ? typeColor + "60" : colors.border }]}>
      {/* Type badge + actions */}
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: typeColor + "20" }]}>
          <Feather name={icon as any} size={11} color={typeColor} />
          <Text style={[styles.badgeText, { color: typeColor }]}>{label}</Text>
        </View>
        <Text style={[styles.cardTime, { color: colors.muted }]}>{timeAgo(item.createdAt)}{chunkLabel}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => onToggleImportant(item.id, item.important)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name={item.important ? "star" : "star"}
              size={15}
              color={item.important ? typeColor : colors.muted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onChangeType(item.id, item.memoryType)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="tag" size={15} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={15} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.cardText, { color: colors.onSurface }]} numberOfLines={4}>
        {item.text}
      </Text>

      {item.metadata?.originalName && (
        <Text style={[styles.cardMeta, { color: colors.muted }]} numberOfLines={1}>
          <Feather name="paperclip" size={10} /> {item.metadata.originalName}
        </Text>
      )}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MemoriasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MemoryType | "todas">("todas");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const load = useCallback(async (filter: MemoryType | "todas" = activeFilter) => {
    const params = filter !== "todas" ? `?type=${filter}` : "";
    const resp = await apiFetch(`/api/ai/memories${params}`);
    if (resp.ok) {
      const data = await resp.json() as { memories: Memory[]; total: number };
      setMemories(data.memories);
      setTotal(data.total);
    }
    setLoading(false);
    setRefreshing(false);
  }, [activeFilter]);

  useEffect(() => { load(); }, []);

  const handleFilterChange = (f: MemoryType | "todas") => {
    setActiveFilter(f);
    setLoading(true);
    load(f);
  };

  const handleDelete = (id: number) => {
    Alert.alert("Apagar memória", "Esta ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar", style: "destructive", onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await apiFetch(`/api/ai/memories/${id}`, { method: "DELETE" });
          setMemories((prev) => prev.filter((m) => m.id !== id));
          setTotal((t) => t - 1);
        },
      },
    ]);
  };

  const handleToggleImportant = async (id: number, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await apiFetch(`/api/ai/memories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ important: !current }),
    });
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, important: !current } : m));
  };

  const handleChangeType = (id: number, current: MemoryType) => {
    const types = (["audio", "documento", "factual", "tarefa", "projeto", "conversa"] as MemoryType[]);
    const opts = types.map((t) => ({
      text: TYPE_LABELS[t],
      onPress: async () => {
        await apiFetch(`/api/ai/memories/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ memoryType: t }),
        });
        setMemories((prev) => prev.map((m) => m.id === id ? { ...m, memoryType: t } : m));
      },
    }));
    Alert.alert("Mudar tipo", "Selecione o tipo da memória:", [
      ...opts,
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(
      "Apagar todas as memórias",
      `Isso vai apagar ${total} memória(s) permanentemente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar tudo", style: "destructive", onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await apiFetch("/api/ai/memories/all", { method: "DELETE" });
            setMemories([]);
            setTotal(0);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { color: colors.onSurface }]}>Memórias</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>{total} item{total !== 1 ? "s" : ""} armazenados</Text>
        </View>
        {total > 0 && (
          <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="trash" size={18} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={[styles.filters, { borderBottomColor: colors.border }]}
      >
        {FILTERS.map(({ key, label }) => {
          const active = activeFilter === key;
          const color = key !== "todas" ? TYPE_COLORS[key as MemoryType] : colors.lime;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => handleFilterChange(key)}
              style={[styles.filterChip, {
                backgroundColor: active ? color + "20" : colors.surfaceContainer,
                borderColor: active ? color : colors.border,
              }]}
              activeOpacity={0.75}
            >
              {key !== "todas" && (
                <Feather name={TYPE_ICONS[key as MemoryType] as any} size={11} color={active ? color : colors.muted} />
              )}
              <Text style={[styles.filterText, { color: active ? color : colors.muted }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 40 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.lime}
            />
          }
          renderItem={({ item }) => (
            <MemoryCard
              item={item}
              colors={colors}
              onDelete={handleDelete}
              onToggleImportant={handleToggleImportant}
              onChangeType={handleChangeType}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="cpu" size={40} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Sem memórias</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Envie áudios, imagens ou PDFs e a IA salvará o conteúdo automaticamente.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  heading: { fontSize: 22, fontWeight: "700" as const },
  sub: { fontSize: 12, marginTop: 1 },
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  filterText: { fontSize: 12, fontWeight: "600" as const },
  list: { padding: 16, gap: 10 },
  card: {
    borderRadius: 14, borderWidth: 1,
    padding: 14, gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" as const },
  cardTime: { fontSize: 11, flex: 1 },
  cardActions: { flexDirection: "row", gap: 12 },
  cardText: { fontSize: 13, lineHeight: 19 },
  cardMeta: { fontSize: 11 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
