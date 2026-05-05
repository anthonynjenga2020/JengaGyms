import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, leadStatusConfig } from '@/lib/theme';
import type { Lead } from '@/lib/supabase';

type Props = {
  lead: Lead;
};

export function LeadItem({ lead }: Props) {
  const config = leadStatusConfig[lead.status] ?? { color: colors.textMuted, label: lead.status };

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  }

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{lead.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{lead.name}</Text>
        <View style={styles.meta}>
          {lead.phone && (
            <View style={styles.metaItem}>
              <Ionicons name="call-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{lead.phone}</Text>
            </View>
          )}
          {lead.interest && (
            <View style={styles.metaItem}>
              <Ionicons name="barbell-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaText}>{lead.interest}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.right}>
        <View style={[styles.badge, { backgroundColor: config.color + '20' }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
        <Text style={styles.time}>{timeAgo(lead.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted },
  right: { alignItems: 'flex-end', gap: 6 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  time: { fontSize: 11, color: colors.textMuted },
});
