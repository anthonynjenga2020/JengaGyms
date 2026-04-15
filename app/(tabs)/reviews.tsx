import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useClient } from '@/hooks/useClient';
import { useReviews } from '@/hooks/useReviews';
import { ReviewItem } from '@/components/ReviewItem';
import { colors, spacing } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={colors.accent}
        />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const { client } = useClient();
  const { reviews, loading, refresh, replyToReview, averageRating } = useReviews(client?.id);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const repliedCount = reviews.filter(r => r.replied).length;
  const unrepliedCount = reviews.length - repliedCount;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reviews</Text>
        <Text style={styles.subtitle}>{reviews.length} total</Text>
      </View>

      {/* Summary card */}
      {reviews.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.ratingBlock}>
            <Text style={styles.ratingNumber}>{averageRating.toFixed(1)}</Text>
            <StarRating rating={averageRating} size={16} />
            <Text style={styles.ratingLabel}>Average rating</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statsBlock}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{unrepliedCount}</Text>
              <Text style={styles.statLabel}>Needs reply</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{repliedCount}</Text>
              <Text style={styles.statLabel}>Replied</Text>
            </View>
          </View>
        </View>
      )}

      {/* Review list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ReviewItem review={item} onReply={replyToReview} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No reviews yet</Text>
              <Text style={styles.emptySubtext}>
                Reviews will appear here once your clients start leaving feedback on Google.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  summaryCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingBlock: { flex: 1, alignItems: 'center', gap: 6 },
  ratingNumber: { fontSize: 40, fontWeight: '700', color: colors.text, lineHeight: 44 },
  ratingLabel: { fontSize: 12, color: colors.textMuted },
  divider: { width: 1, height: '80%', backgroundColor: colors.border, marginHorizontal: 16 },
  statsBlock: { flex: 1, gap: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },
  list: { paddingHorizontal: spacing.md, paddingBottom: 32, gap: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
