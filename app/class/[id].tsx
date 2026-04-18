import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Modal, Platform, Animated,
  Pressable, Switch,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNAnimated, { FadeInDown } from 'react-native-reanimated';
import {
  useClassesContext,
  CATEGORY_COLORS, CATEGORY_LABELS, STATUS_COLORS,
  getDerivedStatus,
} from '@/context/ClassesContext';
import { useMembersContext } from '@/context/MembersContext';
import { colors, spacing } from '@/lib/theme';
import { AddClassModal } from '@/components/AddClassModal';
import type { ClassAttendee, WaitlistEntry, AttendanceStatus, GymClass } from '@/context/ClassesContext';
import type { Member } from '@/context/MembersContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtRelative(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ATTENDANCE_CYCLE: AttendanceStatus[] = ['pending', 'present', 'absent'];

function nextAttendance(status: AttendanceStatus): AttendanceStatus {
  const idx = ATTENDANCE_CYCLE.indexOf(status);
  return ATTENDANCE_CYCLE[(idx + 1) % ATTENDANCE_CYCLE.length];
}

const ATTENDANCE_CONFIG: Record<AttendanceStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending',  color: '#8FA3B4', icon: 'ellipse-outline' },
  present: { label: 'Present',  color: '#33D169', icon: 'checkmark-circle' },
  absent:  { label: 'Absent',   color: '#EF4444', icon: 'close-circle' },
};

// ── Animated capacity bar ─────────────────────────────────────────────────────

function CapacitySection({ cls }: { cls: GymClass }) {
  const pct     = cls.max_capacity > 0 ? Math.min(cls.booked_count / cls.max_capacity, 1) : 0;
  const isFull  = cls.booked_count >= cls.max_capacity;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [pct]);

  const barColor = widthAnim.interpolate({
    inputRange:  [0, 0.79, 0.8, 1],
    outputRange: [colors.primary, colors.primary, '#F97316', isFull ? '#EF4444' : '#F97316'],
  });

  const available = Math.max(0, cls.max_capacity - cls.booked_count);

  return (
    <View style={capStyles.card}>
      {/* Big numbers row */}
      <View style={capStyles.numRow}>
        <View style={capStyles.numBlock}>
          <Text style={[capStyles.numVal, { color: colors.primary }]}>{cls.booked_count}</Text>
          <Text style={capStyles.numLabel}>Booked</Text>
        </View>
        <View style={capStyles.numDivider} />
        <View style={capStyles.numBlock}>
          <Text style={capStyles.numVal}>{cls.max_capacity}</Text>
          <Text style={capStyles.numLabel}>Capacity</Text>
        </View>
        <View style={capStyles.numDivider} />
        <View style={capStyles.numBlock}>
          <Text style={[capStyles.numVal, { color: isFull ? '#EF4444' : '#F97316' }]}>{available}</Text>
          <Text style={capStyles.numLabel}>Available</Text>
        </View>
      </View>

      {/* Animated bar */}
      <View style={capStyles.trackWrapper}>
        <View style={capStyles.track}>
          <Animated.View
            style={[
              capStyles.fill,
              {
                width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
        <Text style={capStyles.pctText}>{Math.round(pct * 100)}%</Text>
      </View>

      {/* Waitlist row */}
      {cls.allow_waitlist && (
        <View style={capStyles.waitlistRow}>
          <Ionicons name="hourglass-outline" size={13} color={colors.textMuted} />
          <Text style={capStyles.waitlistText}>
            Waitlist enabled · max {cls.max_waitlist} spots
          </Text>
        </View>
      )}
    </View>
  );
}

const capStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: 12,
    padding: 16, gap: 14,
  },
  numRow: { flexDirection: 'row', alignItems: 'center' },
  numBlock: { flex: 1, alignItems: 'center', gap: 3 },
  numDivider: { width: 1, height: 36, backgroundColor: colors.border },
  numVal: { fontSize: 28, fontWeight: '700', color: colors.text },
  numLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  trackWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  pctText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, width: 36, textAlign: 'right' },
  waitlistRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waitlistText: { fontSize: 12, color: colors.textMuted },
});

// ── Attendee row ──────────────────────────────────────────────────────────────

function AttendeeRow({
  attendee, onStatusCycle, onRemove,
}: {
  attendee: ClassAttendee;
  onStatusCycle: () => void;
  onRemove: () => void;
}) {
  const cfg  = ATTENDANCE_CONFIG[attendee.attendance_status];
  const init = attendee.member_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return (
    <View style={rowStyles.row}>
      {/* Avatar */}
      <View style={rowStyles.avatar}>
        <Text style={rowStyles.avatarText}>{init}</Text>
      </View>

      {/* Info */}
      <View style={rowStyles.info}>
        <View style={rowStyles.nameRow}>
          <Text style={rowStyles.name} numberOfLines={1}>{attendee.member_name}</Text>
          {attendee.is_walkin && (
            <View style={rowStyles.walkinBadge}>
              <Text style={rowStyles.walkinText}>Walk-in</Text>
            </View>
          )}
        </View>
        {attendee.member_plan && (
          <Text style={rowStyles.plan}>{attendee.member_plan}</Text>
        )}
      </View>

      {/* Status pill (tappable cycles) */}
      <TouchableOpacity
        style={[rowStyles.statusPill, { backgroundColor: cfg.color + '20' }]}
        onPress={onStatusCycle}
        activeOpacity={0.7}
      >
        <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
        <Text style={[rowStyles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </TouchableOpacity>

      {/* Remove */}
      <TouchableOpacity onPress={onRemove} style={rowStyles.removeBtn} hitSlop={8}>
        <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    padding: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  walkinBadge: {
    backgroundColor: '#F97316' + '20', borderRadius: 99,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  walkinText: { fontSize: 10, fontWeight: '700', color: '#F97316' },
  plan: { fontSize: 11, color: colors.textMuted },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  removeBtn: { padding: 2 },
});

// ── Waitlist row ──────────────────────────────────────────────────────────────

function WaitlistRow({
  entry, canPromote, onPromote, onRemove,
}: {
  entry: WaitlistEntry;
  canPromote: boolean;
  onPromote: () => void;
  onRemove: () => void;
}) {
  const init = entry.member_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return (
    <View style={wlStyles.row}>
      {/* Position badge */}
      <View style={wlStyles.posBadge}>
        <Text style={wlStyles.posText}>#{entry.position}</Text>
      </View>

      {/* Avatar */}
      <View style={wlStyles.avatar}>
        <Text style={wlStyles.avatarText}>{init}</Text>
      </View>

      {/* Info */}
      <View style={wlStyles.info}>
        <Text style={wlStyles.name} numberOfLines={1}>{entry.member_name}</Text>
        <Text style={wlStyles.since}>Joined {fmtRelative(entry.added_at)}</Text>
      </View>

      {/* Actions */}
      <View style={wlStyles.actions}>
        {canPromote && (
          <TouchableOpacity style={wlStyles.promoteBtn} onPress={onPromote} activeOpacity={0.75}>
            <Ionicons name="arrow-up-circle-outline" size={14} color={colors.primary} />
            <Text style={wlStyles.promoteTxt}>Add</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const wlStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    padding: 12,
  },
  posBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  posText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F97316' + '25',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#F97316' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  since: { fontSize: 11, color: colors.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '20', borderRadius: 99,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  promoteTxt: { fontSize: 11, fontWeight: '700', color: colors.primary },
});

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[toastSt.wrapper, { transform: [{ translateY }], opacity }]}
    >
      <View style={toastSt.pill}>
        <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
        <Text style={toastSt.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const toastSt = StyleSheet.create({
  wrapper: {
    position: 'absolute', top: 0, left: 0, right: 0,
    alignItems: 'center', zIndex: 999,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.primary + '40',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  text: { fontSize: 13, fontWeight: '600', color: colors.text },
});

// ── Add Attendee Sheet ────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',   color: colors.primary },
  inactive: { label: 'Inactive', color: colors.textMuted },
  expired:  { label: 'Expired',  color: '#EF4444' },
  frozen:   { label: 'Frozen',   color: '#4C9FFF' },
};

type AddAttendeeSheetProps = {
  visible: boolean;
  cls: GymClass;
  currentAttendees: ClassAttendee[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
};

function AddAttendeeSheet({ visible, cls, currentAttendees, onClose, onSuccess }: AddAttendeeSheetProps) {
  const { addAttendee, addToWaitlist, getWaitlist } = useClassesContext();
  const { members } = useMembersContext();

  // Sheet animation
  const translateY = useRef(new Animated.Value(700)).current;
  const backdrop   = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Confirmation card animation
  const confirmAnim = useRef(new Animated.Value(0)).current;

  // State
  const [query, setQuery]                   = useState('');
  const [selected, setSelected]             = useState<Member | null>(null);
  const [useWaitlist, setUseWaitlist]       = useState(false);
  const [walkinName, setWalkinName]         = useState('');
  const [walkinPhone, setWalkinPhone]       = useState('');

  const isFull = cls.booked_count >= cls.max_capacity;
  const bookedIds = new Set(currentAttendees.map(a => a.member_id).filter(Boolean) as string[]);

  // Open / close sheet
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setQuery('');
      setSelected(null);
      setUseWaitlist(false);
      setWalkinName('');
      setWalkinPhone('');
      confirmAnim.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 700, duration: 280, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 230, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  // Confirmation card slide-in/out
  function selectMember(m: Member) {
    setSelected(m);
    Animated.spring(confirmAnim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
  }

  function clearSelected() {
    Animated.timing(confirmAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSelected(null));
  }

  // Filter members: name, phone, or email
  const filtered = members.filter(m => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.phone.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  function handleConfirmMember() {
    if (!selected) return;
    const wl = getWaitlist(cls.id);

    if (isFull && useWaitlist) {
      addToWaitlist(cls.id, selected.id, selected.name);
      const pos = wl.length + 1;
      onSuccess(`${selected.name} added to waitlist (#${pos})`);
    } else {
      addAttendee({
        class_id: cls.id,
        member_id: selected.id,
        member_name: selected.name,
        member_plan: selected.plan_label,
        is_walkin: false,
        attendance_status: 'pending',
      });
      onSuccess(`✓ ${selected.name} added to ${cls.name}`);
    }
    setTimeout(onClose, 500);
  }

  function handleAddWalkin() {
    if (!walkinName.trim()) return;
    addAttendee({
      class_id: cls.id,
      member_id: null,
      member_name: walkinName.trim(),
      member_plan: undefined,
      is_walkin: true,
      attendance_status: 'pending',
    });
    onSuccess(`✓ ${walkinName.trim()} added as walk-in`);
    setTimeout(onClose, 500);
  }

  const confirmTranslateY = confirmAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const confirmOpacity    = confirmAnim;

  if (!mounted) return null;

  return (
    <Modal transparent animationType="none" visible={mounted} onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[sh.backdrop, { opacity: backdrop }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[sh.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={sh.handle} />

        {/* Header */}
        <View style={sh.header}>
          <Text style={sh.title}>Add Attendee</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Class full banner */}
        {isFull && (
          <View style={sh.fullBanner}>
            <Ionicons name="lock-closed-outline" size={14} color="#EF4444" />
            <Text style={sh.fullBannerText}>Class is full</Text>
            <View style={sh.waitlistToggleRow}>
              <Text style={sh.waitlistToggleLabel}>Add to Waitlist?</Text>
              <Switch
                value={useWaitlist}
                onValueChange={setUseWaitlist}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={useWaitlist ? colors.primary : colors.textMuted}
              />
            </View>
          </View>
        )}

        {/* Search */}
        <View style={sh.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={sh.searchInput}
            placeholder="Search members..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={t => { setQuery(t); clearSelected(); }}
            autoFocus={!isFull}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); clearSelected(); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Confirmation card */}
        {selected && (
          <Animated.View style={[sh.confirmCard, { transform: [{ translateY: confirmTranslateY }], opacity: confirmOpacity }]}>
            <View style={sh.confirmLeft}>
              <View style={[sh.confirmAvatar, { backgroundColor: colors.primary + '25' }]}>
                <Text style={[sh.confirmInitials, { color: colors.primary }]}>
                  {selected.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={sh.confirmName}>{selected.name}</Text>
                <Text style={sh.confirmSub}>
                  {isFull && useWaitlist ? `Add to waitlist · ${cls.name}` : `Add to ${cls.name}`}
                </Text>
              </View>
            </View>
            <View style={sh.confirmBtns}>
              <TouchableOpacity style={sh.confirmBtn} onPress={handleConfirmMember}>
                <Ionicons name="checkmark" size={16} color={colors.primary} />
                <Text style={[sh.confirmBtnTxt, { color: colors.primary }]}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sh.clearBtn} onPress={clearSelected}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        <ScrollView
          style={sh.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Member results */}
          {filtered.length === 0 ? (
            <Text style={sh.emptyText}>
              {query ? `No members match "${query}"` : 'No members found'}
            </Text>
          ) : (
            filtered.map((m, index) => {
              const alreadyBooked = bookedIds.has(m.id);
              const isExpired     = m.status === 'expired';
              const isSelectable  = !alreadyBooked && (!isFull || useWaitlist);
              const badgeCfg      = STATUS_BADGE[m.status] ?? STATUS_BADGE.inactive;
              const initials      = m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

              return (
                <RNAnimated.View
                  key={m.id}
                  entering={FadeInDown.delay(index * 50).duration(280).springify()}
                >
                  <TouchableOpacity
                    style={[sh.memberRow, !isSelectable && sh.memberRowDisabled]}
                    onPress={() => isSelectable && selectMember(m)}
                    activeOpacity={isSelectable ? 0.7 : 1}
                    disabled={!isSelectable}
                  >
                    {/* Avatar */}
                    <View style={[sh.memberAvatar, !isSelectable && { opacity: 0.4 }]}>
                      <Text style={sh.memberInitials}>{initials}</Text>
                    </View>

                    {/* Info */}
                    <View style={sh.memberInfo}>
                      <View style={sh.memberNameRow}>
                        <Text style={[sh.memberName, !isSelectable && { color: colors.textMuted }]}>
                          {m.name}
                        </Text>
                        {isExpired && (
                          <Ionicons name="warning-outline" size={13} color={colors.warning} />
                        )}
                      </View>
                      <Text style={sh.memberPlan}>{m.plan_label}</Text>
                    </View>

                    {/* Right side */}
                    {alreadyBooked ? (
                      <Text style={sh.alreadyBooked}>Already booked</Text>
                    ) : isFull && !useWaitlist ? (
                      <Text style={sh.alreadyBooked}>Class full</Text>
                    ) : (
                      <View style={[sh.statusBadge, { backgroundColor: badgeCfg.color + '20' }]}>
                        <Text style={[sh.statusBadgeTxt, { color: badgeCfg.color }]}>{badgeCfg.label}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </RNAnimated.View>
              );
            })
          )}

          {/* Walk-in section */}
          <View style={sh.walkinSection}>
            <View style={sh.walkinDivider}>
              <View style={sh.walkinLine} />
              <Text style={sh.walkinDividerTxt}>Not a member? Add walk-in</Text>
              <View style={sh.walkinLine} />
            </View>

            <TextInput
              style={sh.walkinInput}
              placeholder="Full name (required)"
              placeholderTextColor={colors.textMuted}
              value={walkinName}
              onChangeText={setWalkinName}
              returnKeyType="next"
            />
            <TextInput
              style={sh.walkinInput}
              placeholder="Phone (optional)"
              placeholderTextColor={colors.textMuted}
              value={walkinPhone}
              onChangeText={setWalkinPhone}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[sh.walkinBtn, !walkinName.trim() && { opacity: 0.4 }]}
              disabled={!walkinName.trim()}
              onPress={handleAddWalkin}
            >
              <Ionicons name="person-add-outline" size={16} color="#000" />
              <Text style={sh.walkinBtnTxt}>Add Walk-in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },

  // Full banner
  fullBanner: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    backgroundColor: '#EF4444' + '12',
    borderWidth: 1, borderColor: '#EF4444' + '30',
    borderRadius: 10, marginHorizontal: spacing.md, marginBottom: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  fullBannerText: { fontSize: 13, fontWeight: '600', color: '#EF4444', flex: 1 },
  waitlistToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  waitlistToggleLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, paddingHorizontal: 12, paddingVertical: 11,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  // Confirmation card
  confirmCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary + '12',
    borderWidth: 1, borderColor: colors.primary + '40',
    borderRadius: 14, marginHorizontal: spacing.md, marginBottom: 10,
    padding: 12,
  },
  confirmLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  confirmAvatar: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmInitials: { fontSize: 13, fontWeight: '800' },
  confirmName: { fontSize: 14, fontWeight: '700', color: colors.text },
  confirmSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  confirmBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary + '20', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.primary + '50',
  },
  confirmBtnTxt: { fontSize: 13, fontWeight: '700' },
  clearBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  // Scroll + member list
  scroll: { flex: 1 },
  emptyText: {
    textAlign: 'center', color: colors.textMuted, fontSize: 13,
    marginTop: 24, marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  memberRowDisabled: { opacity: 0.55 },
  memberAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.info + '25',
    justifyContent: 'center', alignItems: 'center',
  },
  memberInitials: { fontSize: 13, fontWeight: '800', color: colors.info },
  memberInfo: { flex: 1, gap: 2 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.text },
  memberPlan: { fontSize: 11, color: colors.textMuted },
  alreadyBooked: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  statusBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeTxt: { fontSize: 10, fontWeight: '700' },

  // Walk-in section
  walkinSection: { paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 8, gap: 10 },
  walkinDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  walkinLine: { flex: 1, height: 1, backgroundColor: colors.border },
  walkinDividerTxt: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  walkinInput: {
    backgroundColor: colors.background, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: colors.text,
  },
  walkinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 13, marginTop: 2,
  },
  walkinBtnTxt: { fontSize: 14, fontWeight: '700', color: '#000' },
});

// ── Details tab content ───────────────────────────────────────────────────────

function DetailsTab({ cls }: { cls: GymClass }) {
  const { getTrainer } = useClassesContext();
  const trainer = getTrainer(cls.trainer_id);

  const rows: { label: string; value: string }[] = [
    { label: 'Category',  value: CATEGORY_LABELS[cls.category] },
    { label: 'Type',      value: cls.type === 'recurring' ? 'Recurring' : 'One-time' },
    ...(cls.type === 'recurring' && cls.repeat
      ? [{ label: 'Repeats', value: cls.repeat.charAt(0).toUpperCase() + cls.repeat.slice(1) }]
      : []),
    ...(cls.end_date ? [{ label: 'End Date', value: fmtDate(cls.end_date) }] : []),
    { label: 'Location',  value: cls.location ?? '—' },
    { label: 'Trainer',   value: trainer?.name ?? '—' },
    { label: 'Trainer Role', value: trainer?.role ?? '—' },
    { label: 'Max Capacity', value: String(cls.max_capacity) },
    { label: 'Waitlist',  value: cls.allow_waitlist ? `Enabled (max ${cls.max_waitlist})` : 'Disabled' },
    { label: 'Created',   value: new Date(cls.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];

  return (
    <View style={detailStyles.container}>
      {cls.description ? (
        <View style={detailStyles.descCard}>
          <Text style={detailStyles.descLabel}>Description</Text>
          <Text style={detailStyles.descText}>{cls.description}</Text>
        </View>
      ) : null}

      <View style={detailStyles.infoCard}>
        {rows.map((r, i) => (
          <View key={r.label} style={[detailStyles.row, i < rows.length - 1 && detailStyles.rowBorder]}>
            <Text style={detailStyles.rowLabel}>{r.label}</Text>
            <Text style={detailStyles.rowValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  container: { gap: 12 },
  descCard: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 6,
  },
  descLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6 },
  descText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  infoCard: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },
});

// ── More menu ─────────────────────────────────────────────────────────────────

function MoreMenu({
  visible, onClose, onCancel, onDelete, isCancelled,
}: {
  visible: boolean;
  onClose: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isCancelled: boolean;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={menuStyles.overlay} onPress={onClose}>
        <View style={menuStyles.menu}>
          <TouchableOpacity style={menuStyles.item} onPress={() => { onClose(); onCancel(); }}>
            <Ionicons
              name={isCancelled ? 'refresh-circle-outline' : 'ban-outline'}
              size={18}
              color={isCancelled ? colors.info : colors.warning}
            />
            <Text style={[menuStyles.itemText, { color: isCancelled ? colors.info : colors.warning }]}>
              {isCancelled ? 'Reactivate Class' : 'Cancel Class'}
            </Text>
          </TouchableOpacity>
          <View style={menuStyles.divider} />
          <TouchableOpacity style={menuStyles.item} onPress={() => { onClose(); onDelete(); }}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[menuStyles.itemText, { color: colors.danger }]}>Delete Class</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 100 : 72, paddingRight: spacing.md,
  },
  menu: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    minWidth: 200,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  itemText: { fontSize: 15, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

type TabKey = 'attendees' | 'waitlist' | 'details';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const {
    getClass, getAttendees, getWaitlist, getTrainer,
    updateClass, deleteClass,
    updateAttendance, removeAttendee, removeFromWaitlist, moveWaitlistToAttendees,
  } = useClassesContext();

  const cls = getClass(id);
  const attendees = getAttendees(id);
  const waitlist  = getWaitlist(id);

  const [activeTab, setActiveTab]       = useState<TabKey>('attendees');
  const [editVisible, setEditVisible]   = useState(false);
  const [addVisible, setAddVisible]     = useState(false);
  const [menuVisible, setMenuVisible]   = useState(false);
  const [toastMsg, setToastMsg]         = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  if (!cls) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>Class not found.</Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const derivedStatus = getDerivedStatus(cls);
  const catColor = CATEGORY_COLORS[cls.category];
  const trainer  = getTrainer(cls.trainer_id);

  function handleCancelToggle() {
    if (cls.status === 'cancelled') {
      Alert.alert('Reactivate Class', 'Mark this class as active again?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reactivate', onPress: () => updateClass(id, { status: 'active' }) },
      ]);
    } else {
      Alert.alert('Cancel Class', 'This will mark the class as cancelled. Continue?', [
        { text: 'Keep Active', style: 'cancel' },
        { text: 'Cancel Class', style: 'destructive', onPress: () => updateClass(id, { status: 'cancelled' }) },
      ]);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete Class',
      'This will permanently delete the class and all attendance records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { deleteClass(id); router.back(); },
        },
      ],
    );
  }

  function handleRemoveAttendee(attendeeId: string, name: string) {
    Alert.alert('Remove Attendee', `Remove ${name} from this class?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeAttendee(id, attendeeId) },
    ]);
  }

  function handleRemoveWaitlist(entryId: string, name: string) {
    Alert.alert('Remove from Waitlist', `Remove ${name} from the waitlist?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromWaitlist(id, entryId) },
    ]);
  }

  const canPromote = cls.booked_count < cls.max_capacity;

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'attendees', label: 'Attendees', count: attendees.length },
    { key: 'waitlist',  label: 'Waitlist',  count: waitlist.length },
    { key: 'details',   label: 'Details' },
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Toast ── */}
      <Toast message={toastMsg} visible={toastVisible} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={s.headerTitle} numberOfLines={1}>{cls.name}</Text>

        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn} onPress={() => setEditVisible(true)} hitSlop={8}>
            <Ionicons name="create-outline" size={21} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => setMenuVisible(true)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={21} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hero info card ── */}
      <View style={[s.heroCard, { borderLeftColor: catColor }]}>
        <View style={s.heroLeft}>
          {/* Category + status row */}
          <View style={s.heroBadgeRow}>
            <View style={[s.catBadge, { backgroundColor: catColor + '25' }]}>
              <Text style={[s.catText, { color: catColor }]}>{CATEGORY_LABELS[cls.category]}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[derivedStatus] + '20' }]}>
              {derivedStatus === 'in_progress' && (
                <View style={[s.statusDot, { backgroundColor: STATUS_COLORS[derivedStatus] }]} />
              )}
              <Text style={[s.statusText, { color: STATUS_COLORS[derivedStatus] }]}>
                {{ upcoming: 'Upcoming', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' }[derivedStatus]}
              </Text>
            </View>
          </View>

          {/* Date + time */}
          <View style={s.heroRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={s.heroMeta}>{fmtDate(cls.date)}</Text>
          </View>
          <View style={s.heroRow}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={s.heroMeta}>{fmt12(cls.start_time)} — {fmt12(cls.end_time)}</Text>
          </View>

          {/* Trainer */}
          {trainer && (
            <View style={s.heroRow}>
              <View style={[s.trainerDot, { backgroundColor: trainer.color }]}>
                <Text style={s.trainerInitials}>{trainer.avatar_initials}</Text>
              </View>
              <Text style={s.heroMeta}>{trainer.name}</Text>
              <Text style={s.heroMetaMuted}>· {trainer.role}</Text>
            </View>
          )}

          {/* Location */}
          {cls.location && (
            <View style={s.heroRow}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={s.heroMeta}>{cls.location}</Text>
            </View>
          )}

          {/* Recurring tag */}
          {cls.type === 'recurring' && cls.repeat && (
            <View style={s.heroRow}>
              <Ionicons name="repeat-outline" size={13} color={colors.textMuted} />
              <Text style={s.heroMeta}>
                Repeats {cls.repeat} {cls.end_date ? `· until ${fmtDate(cls.end_date)}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Capacity section ── */}
      <CapacitySection cls={cls} />

      {/* ── Tabs ── */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ── */}
      <ScrollView style={s.tabContent} contentContainerStyle={s.tabContentInner} showsVerticalScrollIndicator={false}>
        {activeTab === 'attendees' && (
          <>
            {/* Add attendee button */}
            <TouchableOpacity style={s.addAttendeeBtn} onPress={() => setAddVisible(true)}>
              <Ionicons name="person-add-outline" size={16} color={colors.primary} />
              <Text style={s.addAttendeeTxt}>Add Attendee</Text>
            </TouchableOpacity>

            {/* Attendee list */}
            {attendees.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="people-outline" size={40} color={colors.textMuted} />
                <Text style={s.emptyText}>No attendees yet</Text>
                <Text style={s.emptySubtext}>Tap "Add Attendee" to book someone in</Text>
              </View>
            ) : (
              <View style={s.list}>
                {attendees.map(a => (
                  <AttendeeRow
                    key={a.id}
                    attendee={a}
                    onStatusCycle={() => updateAttendance(id, a.id, nextAttendance(a.attendance_status))}
                    onRemove={() => handleRemoveAttendee(a.id, a.member_name)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'waitlist' && (
          <>
            {waitlist.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="hourglass-outline" size={40} color={colors.textMuted} />
                <Text style={s.emptyText}>Waitlist is empty</Text>
                <Text style={s.emptySubtext}>Members waiting for a spot will appear here</Text>
              </View>
            ) : (
              <View style={s.list}>
                {waitlist.map(e => (
                  <WaitlistRow
                    key={e.id}
                    entry={e}
                    canPromote={canPromote}
                    onPromote={() => moveWaitlistToAttendees(id, e.id)}
                    onRemove={() => handleRemoveWaitlist(e.id, e.member_name)}
                  />
                ))}
              </View>
            )}

            {!canPromote && waitlist.length > 0 && (
              <View style={s.fullNotice}>
                <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                <Text style={s.fullNoticeText}>Class is full — remove an attendee first to promote from waitlist.</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'details' && <DetailsTab cls={cls} />}
      </ScrollView>

      {/* ── Modals ── */}
      <AddClassModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        editClass={cls}
      />

      <AddAttendeeSheet
        visible={addVisible}
        cls={cls}
        currentAttendees={attendees}
        onClose={() => setAddVisible(false)}
        onSuccess={showToast}
      />

      <MoreMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onCancel={handleCancelToggle}
        onDelete={handleDelete}
        isCancelled={cls.status === 'cancelled'}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    gap: 8,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center',
  },
  headerRight: { flexDirection: 'row', gap: 6 },

  // Hero card
  heroCard: {
    marginHorizontal: spacing.md, marginBottom: 12,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: 14,
  },
  heroLeft: { gap: 8 },
  heroBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  catBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  catText: { fontSize: 11, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMeta: { fontSize: 13, color: colors.textSecondary },
  heroMetaMuted: { fontSize: 12, color: colors.textMuted },
  trainerDot: {
    width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  trainerInitials: { fontSize: 7, fontWeight: '800', color: '#fff' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md, marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surfaceElevated },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.text },

  // Tab content
  tabContent: { flex: 1 },
  tabContentInner: { paddingHorizontal: spacing.md, paddingBottom: 32, gap: 10 },

  // Add attendee button
  addAttendeeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '40',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  addAttendeeTxt: { fontSize: 14, fontWeight: '600', color: colors.primary },

  // List
  list: { gap: 8 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 8, paddingHorizontal: 24 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  // Full notice
  fullNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.warning + '15',
    borderRadius: 10, borderWidth: 1, borderColor: colors.warning + '30',
    padding: 12,
  },
  fullNoticeText: { flex: 1, fontSize: 12, color: colors.warning, lineHeight: 18 },
});
