import { View, Text, StyleSheet } from "react-native";

// Placeholder — IGDB search UI comes in next phase
export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Search Games</Text>
      <Text style={styles.sub}>Search IGDB for games to log</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f", alignItems: "center", justifyContent: "center" },
  text: { color: "#fff", fontSize: 22, fontWeight: "700" },
  sub: { color: "#888", marginTop: 8, fontSize: 14 },
});
