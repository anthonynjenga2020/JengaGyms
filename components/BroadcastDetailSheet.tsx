import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import { type MockBroadcast, formatScheduledAt } from '@/lib/mockBroadcasts';

const DELIVERY_META: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string }> = {
  delivered: { icon: 'checkmark-done-outline', color: '#33D169', label: 'Delivered' },
  failed:    { icon: 'close-circle-outline',   color: '#FF4C4C', label: 'Failed' },
  pending:   { icon: 'time-outline',           color: '#8FA3B4', label: 'Pending' },
};

interface Props {
  broadcast: MockBroadcast | null;
  onClose: () => void;
}

export function BroadcastDetailSheet({ broadcast, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: broadcast ? 0 : 600,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [broadcast]);

  function timeLabel(): string {
    if (!broadcast) return '';
    if (broadcast.status === 'sent' && broadcast.sentAt) {
      const diff = Math.round((Date.now() - new Date(broadcast.sentAt).getTime()) / 60000);
      if (diff < 60) return `Sent ${diff}m ago`;
      if (diff < 1440) return `Sent ${Math.round(diff / 60)}h ago`;
      return `Sent ${Math.round(diff / 1440)}d ago`;
    }
    if (broadcast.status === 'scheduled' && broadcast.scheduledAt) {
      return `Scheduled: ${formatScheduledAt(broadcast.scheduledAt)}`;
    }
    return '';
  }

  const delivered = broadcast?.recipients.filter(r => r.deliveryStatus === 'delivered').length ?? 0;
  const failed = broadcast?.recipients.filter(r => r.deliveryStatus === 'failed').length ?? 0;

  return (
    <Modal visible={!!broadcast} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle + header */}
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{broadcast?.recipientLabel}</Text>
            <Text style={styles.headerTime}>{timeLabel()}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
          {/* Message bubble */}
          <View style={styles.bubbleWrap}>
            <Text style={styles.bubbleLabel}>Message</Text>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{broadcast?.message}</Text>
            </View>
          </View>

          {/* Delivery summary */}
          {broadcast && broadcast.recipientCount > 1 && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryChip, { backgroundColor: '#33D16920' }]}>
                <Ionicons name="checkmark-done-outline" size={14} color="#33D169" />
                <Text style={[styles.summaryChipText, { color: '#33D169' }]}>{delivered} delivered</Text>
              </View>
              {failed > 0 && (
                <View style={[styles.summaryChip, { backgroundColor: '#FF4C4C20' }]}>
                  <Ionicons name="close-circle-outline" size={14} color="#FF4C4C" />
                  <Text style={[styles.summaryChipText, { color: '#FF4C4C' }]}>{failed} failed</Text>
                </View>
              )}
            </View>
          )}

          {/* Recipients list */}
          <View>
            <Text style={styles.sectionTitle}>Recipients</Text>
            <View style={styles.recipientList}>
              {broadcast?.recipients.map((r, i) => {
                const meta = DELIVERY_META[r.deliveryStatus];
                const initials = r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <View key={r.id} style={[styles.recipientRow, i > 0 && styles.recipientBorder]}>
                    <View style={styles.recipientAvatar}>
                      <Text style={styles.recipientInitials}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipientName}>{r.name}</Text>
                      <Text style={styles.recipientType}>{r.type}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: meta.color + '20' }]}>
                      <Ionicons name={meta.icon} size={13} color={meta.color} />
                      <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '75%',
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    gap: 14,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 30, height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },

  bubbleWrap: { gap: 8 },
  bubbleLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  bubble: {
    backgroundColor: colors.primary + '22',
    borderRadius: 14,
    borderBottomRightRadius: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primary + '35',
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 21 },

  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  summaryChipText: { fontSize: 12, fontWeight: '600' },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  recipientList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  recipientBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  recipientAvatar: {
    width: 32, height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
  },
  recipientInitials: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  recipientName: { fontSize: 13, fontWeight: '600', color: colors.text },
  recipientType: { fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  statusChipText: { fontSize: 10, fontWeight: '700' },
});
