import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/config/supabase";

type Mode = "login" | "register";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert("Atenção", "Preencha o e-mail e uma senha com pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) Alert.alert("Erro ao entrar", error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) {
          Alert.alert("Erro ao criar conta", error.message);
        } else if (!data.session) {
          Alert.alert(
            "Confirme seu e-mail",
            `Enviamos um link de confirmação para ${email}. Acesse seu e-mail e clique no link para ativar sua conta.`
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Branding */}
        <View style={styles.logoArea}>
          <Text style={[styles.logoText, { color: colors.lime }]}>WIB</Text>
          <Text style={[styles.logoSub, { color: colors.muted }]}>Segundo Cérebro Urbano</Text>
        </View>

        {/* Login / Register toggle */}
        <View style={[styles.toggleRow, { backgroundColor: colors.surfaceContainer, borderRadius: 14 }]}>
          {(["login", "register"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[styles.toggleBtn, mode === m && { backgroundColor: colors.lime, borderRadius: 11 }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.toggleText, { color: mode === m ? colors.onLime : colors.muted }]}>
                {m === "login" ? "Entrar" : "Criar conta"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>E-MAIL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.onSurface }]}
              placeholder="seu@email.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>SENHA</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.onSurface }]}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.lime, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.onLime} />
              : <Text style={[styles.submitText, { color: colors.onLime }]}>
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 28 },
  logoArea: { alignItems: "center", marginBottom: 44 },
  logoText: { fontSize: 72, fontWeight: "800" as const, letterSpacing: -3 },
  logoSub: { fontSize: 15, marginTop: 4, letterSpacing: 0.3 },
  toggleRow: { flexDirection: "row", padding: 4, marginBottom: 32 },
  toggleBtn: { flex: 1, alignItems: "center", paddingVertical: 11 },
  toggleText: { fontSize: 15, fontWeight: "600" as const },
  form: { gap: 18 },
  field: { gap: 7 },
  label: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 6 },
  submitText: { fontSize: 16, fontWeight: "700" as const },
});
