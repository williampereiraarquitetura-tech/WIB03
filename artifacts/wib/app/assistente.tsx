import React, { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "O que está travando meus projetos?",
  "Quais tarefas são urgentes hoje?",
  "Resuma o status dos projetos",
  "Quais projetos estão bloqueados?",
];

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function AssistenteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const resp = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await resp.json() as { message: string; suggestedActions?: string[] };
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: data.message };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Não foi possível conectar ao WIB. Verifique a conexão." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: colors.lime }]} />
          <Text style={[styles.heading, { color: colors.onSurface }]}>WIB</Text>
        </View>
        <Text style={[styles.sub, { color: colors.muted }]}>Assistente de projetos</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={[styles.msgList, { paddingTop: 16 }]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={loading ? (
          <View style={[styles.bubble, styles.botBubble, { backgroundColor: colors.surfaceContainer }]}>
            <ActivityIndicator size="small" color={colors.lime} />
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.role === "user" ? [styles.userBubble, { backgroundColor: colors.lime }] : [styles.botBubble, { backgroundColor: colors.surfaceContainer }],
          ]}>
            <Text style={[styles.msgText, { color: item.role === "user" ? colors.onLime : colors.onSurface }]}>
              {item.content}
            </Text>
          </View>
        )}
        ListFooterComponent={messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={[styles.wibIcon, { backgroundColor: colors.lime + "20" }]}>
              <Feather name="zap" size={28} color={colors.lime} />
            </View>
            <Text style={[styles.welcomeTitle, { color: colors.onSurface }]}>Olá, sou o WIB</Text>
            <Text style={[styles.welcomeText, { color: colors.muted }]}>Pergunte sobre seus projetos, tarefas, pendências ou qualquer coisa sobre seu trabalho.</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} onPress={() => send(s)} style={[styles.suggestion, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
                  <Text style={[styles.suggestionText, { color: colors.onSurfaceVariant }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      />

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: botPad + 12 }]}>
        <View style={[styles.inputRow, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Pergunte ao WIB..."
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.lime : colors.surfaceContainerHigh }]}
            activeOpacity={0.8}
          >
            <Feather name="send" size={16} color={input.trim() ? colors.onLime : colors.muted} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 4, marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  heading: { fontSize: 26, fontWeight: "700" as const },
  sub: { fontSize: 13, marginTop: 2 },
  msgList: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1, justifyContent: "flex-end" },
  bubble: { borderRadius: 18, padding: 14, marginBottom: 10, maxWidth: "85%" },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  botBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  msgText: { fontSize: 15, lineHeight: 22 },
  welcome: { alignItems: "center", paddingVertical: 32, gap: 12 },
  wibIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontSize: 22, fontWeight: "700" as const },
  welcomeText: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  suggestions: { gap: 8, width: "100%" },
  suggestion: { borderWidth: 1, borderRadius: 12, padding: 12 },
  suggestionText: { fontSize: 14 },
  inputBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", borderRadius: 20, borderWidth: 1, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 15, lineHeight: 22, maxHeight: 100, paddingVertical: 6 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginLeft: 8 },
});
