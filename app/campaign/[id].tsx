import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import {
  MOCK_CAMPAIGNS,
  CAMPAIGN_TYPE_META,
  CAMPAIGN_STATUS_META,
} from '@/lib/mockCampaigns';

// ── Progress bar ──────────────────────────────────────────────────────────────

function AnimatedProgressBar({ pct, color }: { pct: number; color: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </View>
  );
}

// ── Stat row item ─────────────────────────────────────────────────────────────

function StatItem({ label, value, icon, color }: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const campaign = MOCK_CAMPAIGNS.find(c => c.id === id);

  if (!campaign) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.notFoundText}>Campaign not found</Text>
        </View>
      </View>
    );
  }

  const typeMeta = CAMPAIGN_TYPE_META[campaign.type];
  const statusMeta = CAMPAIGN_STATUS_META[campaign.status];
  const deliveryPct = campaign.total > 0 ? Math.round((campaign.sent / campaign.total) * 100) : 0;
  const openRate = campaign.sent > 0 ? Math.round((campaign.responses / campaign.sent) * 100) : 0;
  const convRate = campaign.sent > 0 ? Math.round((campaign.conversions / campaign.sent) * 100) : 0;

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-KE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Campaign Detail</Text>
        <View style={[styles.statusChip, { backgroundColor: statusMeta.bg }]}>
          <Text style={[styles.statusChipText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Hero card */}
        <RNAnimated.View entering={FadeInDown.springify()} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroEmoji}>{typeMeta.emoji}</Text>
            <View style={[styles.typeChip, { backgroundColor: typeMeta.color + '20' }]}>
              <Text style={[styles.typeChipText, { color: typeMeta.color }]}>{typeMeta.label}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{campaign.name}</Text>
          <Text style={styles.heroDate}>Created {formatDate(campaign.created_at)}</Text>
          {campaign.scheduled_at && (
            <View style={styles.scheduleRow}>
              <Ionicons name="time-outline" size={14} color={colors.info} />
              <Text style={styles.scheduleText}>
                Scheduled for {formatDate(campaign.scheduled_at)}
              </Text>
            </View>
          )}
        </RNAnimated.View>

        {/* Stats grid */}
        <RNAnimated.View entering={FadeInDown.delay(80).springify()} style={styles.statsGrid}>
          <StatItem label="Sent" value={campaign.sent.toLocaleString()} icon="send-outline" color={colors.info} />
          <View style={styles.statDivider} />
          <StatItem label="Responses" value={campaign.responses.toLocaleString()} icon="chatbubble-outline" color={colors.primary} />
          <View style={styles.statDivider} />
          <StatItem label="Conversions" value={campaign.conversions.toLocaleString()} icon="repeat-outline" color={colors.warning} />
          <View style={styles.statDivider} />
          <StatItem label="Recipients" value={campaign.recipients.toLocaleString()} icon="people-outline" color={colors.textSecondary} />
        </RNAnimated.View>

        {/* Performance rates */}
        {campaign.sent > 0 && (
          <RNAnimated.View entering={FadeInDown.delay(160).springify()} style={styles.section}>
            <Text style={styles.sectionTitle}>Performance</Text>

            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Response Rate</Text>
              <Text style={[styles.rateValue, { color: colors.primary }]}>{openRate}%</Text>
            </View>
            <AnimatedProgressBar pct={openRate} color={colors.primary} />

            <View style={[styles.rateRow, { marginTop: 16 }]}>
              <Text style={styles.rateLabel}>Conversion Rate</Text>
              <Text style={[styles.rateValue, { color: colors.warning }]}>{convRate}%</Text>
            </View>
            <AnimatedProgressBar pct={convRate} color={colors.warning} />

            {campaign.total > 0 && (
              <>
                <View style={[styles.rateRow, { marginTop: 16 }]}>
                  <Text style={styles.rateLabel}>Delivery Progress</Text>
                  <Text style={[styles.rateValue, { color: colors.info }]}>
                    {campaign.sent.toLocaleString()} / {campaign.total.toLocaleString()}
                  </Text>
                </View>
                <AnimatedProgressBar pct={deliveryPct} color={colors.info} />
              </>
            )}
          </RNAnimated.View>
        )}

        {/* Audience */}
        <RNAnimated.View entering={FadeInDown.delay(240).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Audience</Text>
          <View style={styles.audienceCard}>
            <Ionicons name="people-outline" size={28} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.audienceValue}>{campaign.recipients.toLocaleString()} recipients</Text>
              <Text style={styles.audienceSub}>
                {campaign.status === 'draft'
                  ? 'Audience not finalised yet'
                  : campaign.status === 'scheduled'
                  ? 'Will be sent to these contacts'
                  : 'Contacts in this campaign'}
              </Text>
            </View>
          </View>
        </RNAnimated.View>

        {/* Actions */}
        {(campaign.status === 'active' || campaign.status === 'paused') && (
          <RNAnimated.View entering={FadeInDown.delay(320).springify()} style={styles.actions}>
            {campaign.status === 'active' ? (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]}>
                <Ionicons name="pause-circle-outline" size={18} color={colors.warning} />
                <Text style={[styles.actionBtnText, { color: colors.warning }]}>Pause Campaign</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="play-circle-outline" size={18} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Resume Campaign</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]}>
              <Ionicons name="stop-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>Stop Campaign</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        )}
        {campaign.status === 'draft' && (
          <RNAnimated.View entering={FadeInDown.delay(320).springify()} style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={[styles.actionBtnText, { color: '#fff' }]}>Launch Campaign</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  statusChipText: { fontSize: 12, fontWeight: '700' },

  scroll: { paddingHorizontal: spacing.md, gap: 14, paddingTop: 4 },

  // Hero
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEmoji: { fontSize: 32 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  typeChipText: { fontSize: 12, fontWeight: '700' },
  heroName: { fontSize: 20, fontWeight: '700', color: colors.text },
  heroDate: { fontSize: 13, color: colors.textMuted },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  scheduleText: { fontSize: 13, color: colors.info, fontWeight: '600' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 5 },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  statIcon: { width: 34, height: 34, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },

  // Performance
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rateLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  rateValue: { fontSize: 14, fontWeight: '700' },
  track: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full },

  // Audience
  audienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: 12,
  },
  audienceValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  audienceSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Actions
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warning + '10',
  },
  actionBtnDanger: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.danger + '10',
  },
  actionBtnText: { fontSize: 15, fontWeight: '700' },

  // Not found
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: colors.textMuted },
});
