import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  Animated,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import {
  MOCK_CAMPAIGNS,
  CAMPAIGN_TYPE_META,
  CAMPAIGN_STATUS_META,
  type MockCampaign,
  type CampaignStatus,
} from '@/lib/mockCampaigns';
import { CreateCampaignModal } from '@/components/CreateCampaignModal';

// ── Counter animation ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900, delay = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (target === 0) return;
      const totalSteps = 40;
      const stepMs = duration / totalSteps;
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const eased = 1 - Math.pow(1 - step / totalSteps, 3);
        setCount(Math.round(eased * target));
        if (step >= totalSteps) { clearInterval(timer); setCount(target); }
      }, stepMs);
      return () => clearInterval(timer);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, delay]);
  return count;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

type StatCardProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  value: number;
  displayValue?: string;
  label: string;
  index: number;
};

function StatCard({ icon, iconColor, value, displayValue, label, index }: StatCardProps) {
  const counted = useCountUp(value, 900, index * 120);
  const display = displayValue
    ? displayValue.replace(String(value), counted.toLocaleString())
    : counted.toLocaleString();

  return (
    <RNAnimated.View entering={FadeInDown.delay(index * 100).springify()} style={styles.statCard}>
      <View style={[styles.statIconBadge, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{display}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>this month</Text>
    </RNAnimated.View>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.min((sent / total) * 100, 100) : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      delay: 400,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>Delivery progress</Text>
        <Text style={styles.progressLabel}>{sent.toLocaleString()} / {total.toLocaleString()} sent</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ── Campaign card ─────────────────────────────────────────────────────────────

type CampaignCardProps = { campaign: MockCampaign; index: number };

function CampaignCard({ campaign, index }: CampaignCardProps) {
  const typeMeta = CAMPAIGN_TYPE_META[campaign.type];
  const statusMeta = CAMPAIGN_STATUS_META[campaign.status];

  function formatDate() {
    if (campaign.status === 'scheduled' && campaign.scheduled_at) {
      const d = new Date(campaign.scheduled_at);
      return 'Scheduled: ' + d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    }
    if (campaign.sent > 0) {
      const d = new Date(campaign.created_at);
      const diff = Math.round((Date.now() - d.getTime()) / 86400000);
      if (diff === 0) return 'Sent today';
      if (diff === 1) return 'Sent 1 day ago';
      if (diff < 30) return `Sent ${diff} days ago`;
      return 'Sent ' + d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    }
    return null;
  }

  const dateStr = formatDate();
  const showProgress = campaign.status === 'active' && campaign.total > 0;

  return (
    <RNAnimated.View entering={FadeInDown.delay(index * 80).springify()}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.82}
        onPress={() => router.push(`/campaign/${campaign.id}`)}
      >
        {/* Row 1: name + status */}
        <View style={styles.cardRow}>
          <Text style={styles.cardName} numberOfLines={1}>{campaign.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        {/* Row 2: type */}
        <View style={styles.typeRow}>
          <Text style={styles.typeEmoji}>{typeMeta.emoji}</Text>
          <Text style={[styles.typeLabel, { color: typeMeta.color }]}>{typeMeta.label}</Text>
        </View>

        {/* Row 3: mini stats */}
        <View style={styles.miniStats}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{campaign.sent.toLocaleString()}</Text>
            <Text style={styles.miniStatLabel}>Sent</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{campaign.responses.toLocaleString()}</Text>
            <Text style={styles.miniStatLabel}>Responses</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{campaign.conversions.toLocaleString()}</Text>
            <Text style={styles.miniStatLabel}>Conversions</Text>
          </View>
        </View>

        {/* Row 4: date + recipients */}
        {(dateStr || campaign.recipients > 0) && (
          <View style={styles.cardMeta}>
            {dateStr ? (
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{dateStr}</Text>
              </View>
            ) : <View />}
            {campaign.recipients > 0 && (
              <View style={styles.metaChip}>
                <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{campaign.recipients.toLocaleString()} recipients</Text>
              </View>
            )}
          </View>
        )}

        {/* Progress bar (active only) */}
        {showProgress && (
          <ProgressBar sent={campaign.sent} total={campaign.total} />
        )}

        {/* Chevron */}
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

// ── Sort dropdown ─────────────────────────────────────────────────────────────

type SortOption = 'newest' | 'oldest' | 'best';
const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  best: 'Best Performing',
};

function SortDropdown({
  value,
  onChange,
  visible,
  onOpen,
  onClose,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <View>
      <TouchableOpacity style={styles.sortBtn} onPress={onOpen}>
        <Ionicons name="swap-vertical-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.sortBtnText}>{SORT_LABELS[value]}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.dropdownOverlay} onPress={onClose}>
          <View style={styles.dropdownMenu}>
            {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
              <TouchableOpacity
                key={key}
                style={[styles.dropdownItem, value === key && styles.dropdownItemActive]}
                onPress={() => { onChange(key); onClose(); }}
              >
                <Text style={[styles.dropdownText, value === key && { color: colors.primary }]}>
                  {SORT_LABELS[key]}
                </Text>
                {value === key && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}


// ── Automations / Broadcasts placeholder ─────────────────────────────────────

function ComingSoonTab({ label }: { label: string }) {
  return (
    <RNAnimated.View entering={FadeIn.duration(200)} style={styles.comingSoon}>
      <Ionicons name="construct-outline" size={44} color={colors.textMuted} />
      <Text style={styles.comingSoonTitle}>{label}</Text>
      <Text style={styles.comingSoonSub}>This section is coming soon.</Text>
    </RNAnimated.View>
  );
}

// ── Campaigns list tab ────────────────────────────────────────────────────────

const FILTERS: { key: CampaignStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'draft',     label: 'Draft' },
  { key: 'paused',    label: 'Paused' },
];

function CampaignsListTab({ extraCampaigns, onOpenCreate }: { extraCampaigns: MockCampaign[]; onOpenCreate: () => void }) {
  const [filter, setFilter] = useState<CampaignStatus | 'all'>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [showSort, setShowSort] = useState(false);
  const [listKey, setListKey] = useState(0);

  function handleFilter(f: CampaignStatus | 'all') {
    setFilter(f);
    setListKey(k => k + 1);
  }

  const allCampaigns = [...extraCampaigns, ...MOCK_CAMPAIGNS];
  const filtered = allCampaigns
    .filter(c => filter === 'all' || c.status === filter)
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'best') return b.conversions - a.conversions;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <>
      {/* Filter pills + sort */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.pill, filter === f.key && styles.pillActive]}
              onPress={() => handleFilter(f.key)}
            >
              <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <SortDropdown
          value={sort}
          onChange={setSort}
          visible={showSort}
          onOpen={() => setShowSort(true)}
          onClose={() => setShowSort(false)}
        />
      </View>

      {/* Cards */}
      {filtered.length === 0 ? (
        <RNAnimated.View entering={FadeIn.duration(200)} style={styles.emptyState}>
          <Ionicons name="megaphone-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No campaigns yet</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={onOpenCreate}>
            <Text style={styles.emptyBtnText}>Create your first campaign +</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      ) : (
        <View key={listKey} style={styles.cardList}>
          {filtered.map((c, i) => (
            <CampaignCard key={c.id} campaign={c} index={i} />
          ))}
        </View>
      )}
    </>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const MAIN_TABS = ['Campaigns', 'Automations', 'Broadcasts'] as const;
type MainTab = typeof MAIN_TABS[number];

export default function MarketingScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MainTab>('Campaigns');
  const [showNew, setShowNew] = useState(false);
  const [extraCampaigns, setExtraCampaigns] = useState<MockCampaign[]>([]);
  const tabFade = useRef(new Animated.Value(1)).current;

  function handleLaunch(campaign: MockCampaign) {
    setExtraCampaigns(prev => [campaign, ...prev]);
  }

  function switchTab(tab: MainTab) {
    Animated.sequence([
      Animated.timing(tabFade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(tabFade, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setActiveTab(tab);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketing</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNew(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Stat cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statRow}
        >
          <StatCard
            icon="send-outline"
            iconColor={colors.info}
            value={1248}
            label="Messages Sent"
            index={0}
          />
          <StatCard
            icon="trending-up-outline"
            iconColor={colors.primary}
            value={68}
            displayValue="68%"
            label="Avg Open Rate"
            index={1}
          />
          <StatCard
            icon="repeat-outline"
            iconColor={colors.warning}
            value={34}
            label="Conversions"
            index={2}
          />
        </ScrollView>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {MAIN_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => switchTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
              {activeTab === tab && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <Animated.View style={{ opacity: tabFade }}>
          {activeTab === 'Campaigns' && (
            <CampaignsListTab
              extraCampaigns={extraCampaigns}
              onOpenCreate={() => setShowNew(true)}
            />
          )}
          {activeTab === 'Automations' && <ComingSoonTab label="Automations" />}
          {activeTab === 'Broadcasts' && <ComingSoonTab label="Broadcasts" />}
        </Animated.View>
      </ScrollView>

      <CreateCampaignModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onLaunch={handleLaunch}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.text },
  addBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.info,
    justifyContent: 'center', alignItems: 'center',
  },

  // Stat cards
  statRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 12,
  },
  statCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  statIconBadge: {
    width: 32, height: 32, borderRadius: radius.sm,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 26, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  statSub: { fontSize: 11, color: colors.textMuted },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 8, right: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  // Filter pills + sort
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingRight: spacing.md,
    gap: 8,
  },
  filterPills: {
    paddingLeft: spacing.md,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: colors.primary },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  // Sort dropdown
  dropdownOverlay: { flex: 1, justifyContent: 'flex-end' },
  dropdownMenu: {
    marginHorizontal: spacing.md,
    marginBottom: 100,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignSelf: 'flex-end',
    minWidth: 190,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: { backgroundColor: colors.primary + '10' },
  dropdownText: { fontSize: 14, fontWeight: '500', color: colors.text },

  // Campaign cards
  cardList: {
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeEmoji: { fontSize: 15 },
  typeLabel: { fontSize: 13, fontWeight: '600' },
  miniStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: 10,
    gap: 0,
  },
  miniStat: { flex: 1, alignItems: 'center', gap: 2 },
  miniStatDivider: { width: 1, height: 28, backgroundColor: colors.border },
  miniStatValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  miniStatLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted },
  chevron: { position: 'absolute', right: 14, top: 14 },

  // Progress bar
  progressWrap: { gap: 5 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 11, color: colors.textMuted },
  progressTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 14, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.primary + '20',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  // Coming soon
  comingSoon: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  comingSoonTitle: { fontSize: 17, fontWeight: '700', color: colors.textSecondary },
  comingSoonSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

});
