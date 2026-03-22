import { View, Text, Pressable, StyleSheet, ToastAndroid, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useLogModal } from '../store/logModal';

export default function ScreenHeader() {
  const { open } = useLogModal();

  function showComingSoon() {
    if (Platform.OS === 'android') {
      ToastAndroid.show('Notifications coming soon', ToastAndroid.SHORT);
    } else {
      Alert.alert('Coming soon', 'Notifications are not yet available.');
    }
  }

  return (
    <View style={styles.header}>
      <Pressable onPress={() => open()} hitSlop={8} style={styles.iconButton}>
        <Ionicons name="add" size={24} color={Colors.textSecondary} />
      </Pressable>

      <Text style={styles.wordmark}>Shelved</Text>

      <Pressable onPress={showComingSoon} style={styles.bellButton}>
        <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  iconButton: { padding: 2 },
  wordmark: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: Colors.accent,
  },
  bellButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
