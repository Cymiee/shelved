import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import type { IGDBGame } from '@gameboxd/lib';
import { getCoverUrl } from '@gameboxd/lib';
import { Colors } from '../constants/colors';

interface GameCardProps {
  game: IGDBGame;
  width?: number;
  onPress: (game: IGDBGame) => void;
}

export default function GameCard({ game, width = 72, onPress }: GameCardProps) {
  const height = Math.round(width * 1.5);
  const coverUrl = game.cover ? getCoverUrl(game.cover.image_id, 'cover_big') : null;

  return (
    <Pressable style={[styles.container, { width }]} onPress={() => onPress(game)}>
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={[styles.cover, { width, height }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { width, height }]} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {game.name}
      </Text>
      {game.rating != null && (
        <Text style={styles.rating}>{(game.rating / 10).toFixed(1)}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexShrink: 0 },
  cover: {
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  placeholder: {
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  title: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  rating: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.accent,
    marginTop: 1,
  },
});
