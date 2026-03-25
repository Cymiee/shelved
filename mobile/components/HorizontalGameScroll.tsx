import { FlatList, View, ActivityIndicator, StyleSheet } from 'react-native';
import type { IGDBGame } from '@gameboxd/lib';
import GameCard from './GameCard';
import { Colors } from '../constants/colors';

interface Props {
  games: IGDBGame[];
  loading?: boolean;
  cardWidth?: number;
  onPress: (game: IGDBGame) => void;
}

export default function HorizontalGameScroll({ games, loading, cardWidth = 110, onPress }: Props) {
  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={Colors.accent} size="small" />
      </View>
    );
  }

  return (
    <FlatList
      data={games}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <GameCard game={item} width={cardWidth} onPress={onPress} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    gap: 8,
    paddingHorizontal: 16,
  },
});
