import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Hoje</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="projetos">
        <Icon sf={{ default: "folder", selected: "folder.fill" }} />
        <Label>Projetos</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="captura">
        <Icon sf={{ default: "mic", selected: "mic.fill" }} />
        <Label>Capturar</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="documentos">
        <Icon sf={{ default: "doc", selected: "doc.fill" }} />
        <Label>Docs</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pessoas">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Pessoas</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.navBg,
          borderTopWidth: 1,
          borderTopColor: colors.navBorder,
          elevation: 0,
          height: isWeb ? 84 : 70,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navBg }]} />
          ) : (
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginBottom: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Hoje",
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="house" tintColor={color} size={size} /> : <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projetos"
        options={{
          title: "Projetos",
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="folder" tintColor={color} size={size} /> : <Feather name="folder" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="captura"
        options={{
          title: "Capturar",
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="mic" tintColor={color} size={size} /> : <Feather name="mic" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="documentos"
        options={{
          title: "Docs",
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="doc" tintColor={color} size={size} /> : <Feather name="file-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pessoas"
        options={{
          title: "Pessoas",
          tabBarIcon: ({ color, size }) =>
            isIOS ? <SymbolView name="person" tintColor={color} size={size} /> : <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
