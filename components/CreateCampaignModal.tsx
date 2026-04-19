import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import type { LeadStage, LeadSource, LeadInterest } from '@/lib/theme';
import {
  CAMPAIGN_TYPE_META,
  CAMPAIGN_STATUS_META,
  type MockCampaign,
  type CampaignType,
} from '@/lib/mockCampaigns';
import { useMembersContext } from '@/context/MembersContext';
import { useLeadsContext } from '@/context/LeadsContext';
import { useMessagesContext } from '@/context/MessagesContext';
import type { Member } from '@/context/MembersContext';
import type { AppLead } from '@/context/LeadsContext';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type AudienceType = 'members' | 'leads' | 'both' | 'custom';
type MemberStatusFilter = 'all_active' | 'expiring_soon' | 'expired' | 'frozen';
type MemberPlanFilter = 'all' | 'monthly' | 'annual' | 'pay_per_class';
type LastVisitFilter = 'any' | 'within_7' | '8_to_30' | '30_plus';
type SendTiming = 'now' | 'scheduled' | 'recurring';

type FollowUpStep = { delay: string; text: string };

interface WizardState {
  campaignType: CampaignType | null;
  audienceType: AudienceType;
  memberStatus: MemberStatusFilter;
  memberPlan: MemberPlanFilter;
  lastVisit: LastVisitFilter;
  trainer: string;
  leadStage: LeadStage | 'all';
  leadSource: LeadSource | 'all';
  leadInterest: LeadInterest | 'all';
  campaignName: string;
  channel: 'sms' | 'whatsapp';
  messageText: string;
  followUpSteps: FollowUpStep[];
  sendTiming: SendTiming;
  scheduledDate: Date | null;
  scheduledTime: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAMPAIGN_TYPES: { type: CampaignType; desc: string }[] = [
  { type: 'sms_broadcast',  desc: 'Send a one-time message to a group' },
  { type: 'follow_up',      desc: 'Automated messages over multiple days' },
  { type: 'reactivation',   desc: 'Win back inactive members & leads' },
  { type: 'promotion',      desc: 'Announce a special offer or discount' },
  { type: 'event',          desc: 'Promote an upcoming class or event' },
  { type: 'review_request', desc: 'Ask members to leave a review' },
];

const CAMPAIGN_TYPE_META_EXT: Record<string, { emoji: string; label: string; color: string }> = {
  ...CAMPAIGN_TYPE_META,
  review_request: { emoji: '🌟', label: 'Review Request', color: '#FFD700' },
};

const STEP_LABELS = ['Type', 'Audience', 'Message', 'Schedule'];

const DELAY_OPTIONS = [
  'Immediately', 'After 1 day', 'After 2 days',
  'After 3 days', 'After 5 days', 'After 1 week',
];

const TOKENS = ['[Name]', '[Gym Name]', '[Plan]', '[Expiry Date]', '[Amount]', '[Trainer]'];

const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '16:00', '18:00', '20:00',
];

const TRAINERS = ['James Kariuki', 'Fatuma Ali', 'David Omondi'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 600) {
  const [count, setCount] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const steps = 24;
    const stepMs = duration / steps;
    let s = 0;
    const timer = setInterval(() => {
      s++;
      const ease = 1 - Math.pow(1 - s / steps, 3);
      setCount(Math.round(from + (target - from) * ease));
      if (s >= steps) { clearInterval(timer); setCount(target); }
    }, stepMs);
    return () => clearInterval(timer);
  }, [target]);
  return count;
}

function calcAudience(
  state: WizardState,
  allMembers: Member[],
  allLeads: AppLead[],
): { total: number; members: number; leads: number } {
  let members = 0, leads = 0;

  if (state.audienceType === 'members' || state.audienceType === 'both') {
    members = allMembers.filter(m => {
      if (state.memberStatus === 'all_active' && m.status !== 'active') return false;
      if (state.memberStatus === 'expiring_soon') {
        if (m.status !== 'active') return false;
        const days = (new Date(m.expiry_date).getTime() - Date.now()) / 86400000;
        if (days < 0 || days > 14) return false;
      }
      if (state.memberStatus === 'expired' && m.status !== 'expired') return false;
      if (state.memberStatus === 'frozen' && m.status !== 'frozen') return false;
      if (state.memberPlan === 'monthly' && !m.plan.startsWith('monthly')) return false;
      if (state.memberPlan === 'annual' && !m.plan.startsWith('annual')) return false;
      if (state.memberPlan === 'pay_per_class' && m.plan !== 'pay_per_class') return false;
      if (state.lastVisit !== 'any' && m.last_visit_at) {
        const d = (Date.now() - new Date(m.last_visit_at).getTime()) / 86400000;
        if (state.lastVisit === 'within_7' && d > 7) return false;
        if (state.lastVisit === '8_to_30' && (d <= 7 || d > 30)) return false;
        if (state.lastVisit === '30_plus' && d <= 30) return false;
      }
      if (state.trainer !== 'all' && m.assigned_trainer !== state.trainer) return false;
      return true;
    }).length;
  }

  if (state.audienceType === 'leads' || state.audienceType === 'both') {
    leads = allLeads.filter(l => {
      if (state.leadStage !== 'all' && l.status !== state.leadStage) return false;
      if (state.leadSource !== 'all' && l.source !== state.leadSource) return false;
      if (state.leadInterest !== 'all' && !l.interests.includes(state.leadInterest as LeadInterest)) return false;
      return true;
    }).length;
  }

  return { total: members + leads, members, leads };
}

function renderPreviewText(text: string): string {
  return text
    .replace(/\[Name\]/g, 'John')
    .replace(/\[Gym Name\]/g, 'Jenga Gym')
    .replace(/\[Plan\]/g, 'Monthly Premium')
    .replace(/\[Expiry Date\]/g, '30 Apr 2026')
    .replace(/\[Amount\]/g, 'KSh 4,500')
    .replace(/\[Trainer\]/g, 'James Kariuki');
}

function getCounterColor(len: number): string {
  if (len >= 155) return colors.danger;
  if (len >= 140) return colors.warning;
  return colors.textMuted;
}

function getSMSBadge(len: number): string | null {
  if (len === 0) return null;
  const count = len <= 160 ? 1 : Math.ceil(len / 153);
  return `${count} SMS`;
}

function formatSchedulePreview(state: WizardState, audienceCount: number): string {
  const when = state.sendTiming === 'now'
    ? 'immediately'
    : state.scheduledDate
    ? state.scheduledDate.toLocaleDateString('en-KE', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
      }) + (state.scheduledTime ? ` at ${state.scheduledTime}` : '')
    : 'at a scheduled time';
  return `This campaign will send ${when} to ${audienceCount} contacts`;
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <View style={si.row}>
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const active = num === step;
        const done = num < step;
        return (
          <View key={label} style={si.item}>
            <View style={[si.dot, active && si.dotActive, done && si.dotDone]}>
              {done
                ? <Ionicons name="checkmark" size={11} color="#fff" />
                : <Text style={[si.dotText, (active || done) && si.dotTextActive]}>{num}</Text>}
            </View>
            <Text style={[si.label, active && si.labelActive]}>{label}</Text>
            {i < STEP_LABELS.length - 1 && (
              <View style={[si.line, done && si.lineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 12 },
  item: { flex: 1, alignItems: 'center', position: 'relative' },
  dot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  dotActive: { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
  dotDone: { borderColor: colors.primary, backgroundColor: colors.primary },
  dotText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  dotTextActive: { color: colors.primary },
  label: { fontSize: 10, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  labelActive: { color: colors.primary },
  line: {
    position: 'absolute', top: 13,
    left: '60%', right: '-60%',
    height: 2, backgroundColor: colors.border,
  },
  lineDone: { backgroundColor: colors.primary },
});

// ── Date picker ───────────────────────────────────────────────────────────────

function DatePicker({ selected, onSelect }: { selected: Date | null; onSelect: (d: Date) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() + (i + 1) * 86400000));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
      {days.map((day, i) => {
        const sel = selected?.toDateString() === day.toDateString();
        return (
          <TouchableOpacity key={i} onPress={() => onSelect(day)}
            style={[dp.btn, sel && dp.btnSel]}>
            <Text style={[dp.wd, sel && dp.selText]}>
              {day.toLocaleDateString('en-KE', { weekday: 'short' })}
            </Text>
            <Text style={[dp.day, sel && dp.selText]}>{day.getDate()}</Text>
            <Text style={[dp.mo, sel && dp.selText]}>
              {day.toLocaleDateString('en-KE', { month: 'short' })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const dp = StyleSheet.create({
  btn: {
    width: 56, alignItems: 'center', paddingVertical: 10,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  btnSel: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  wd: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  day: { fontSize: 18, fontWeight: '700', color: colors.text },
  mo: { fontSize: 10, color: colors.textMuted },
  selText: { color: colors.primary },
});

// ── Time picker ───────────────────────────────────────────────────────────────

function TimePicker({ selected, onSelect }: { selected: string; onSelect: (t: string) => void }) {
  function fmt(t: string) {
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ap}`;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
      {TIME_SLOTS.map(t => {
        const sel = selected === t;
        return (
          <TouchableOpacity key={t} onPress={() => onSelect(t)}
            style={[tp.btn, sel && tp.btnSel]}>
            <Text style={[tp.text, sel && tp.textSel]}>{fmt(t)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const tp = StyleSheet.create({
  btn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  btnSel: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  text: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  textSel: { color: colors.primary },
});

// ── Pill selector ─────────────────────────────────────────────────────────────

function PillSelector<T extends string>({
  options, value, onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
      {options.map(opt => {
        const sel = value === opt.key;
        return (
          <TouchableOpacity key={opt.key} onPress={() => onChange(opt.key)}
            style={[pill.btn, sel && pill.btnSel]}>
            <Text style={[pill.text, sel && pill.textSel]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const pill = StyleSheet.create({
  btn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.surface, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  btnSel: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  text: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  textSel: { color: colors.primary },
});

// ── Step 1: Type ──────────────────────────────────────────────────────────────

function Step1({ type, onSelect }: { type: CampaignType | null; onSelect: (t: CampaignType) => void }) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>What type of campaign?</Text>
      <View style={s1.grid}>
        {CAMPAIGN_TYPES.map(({ type: t, desc }) => {
          const meta = CAMPAIGN_TYPE_META_EXT[t] ?? CAMPAIGN_TYPE_META_EXT['sms_broadcast'];
          const selected = type === t;
          return (
            <TouchableOpacity
              key={t}
              style={[s1.card, selected && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
              onPress={() => onSelect(t as CampaignType)}
              activeOpacity={0.75}
            >
              <View style={s1.cardTop}>
                <Text style={s1.emoji}>{meta.emoji}</Text>
                {selected && (
                  <View style={s1.check}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  </View>
                )}
              </View>
              <Text style={[s1.name, selected && { color: colors.primary }]}>{meta.label}</Text>
              <Text style={s1.desc}>{desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s1 = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.md },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border,
    padding: 14, gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  emoji: { fontSize: 26 },
  check: {},
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  desc: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
});

// ── Step 2: Audience ──────────────────────────────────────────────────────────

function Step2({ state, onChange }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void }) {
  const { members } = useMembersContext();
  const { leads } = useLeadsContext();
  const audience = calcAudience(state, members, leads);
  const animCount = useCountUp(audience.total);
  const isMember = state.audienceType === 'members' || state.audienceType === 'both';
  const isLead = state.audienceType === 'leads' || state.audienceType === 'both';

  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Who should receive this?</Text>

      {/* Audience type pills */}
      <PillSelector
        options={[
          { key: 'members', label: 'Members' },
          { key: 'leads',   label: 'Leads' },
          { key: 'both',    label: 'Both' },
          { key: 'custom',  label: 'Custom List' },
        ] as { key: AudienceType; label: string }[]}
        value={state.audienceType}
        onChange={v => onChange({ audienceType: v })}
      />

      {/* Member filters */}
      {isMember && (
        <View style={s2.section}>
          <Text style={s2.sectionLabel}>Member filters</Text>
          <Text style={s2.filterLabel}>Status</Text>
          <PillSelector
            options={[
              { key: 'all_active',    label: 'All Active' },
              { key: 'expiring_soon', label: 'Expiring Soon' },
              { key: 'expired',       label: 'Expired' },
              { key: 'frozen',        label: 'Frozen' },
            ] as { key: MemberStatusFilter; label: string }[]}
            value={state.memberStatus}
            onChange={v => onChange({ memberStatus: v })}
          />
          <Text style={s2.filterLabel}>Plan</Text>
          <PillSelector
            options={[
              { key: 'all',           label: 'All Plans' },
              { key: 'monthly',       label: 'Monthly' },
              { key: 'annual',        label: 'Annual' },
              { key: 'pay_per_class', label: 'Pay Per Class' },
            ] as { key: MemberPlanFilter; label: string }[]}
            value={state.memberPlan}
            onChange={v => onChange({ memberPlan: v })}
          />
          <Text style={s2.filterLabel}>Last Visit</Text>
          <PillSelector
            options={[
              { key: 'any',      label: 'Any' },
              { key: 'within_7', label: 'Within 7 days' },
              { key: '8_to_30',  label: '8–30 days' },
              { key: '30_plus',  label: '30+ days' },
            ] as { key: LastVisitFilter; label: string }[]}
            value={state.lastVisit}
            onChange={v => onChange({ lastVisit: v })}
          />
          <Text style={s2.filterLabel}>Trainer</Text>
          <PillSelector
            options={[{ key: 'all', label: 'All Trainers' }, ...TRAINERS.map(t => ({ key: t, label: t }))]}
            value={state.trainer}
            onChange={v => onChange({ trainer: v })}
          />
        </View>
      )}

      {/* Lead filters */}
      {isLead && (
        <View style={s2.section}>
          <Text style={s2.sectionLabel}>Lead filters</Text>
          <Text style={s2.filterLabel}>Stage</Text>
          <PillSelector
            options={[
              { key: 'all',             label: 'All' },
              { key: 'new_lead',        label: 'New Lead' },
              { key: 'contacted',       label: 'Contacted' },
              { key: 'trial_booked',    label: 'Trial Booked' },
              { key: 'trial_completed', label: 'Trial Done' },
              { key: 'lost_lead',       label: 'Lost Lead' },
            ] as { key: LeadStage | 'all'; label: string }[]}
            value={state.leadStage}
            onChange={v => onChange({ leadStage: v })}
          />
          <Text style={s2.filterLabel}>Source</Text>
          <PillSelector
            options={[
              { key: 'all',        label: 'All' },
              { key: 'website',    label: 'Website' },
              { key: 'instagram',  label: 'Instagram' },
              { key: 'referral',   label: 'Referral' },
              { key: 'walk_in',    label: 'Walk-in' },
              { key: 'google_ads', label: 'Google Ads' },
            ] as { key: LeadSource | 'all'; label: string }[]}
            value={state.leadSource}
            onChange={v => onChange({ leadSource: v })}
          />
          <Text style={s2.filterLabel}>Interest</Text>
          <PillSelector
            options={[
              { key: 'all',                label: 'All' },
              { key: 'membership',          label: 'Membership' },
              { key: 'personal_training',   label: 'Training' },
              { key: 'group_classes',       label: 'Classes' },
            ] as { key: LeadInterest | 'all'; label: string }[]}
            value={state.leadInterest}
            onChange={v => onChange({ leadInterest: v })}
          />
        </View>
      )}

      {/* Audience preview */}
      <View style={s2.previewCard}>
        <View style={s2.previewRow}>
          <Text style={s2.previewEmoji}>👥</Text>
          <View>
            <Text style={s2.previewCount}>
              Estimated audience: <Text style={{ color: animCount === 0 ? colors.danger : colors.primary }}>{animCount}</Text> contacts
            </Text>
            {audience.total > 0 ? (
              <Text style={s2.previewBreak}>
                {isMember && isLead
                  ? `${audience.members} members + ${audience.leads} leads`
                  : isMember
                  ? `${audience.members} members`
                  : `${audience.leads} leads`}
              </Text>
            ) : (
              <View style={s2.warnRow}>
                <Ionicons name="warning-outline" size={13} color={colors.warning} />
                <Text style={s2.warnText}>No contacts match these filters</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const s2 = StyleSheet.create({
  section: { gap: 10, paddingHorizontal: spacing.md },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: -2 },
  filterLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: -4, paddingLeft: 2 },
  previewCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: 14,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewEmoji: { fontSize: 28 },
  previewCount: { fontSize: 14, fontWeight: '600', color: colors.text },
  previewBreak: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  warnText: { fontSize: 12, color: colors.warning },
});

// ── Step 3: Message ───────────────────────────────────────────────────────────

function Step3({ state, onChange }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void }) {
  const { quickReplies } = useMessagesContext();
  const [showTemplates, setShowTemplates] = useState(false);
  const selectionRef = useRef({ start: 0, end: 0 });
  const textInputRef = useRef<TextInput>(null);
  const isFollowUp = state.campaignType === 'follow_up';

  function insertToken(token: string) {
    const { start, end } = selectionRef.current;
    const before = state.messageText.slice(0, start);
    const after = state.messageText.slice(end);
    const newText = before + token + after;
    onChange({ messageText: newText });
    selectionRef.current = { start: start + token.length, end: start + token.length };
  }

  function insertTemplate(body: string) {
    onChange({ messageText: body });
    setShowTemplates(false);
  }

  function updateFollowUpStep(index: number, patch: Partial<FollowUpStep>) {
    const steps = state.followUpSteps.map((s, i) => i === index ? { ...s, ...patch } : s);
    onChange({ followUpSteps: steps });
  }

  function addStep() {
    if (state.followUpSteps.length >= 5) return;
    const delayOptions = ['After 2 days', 'After 3 days', 'After 5 days', 'After 1 week'];
    const delay = delayOptions[Math.min(state.followUpSteps.length - 1, delayOptions.length - 1)];
    onChange({ followUpSteps: [...state.followUpSteps, { delay, text: '' }] });
  }

  function removeStep(index: number) {
    onChange({ followUpSteps: state.followUpSteps.filter((_, i) => i !== index) });
  }

  const charLen = state.messageText.length;
  const smsBadge = getSMSBadge(charLen);

  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Craft your message</Text>

      {/* Campaign name */}
      <View style={s3.field}>
        <Text style={s3.label}>Campaign Name *</Text>
        <TextInput
          style={s3.input}
          placeholder="e.g. January Membership Drive"
          placeholderTextColor={colors.textMuted}
          value={state.campaignName}
          onChangeText={v => onChange({ campaignName: v })}
        />
      </View>

      {/* Channel selector */}
      {(state.campaignType === 'sms_broadcast' || state.campaignType === 'promotion' ||
        state.campaignType === 'reactivation' || state.campaignType === 'review_request') && (
        <View style={s3.field}>
          <Text style={s3.label}>Channel</Text>
          <View style={s3.channelRow}>
            <TouchableOpacity
              style={[s3.channelBtn, state.channel === 'sms' && s3.channelBtnSel]}
              onPress={() => onChange({ channel: 'sms' })}
            >
              <Ionicons name="chatbubble-outline" size={16} color={state.channel === 'sms' ? colors.primary : colors.textMuted} />
              <Text style={[s3.channelText, state.channel === 'sms' && { color: colors.primary }]}>SMS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s3.channelBtnDisabled} disabled>
              <Ionicons name="logo-whatsapp" size={16} color={colors.textMuted} />
              <Text style={s3.channelTextDisabled}>WhatsApp</Text>
              <View style={s3.soonBadge}><Text style={s3.soonText}>Soon</Text></View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Message composer — single or follow-up */}
      {isFollowUp ? (
        <View style={s3.field}>
          <Text style={s3.label}>Message Steps</Text>
          {state.followUpSteps.map((step, i) => (
            <View key={i} style={s3.stepCard}>
              <View style={s3.stepHeader}>
                <View style={s3.stepDot}><Text style={s3.stepDotText}>{i + 1}</Text></View>
                <PillSelector
                  options={DELAY_OPTIONS.map(d => ({ key: d, label: d }))}
                  value={step.delay}
                  onChange={v => updateFollowUpStep(i, { delay: v })}
                />
                {i > 0 && (
                  <TouchableOpacity onPress={() => removeStep(i)} style={s3.removeBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={s3.textarea}
                multiline
                placeholder="Type your message..."
                placeholderTextColor={colors.textMuted}
                value={step.text}
                onChangeText={v => updateFollowUpStep(i, { text: v })}
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={[s3.charCount, { color: getCounterColor(step.text.length) }]}>
                {step.text.length} / 160
              </Text>
            </View>
          ))}
          {state.followUpSteps.length < 5 && (
            <TouchableOpacity style={s3.addStepBtn} onPress={addStep}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={s3.addStepText}>+ Add Step</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={s3.field}>
          <Text style={s3.label}>Message</Text>
          <View style={s3.composerBox}>
            <TextInput
              ref={textInputRef}
              style={s3.textarea}
              multiline
              placeholder="Type your message..."
              placeholderTextColor={colors.textMuted}
              value={state.messageText}
              onChangeText={v => onChange({ messageText: v })}
              numberOfLines={6}
              textAlignVertical="top"
              onSelectionChange={({ nativeEvent }) => {
                selectionRef.current = nativeEvent.selection;
              }}
            />
            <View style={s3.composerFooter}>
              <Text style={[s3.charCount, { color: getCounterColor(charLen) }]}>
                {charLen} / 160
                {charLen > 160 && <Text style={{ color: colors.warning }}> ({Math.ceil(charLen / 153)} SMS)</Text>}
              </Text>
              {smsBadge && (
                <View style={[s3.smsBadge, charLen > 160 && { backgroundColor: colors.warning + '25', borderColor: colors.warning }]}>
                  <Text style={[s3.smsBadgeText, charLen > 160 && { color: colors.warning }]}>{smsBadge}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tokens */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s3.tokenRow}>
            {TOKENS.map(tok => (
              <TouchableOpacity key={tok} style={s3.tokenBtn} onPress={() => insertToken(tok)}>
                <Text style={s3.tokenText}>{tok}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Use template */}
          <TouchableOpacity style={s3.templateBtn} onPress={() => setShowTemplates(v => !v)}>
            <Ionicons name="flash-outline" size={15} color={colors.info} />
            <Text style={s3.templateBtnText}>Use Template</Text>
            <Ionicons name={showTemplates ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          </TouchableOpacity>

          {showTemplates && (
            <View style={s3.templateList}>
              {quickReplies.map(qr => (
                <TouchableOpacity key={qr.id} style={s3.templateItem} onPress={() => insertTemplate(qr.body)}>
                  <Text style={s3.templateItemTitle}>{qr.title}</Text>
                  <Text style={s3.templateItemBody} numberOfLines={2}>{qr.body}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Preview */}
      {!isFollowUp && state.messageText.length > 0 && (
        <View style={s3.field}>
          <Text style={s3.label}>Preview</Text>
          <View style={s3.previewWrap}>
            <View style={s3.phoneBubble}>
              <Text style={s3.bubbleText}>{renderPreviewText(state.messageText)}</Text>
            </View>
            <Text style={s3.previewNote}>Previewed as "John"</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s3 = StyleSheet.create({
  field: { gap: 8, paddingHorizontal: spacing.md },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 14,
  },
  channelRow: { flexDirection: 'row', gap: 10 },
  channelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  channelBtnSel: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  channelText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  channelBtnDisabled: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, opacity: 0.5,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  channelTextDisabled: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  soonBadge: {
    backgroundColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  soonText: { fontSize: 9, color: colors.textMuted, fontWeight: '700' },
  composerBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  textarea: {
    color: colors.text, fontSize: 14, lineHeight: 20,
    padding: 14, minHeight: 110,
  },
  composerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  charCount: { fontSize: 12, fontWeight: '600' },
  smsBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: colors.info + '20',
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.info,
  },
  smsBadgeText: { fontSize: 11, fontWeight: '700', color: colors.info },
  tokenRow: { gap: 8, paddingTop: 2 },
  tokenBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  tokenText: { fontSize: 12, color: colors.info, fontWeight: '600' },
  templateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  templateBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.info },
  templateList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  templateItem: {
    padding: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 3,
  },
  templateItemTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  templateItemBody: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: 12, gap: 10,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  removeBtn: { padding: 4 },
  addStepBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
  },
  addStepText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  previewWrap: { gap: 8 },
  phoneBubble: {
    alignSelf: 'flex-start', maxWidth: '85%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16, borderBottomLeftRadius: 4,
    padding: 12,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  bubbleText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  previewNote: { fontSize: 11, color: colors.textMuted, paddingLeft: 2 },
});

// ── Step 4: Schedule ──────────────────────────────────────────────────────────

function Step4({ state, onChange, audienceCount }: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  audienceCount: number;
}) {
  const isSequence = state.campaignType === 'follow_up';

  const timingOptions = [
    {
      key: 'now' as SendTiming,
      emoji: '🚀',
      title: 'Send Now',
      desc: 'Campaign sends immediately after you confirm',
    },
    {
      key: 'scheduled' as SendTiming,
      emoji: '📅',
      title: 'Schedule for Later',
      desc: 'Pick a specific date and time',
    },
    ...(isSequence ? [{
      key: 'recurring' as SendTiming,
      emoji: '🔁',
      title: 'Recurring',
      desc: 'Triggers automatically for new contacts matching your filters',
    }] : []),
  ];

  const audienceCount_ = useCountUp(audienceCount);

  const summary = formatSchedulePreview(state, audienceCount);

  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>When should this send?</Text>

      {timingOptions.map(opt => {
        const sel = state.sendTiming === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[s4.timingCard, sel && s4.timingCardSel]}
            onPress={() => onChange({ sendTiming: opt.key })}
            activeOpacity={0.8}
          >
            <Text style={s4.timingEmoji}>{opt.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s4.timingTitle, sel && { color: colors.primary }]}>{opt.title}</Text>
              <Text style={s4.timingDesc}>{opt.desc}</Text>
            </View>
            <View style={[s4.radio, sel && s4.radioSel]}>
              {sel && <View style={s4.radioDot} />}
            </View>
          </TouchableOpacity>
        );
      })}

      {state.sendTiming === 'scheduled' && (
        <View style={s4.pickerSection}>
          <Text style={s4.pickerLabel}>Select Date</Text>
          <DatePicker selected={state.scheduledDate} onSelect={d => onChange({ scheduledDate: d })} />
          <Text style={[s4.pickerLabel, { marginTop: 10 }]}>Select Time</Text>
          <TimePicker selected={state.scheduledTime} onSelect={t => onChange({ scheduledTime: t })} />
          <View style={s4.tzRow}>
            <Ionicons name="globe-outline" size={13} color={colors.textMuted} />
            <Text style={s4.tzText}>Sending in EAT (East Africa Time)</Text>
          </View>
        </View>
      )}

      {/* Summary */}
      <View style={s4.summary}>
        <Text style={s4.summaryTitle}>Campaign Summary</Text>
        <View style={s4.summaryRow}>
          <Text style={s4.summaryKey}>Type</Text>
          <Text style={s4.summaryVal}>
            {state.campaignType ? CAMPAIGN_TYPE_META_EXT[state.campaignType]?.label : '—'}
          </Text>
        </View>
        <View style={s4.summaryRow}>
          <Text style={s4.summaryKey}>Audience</Text>
          <Text style={s4.summaryVal}>{audienceCount_} contacts</Text>
        </View>
        <View style={s4.summaryRow}>
          <Text style={s4.summaryKey}>Message</Text>
          <Text style={s4.summaryVal} numberOfLines={2}>
            {state.messageText
              ? state.messageText.slice(0, 80) + (state.messageText.length > 80 ? '...' : '')
              : state.followUpSteps[0]?.text
              ? state.followUpSteps[0].text.slice(0, 80) + '...'
              : '(empty)'}
          </Text>
        </View>
        <View style={s4.summaryRow}>
          <Text style={s4.summaryKey}>Schedule</Text>
          <Text style={s4.summaryVal}>
            {state.sendTiming === 'now' ? 'Send Now'
              : state.sendTiming === 'recurring' ? 'Recurring'
              : state.scheduledDate
              ? state.scheduledDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) + (state.scheduledTime ? ` at ${state.scheduledTime}` : '')
              : 'Not set'}
          </Text>
        </View>
        {state.sendTiming === 'scheduled' && state.scheduledDate && (
          <View style={s4.scheduleNote}>
            <Ionicons name="information-circle-outline" size={14} color={colors.info} />
            <Text style={s4.scheduleNoteText}>{summary}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s4 = StyleSheet.create({
  timingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 2, borderColor: colors.border,
    padding: 14,
  },
  timingCardSel: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  timingEmoji: { fontSize: 26, width: 36, textAlign: 'center' },
  timingTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  timingDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioSel: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  pickerSection: { gap: 6, paddingHorizontal: spacing.md },
  pickerLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, paddingLeft: 2 },
  tzRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 2 },
  tzText: { fontSize: 11, color: colors.textMuted },
  summary: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 10,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  summaryKey: { fontSize: 13, color: colors.textMuted, fontWeight: '600', width: 80 },
  summaryVal: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '500', textAlign: 'right' },
  scheduleNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.info + '12',
    borderRadius: radius.sm, padding: 10, marginTop: 4,
  },
  scheduleNoteText: { flex: 1, fontSize: 12, color: colors.info, lineHeight: 17 },
});

// ── Success state ─────────────────────────────────────────────────────────────

function SuccessState({ campaignName, audienceCount, onDone }: {
  campaignName: string;
  audienceCount: number;
  onDone: () => void;
}) {
  return (
    <RNAnimated.View entering={ZoomIn.springify()} style={suc.wrap}>
      <View style={suc.iconWrap}>
        <Text style={suc.rocket}>🚀</Text>
      </View>
      <Text style={suc.title}>Campaign Launched!</Text>
      <Text style={suc.sub}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{campaignName || 'Your campaign'}</Text>
        {' '}is sending to{' '}
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{audienceCount} contacts</Text>
      </Text>
      <TouchableOpacity style={suc.btn} onPress={onDone}>
        <Text style={suc.btnText}>Done</Text>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

const suc = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 16 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  rocket: { fontSize: 42 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: 48, marginTop: 8,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ── Main modal ────────────────────────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  campaignType: null,
  audienceType: 'members',
  memberStatus: 'all_active',
  memberPlan: 'all',
  lastVisit: 'any',
  trainer: 'all',
  leadStage: 'all',
  leadSource: 'all',
  leadInterest: 'all',
  campaignName: '',
  channel: 'sms',
  messageText: '',
  followUpSteps: [{ delay: 'Immediately', text: '' }],
  sendTiming: 'now',
  scheduledDate: null,
  scheduledTime: '10:00',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onLaunch: () => void;
  clientId?: string;
};

export function CreateCampaignModal({ visible, onClose, onLaunch, clientId }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { members } = useMembersContext();
  const { leads } = useLeadsContext();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(800)).current;
  const [step, setStep] = useState(1);
  const [wizState, setWizState] = useState<WizardState>(INITIAL_STATE);
  const [launching, setLaunching] = useState(false);
  const [success, setSuccess] = useState(false);

  const audience = calcAudience(wizState, members, leads);

  // Open/close sheet
  useEffect(() => {
    if (visible) {
      setStep(1);
      setWizState(INITIAL_STATE);
      setLaunching(false);
      setSuccess(false);
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }
  }, [visible]);

  function closeSheet() {
    Animated.timing(sheetAnim, { toValue: 800, duration: 250, useNativeDriver: true }).start(onClose);
  }

  function patch(p: Partial<WizardState>) {
    setWizState(prev => ({ ...prev, ...p }));
  }

  function slideNext(nextStep: number) {
    Animated.timing(slideAnim, { toValue: -width, duration: 220, useNativeDriver: true }).start(() => {
      slideAnim.setValue(width);
      setStep(nextStep);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    });
  }

  function slideBack(prevStep: number) {
    Animated.timing(slideAnim, { toValue: width, duration: 220, useNativeDriver: true }).start(() => {
      slideAnim.setValue(-width);
      setStep(prevStep);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    });
  }

  function canNext(): boolean {
    if (step === 1) return wizState.campaignType !== null;
    if (step === 2) return audience.total > 0;
    if (step === 3) {
      if (!wizState.campaignName.trim()) return false;
      if (wizState.campaignType === 'follow_up') {
        return wizState.followUpSteps.some(s => s.text.trim().length > 0);
      }
      return wizState.messageText.trim().length > 0;
    }
    return true;
  }

  async function handleLaunch() {
    if (!clientId) return;
    setLaunching(true);

    const scheduledAt = wizState.sendTiming === 'scheduled' && wizState.scheduledDate
      ? (() => {
          const d = new Date(wizState.scheduledDate!);
          if (wizState.scheduledTime) {
            const [h, m] = wizState.scheduledTime.split(':').map(Number);
            d.setHours(h, m, 0, 0);
          }
          return d.toISOString();
        })()
      : null;

    const { error } = await supabase.from('campaigns').insert({
      client_id: clientId,
      name: wizState.campaignName || 'New Campaign',
      type: wizState.campaignType ?? 'sms_broadcast',
      channel: wizState.channel,
      status: wizState.sendTiming === 'now' ? 'active' : 'scheduled',
      message: wizState.campaignType === 'follow_up'
        ? wizState.followUpSteps[0]?.text ?? ''
        : wizState.messageText,
      recipient_count: audience.total,
      audience_size: audience.total,
      scheduled_at: scheduledAt,
    });

    setLaunching(false);
    if (!error) {
      setSuccess(true);
      onLaunch();
    }
  }

  const nextDisabled = !canNext();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeSheet}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={s.backdrop} onPress={closeSheet}>
          <Animated.View
            style={[s.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: sheetAnim }] }]}
          >
            <Pressable>
              {/* Handle */}
              <View style={s.handle} />

              {/* Close */}
              <TouchableOpacity style={s.closeBtn} onPress={closeSheet}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              {success ? (
                <SuccessState
                  campaignName={wizState.campaignName}
                  audienceCount={audience.total}
                  onDone={closeSheet}
                />
              ) : (
                <>
                  <StepIndicator step={step} />

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 16 }}
                  >
                    <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
                      {step === 1 && <Step1 type={wizState.campaignType} onSelect={t => patch({ campaignType: t })} />}
                      {step === 2 && <Step2 state={wizState} onChange={patch} />}
                      {step === 3 && <Step3 state={wizState} onChange={patch} />}
                      {step === 4 && <Step4 state={wizState} onChange={patch} audienceCount={audience.total} />}
                    </Animated.View>
                  </ScrollView>

                  {/* Navigation */}
                  <View style={s.navRow}>
                    {step > 1 ? (
                      <TouchableOpacity style={s.backBtn} onPress={() => slideBack(step - 1)}>
                        <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                        <Text style={s.backBtnText}>Back</Text>
                      </TouchableOpacity>
                    ) : (
                      <View />
                    )}
                    {step < 4 ? (
                      <TouchableOpacity
                        style={[s.nextBtn, nextDisabled && s.nextBtnDisabled]}
                        onPress={() => !nextDisabled && slideNext(step + 1)}
                        disabled={nextDisabled}
                      >
                        <Text style={[s.nextBtnText, nextDisabled && { color: colors.textMuted }]}>Next</Text>
                        <Ionicons name="arrow-forward" size={16} color={nextDisabled ? colors.textMuted : '#fff'} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[s.launchBtn, launching && { opacity: 0.8 }]}
                        onPress={handleLaunch}
                        disabled={launching}
                      >
                        {launching
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <>
                              <Text style={s.launchBtnText}>Launch Campaign</Text>
                              <Text style={{ fontSize: 16 }}>🚀</Text>
                            </>}
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    maxHeight: '92%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 10,
  },
  closeBtn: {
    position: 'absolute', top: 10, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  stepWrap: { gap: 18, paddingBottom: 8 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.md },
  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  backBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 24,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  nextBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  launchBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  launchBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
