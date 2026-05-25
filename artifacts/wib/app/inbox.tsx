import React from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { InboxCard } from "@/components/InboxCard";
import { useListInboxItems, useConfirmInboxItem, useDismissInboxItem, getListInboxItemsQueryKey } from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: items, isLoading, refetch } = useListInboxItems({ status: "pending" });
  const confirm = useConfirmInboxItem();
  const dismiss = useDismissInboxItem();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListInboxItemsQueryKey({ status: "pending" }) });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.heading, { color: colors.onSurface }]}>Inbox</Text>
          {items && items.length > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.lime + "20" }]}>
              <Text style={[styles.countText, { color: colors.lime }]}>{items.length} PENDENTE{items.length !== 1 ? "S" : ""}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.lime} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 40 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={colors.lime} />}
          renderItem={({ item }) => (
            <InboxCard
              item={item as any}
              onConfirm={(projectId) =>
                confirm.mutate(
                  { id: item.id, data: { createTasks: true, projectId } },
                  { onSuccess: invalidate }
                )
              }
              onDismiss={() => dismiss.mutate({ id: item.id }, { onSuccess: invalidate })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={48} color={colors.lime} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Inbox vazia</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Capture algo novo pela aba Capturar</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 14 },
  backBtn: { padding: 4 },
  heading: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
  countBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 4 },
  countText: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8 },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 22, fontWeight: "700" as const, marginTop: 8 },
  emptyText: { fontSize: 15, textAlign: "center" },
});
