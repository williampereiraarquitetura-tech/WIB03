import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { API_URL } from "@/config/api";
import { supabase } from "@/config/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedActions?: string[];
  saved?: boolean;
  ts: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ─── Typing indicator ────────────────────────────────────────────────────────

function TypingIndicator({ color }: { color: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % 3), 450);
    return () => clearInterval(t);
  }, []);
  const dots = ["●○○", "○●○", "○○●"][frame];
  return <Text style={{ color, fontSize: 14, letterSpacing: 4 }}>{dots}</Text>;
}

// ─── Message text renderer — handles **bold** and newlines ───────────────────

function MessageText({ text, color }: { text: string; color: string }) {
  const parts: { text: string; bold: boolean }[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), bold: false });
    parts.push({ text: match[1]!, bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });

  return (
    <Text style={{ fontSize: 15, lineHeight: 22, color }}>
      {parts.map((p, i) => (
        <Text key={i} style={p.bold ? { fontWeight: "700" as const } : undefined}>{p.text}</Text>
      ))}
    </Text>
  );
}

// ─── Bubble ──────────────────────────────────────────────────────────────────

function MessageBubble({
  item, colors, onSave, onSuggestion,
}: {
  item: ChatMessage;
  colors: ReturnType<typeof useColors>;
  onSave: (msg: ChatMessage) => void;
  onSuggestion: (text: string) => void;
}) {
  const isUser = item.role === "user";

  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.wrapperRight : styles.wrapperLeft]}>
      {/* Avatar dot for assistant */}
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.lime + "25" }]}>
          <Feather name="zap" size={11} color={colors.lime} />
        </View>
      )}

      <View style={{ maxWidth: "80%", gap: 4 }}>
        <View style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.lime }]
            : [styles.botBubble, { backgroundColor: colors.surfaceContainer }],
        ]}>
          <MessageText
            text={item.content}
            color={isUser ? colors.onLime : colors.onSurface}
          />
        </View>

        {/* Meta row: time + save button */}
        <View style={[styles.metaRow, isUser ? styles.metaRight : styles.metaLeft]}>
          <Text style={[styles.ts, { color: colors.muted }]}>{fmtTime(item.ts)}</Text>
          {!isUser && (
            <TouchableOpacity
              onPress={() => onSave(item)}
              style={styles.saveBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={item.saved ? "bookmark" : "bookmark"}
                size={12}
                color={item.saved ? colors.lime : colors.muted}
              />
              {item.saved && (
                <Text style={[styles.savedLabel, { color: colors.lime }]}>salvo</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Suggested actions chips */}
        {!isUser && item.suggestedActions && item.suggestedActions.length > 0 && (
          <View style={styles.chips}>
            {item.suggestedActions.map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => onSuggestion(a)}
                style={[styles.chip, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.border }]}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, { color: colors.onSurfaceVariant }]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "O que está travando meus projetos?",
  "Quais tarefas são urgentes hoje?",
  "Resuma o status dos projetos",
  "O que capturei recentemente?",
];

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

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: msg, ts: new Date() };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const token = await getToken();
      const history = next.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msg, history }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json() as { message: string; suggestedActions?: string[] };
      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.message,
        suggestedActions: data.suggestedActions?.filter(Boolean),
        ts: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`, role: "assistant", ts: new Date(),
        content: "Não foi possível conectar ao WIB. Verifique sua conexão.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const saveMemory = async (msg: ChatMessage) => {
    if (msg.saved) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/ai/memory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: msg.content }),
      });
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, saved: true } : m));
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a memória.");
    }
  };

  const clearChat = () => {
    Alert.alert("Limpar conversa", "Deseja apagar todas as mensagens desta sessão?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: () => setMessages([]) },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <View style={[styles.onlineDot, { backgroundColor: colors.lime }]} />
            <Text style={[styles.heading, { color: colors.onSurface }]}>WIB</Text>
          </View>
          <Text style={[styles.sub, { color: colors.muted }]}>Assistente com memória vetorial</Text>
        </View>

        <TouchableOpacity onPress={() => router.push("/memorias")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="cpu" size={18} color={colors.muted} />
        </TouchableOpacity>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="trash-2" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
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
          <View style={[styles.bubbleWrapper, styles.wrapperLeft, { marginBottom: 10 }]}>
            <View style={[styles.avatar, { backgroundColor: colors.lime + "25" }]}>
              <Feather name="zap" size={11} color={colors.lime} />
            </View>
            <View style={[styles.bubble, styles.botBubble, { backgroundColor: colors.surfaceContainer, paddingVertical: 16, paddingHorizontal: 18 }]}>
              <TypingIndicator color={colors.lime} />
            </View>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <MessageBubble
            item={item}
            colors={colors}
            onSave={saveMemory}
            onSuggestion={(t) => send(t)}
          />
        )}
        ListFooterComponent={messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={[styles.wibIcon, { backgroundColor: colors.lime + "20" }]}>
              <Feather name="zap" size={30} color={colors.lime} />
            </View>
            <Text style={[styles.welcomeTitle, { color: colors.onSurface }]}>Olá, sou o WIB</Text>
            <Text style={[styles.welcomeText, { color: colors.muted }]}>
              Pergunte sobre seus projetos, tarefas ou qualquer coisa capturada. Busco na sua memória antes de responder.
            </Text>
            <View style={styles.suggestionGrid}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => send(s)}
                  style={[styles.suggestionBtn, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}
                  activeOpacity={0.75}
                >
                  <Feather name="message-circle" size={13} color={colors.muted} style={{ marginRight: 6 }} />
                  <Text style={[styles.suggestionText, { color: colors.onSurfaceVariant }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: botPad + 10 }]}>
        <View style={[styles.inputRow, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.onSurface }]}
            placeholder="Pergunte ao WIB..."
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={600}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() && !loading ? colors.lime : colors.surfaceContainerHigh },
            ]}
          >
            {loading
              ? <ActivityIndicator size="small" color={colors.muted} />
              : <Feather name="send" size={16} color={input.trim() ? colors.onLime : colors.muted} />
            }
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Toque em <Feather name="bookmark" size={10} color={colors.muted} /> para salvar uma resposta na memória
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  heading: { fontSize: 20, fontWeight: "700" as const },
  sub: { fontSize: 11, marginTop: 1 },

  msgList: { paddingHorizontal: 16, paddingBottom: 12, flexGrow: 1, justifyContent: "flex-end" },

  bubbleWrapper: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12 },
  wrapperLeft: { alignSelf: "flex-start" },
  wrapperRight: { alignSelf: "flex-end", flexDirection: "row-reverse" },

  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  userBubble: { borderBottomRightRadius: 5 },
  botBubble: { borderBottomLeftRadius: 5 },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaLeft: { justifyContent: "flex-start", paddingLeft: 2 },
  metaRight: { justifyContent: "flex-end", paddingRight: 2 },
  ts: { fontSize: 10 },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  savedLabel: { fontSize: 10, fontWeight: "600" as const },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12 },

  welcome: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 16, gap: 14 },
  wibIcon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontSize: 22, fontWeight: "700" as const },
  welcomeText: { fontSize: 14, textAlign: "center", lineHeight: 21, maxWidth: 290 },
  suggestionGrid: { gap: 8, width: "100%", marginTop: 4 },
  suggestionBtn: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  suggestionText: { fontSize: 14, flex: 1 },

  inputBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    borderRadius: 22, borderWidth: 1,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 15, lineHeight: 22, maxHeight: 110, paddingVertical: 6 },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", marginLeft: 8,
  },
  hint: { fontSize: 10, textAlign: "center", marginTop: 6, marginBottom: 2 },
});
