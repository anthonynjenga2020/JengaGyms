import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useRef, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import {
  MOCK_CAMPAIGNS,
  MOCK_CAMPAIGN_DETAILS,
  CAMPAIGN_TYPE_META,
  CAMPAIGN_STATUS_META,
  type CampaignStatus,
  type CampaignRecipient,
} from '@/lib/mockCampaigns';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  if (diff < 30) return `${diff} days ago`;
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900, delay = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const timeout = setTimeout(() => {
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

// ── Animated progress bar ─────────────────────────────────────────────────────

function AnimatedProgressBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 900,
      delay,
      useNativeDriver: false,
    }).start();
  }, [pct]);

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

// ── Stat card (2×2 grid) ──────────────────────────────────────────────────────

type StatCardProps = {
  emoji: string;
  label: string;
  value: number;
  rate?: string;
  color: string;
  index: number;
};

function StatCard({ emoji, label, value, rate, color, index }: StatCardProps) {
  const counted = useCountUp(value, 900, index * 120);
  return (
    <RNAnimated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={[styles.statCard, { borderTopColor: color }]}
    >
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{counted.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {rate !== undefined && <Text style={styles.statRate}>{rate}</Text>}
    </RNAnimated.View>
  );
}

// ── Bar chart (View-based, no SVG needed) ─────────────────────────────────────

const CHART_H = 100;

function AnimatedBar({ value, maxValue, delay, color }: {
  value: number; maxValue: number; delay: number; color: string;
}) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: maxValue > 0 ? value / maxValue : 0,
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, []);
  return (
    <View style={{ flex: 1, height: CHART_H, justifyContent: 'flex-end' }}>
      <Animated.View
        style={{
          height: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CHART_H] }),
          backgroundColor: color + '55',
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: color + '99',
        }}
      />
    </View>
  );
}

function ResponseChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={styles.chart}>
      <Text style={styles.sectionTitle}>Responses Over Time</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 4, marginTop: 8 }}>
        {data.map((d, i) => (
          <AnimatedBar key={i} value={d.value} maxValue={maxVal} delay={i * 60} color={colors.primary} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={[styles.chartLabel, { flex: 1 }]}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ── Conversion funnel ─────────────────────────────────────────────────────────

type FunnelStepData = { label: string; value: number; pct: number | null; color: string };

function FunnelStep({ step, index, isLast }: { step: FunnelStepData; index: number; isLast: boolean }) {
  const marginH = index * 14;
  return (
    <View>
      <RNAnimated.View entering={FadeInDown.delay(index * 100).springify()}>
        <View style={[styles.funnelStep, { marginHorizontal: marginH, borderColor: step.color + '60', backgroundColor: step.color + '15' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.funnelLabel, { color: step.color }]}>{step.label}</Text>
            {step.pct !== null && (
              <Text style={styles.funnelPct}>{step.pct}% of previous</Text>
            )}
          </View>
          <Text style={[styles.funnelValue, { color: step.color }]}>{step.value.toLocaleString()}</Text>
        </View>
      </RNAnimated.View>
      {!isLast && (
        <View style={styles.funnelArrow}>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </View>
      )}
    </View>
  );
}

function ConversionFunnel({ sent, delivered, responses, conversions }: {
  sent: number; delivered: number; responses: number; conversions: number;
}) {
  const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
  const responseRate = delivered > 0 ? Math.round((responses / delivered) * 100) : 0;
  const convRate = responses > 0 ? Math.round((conversions / responses) * 100) : 0;

  const steps: FunnelStepData[] = [
    { label: 'Sent',       value: sent,        pct: null,         color: '#4C9FFF' },
    { label: 'Delivered',  value: delivered,   pct: deliveryRate, color: '#33D169' },
    { label: 'Responded',  value: responses,   pct: responseRate, color: '#B3E84C' },
    { label: 'Converted',  value: conversions, pct: convRate,     color: '#FFB347' },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Conversion Funnel</Text>
      <View style={{ marginTop: 12, gap: 0 }}>
        {steps.map((s, i) => (
          <FunnelStep key={s.label} step={s} index={i} isLast={i === steps.length - 1} />
        ))}
      </View>
    </View>
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────

function ActivityItem({ item, index }: { item: { id: string; text: string; timestamp: string; initials: string; color: string }; index: number }) {
  return (
    <RNAnimated.View entering={FadeInDown.delay(index * 60).springify()} style={styles.activityRow}>
      <View style={[styles.activityAvatar, { backgroundColor: item.color + '25' }]}>
        <Text style={[styles.activityInitials, { color: item.color }]}>{item.initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityText}>{item.text}</Text>
        <Text style={styles.activityTime}>{timeAgo(item.timestamp)}</Text>
      </View>
    </RNAnimated.View>
  );
}

// ── Recipients list ───────────────────────────────────────────────────────────

const RECIPIENT_STATUS_META: Record<
  CampaignRecipient['status'],
  { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string }
> = {
  sent:       { icon: 'checkmark-outline',         color: '#8FA3B4', label: 'Sent' },
  delivered:  { icon: 'checkmark-done-outline',    color: '#4C9FFF', label: 'Delivered' },
  responded:  { icon: 'chatbubble-outline',         color: '#B3E84C', label: 'Responded' },
  converted:  { icon: 'trophy-outline',            color: '#FFB347', label: 'Converted' },
  failed:     { icon: 'close-circle-outline',      color: '#FF4C4C', label: 'Failed' },
};

function RecipientRow({ item, index }: { item: CampaignRecipient; index: number }) {
  const meta = RECIPIENT_STATUS_META[item.status];
  const initials = item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  function handlePress() {
    if (item.type === 'member') router.push(`/member/${item.refId}`);
    else router.push(`/lead/${item.refId}`);
  }

  return (
    <RNAnimated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity style={styles.recipientRow} onPress={handlePress} activeOpacity={0.75}>
        <View style={[styles.recipientAvatar, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={styles.recipientInitials}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.recipientName}>{item.name}</Text>
          <Text style={styles.recipientTime}>{timeAgo(item.timestamp)}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: item.type === 'member' ? colors.primary + '20' : colors.info + '20' }]}>
          <Text style={[styles.typeBadgeText, { color: item.type === 'member' ? colors.primary : colors.info }]}>
            {item.type === 'member' ? 'Member' : 'Lead'}
          </Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon} size={13} color={meta.color} />
          <Text style={[styles.statusChipTxt, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: string }) {
  return (
    <View style={styles.phoneWrap}>
      <View style={styles.phoneMock}>
        <View style={styles.phoneNotch} />
        <View style={styles.phoneScreen}>
          <Text style={styles.phoneHeader}>📱 SMS Preview</Text>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{message}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: visible ? 0 : -60, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY: slideAnim }] }]}>
      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ── Three-dot menu ────────────────────────────────────────────────────────────

type MenuAction = 'edit' | 'duplicate' | 'toggle_pause' | 'cancel' | 'delete';

function ThreeDotsMenu({
  visible,
  onClose,
  onAction,
  isPaused,
}: {
  visible: boolean;
  onClose: () => void;
  onAction: (a: MenuAction) => void;
  isPaused: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  const items: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; action: MenuAction; color?: string }[] = [
    { label: 'Edit Campaign',    icon: 'create-outline',       action: 'edit' },
    { label: 'Duplicate',        icon: 'copy-outline',         action: 'duplicate' },
    { label: isPaused ? 'Resume Campaign' : 'Pause Campaign', icon: isPaused ? 'play-circle-outline' : 'pause-circle-outline', action: 'toggle_pause' },
    { label: 'Cancel Campaign',  icon: 'stop-circle-outline',  action: 'cancel',  color: colors.warning },
    { label: 'Delete',           icon: 'trash-outline',        action: 'delete',  color: colors.danger },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <Animated.View style={[styles.menuSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.menuHandle} />
          {items.map((item, i) => (
            <TouchableOpacity
              key={item.action}
              style={[styles.menuItem, i > 0 && styles.menuItemBorder]}
              onPress={() => { onAction(item.action); onClose(); }}
            >
              <Ionicons name={item.icon} size={20} color={item.color ?? colors.text} />
              <Text style={[styles.menuItemText, item.color ? { color: item.color } : {}]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder, { marginTop: 8 }]} onPress={onClose}>
            <Text style={[styles.menuItemText, { color: colors.textMuted, textAlign: 'center', flex: 1 }]}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'recipients' | 'message';

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ campaignId, sent, delivered, responses, conversions }: {
  campaignId: string; sent: number; delivered: number; responses: number; conversions: number;
}) {
  const detail = MOCK_CAMPAIGN_DETAILS[campaignId];
  return (
    <View style={{ gap: 14 }}>
      {detail?.timeSeries?.length > 0 && (
        <View style={styles.section}>
          <ResponseChart data={detail.timeSeries} />
        </View>
      )}
      {sent > 0 && (
        <ConversionFunnel
          sent={sent}
          delivered={delivered}
          responses={responses}
          conversions={conversions}
        />
      )}
      {detail?.activities?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={{ marginTop: 8, gap: 0 }}>
            {detail.activities.map((a, i) => (
              <ActivityItem key={a.id} item={a} index={i} />
            ))}
          </View>
        </View>
      )}
      {(!detail?.timeSeries?.length && !detail?.activities?.length && sent === 0) && (
        <RNAnimated.View entering={FadeIn.duration(300)} style={styles.emptyTab}>
          <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTabText}>No data yet — send the campaign first</Text>
        </RNAnimated.View>
      )}
    </View>
  );
}

// ── Recipients tab ────────────────────────────────────────────────────────────

type RecipientFilter = CampaignRecipient['status'] | 'all';

const RECIPIENT_FILTERS: { key: RecipientFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'responded', label: 'Responded' },
  { key: 'converted', label: 'Converted' },
  { key: 'failed',    label: 'Failed' },
];

function RecipientsTab({ campaignId }: { campaignId: string }) {
  const [filter, setFilter] = useState<RecipientFilter>('all');
  const detail = MOCK_CAMPAIGN_DETAILS[campaignId];
  const recipients = detail?.recipients ?? [];

  const filtered = filter === 'all' ? recipients : recipients.filter(r => r.status === filter);

  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {RECIPIENT_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.pill, filter === f.key && styles.pillActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <RNAnimated.View entering={FadeIn.duration(200)} style={styles.emptyTab}>
          <Ionicons name="people-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTabText}>
            {recipients.length === 0 ? 'No recipients yet' : 'No recipients match this filter'}
          </Text>
        </RNAnimated.View>
      ) : (
        <View style={styles.section}>
          {filtered.map((r, i) => (
            <RecipientRow key={r.id} item={r} index={i} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Message tab ───────────────────────────────────────────────────────────────

function MessageTab({ campaignId }: { campaignId: string }) {
  const [copied, setCopied] = useState(false);
  const detail = MOCK_CAMPAIGN_DETAILS[campaignId];
  const message = detail?.message ?? '';

  function handleDuplicate() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  if (!message) {
    return (
      <View style={styles.emptyTab}>
        <Ionicons name="chatbubble-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTabText}>No message content available</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <MessageBubble message={message} />
      <TouchableOpacity style={styles.duplicateBtn} onPress={handleDuplicate}>
        <Ionicons name="flash-outline" size={18} color={colors.primary} />
        <Text style={styles.duplicateBtnText}>
          {copied ? 'Added to Quick Replies ✓' : 'Duplicate as Template ⚡'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const campaign = MOCK_CAMPAIGNS.find(c => c.id === id);

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [localStatus, setLocalStatus] = useState<CampaignStatus | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const tabFade = useRef(new Animated.Value(1)).current;

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
  const status = localStatus ?? campaign.status;
  const statusMeta = CAMPAIGN_STATUS_META[status];

  const deliveryPct = campaign.total > 0 ? Math.round((campaign.sent / campaign.total) * 100) : 0;
  const deliveryRate = campaign.sent > 0 ? Math.round((campaign.delivered / campaign.sent) * 100) : 0;
  const responseRate = campaign.delivered > 0 ? Math.round((campaign.responses / campaign.delivered) * 100) : 0;
  const convRate = campaign.sent > 0 ? Math.round((campaign.conversions / campaign.sent) * 100) : 0;

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }

  function switchTab(tab: DetailTab) {
    if (tab === activeTab) return;
    Animated.timing(tabFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  function handleMenuAction(action: 'edit' | 'duplicate' | 'toggle_pause' | 'cancel' | 'delete') {
    if (action === 'edit') {
      showToast('Edit coming soon');
    } else if (action === 'duplicate') {
      showToast('Campaign duplicated');
    } else if (action === 'toggle_pause') {
      const next = status === 'paused' ? 'active' : 'paused';
      setLocalStatus(next);
      showToast(next === 'paused' ? 'Campaign paused' : 'Campaign resumed');
    } else if (action === 'cancel') {
      setLocalStatus('completed');
      showToast('Campaign cancelled');
    } else if (action === 'delete') {
      router.back();
    }
  }

  const showProgress = (status === 'active' || status === 'paused') && campaign.total > 0 && campaign.sent < campaign.total;

  function formatSchedule(): string | null {
    if (campaign.sent > 0) return `Sent ${relativeDate(campaign.created_at)}`;
    if (campaign.scheduled_at) {
      const d = new Date(campaign.scheduled_at);
      return `Scheduled: ${d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return null;
  }

  const scheduleStr = formatSchedule();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Toast */}
      <Toast message={toastMsg} visible={toastVisible} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{campaign.name}</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Summary card */}
        <RNAnimated.View entering={FadeInDown.springify()} style={styles.summaryCard}>
          <Text style={styles.campaignName}>{campaign.name}</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: typeMeta.color + '20' }]}>
              <Text style={[styles.badgeText, { color: typeMeta.color }]}>
                {typeMeta.emoji} {typeMeta.label}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.info + '20' }]}>
              <Text style={[styles.badgeText, { color: colors.info }]}>📱 SMS</Text>
            </View>
          </View>

          <View style={styles.summaryMeta}>
            {campaign.recipients > 0 && (
              <View style={styles.metaRow}>
                <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>👥 {campaign.recipients.toLocaleString()} recipients</Text>
              </View>
            )}
            {scheduleStr && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaText}>{scheduleStr}</Text>
              </View>
            )}
          </View>
        </RNAnimated.View>

        {/* Stats 2×2 grid */}
        <View style={styles.statsGrid}>
          <StatCard
            emoji="📤" label="Sent"
            value={campaign.sent}
            color={colors.info}
            index={0}
          />
          <StatCard
            emoji="✅" label="Delivered"
            value={campaign.delivered}
            rate={campaign.sent > 0 ? `${deliveryRate}% delivery` : undefined}
            color={colors.primary}
            index={1}
          />
          <StatCard
            emoji="💬" label="Responses"
            value={campaign.responses}
            rate={campaign.delivered > 0 ? `${responseRate}% response rate` : undefined}
            color="#B3E84C"
            index={2}
          />
          <StatCard
            emoji="🎯" label="Conversions"
            value={campaign.conversions}
            rate={campaign.sent > 0 ? `${convRate}% conversion` : undefined}
            color={colors.warning}
            index={3}
          />
        </View>

        {/* Delivery progress bar */}
        {showProgress && (
          <RNAnimated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>
                {deliveryPct === 100 ? 'Completed' : `Sending... ${campaign.sent.toLocaleString()} / ${campaign.total.toLocaleString()}`}
              </Text>
              <Text style={[styles.progressPct, { color: colors.info }]}>{deliveryPct}%</Text>
            </View>
            <AnimatedProgressBar pct={deliveryPct} color={colors.info} delay={300} />
          </RNAnimated.View>
        )}

        {/* Tab bar */}
        <RNAnimated.View entering={FadeInDown.delay(240).springify()} style={styles.tabBar}>
          {(['overview', 'recipients', 'message'] as DetailTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => switchTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              {activeTab === tab && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </RNAnimated.View>

        {/* Tab content */}
        <Animated.View style={{ opacity: tabFade }}>
          {activeTab === 'overview' && (
            <OverviewTab
              campaignId={campaign.id}
              sent={campaign.sent}
              delivered={campaign.delivered}
              responses={campaign.responses}
              conversions={campaign.conversions}
            />
          )}
          {activeTab === 'recipients' && <RecipientsTab campaignId={campaign.id} />}
          {activeTab === 'message' && <MessageTab campaignId={campaign.id} />}
        </Animated.View>
      </ScrollView>

      {/* Three-dot menu */}
      <ThreeDotsMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onAction={handleMenuAction}
        isPaused={status === 'paused'}
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
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  menuBtn: {
    width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },

  scroll: { paddingHorizontal: spacing.md, gap: 14, paddingTop: 4 },

  // Summary card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 12,
  },
  campaignName: { fontSize: 22, fontWeight: '800', color: colors.text, lineHeight: 28 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  badgeText: { fontSize: 12, fontWeight: '700' },
  summaryMeta: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

  // Stats 2×2 grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    padding: 14,
    gap: 3,
  },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  statRate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Sections
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Progress bar
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPct: { fontSize: 14, fontWeight: '700' },
  track: { height: 7, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabItemActive: { backgroundColor: colors.primary + '12' },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8, right: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  // Chart
  chart: { gap: 0 },
  chartLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },

  // Funnel
  funnelStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },
  funnelLabel: { fontSize: 14, fontWeight: '700' },
  funnelPct: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  funnelValue: { fontSize: 22, fontWeight: '800' },
  funnelArrow: { alignItems: 'center', paddingVertical: 4 },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityAvatar: {
    width: 36, height: 36, borderRadius: radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  activityInitials: { fontSize: 12, fontWeight: '700' },
  activityText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  activityTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // Recipients
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recipientAvatar: {
    width: 36, height: 36, borderRadius: radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  recipientInitials: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  recipientName: { fontSize: 14, fontWeight: '600', color: colors.text },
  recipientTime: { fontSize: 11, color: colors.textMuted },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center',
    gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full,
  },
  statusChipTxt: { fontSize: 10, fontWeight: '700' },

  // Filter pills
  pill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  pillTextActive: { color: colors.primary },

  // Message bubble
  phoneWrap: { alignItems: 'center', paddingVertical: 8 },
  phoneMock: {
    width: 260,
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  phoneNotch: {
    width: 60, height: 5, borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  phoneScreen: { gap: 10 },
  phoneHeader: { fontSize: 11, color: colors.textMuted, textAlign: 'center', fontWeight: '600' },
  bubble: {
    backgroundColor: colors.primary + '25',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  bubbleText: { fontSize: 13, color: colors.text, lineHeight: 19 },

  // Duplicate button
  duplicateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  duplicateBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  // Toast
  toast: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: colors.text },

  // Three-dot menu
  menuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  menuSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    padding: spacing.md,
    paddingBottom: 32,
    gap: 0,
  },
  menuHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuItemText: { fontSize: 15, fontWeight: '600', color: colors.text },

  // Empty states
  emptyTab: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTabText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  // Not found
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: colors.textMuted },
});
