import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, campaignTypeConfig, campaignStatusConfig } from '@/lib/theme';
import type { Campaign } from '@/lib/supabase';

type Props = {
  campaign: Campaign;
};

export function CampaignItem({ campaign }: Props) {
  const typeConfig = campaignTypeConfig[campaign.type];
  const statusConfig = campaignStatusConfig[campaign.status];
  const openRate = campaign.sent_count > 0
    ? Math.round((campaign.open_count / campaign.sent_count) * 100)
    : 0;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-KE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.typeTag}>
          <Ionicons
            name={typeConfig.icon as React.ComponentProps<typeof Ionicons>['name']}
            size={13}
            color={colors.primary}
          />
          <Text style={styles.typeText}>{typeConfig.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      <Text style={styles.name}>{campaign.name}</Text>

      {campaign.subject && (
        <Text style={styles.subject} numberOfLines={1}>{campaign.subject}</Text>
      )}

      {/* Stats */}
      {campaign.sent_count > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{campaign.sent_count.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Sent</Text>
          </View>
          {campaign.open_count > 0 && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{openRate}%</Text>
              <Text style={styles.statLabel}>Open rate</Text>
            </View>
          )}
          {campaign.audience_size > 0 && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{campaign.audience_size.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Audience</Text>
            </View>
          )}
        </View>
      )}

      {campaign.sent_at && (
        <Text style={styles.date}>Sent {formatDate(campaign.sent_at)}</Text>
      )}
      {!campaign.sent_at && campaign.scheduled_at && (
        <Text style={styles.date}>Scheduled for {formatDate(campaign.scheduled_at)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 8,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  typeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  typeText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  subject: { fontSize: 13, color: colors.textMuted },
  statsRow: {
    flexDirection: 'row', gap: 20,
    paddingTop: 4,
  },
  stat: { gap: 2 },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },
  date: { fontSize: 11, color: colors.textMuted },
});
