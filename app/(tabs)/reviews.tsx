import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform as RNPlatform,
  LayoutAnimation,
  UIManager,
  Share,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import { useReviewsContext } from '@/context/ReviewsContext';
import { RequestReviewModal } from '@/components/RequestReviewModal';
import type { MockReview } from '@/lib/mockReviews';

// ─── Constants ───────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#4C9FFF', '#A855F7', '#F97316', '#33D169', '#FF4C4C', '#FFD24C', '#EC4899'];
const BAR_COLORS = ['#33D169', '#6BCB47', '#FFB347', '#FF8C47', '#FF4C4C']; // 5→1 stars

type PlatformFilter = 'all' | 'google' | 'facebook';
type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest' | 'needs_response';

const SORT_OPTIONS: { key: string | number; label: string }[] = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'highest', label: 'Highest Rated' },
  { key: 'lowest', label: 'Lowest Rated' },
  { key: 'needs_response', label: 'Needs Response' },
];

const STAR_OPTIONS: { key: string | number; label: string }[] = [
  { key: 0, label: 'All Stars' },
  { key: 5, label: '5 Stars' },
  { key: 4, label: '4 Stars' },
  { key: 3, label: '3 Stars' },
  { key: 2, label: '2 Stars' },
  { key: 1, label: '1 Star' },
];

const TEMPLATES = [
  {
    label: 'Thank You — Positive',
    text: "Thank you so much for the kind words, [Name]! We're thrilled to have you as part of our gym family. See you on the floor! 💪",
  },
  {
    label: 'Thank You — General',
    text: "Thanks for taking the time to leave a review, [Name]! Your feedback means a lot to us.",
  },
  {
    label: 'Apology — Negative',
    text: "Hi [Name], we're sorry to hear about your experience. This is not the standard we hold ourselves to. Please contact us directly at [Phone] so we can make it right.",
  },
  {
    label: 'Invitation to Return',
    text: "Hi [Name], thank you for the feedback! We'd love another chance to impress you. Pop in anytime and ask for the manager — we'll take good care of you.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Enable LayoutAnimation on Android
if (RNPlatform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────

function ProgressRing({
  pct,
  color,
  size = 80,
  thickness = 9,
}: {
  pct: number;
  color: string;
  size?: number;
  thickness?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 1200, useNativeDriver: true }).start();
  }, []);

  // Right half sweeps 0 → 50%: disc rotates from –180° to 0°
  const rightRot = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '0deg', '0deg'],
    extrapolate: 'clamp',
  });

  // Left half sweeps 50% → 100%: disc rotates from –180° to 0°
  const leftRot = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-180deg', '-180deg', '0deg'],
    extrapolate: 'clamp',
  });

  const half = size / 2;
  const innerSize = size - thickness * 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View
        style={{
          position: 'absolute', width: size, height: size,
          borderRadius: half, backgroundColor: colors.border,
        }}
      />

      {/* Right fill — clip to right side */}
      <View style={{ position: 'absolute', right: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View
          style={{
            position: 'absolute', right: 0,
            width: size, height: size, borderRadius: half,
            backgroundColor: color,
            transform: [{ rotate: rightRot }],
          }}
        />
      </View>

      {/* Left fill — clip to left side */}
      <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View
          style={{
            position: 'absolute', left: 0,
            width: size, height: size, borderRadius: half,
            backgroundColor: color,
            transform: [{ rotate: leftRot }],
          }}
        />
      </View>

      {/* Inner hole */}
      <View
        style={{
          position: 'absolute',
          top: thickness, left: thickness,
          width: innerSize, height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: colors.surface,
          justifyContent: 'center', alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 20 }}>
          {Math.round(pct * 100)}%
        </Text>
      </View>
    </View>
  );
}

// ─── TrendChart ──────────────────────────────────────────────────────────────

const TREND_MAX_H = 52;

function TrendChart({ reviews }: { reviews: MockReview[] }) {
  const now = Date.now();

  // Build W1–W4 counts (W4 = most recent week)
  const weekCounts = [3, 2, 1, 0].map(weeksAgo => {
    const end = now - weeksAgo * 7 * 86_400_000;
    const start = end - 7 * 86_400_000;
    return reviews.filter(r => {
      const t = new Date(r.created_at).getTime();
      return t >= start && t < end;
    }).length;
  });

  const thisMonth = reviews.filter(
    r => now - new Date(r.created_at).getTime() < 30 * 86_400_000
  ).length;
  const lastMonth = reviews.filter(r => {
    const age = now - new Date(r.created_at).getTime();
    return age >= 30 * 86_400_000 && age < 60 * 86_400_000;
  }).length;
  const changePct =
    lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;
  const positive = changePct >= 0;

  const maxCount = Math.max(...weekCounts, 1);
  const barAnims = useRef(weekCounts.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      90,
      weekCounts.map((count, i) =>
        Animated.timing(barAnims[i], {
          toValue: count,
          duration: 600,
          useNativeDriver: false,
        })
      )
    ).start();
  }, []);

  return (
    <View style={s.trendWidget}>
      <View style={s.trendHeaderRow}>
        <Text style={s.trendLabel}>Reviews This Month</Text>
        {lastMonth > 0 && (
          <Text style={[s.trendChange, { color: positive ? colors.success : colors.danger }]}>
            {positive ? '+' : ''}{changePct}% vs last month
          </Text>
        )}
      </View>

      <View style={s.trendBarsRow}>
        {weekCounts.map((count, i) => (
          <View key={i} style={s.trendBarCol}>
            <View style={s.trendBarTrack}>
              <Animated.View
                style={[
                  s.trendBarFill,
                  {
                    height: barAnims[i].interpolate({
                      inputRange: [0, maxCount],
                      outputRange: [0, TREND_MAX_H],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            </View>
            <Text style={s.trendBarCount}>{count}</Text>
            <Text style={s.trendBarWeek}>W{i + 1}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── KeywordPills ─────────────────────────────────────────────────────────────

const KEYWORDS = [
  { text: 'great trainers', count: 18, positive: true },
  { text: 'clean facility', count: 14, positive: true },
  { text: 'friendly staff', count: 11, positive: true },
  { text: 'good equipment', count: 9, positive: true },
  { text: 'good value', count: 7, positive: true },
  { text: 'parking', count: 5, positive: false },
];

function KeywordPills() {
  return (
    <View style={s.keywordsWidget}>
      <Text style={s.keywordsLabel}>What Members Say</Text>
      <View style={s.keywordsPillRow}>
        {KEYWORDS.map((kw, i) => (
          <Reanimated.View key={i} entering={FadeInDown.delay(i * 50).springify()}>
            <View
              style={[
                s.keywordPill,
                kw.positive
                  ? { backgroundColor: colors.primary + '18', borderColor: colors.primary + '50' }
                  : { backgroundColor: colors.danger + '18', borderColor: colors.danger + '50' },
              ]}
            >
              <Text
                style={[
                  s.keywordPillText,
                  { color: kw.positive ? colors.primary : colors.danger },
                ]}
              >
                {kw.text} ({kw.count})
              </Text>
            </View>
          </Reanimated.View>
        ))}
      </View>
    </View>
  );
}

// ─── InsightsCard ─────────────────────────────────────────────────────────────

function InsightsCard({ reviews }: { reviews: MockReview[] }) {
  const [collapsed, setCollapsed] = useState(false);

  const replied = reviews.filter(r => r.replied).length;
  const total = reviews.length;
  const pct = total > 0 ? replied / total : 0;
  const ringColor =
    pct >= 0.8 ? colors.success : pct >= 0.6 ? colors.warning : colors.danger;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(c => !c);
  }

  return (
    <Reanimated.View entering={FadeInDown.delay(160).springify()} style={s.insightsCard}>
      {/* Header */}
      <TouchableOpacity style={s.insightsHeader} onPress={toggle} activeOpacity={0.7}>
        <Ionicons name="bar-chart-outline" size={15} color={colors.primary} />
        <Text style={s.insightsTitle}>Insights</Text>
        <View style={{ flex: 1 }} />
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {!collapsed && (
        <View>
          <View style={s.insightsDivider} />

          {/* Response Rate widget */}
          <View style={s.responseRateWidget}>
            <ProgressRing pct={pct} color={ringColor} />
            <View style={s.responseRateInfo}>
              <Text style={s.responseRateLabel}>Response Rate</Text>
              <Text style={s.responseRateSub}>
                {replied} of {total} reviews answered
              </Text>
              <View
                style={[
                  s.responseRateBadge,
                  { backgroundColor: ringColor + '20', borderColor: ringColor + '50' },
                ]}
              >
                <Text style={[s.responseRateBadgeText, { color: ringColor }]}>
                  {pct >= 0.8 ? 'Great' : pct >= 0.6 ? 'Good' : 'Needs work'}
                </Text>
              </View>
            </View>
          </View>

          {/* Review Trend */}
          <View style={s.insightsDivider} />
          <TrendChart reviews={reviews} />

          {/* Keyword Pills */}
          <View style={s.insightsDivider} />
          <KeywordPills />
        </View>
      )}
    </Reanimated.View>
  );
}

// ─── StarRow ─────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={size}
          color={colors.accent}
        />
      ))}
    </View>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ visible, message }: { visible: boolean; message: string }) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : -80,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.toast, { top: insets.top + 14, transform: [{ translateY: slideAnim }] }]}
    >
      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
      <Text style={s.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── RatingSummaryCard ────────────────────────────────────────────────────────

function RatingSummaryCard({ reviews }: { reviews: MockReview[] }) {
  const total = reviews.length;
  const avg = total > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

  const animAvg = useRef(new Animated.Value(0)).current;
  const [displayAvg, setDisplayAvg] = useState('0.0');
  const barAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const listener = animAvg.addListener(({ value }) => setDisplayAvg(value.toFixed(1)));

    Animated.timing(animAvg, {
      toValue: avg,
      duration: 1100,
      useNativeDriver: false,
    }).start();

    Animated.stagger(
      90,
      [5, 4, 3, 2, 1].map((star, i) => {
        const count = reviews.filter(r => r.rating === star).length;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return Animated.timing(barAnims[i], {
          toValue: pct,
          duration: 750,
          useNativeDriver: false,
        });
      })
    ).start();

    return () => animAvg.removeListener(listener);
  }, []);

  return (
    <Reanimated.View entering={FadeInDown.delay(80).springify()} style={s.summaryCard}>
      {/* Left: big average + stars + total */}
      <View style={s.summaryLeft}>
        <Text style={s.avgNum}>{displayAvg}</Text>
        <StarRow rating={Math.round(avg)} size={16} />
        <Text style={s.avgSub}>
          {total} review{total !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={s.vDivider} />

      {/* Right: bars 5→1 */}
      <View style={s.barsSection}>
        {[5, 4, 3, 2, 1].map((star, i) => {
          const count = reviews.filter(r => r.rating === star).length;
          return (
            <View key={star} style={s.barRow}>
              <Text style={s.barLabel}>{star}★</Text>
              <View style={s.barTrack}>
                <Animated.View
                  style={[
                    s.barFill,
                    {
                      backgroundColor: BAR_COLORS[i],
                      width: barAnims[i].interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={s.barCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </Reanimated.View>
  );
}

// ─── Dropdown ────────────────────────────────────────────────────────────────

function Dropdown({
  options,
  selected,
  onSelect,
}: {
  options: { key: string | number; label: string }[];
  selected: string | number;
  onSelect: (key: string | number) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = options.find(o => o.key === selected)?.label ?? '';

  return (
    <View>
      <TouchableOpacity style={s.dropBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={s.dropBtnText} numberOfLines={1}>
          {currentLabel}
        </Text>
        <Ionicons name="chevron-down" size={11} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={s.dropOverlay} onPress={() => setOpen(false)}>
          <View style={s.dropList}>
            {options.map(opt => (
              <TouchableOpacity
                key={String(opt.key)}
                style={[s.dropOption, opt.key === selected && s.dropOptionActive]}
                onPress={() => {
                  onSelect(opt.key);
                  setOpen(false);
                }}
              >
                <Text
                  style={[s.dropOptionText, opt.key === selected && s.dropOptionTextActive]}
                >
                  {opt.label}
                </Text>
                {opt.key === selected && (
                  <Ionicons name="checkmark" size={14} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── ReviewCard ──────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  index,
  onReply,
}: {
  review: MockReview;
  index: number;
  onReply: (r: MockReview) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.content.length > 140;
  const displayText =
    expanded || !isLong ? review.content : review.content.slice(0, 140).trimEnd() + '…';

  return (
    <Reanimated.View entering={FadeInDown.delay(index * 55).springify()} style={s.card}>
      {/* Top row */}
      <View style={s.cardTop}>
        <View style={[s.avatar, { backgroundColor: getAvatarColor(review.reviewer_name) }]}>
          <Text style={s.avatarText}>{getInitials(review.reviewer_name)}</Text>
          <View
            style={[
              s.platformBadge,
              review.platform === 'google' ? s.googleBadge : s.fbBadge,
            ]}
          >
            <Text style={s.platformBadgeText}>{review.platform === 'google' ? 'G' : 'f'}</Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.reviewerName}>{review.reviewer_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <StarRow rating={review.rating} size={12} />
            <Text style={s.reviewTime}>{relativeTime(review.created_at)}</Text>
          </View>
        </View>

        {review.resolved ? (
          <View style={s.resolvedBadge}>
            <Text style={s.resolvedBadgeText}>Resolved ✓</Text>
          </View>
        ) : !review.replied ? (
          <View style={s.needsReplyBadge}>
            <Text style={s.needsReplyText}>Needs reply</Text>
          </View>
        ) : null}
      </View>

      {/* Content */}
      <Text style={s.reviewContent}>{displayText}</Text>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)} style={{ marginTop: 5 }}>
          <Text style={s.readMore}>{expanded ? 'Show less' : 'Read more'}</Text>
        </TouchableOpacity>
      )}

      {/* Reply section */}
      {review.replied && review.reply_text ? (
        <View style={s.replyCard}>
          <View style={s.replyCardHeader}>
            <Ionicons name="return-down-forward-outline" size={13} color={colors.primary} />
            <Text style={s.replyCardLabel}>Your response</Text>
          </View>
          <Text style={s.replyCardText} numberOfLines={4}>
            {review.reply_text}
          </Text>
          <TouchableOpacity onPress={() => onReply(review)} style={{ marginTop: 6 }}>
            <Text style={s.editReplyLink}>Edit Response</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.replyBtn} onPress={() => onReply(review)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.primary} />
          <Text style={s.replyBtnText}>Reply</Text>
        </TouchableOpacity>
      )}
    </Reanimated.View>
  );
}

// ─── ReplySheet ───────────────────────────────────────────────────────────────

function ReplySheet({
  review,
  onClose,
  onSubmit,
  onSuccess,
}: {
  review: MockReview | null;
  onClose: () => void;
  onSubmit: (id: string, text: string, resolved: boolean) => void;
  onSuccess: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(700)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [localReview, setLocalReview] = useState<MockReview | null>(null);
  const [text, setText] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [markResolved, setMarkResolved] = useState(false);

  useEffect(() => {
    if (review) {
      setLocalReview(review);
      setText(review.reply_text ?? '');
      setMarkResolved(review.resolved ?? false);
      setTemplateOpen(false);
      setVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 700, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setVisible(false);
        setLocalReview(null);
      });
    }
  }, [review]);

  function handleSubmit() {
    if (!localReview || !text.trim()) return;
    onSubmit(localReview.id, text.trim(), markResolved);
    onSuccess();
    onClose();
  }

  function applyTemplate(tmpl: string) {
    if (!localReview) return;
    const firstName = localReview.reviewer_name.split(' ')[0];
    setText(tmpl.replace(/\[Name\]/g, firstName));
    setTemplateOpen(false);
  }

  const charColor =
    text.length >= 490 ? colors.danger : text.length >= 400 ? colors.warning : colors.textMuted;
  const isEdit = localReview?.replied ?? false;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={RNPlatform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropAnim }]}
          pointerEvents={review ? 'auto' : 'none'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={s.handle} />

          {/* Header */}
          <View style={s.sheetHeaderRow}>
            <Text style={s.sheetTitle}>{isEdit ? 'Edit Response' : 'Reply to Review'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Reviewer summary */}
            {localReview && (
              <>
                <View style={s.reviewerSummary}>
                  <View
                    style={[
                      s.summaryAvatar,
                      { backgroundColor: getAvatarColor(localReview.reviewer_name) },
                    ]}
                  >
                    <Text style={s.avatarText}>{getInitials(localReview.reviewer_name)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.reviewerName}>{localReview.reviewer_name}</Text>
                    <StarRow rating={localReview.rating} size={12} />
                    <Text style={s.snippetLine} numberOfLines={1}>
                      {localReview.content}
                    </Text>
                  </View>
                </View>
                <View style={s.sheetDivider} />
              </>
            )}

            {/* Template picker */}
            <TouchableOpacity
              style={s.templateToggle}
              onPress={() => setTemplateOpen(o => !o)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.primary} />
              <Text style={s.templateToggleText}>Use a template</Text>
              <Ionicons
                name={templateOpen ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={colors.primary}
              />
            </TouchableOpacity>

            {templateOpen && (
              <View style={s.templateList}>
                {TEMPLATES.map((tmpl, i) => (
                  <Reanimated.View key={i} entering={FadeInDown.delay(i * 60).springify()}>
                    <TouchableOpacity
                      style={[s.templateRow, i < TEMPLATES.length - 1 && s.templateRowBorder]}
                      onPress={() => applyTemplate(tmpl.text)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.templateLabel}>{tmpl.label}</Text>
                      <Text style={s.templatePreview} numberOfLines={1}>
                        {tmpl.text.replace(
                          /\[Name\]/g,
                          localReview?.reviewer_name.split(' ')[0] ?? 'there'
                        )}
                      </Text>
                    </TouchableOpacity>
                  </Reanimated.View>
                ))}
              </View>
            )}

            <View style={[s.sheetDivider, { marginTop: 12 }]} />

            {/* Textarea */}
            <TextInput
              style={s.replyInput}
              placeholder="Write your response..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={text}
              onChangeText={setText}
              maxLength={500}
            />
            <Text style={[s.charCount, { color: charColor }]}>{text.length} / 500</Text>

            <View style={s.sheetDivider} />

            {/* Mark as resolved */}
            <View style={s.resolvedToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Mark as Resolved</Text>
                <Text style={s.toggleSub}>Adds a badge to this review</Text>
              </View>
              <Switch
                value={markResolved}
                onValueChange={setMarkResolved}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={markResolved ? colors.primary : colors.textMuted}
              />
            </View>

            <View style={s.sheetDivider} />

            {/* Buttons */}
            <View style={s.sheetBtns}>
              <TouchableOpacity
                style={[s.postBtn, !text.trim() && { opacity: 0.4 }]}
                onPress={handleSubmit}
                disabled={!text.trim()}
              >
                <Text style={s.postBtnText}>
                  {isEdit ? 'Update Response' : 'Post Response'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelTextBtn} onPress={onClose}>
                <Text style={s.cancelTextBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ReviewSettingsSheet ─────────────────────────────────────────────────────

function ReviewSettingsSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [googleLink, setGoogleLink] = useState('');
  const [facebookLink, setFacebookLink] = useState('');

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={RNPlatform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropAnim }]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={s.handle} />

          <View style={s.sheetHeaderRow}>
            <Text style={s.sheetTitle}>Review Settings</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.settingsFieldLabel}>Google Review Link</Text>
            <TextInput
              style={s.settingsInput}
              placeholder="https://g.page/r/your-gym/review"
              placeholderTextColor={colors.textMuted}
              value={googleLink}
              onChangeText={setGoogleLink}
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={s.sheetDivider} />

            <Text style={s.settingsFieldLabel}>Facebook Review Link</Text>
            <TextInput
              style={s.settingsInput}
              placeholder="https://facebook.com/your-page/reviews"
              placeholderTextColor={colors.textMuted}
              value={facebookLink}
              onChangeText={setFacebookLink}
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={s.sheetDivider} />

            {/* Auto-request — coming soon */}
            <View style={[s.resolvedToggleRow, { opacity: 0.5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Auto-request Reviews</Text>
                <Text style={s.toggleSub}>
                  Send after a member's 5th visit{'  '}
                  <Text style={{ color: colors.warning }}>Coming soon</Text>
                </Text>
              </View>
              <Switch
                value={false}
                onValueChange={() => {}}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={colors.textMuted}
                disabled
              />
            </View>

            <View style={s.sheetDivider} />

            <TouchableOpacity
              style={s.postBtn}
              onPress={() => { onSaved(); onClose(); }}
            >
              <Text style={s.postBtnText}>Save Settings</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── QuickActionsRow ─────────────────────────────────────────────────────────

function QuickActionsRow({
  reviews,
  onExport,
  onSettings,
}: {
  reviews: MockReview[];
  onExport: () => void;
  onSettings: () => void;
}) {
  async function handleShare() {
    if (reviews.length === 0) return;
    const best = reviews.reduce((a, b) => (a.rating >= b.rating ? a : b));
    try {
      await Share.share({
        message:
          `"${best.content}"\n\n— ${best.reviewer_name}, ${'⭐'.repeat(best.rating)}\n\nLeave us a review too!`,
      });
    } catch (_) {}
  }

  const ACTIONS = [
    { icon: 'share-outline' as const,    label: 'Share Best\nReview',   onPress: handleShare },
    { icon: 'bar-chart-outline' as const, label: 'Export\nReviews',     onPress: onExport },
    { icon: 'settings-outline' as const, label: 'Review\nSettings',    onPress: onSettings },
  ];

  return (
    <Reanimated.View entering={FadeInDown.delay(200).springify()} style={s.quickActionsRow}>
      {ACTIONS.map((action, i) => (
        <TouchableOpacity
          key={i}
          style={s.quickActionBtn}
          onPress={action.onPress}
          activeOpacity={0.7}
        >
          <View style={s.quickActionIcon}>
            <Ionicons name={action.icon} size={18} color={colors.primary} />
          </View>
          <Text style={s.quickActionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </Reanimated.View>
  );
}

// ─── ReviewsScreen ────────────────────────────────────────────────────────────

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const { reviews, replyToReview } = useReviewsContext();

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [starFilter, setStarFilter] = useState<string | number>(0);
  const [sortBy, setSortBy] = useState<string | number>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [needsResponse, setNeedsResponse] = useState(false);
  const [hideResolved, setHideResolved] = useState(false);
  const [replyTarget, setReplyTarget] = useState<MockReview | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Response posted');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [requestVisible, setRequestVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  function showToast(msg = 'Response posted') {
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  const unansweredCount = reviews.filter(r => !r.replied).length;

  function clearAllFilters() {
    setPlatformFilter('all');
    setStarFilter(0);
    setSortBy('newest');
    setSearchQuery('');
    setNeedsResponse(false);
    setHideResolved(false);
  }

  const hasActiveFilters =
    platformFilter !== 'all' ||
    starFilter !== 0 ||
    searchQuery.trim().length > 0 ||
    needsResponse ||
    hideResolved;

  const emptyInfo = useMemo(() => {
    // Special case: needsResponse is on but there are genuinely zero unanswered reviews
    if (needsResponse && reviews.filter(r => !r.replied).length === 0) {
      return {
        icon: 'checkmark-circle-outline' as const,
        color: colors.success,
        title: 'All caught up!',
        subtitle: 'Every review has been replied to.',
      };
    }
    const parts: string[] = [];
    if (searchQuery.trim()) parts.push(`matching "${searchQuery.trim()}"`);
    if (platformFilter !== 'all')
      parts.push(`on ${platformFilter.charAt(0).toUpperCase() + platformFilter.slice(1)}`);
    if (starFilter !== 0) parts.push(`rated ${starFilter}★`);
    if (needsResponse) parts.push('needing a response');
    if (hideResolved) parts.push('excluding resolved');
    return {
      icon: (searchQuery.trim() ? 'search-outline' : 'filter-outline') as
        | 'search-outline'
        | 'filter-outline',
      color: colors.textMuted,
      title: 'No reviews found',
      subtitle: parts.length > 0 ? parts.join(' · ') : 'Try adjusting your filters',
    };
  }, [reviews, searchQuery, platformFilter, starFilter, needsResponse, hideResolved]);

  // Counts per platform respecting star + search (not platform) for pill labels
  const platformCounts = useMemo(() => {
    let base = reviews;
    if (starFilter !== 0) base = base.filter(r => r.rating === Number(starFilter));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter(
        r =>
          r.reviewer_name.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q)
      );
    }
    return {
      all: base.length,
      google: base.filter(r => r.platform === 'google').length,
      facebook: base.filter(r => r.platform === 'facebook').length,
    };
  }, [reviews, starFilter, searchQuery]);

  const filtered = useMemo(() => {
    let result = reviews;
    if (platformFilter !== 'all') result = result.filter(r => r.platform === platformFilter);
    if (starFilter !== 0) result = result.filter(r => r.rating === Number(starFilter));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        r =>
          r.reviewer_name.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q)
      );
    }
    if (needsResponse) result = result.filter(r => !r.replied);
    if (hideResolved) result = result.filter(r => !r.resolved);

    const sorted = [...result];
    switch (sortBy) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'highest':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        sorted.sort((a, b) => a.rating - b.rating);
        break;
      case 'needs_response':
        sorted.sort((a, b) => (a.replied ? 1 : 0) - (b.replied ? 1 : 0));
        break;
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sorted;
  }, [reviews, platformFilter, starFilter, sortBy, searchQuery, needsResponse, hideResolved]);

  return (
    <View style={s.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={s.title}>Reviews</Text>
            <Text style={s.subtitle}>
              {reviews.length} total · {unansweredCount} need a reply
            </Text>
          </View>
          <TouchableOpacity
            style={s.requestBtn}
            onPress={() => setRequestVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="star-outline" size={14} color="#0F1923" />
            <Text style={s.requestBtnText}>Request</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary card ── */}
        <RatingSummaryCard reviews={reviews} />

        {/* ── Insights card ── */}
        <InsightsCard reviews={reviews} />

        {/* ── Quick actions ── */}
        <QuickActionsRow
          reviews={reviews}
          onExport={() => showToast('Export feature coming soon')}
          onSettings={() => setSettingsVisible(true)}
        />

        {/* ── Search bar ── */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or review text…"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Filter row ── */}
        <View style={s.filterSection}>
          {/* Platform pills */}
          <View style={s.platformRow}>
            {(['all', 'google', 'facebook'] as PlatformFilter[]).map(p => {
              const count = platformCounts[p as keyof typeof platformCounts];
              const label =
                p === 'all'
                  ? `All (${count})`
                  : `${p.charAt(0).toUpperCase() + p.slice(1)} (${count})`;
              return (
                <TouchableOpacity
                  key={p}
                  style={[s.pill, platformFilter === p && s.pillActive]}
                  onPress={() => setPlatformFilter(p as PlatformFilter)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.pillText, platformFilter === p && s.pillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dropdowns row */}
          <View style={s.dropdownRow}>
            <Dropdown
              options={STAR_OPTIONS}
              selected={starFilter}
              onSelect={setStarFilter}
            />
            <Dropdown
              options={SORT_OPTIONS}
              selected={sortBy}
              onSelect={setSortBy}
            />
          </View>
        </View>

        {/* ── Toggle filters ── */}
        <View style={s.toggleFilters}>
          <TouchableOpacity
            style={[s.togglePill, needsResponse && s.togglePillActive]}
            onPress={() => setNeedsResponse(v => !v)}
            activeOpacity={0.7}
          >
            <View
              style={[
                s.toggleDot,
                { backgroundColor: needsResponse ? '#FF8C00' : colors.textMuted },
              ]}
            />
            <Text style={[s.togglePillText, needsResponse && s.togglePillTextActive]}>
              Needs Response
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.togglePill, hideResolved && s.togglePillActive]}
            onPress={() => setHideResolved(v => !v)}
            activeOpacity={0.7}
          >
            <View
              style={[
                s.toggleDot,
                { backgroundColor: hideResolved ? colors.primary : colors.textMuted },
              ]}
            />
            <Text style={[s.togglePillText, hideResolved && s.togglePillTextActive]}>
              Hide Resolved
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Results count ── */}
        <Text style={s.resultsCount}>
          {filtered.length} review{filtered.length !== 1 ? 's' : ''}
        </Text>

        {/* ── Review cards ── */}
        {filtered.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name={emptyInfo.icon} size={44} color={emptyInfo.color} />
            <Text style={[s.emptyText, { color: emptyInfo.color }]}>{emptyInfo.title}</Text>
            <Text style={s.emptySubtext}>{emptyInfo.subtitle}</Text>
            {hasActiveFilters && emptyInfo.title !== 'All caught up!' && (
              <TouchableOpacity onPress={clearAllFilters} style={{ marginTop: 4 }}>
                <Text style={s.clearFilters}>Clear all filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map((review, index) => (
            <ReviewCard
              key={review.id}
              review={review}
              index={index}
              onReply={setReplyTarget}
            />
          ))
        )}
      </ScrollView>

      <Toast visible={toastVisible} message={toastMessage} />
      <ReviewSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onSaved={() => showToast('Settings saved')}
      />
      <RequestReviewModal
        visible={requestVisible}
        onClose={() => setRequestVisible(false)}
        onSent={(count) => {
          setRequestVisible(false);
          showToast(`Request sent to ${count} member${count !== 1 ? 's' : ''}`);
        }}
      />
      <ReplySheet
        review={replyTarget}
        onClose={() => setReplyTarget(null)}
        onSubmit={(id, text, resolved) => replyToReview(id, text, resolved)}
        onSuccess={showToast}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 48 },

  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  requestBtnText: { fontSize: 12, fontWeight: '700', color: '#0F1923' },

  // Summary card
  summaryCard: {
    marginHorizontal: spacing.md,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLeft: { width: 84, alignItems: 'center', gap: 6 },
  avgNum: { fontSize: 46, fontWeight: '800', color: colors.text, lineHeight: 50 },
  avgSub: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  vDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  barsSection: { flex: 1, gap: 7 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontSize: 11, color: colors.textSecondary, width: 22, textAlign: 'right' },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  barCount: { fontSize: 11, color: colors.textMuted, width: 18, textAlign: 'right' },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },

  // Filters
  filterSection: { paddingHorizontal: spacing.md, gap: 10, marginBottom: 6 },
  platformRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#0F1923' },

  dropdownRow: { flexDirection: 'row', gap: 8 },
  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 140,
  },
  dropBtnText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, flex: 1 },
  dropOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dropList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 210,
    overflow: 'hidden',
  },
  dropOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropOptionActive: { backgroundColor: colors.primary + '18' },
  dropOptionText: { fontSize: 14, color: colors.text },
  dropOptionTextActive: { color: colors.primary, fontWeight: '600' },

  // Toggle filter pills
  toggleFilters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  togglePillActive: {
    borderColor: colors.primary + '80',
    backgroundColor: colors.primary + '12',
  },
  toggleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  togglePillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  togglePillTextActive: { color: colors.text },

  resultsCount: {
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    fontSize: 12,
    color: colors.textMuted,
  },

  // Review cards
  card: {
    marginHorizontal: spacing.md,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  platformBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  googleBadge: { backgroundColor: '#4285F4' },
  fbBadge: { backgroundColor: '#1877F2' },
  platformBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  reviewerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  reviewTime: { fontSize: 11, color: colors.textMuted },

  needsReplyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: '#FF8C0020',
    borderWidth: 1,
    borderColor: '#FF8C0060',
  },
  needsReplyText: { fontSize: 10, fontWeight: '600', color: '#FF8C00' },

  reviewContent: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  readMore: { fontSize: 12, fontWeight: '600', color: colors.primary },

  replyCard: {
    marginTop: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: 10,
  },
  replyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  replyCardLabel: { fontSize: 11, fontWeight: '600', color: colors.primary },
  replyCardText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  editReplyLink: { fontSize: 12, fontWeight: '600', color: colors.primary },

  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  replyBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  // Toast
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    zIndex: 999,
    elevation: 8,
  },
  toastText: { fontSize: 14, fontWeight: '600', color: colors.text },

  // Reply sheet
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },

  // Reviewer summary in sheet
  reviewerSummary: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  summaryAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snippetLine: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  // Template picker
  templateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  templateToggleText: { fontSize: 13, fontWeight: '600', color: colors.primary, flex: 1 },
  templateList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    overflow: 'hidden',
  },
  templateRow: { paddingHorizontal: 14, paddingVertical: 11 },
  templateRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  templateLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
  templatePreview: { fontSize: 12, color: colors.textMuted },

  replyInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },

  // Mark as resolved
  resolvedToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  toggleSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  // Resolved badge on card
  resolvedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.textMuted + '20',
    borderWidth: 1,
    borderColor: colors.textMuted + '40',
  },
  resolvedBadgeText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },

  sheetBtns: { flexDirection: 'column', gap: 0, marginTop: 4 },
  postBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  postBtnText: { fontSize: 15, fontWeight: '700', color: '#0F1923' },
  cancelTextBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelTextBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  clearFilters: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 4 },

  // Insights card
  insightsCard: {
    marginHorizontal: spacing.md,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 14,
  },
  insightsTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  insightsDivider: { height: 1, backgroundColor: colors.border },

  // Response rate widget
  responseRateWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 14,
  },
  responseRateInfo: { flex: 1, gap: 4 },
  responseRateLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  responseRateSub: { fontSize: 12, color: colors.textMuted },
  responseRateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: 4,
  },
  responseRateBadgeText: { fontSize: 11, fontWeight: '700' },

  // Trend chart
  trendWidget: { paddingHorizontal: 14, paddingVertical: 12 },
  trendHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  trendChange: { fontSize: 12, fontWeight: '600' },
  trendBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'space-around',
  },
  trendBarCol: { flex: 1, alignItems: 'center', gap: 3 },
  trendBarTrack: {
    width: '80%',
    height: TREND_MAX_H,
    justifyContent: 'flex-end',
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  trendBarCount: { fontSize: 11, fontWeight: '700', color: colors.text },
  trendBarWeek: { fontSize: 10, color: colors.textMuted },

  // Keyword pills
  keywordsWidget: { paddingHorizontal: 14, paddingVertical: 12 },
  keywordsLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 },
  keywordsPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keywordPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  keywordPillText: { fontSize: 12, fontWeight: '600' },

  // Quick actions row
  quickActionsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: 14,
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 7,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Settings sheet
  settingsFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  settingsInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
});
