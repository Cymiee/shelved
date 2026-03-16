import { View, Text, StyleSheet } from "react-native";
import { useAuthStore } from "../../store/auth";

export default function ProfileScreen() {
  const { profile } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{profile?.username ?? "Not logged in"}</Text>
      <Text style={styles.sub}>{profile?.bio ?? ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f", alignItems: "center", justifyContent: "center" },
  text: { color: "#fff", fontSize: 22, fontWeight: "700" },
  sub: { color: "#888", marginTop: 8, fontSize: 14 },
});
