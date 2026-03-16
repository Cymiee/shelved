import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6c63ff",
        tabBarStyle: { backgroundColor: "#0f0f0f" },
        headerStyle: { backgroundColor: "#0f0f0f" },
        headerTintColor: "#fff",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Feed" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
