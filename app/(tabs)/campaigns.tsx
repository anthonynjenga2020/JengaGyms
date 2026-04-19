import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  Animated,
  TextInput,
} from 'react-native';
import { useState, useRef, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import {
  CAMPAIGN_TYPE_META,
  CAMPAIGN_STATUS_META,
  type MockCampaign,
  type CampaignStatus,
} from '@/lib/mockCampaigns';
import { useClient } from '@/hooks/useClient';
import { useCampaigns } from '@/hooks/useCampaigns';
import type { Campaign } from '@/lib/supabase';
import { CreateCampaignModal } from '@/components/CreateCampaignModal';
import { AutomationsTab } from '@/components/AutomationsTab';
import { BroadcastsTab } from '@/components/BroadcastsTab';

// Map DB Campaign type → MockCampaign shape used by UI components
function toMockCampaign(c: Campaign): MockCampaign {
  return {
    id: c.id,
    name: c.name,
    status: c.status as CampaignStatus,
    type: c.type as MockCampaign['type'],
    sent: c.sent_count,
    delivered: c.delivered_count,
    total: c.audience_size,
    responses: c.response_count,
    conversions: c.conversion_count,
    recipients: c.recipient_count,
    created_at: c.created_at,
    scheduled_at: c.scheduled_at ?? undefined,
  };
}

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

function CampaignsListTab({ campaigns: allCampaigns, onOpenCreate }: { campaigns: MockCampaign[]; onOpenCreate: () => void }) {
  const [filter, setFilter] = useState<CampaignStatus | 'all'>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [showSort, setShowSort] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [listKey, setListKey] = useState(0);

  function handleFilter(f: CampaignStatus | 'all') {
    setFilter(f);
    setListKey(k => k + 1);
  }

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allCampaigns
      .filter(c => {
        const matchStatus = filter === 'all' || c.status === filter;
        const matchSearch = !q ||
          c.name.toLowerCase().includes(q) ||
          CAMPAIGN_TYPE_META[c.type].label.toLowerCase().includes(q);
        return matchStatus && matchSearch;
      })
      .sort((a, b) => {
        if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sort === 'best') return b.conversions - a.conversions;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [allCampaigns.length, filter, sort, searchQuery]);

  const hasAnyCampaigns = allCampaigns.length > 0;
  const isFiltered = filter !== 'all' || searchQuery.trim().length > 0;

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

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search campaigns..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Cards or empty states */}
      {filtered.length === 0 ? (
        <RNAnimated.View key="empty" entering={FadeIn.duration(200)} style={styles.emptyState}>
          {isFiltered ? (
            <>
              <Ionicons name="search-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No campaigns found</Text>
              <Text style={styles.emptySubtitle}>Try a different search or filter</Text>
            </>
          ) : (
            <>
              <Ionicons name="megaphone-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No campaigns yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={onOpenCreate}>
                <Text style={styles.emptyBtnText}>Create your first campaign +</Text>
              </TouchableOpacity>
            </>
          )}
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

// ── Summary Card ─────────────────────────────────────────────────────────────

const CHART_H = 52;

function WeekBar({ value, maxValue, delay, expanded }: {
  value: number; maxValue: number; delay: number; expanded: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (expanded) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: maxValue > 0 ? value / maxValue : 0,
        duration: 550,
        delay,
        useNativeDriver: false,
      }).start();
    }
  }, [expanded]);
  return (
    <View style={{ flex: 1, height: CHART_H, justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
      <Animated.View
        style={{
          width: '72%',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          backgroundColor: colors.primary + '55',
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: colors.primary,
          height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, CHART_H] }),
        }}
      />
    </View>
  );
}

function ChannelBar({ pct, delay, expanded }: { pct: number; delay: number; expanded: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (expanded) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: pct, duration: 700, delay, useNativeDriver: false }).start();
    }
  }, [expanded]);
  return (
    <View style={styles.channelTrack}>
      <Animated.View
        style={[
          styles.channelFill,
          {
            width: anim.interpolate({
              inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </View>
  );
}

function SummaryCard({ campaigns }: { campaigns: MockCampaign[] }) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  function toggle() {
    const toValue = expanded ? 0 : 1;
    Animated.timing(expandAnim, { toValue, duration: 280, useNativeDriver: false }).start();
    setExpanded(prev => !prev);
  }

  const weeklyData = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return [
      { label: 'Wk 1', start: new Date(y, m, 1),  end: new Date(y, m, 7) },
      { label: 'Wk 2', start: new Date(y, m, 8),  end: new Date(y, m, 14) },
      { label: 'Wk 3', start: new Date(y, m, 15), end: new Date(y, m, 21) },
      { label: 'Wk 4', start: new Date(y, m, 22), end: new Date(y, m + 1, 0) },
    ].map(w => ({
      label: w.label,
      value: campaigns.filter(c => {
        const d = new Date(c.created_at);
        return d >= w.start && d <= w.end;
      }).length,
    }));
  }, [campaigns.length]);

  const maxWeek = Math.max(...weeklyData.map(d => d.value), 1);

  const bestCampaign = useMemo(
    () => [...campaigns].sort((a, b) => b.conversions - a.conversions)[0],
    [campaigns.length],
  );

  const totalReach = useMemo(
    () => campaigns.reduce((s, c) => s + c.recipients, 0),
    [campaigns.length],
  );

  return (
    <RNAnimated.View entering={FadeInDown.delay(300).springify()} style={styles.summaryCard}>
      {/* Always-visible header */}
      <TouchableOpacity style={styles.summaryHeader} onPress={toggle} activeOpacity={0.8}>
        <View style={styles.summaryHeaderLeft}>
          <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
          <Text style={styles.summaryTitle}>This Month at a Glance</Text>
        </View>
        <Animated.View
          style={{
            transform: [{
              rotate: expandAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
            }],
          }}
        >
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Animated.View>
      </TouchableOpacity>

      {/* Collapsible body */}
      <Animated.View
        style={{
          maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 340] }),
          overflow: 'hidden',
        }}
      >
        <View style={styles.summaryBody}>
          {/* Mini bar chart */}
          <View>
            <Text style={styles.summarySection}>Campaigns This Month</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 6, marginTop: 8 }}>
              {weeklyData.map((d, i) => (
                <WeekBar key={i} value={d.value} maxValue={maxWeek} delay={i * 80} expanded={expanded} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {weeklyData.map((d, i) => (
                <Text key={i} style={[styles.chartAxisLabel, { flex: 1 }]}>{d.label}</Text>
              ))}
            </View>
          </View>

          {/* Best performing */}
          {bestCampaign && bestCampaign.conversions > 0 && (
            <View style={styles.bestRow}>
              <Ionicons name="trophy-outline" size={16} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bestLabel}>Best Campaign</Text>
                <Text style={styles.bestName} numberOfLines={1}>{bestCampaign.name}</Text>
              </View>
              <Text style={styles.bestStat}>{bestCampaign.conversions} conversions</Text>
            </View>
          )}

          {/* Channel breakdown */}
          <View style={{ gap: 8 }}>
            <Text style={styles.summarySection}>Channel Breakdown</Text>
            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>📱 SMS</Text>
              <ChannelBar pct={94} delay={100} expanded={expanded} />
              <Text style={styles.channelPct}>94%</Text>
            </View>
            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>💬 WhatsApp</Text>
              <View style={[styles.channelTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.channelFill, { width: '0%' }]} />
              </View>
              <Text style={[styles.channelPct, { color: colors.textMuted }]}>Soon</Text>
            </View>
          </View>

          {/* Audience reach */}
          <View style={styles.reachRow}>
            <Ionicons name="people-outline" size={15} color={colors.info} />
            <Text style={styles.reachText}>
              <Text style={styles.reachNum}>{totalReach.toLocaleString()}</Text>
              {' '}unique contacts reached this month
            </Text>
          </View>
        </View>
      </Animated.View>
    </RNAnimated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const MAIN_TABS = ['Campaigns', 'Automations', 'Broadcasts'] as const;
type MainTab = typeof MAIN_TABS[number];

export default function MarketingScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MainTab>('Campaigns');
  const [showNew, setShowNew] = useState(false);
  const tabFade = useRef(new Animated.Value(1)).current;
  const { client } = useClient();
  const { campaigns: dbCampaigns, refresh: refreshCampaigns } = useCampaigns(client?.id);
  const mappedCampaigns = useMemo(() => dbCampaigns.map(toMockCampaign), [dbCampaigns]);

  function handleLaunch() {
    refreshCampaigns();
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

        {/* Summary card */}
        <SummaryCard campaigns={mappedCampaigns} />

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
              campaigns={mappedCampaigns}
              onOpenCreate={() => setShowNew(true)}
            />
          )}
          {activeTab === 'Automations' && <AutomationsTab />}
          {activeTab === 'Broadcasts' && <BroadcastsTab />}
        </Animated.View>
      </ScrollView>

      <CreateCampaignModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onLaunch={handleLaunch}
        clientId={client?.id}
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

  // Search bar
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },

  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  // Summary card
  summaryCard: {
    marginHorizontal: spacing.md,
    marginBottom: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  summaryBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summarySection: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartAxisLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },

  // Best performing
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warning + '12',
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  bestLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  bestName: { fontSize: 13, fontWeight: '700', color: colors.text },
  bestStat: { fontSize: 12, fontWeight: '700', color: colors.warning },

  // Channel breakdown
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, width: 90 },
  channelTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  channelFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  channelPct: { fontSize: 11, fontWeight: '700', color: colors.primary, width: 34, textAlign: 'right' },

  // Audience reach
  reachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.info + '12',
    borderRadius: radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.info + '30',
  },
  reachText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  reachNum: { fontSize: 13, fontWeight: '700', color: colors.info },

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
