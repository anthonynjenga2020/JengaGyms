import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import type { Review } from '@/lib/supabase';

type Props = {
  review: Review;
  onReply: (id: string, replyText: string) => Promise<unknown>;
};

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={13}
          color={colors.accent}
        />
      ))}
    </View>
  );
}

export function ReviewItem({ review, onReply }: Props) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState(review.reply_text ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmitReply() {
    if (!replyText.trim()) {
      Alert.alert('Error', 'Please write a reply before submitting.');
      return;
    }
    setSaving(true);
    const error = await onReply(review.id, replyText.trim());
    if (error) {
      Alert.alert('Error', 'Failed to save reply. Please try again.');
    } else {
      setShowReplyBox(false);
    }
    setSaving(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <View style={styles.card}>
      {/* Reviewer header */}
      <View style={styles.reviewHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{review.reviewer_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
          <Stars rating={review.rating} />
        </View>
        <Text style={styles.date}>{formatDate(review.created_at)}</Text>
      </View>

      {/* Review content */}
      {review.content && (
        <Text style={styles.content}>{review.content}</Text>
      )}

      {/* Existing reply */}
      {review.replied && review.reply_text && (
        <View style={styles.replyBox}>
          <View style={styles.replyHeader}>
            <Ionicons name="arrow-undo-outline" size={13} color={colors.primary} />
            <Text style={styles.replyLabel}>Your reply</Text>
          </View>
          <Text style={styles.replyText}>{review.reply_text}</Text>
        </View>
      )}

      {/* Reply action */}
      {!review.replied && (
        <>
          {!showReplyBox ? (
            <TouchableOpacity style={styles.replyBtn} onPress={() => setShowReplyBox(true)}>
              <Ionicons name="arrow-undo-outline" size={14} color={colors.primary} />
              <Text style={styles.replyBtnText}>Reply to review</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.replyInputContainer}>
              <TextInput
                style={styles.replyInput}
                placeholder="Write a professional reply..."
                placeholderTextColor={colors.textMuted}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.replyActions}>
                <TouchableOpacity onPress={() => setShowReplyBox(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
                  onPress={handleSubmitReply}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.submitBtnText}>Post reply</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 10,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  reviewerInfo: { flex: 1, gap: 3 },
  reviewerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  date: { fontSize: 11, color: colors.textMuted },
  content: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  replyBox: {
    backgroundColor: colors.background,
    borderRadius: 8, padding: 10, gap: 4,
    borderLeftWidth: 2, borderLeftColor: colors.primary,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replyLabel: { fontSize: 11, fontWeight: '700', color: colors.primary },
  replyText: { fontSize: 13, color: colors.textSecondary },
  replyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: colors.primary,
  },
  replyBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  replyInputContainer: { gap: 8 },
  replyInput: {
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 10,
    fontSize: 13, color: colors.text,
    minHeight: 80,
  },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  cancelText: { fontSize: 14, color: colors.textMuted },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 7,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
});
