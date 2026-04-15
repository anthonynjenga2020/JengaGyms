import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Linking, Alert, Platform, FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useMembersContext } from '@/context/MembersContext';
import { memberStatusConfig, getInitials, getMemberAvatarColor } from '@/components/MemberCard';
import { RecordPaymentModal } from '@/components/RecordPaymentModal';
import { colors, spacing } from '@/lib/theme';
import type { Member, Payment, AttendanceRecord } from '@/context/MembersContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatShortDate(s: string) {
  return new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function membershipProgress(startDate: string, expiryDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(expiryDate).getTime();
  const now = Date.now();
  if (now >= end) return 1;
  if (now <= start) return 0;
  return (now - start) / (end - start);
}

function totalPaidThisYear(payments: Payment[]): number {
  const year = new Date().getFullYear();
  return payments
    .filter(p => p.status === 'paid' && new Date(p.date).getFullYear() === year)
    .reduce((sum, p) => sum + p.amount, 0);
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = Math.max(1, Math.ceil(target / (duration / 20)));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(start);
      if (start >= target) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [target]);
  return count;
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function MembershipProgressBar({ member }: { member: Member }) {
  const progress = membershipProgress(member.start_date, member.expiry_date);
  const animWidth = useRef(new Animated.Value(0)).current;
  const days = daysUntil(member.expiry_date);

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: Math.min(progress, 1),
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, []);

  const barColor = progress > 0.85 ? colors.danger : progress > 0.65 ? '#F97316' : colors.primary;

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.row}>
        <Text style={progressStyles.label}>Membership Progress</Text>
        <Text style={[progressStyles.days, days < 0 && { color: colors.danger }, days <= 7 && days >= 0 && { color: '#F97316' }]}>
          {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days}d remaining`}
        </Text>
      </View>
      <View style={progressStyles.track}>
        <Animated.View
          style={[
            progressStyles.fill,
            {
              backgroundColor: barColor,
              width: animWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <View style={progressStyles.dates}>
        <Text style={progressStyles.dateLabel}>{formatShortDate(member.start_date)}</Text>
        <Text style={progressStyles.dateLabel}>{formatShortDate(member.expiry_date)}</Text>
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  days: { fontSize: 12, fontWeight: '600', color: colors.primary },
  track: {
    height: 8, backgroundColor: colors.border,
    borderRadius: 4, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  dates: { flexDirection: 'row', justifyContent: 'space-between' },
  dateLabel: { fontSize: 11, color: colors.textMuted },
});

// ── Payment Method Icon ───────────────────────────────────────────────────────

function paymentMethodIcon(method: string): React.ComponentProps<typeof Ionicons>['name'] {
  switch (method) {
    case 'mpesa': return 'phone-portrait-outline';
    case 'cash': return 'cash-outline';
    case 'card': return 'card-outline';
    case 'bank_transfer': return 'business-outline';
    default: return 'wallet-outline';
  }
}

function paymentStatusColor(status: string): string {
  switch (status) {
    case 'paid': return colors.primary;
    case 'pending': return '#FFB347';
    case 'failed': return colors.danger;
    default: return colors.textMuted;
  }
}

// ── Calendar Heatmap ──────────────────────────────────────────────────────────

function CalendarHeatmap({ attendance }: { attendance: AttendanceRecord[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  const attendedSet = new Set(attendance.map(a => a.date));
  const monthName = now.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <View style={calStyles.container}>
      <Text style={calStyles.monthLabel}>{monthName}</Text>
      <View style={calStyles.dayLabels}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={calStyles.dayLabel}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={calStyles.cell} />;
          const ds = dateStr(day);
          const attended = attendedSet.has(ds);
          const isToday = day === todayDay && month === todayMonth && year === todayYear;
          return (
            <View
              key={ds}
              style={[
                calStyles.cell,
                attended && calStyles.cellAttended,
                isToday && !attended && calStyles.cellToday,
              ]}
            >
              <Text style={[
                calStyles.cellText,
                attended && calStyles.cellTextAttended,
                isToday && !attended && calStyles.cellTextToday,
              ]}>
                {day}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    padding: 16, gap: 10,
  },
  monthLabel: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  dayLabels: { flexDirection: 'row', justifyContent: 'space-around' },
  dayLabel: { width: 32, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  cellAttended: { backgroundColor: colors.primary },
  cellToday: { borderWidth: 1.5, borderColor: colors.primary },
  cellText: { fontSize: 12, color: colors.textMuted },
  cellTextAttended: { color: '#000', fontWeight: '700' },
  cellTextToday: { color: colors.primary, fontWeight: '700' },
});

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'attendance' | 'payments';

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ member }: { member: Member }) {
  return (
    <View style={tabStyles.content}>
      {/* Membership card */}
      <View style={tabStyles.card}>
        <Text style={tabStyles.cardTitle}>Membership Details</Text>
        <MembershipProgressBar member={member} />
        <View style={tabStyles.divider} />
        <View style={tabStyles.detailGrid}>
          <DetailItem label="Plan" value={member.plan_label} />
          <DetailItem label="Billing" value={`KSh ${member.billing_amount.toLocaleString()} / ${member.billing_cycle}`} />
          <DetailItem label="Start Date" value={formatDate(member.start_date)} />
          <DetailItem label="Expiry Date" value={formatDate(member.expiry_date)} />
          <DetailItem label="Next Billing" value={member.next_billing_date ? formatDate(member.next_billing_date) : '—'} />
          <DetailItem label="Total Visits" value={String(member.total_visits)} />
        </View>
      </View>

      {/* Body stats */}
      {(member.height_cm || member.weight_kg || member.fitness_goal) && (
        <View style={tabStyles.card}>
          <Text style={tabStyles.cardTitle}>Body Stats</Text>
          <View style={tabStyles.detailGrid}>
            {member.height_cm && <DetailItem label="Height" value={`${member.height_cm} cm`} />}
            {member.weight_kg && <DetailItem label="Weight" value={`${member.weight_kg} kg`} />}
            {member.height_cm && member.weight_kg && (
              <DetailItem
                label="BMI"
                value={(member.weight_kg / Math.pow(member.height_cm / 100, 2)).toFixed(1)}
              />
            )}
            {member.fitness_goal && <DetailItem label="Goal" value={member.fitness_goal} />}
          </View>
        </View>
      )}

      {/* Trainer notes */}
      {member.notes && (
        <View style={tabStyles.card}>
          <Text style={tabStyles.cardTitle}>Trainer Notes</Text>
          <Text style={tabStyles.notes}>{member.notes}</Text>
        </View>
      )}

      {/* Emergency contact */}
      {member.emergency_contact_name && (
        <View style={tabStyles.card}>
          <Text style={tabStyles.cardTitle}>Emergency Contact</Text>
          <DetailItem label="Name" value={member.emergency_contact_name} />
          {member.emergency_contact_phone && (
            <DetailItem label="Phone" value={member.emergency_contact_phone} />
          )}
        </View>
      )}
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={tabStyles.detailItem}>
      <Text style={tabStyles.detailLabel}>{label}</Text>
      <Text style={tabStyles.detailValue}>{value}</Text>
    </View>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────

function AttendanceTab({ member, attendance }: { member: Member; attendance: AttendanceRecord[] }) {
  const streak = useCountUp(member.streak);
  const totalVisits = useCountUp(member.total_visits);
  const thisMonth = attendance.length;

  return (
    <View style={tabStyles.content}>
      {/* Stats row */}
      <View style={attStyles.statsRow}>
        <View style={attStyles.statBox}>
          <Text style={attStyles.statValue}>{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
          <Text style={attStyles.statLabel}>Day Streak</Text>
        </View>
        <View style={attStyles.statDivider} />
        <View style={attStyles.statBox}>
          <Text style={attStyles.statValue}>{thisMonth}</Text>
          <Text style={attStyles.statLabel}>This Month</Text>
        </View>
        <View style={attStyles.statDivider} />
        <View style={attStyles.statBox}>
          <Text style={attStyles.statValue}>{totalVisits}</Text>
          <Text style={attStyles.statLabel}>All Time</Text>
        </View>
      </View>

      {/* Calendar heatmap */}
      <CalendarHeatmap attendance={attendance} />

      {/* Recent check-ins */}
      <View style={tabStyles.card}>
        <Text style={tabStyles.cardTitle}>Recent Check-ins</Text>
        {attendance.length === 0 ? (
          <Text style={tabStyles.emptyText}>No attendance records yet.</Text>
        ) : (
          attendance.slice(0, 10).map((rec, i) => (
            <View key={`${rec.date}-${i}`} style={attStyles.checkInRow}>
              <View style={attStyles.checkInDot} />
              <View style={attStyles.checkInInfo}>
                <Text style={attStyles.checkInDate}>{formatDate(rec.date)}</Text>
                <Text style={attStyles.checkInMeta}>
                  {rec.time_in} · {rec.duration_minutes} min
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const attStyles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  checkInRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  checkInDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
  },
  checkInInfo: { flex: 1 },
  checkInDate: { fontSize: 14, fontWeight: '600', color: colors.text },
  checkInMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});

// ── Payments Tab ──────────────────────────────────────────────────────────────

function PaymentsTab({
  member, payments, onRecordPayment,
}: {
  member: Member;
  payments: Payment[];
  onRecordPayment: () => void;
}) {
  const yearTotal = totalPaidThisYear(payments);
  const lastPayment = payments[0];

  return (
    <View style={tabStyles.content}>
      {/* Summary */}
      <View style={payStyles.summaryCard}>
        <View style={payStyles.summaryItem}>
          <Text style={payStyles.summaryAmount}>KSh {yearTotal.toLocaleString()}</Text>
          <Text style={payStyles.summaryLabel}>Paid This Year</Text>
        </View>
        {lastPayment && (
          <View style={payStyles.summaryDivider} />
        )}
        {lastPayment && (
          <View style={payStyles.summaryItem}>
            <Text style={[payStyles.summaryStatus, { color: paymentStatusColor(lastPayment.status) }]}>
              {lastPayment.status.charAt(0).toUpperCase() + lastPayment.status.slice(1)}
            </Text>
            <Text style={payStyles.summaryLabel}>Last Payment</Text>
          </View>
        )}
      </View>

      {/* Record button */}
      <TouchableOpacity style={payStyles.recordBtn} onPress={onRecordPayment}>
        <Ionicons name="add-circle-outline" size={18} color="#000" />
        <Text style={payStyles.recordBtnText}>Record Payment</Text>
      </TouchableOpacity>

      {/* Payment list */}
      <View style={tabStyles.card}>
        <Text style={tabStyles.cardTitle}>Payment History</Text>
        {payments.length === 0 ? (
          <Text style={tabStyles.emptyText}>No payment records yet.</Text>
        ) : (
          payments.map(p => (
            <View key={p.id} style={payStyles.payRow}>
              <View style={[payStyles.methodIcon, { backgroundColor: paymentStatusColor(p.status) + '22' }]}>
                <Ionicons name={paymentMethodIcon(p.method)} size={16} color={paymentStatusColor(p.status)} />
              </View>
              <View style={payStyles.payInfo}>
                <View style={payStyles.payTopRow}>
                  <Text style={payStyles.payAmount}>KSh {p.amount.toLocaleString()}</Text>
                  <View style={[payStyles.statusBadge, { backgroundColor: paymentStatusColor(p.status) + '22' }]}>
                    <Text style={[payStyles.statusText, { color: paymentStatusColor(p.status) }]}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={payStyles.payMeta}>
                  {formatDate(p.date)}{p.reference ? ` · ${p.reference}` : ''}
                </Text>
                {p.note && <Text style={payStyles.payNote}>{p.note}</Text>}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const payStyles = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 18,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryAmount: { fontSize: 22, fontWeight: '700', color: colors.primary },
  summaryStatus: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
  },
  recordBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  payRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  methodIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  payInfo: { flex: 1 },
  payTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  payAmount: { fontSize: 15, fontWeight: '700', color: colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: '700' },
  payMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  payNote: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
});

// ── Shared Tab Styles ─────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    padding: 16, gap: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border },
  detailGrid: { gap: 10 },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  notes: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 8 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMember, getMemberPayments, getMemberAttendance, checkInMember, isCheckedInToday, updateMember, deleteMember } = useMembersContext();

  const member = getMember(id);
  const payments = getMemberPayments(id);
  const attendance = getMemberAttendance(id);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const tabIndicator = useRef(new Animated.Value(0)).current;
  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'payments', label: 'Payments' },
  ];

  function selectTab(tab: TabKey) {
    const index = TABS.findIndex(t => t.key === tab);
    Animated.spring(tabIndicator, { toValue: index, useNativeDriver: true, tension: 80, friction: 12 }).start();
    setActiveTab(tab);
  }

  function handleCall() {
    if (!member) return;
    Linking.openURL(`tel:${member.phone}`);
  }

  function handleSMS() {
    if (!member) return;
    Linking.openURL(`sms:${member.phone}`);
  }

  function handleCheckIn() {
    if (!member) return;
    checkInMember(member.id);
    Alert.alert('✓ Checked In', `${member.name} has been checked in.`);
  }

  function handleMenu() {
    if (!member) return;
    Alert.alert(member.name, 'Member actions', [
      {
        text: member.status === 'frozen' ? 'Unfreeze' : 'Freeze Membership',
        onPress: () => updateMember(member.id, { status: member.status === 'frozen' ? 'active' : 'frozen' }),
      },
      {
        text: member.status === 'inactive' ? 'Set Active' : 'Set Inactive',
        onPress: () => updateMember(member.id, { status: member.status === 'inactive' ? 'active' : 'inactive' }),
      },
      {
        text: 'Delete Member',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete Member', `Remove ${member.name} permanently?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { deleteMember(member.id); router.back(); } },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (!member) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="person-outline" size={48} color={colors.textMuted} />
        <Text style={styles.notFoundText}>Member not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 15, marginTop: 8 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusCfg = memberStatusConfig[member.status];
  const avatarColor = getMemberAvatarColor(member.name);
  const checkedInToday = isCheckedInToday(member.id);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{member.name}</Text>
        <TouchableOpacity onPress={handleMenu} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Identity card */}
        <View style={styles.identityCard}>
          {/* Avatar with status ring */}
          <View style={[styles.avatarRing, { borderColor: statusCfg.color }]}>
            <View style={[styles.avatar, { backgroundColor: avatarColor + '22' }]}>
              <Text style={[styles.avatarText, { color: avatarColor }]}>
                {getInitials(member.name)}
              </Text>
            </View>
          </View>

          <Text style={styles.memberName}>{member.name}</Text>

          <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '22' }]}>
            <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>

          {/* Contact row */}
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactItem} onPress={handleCall}>
              <Ionicons name="call-outline" size={14} color={colors.primary} />
              <Text style={styles.contactText}>{member.phone}</Text>
            </TouchableOpacity>
            {member.email && (
              <TouchableOpacity style={styles.contactItem} onPress={() => Linking.openURL(`mailto:${member.email}`)}>
                <Ionicons name="mail-outline" size={14} color={colors.primary} />
                <Text style={styles.contactText} numberOfLines={1}>{member.email}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Plan + trainer */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
              <Text style={styles.metaChipText}>{member.plan_label}</Text>
            </View>
            {member.assigned_trainer && (
              <View style={styles.metaChip}>
                <Ionicons name="person-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaChipText}>{member.assigned_trainer}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
            <Ionicons name="call" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleSMS}>
            <Ionicons name="chatbubble" size={20} color={colors.info} />
            <Text style={styles.actionLabel}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, checkedInToday && styles.actionBtnDisabled]}
            onPress={handleCheckIn}
            disabled={checkedInToday}
          >
            <Ionicons
              name={checkedInToday ? 'checkmark-circle' : 'barbell-outline'}
              size={20}
              color={checkedInToday ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.actionLabel, checkedInToday && { color: colors.primary }]}>
              {checkedInToday ? 'Checked In' : 'Check In'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setPaymentModalVisible(true)}>
            <Ionicons name="wallet" size={20} color='#F97316' />
            <Text style={styles.actionLabel}>Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => selectTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && <OverviewTab member={member} />}
          {activeTab === 'attendance' && <AttendanceTab member={member} attendance={attendance} />}
          {activeTab === 'payments' && (
            <PaymentsTab
              member={member}
              payments={payments}
              onRecordPayment={() => setPaymentModalVisible(true)}
            />
          )}
        </View>
      </ScrollView>

      <RecordPaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        memberId={member.id}
        defaultAmount={member.billing_amount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 17, fontWeight: '600', color: colors.textMuted },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },

  // Identity card
  identityCard: {
    alignItems: 'center', gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 24, paddingHorizontal: 16,
    marginHorizontal: spacing.md, marginBottom: 12,
  },
  avatarRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, padding: 3,
  },
  avatar: {
    flex: 1, borderRadius: 34,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '700' },
  memberName: { fontSize: 22, fontWeight: '700', color: colors.text },
  statusBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99 },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },
  contactRow: { gap: 6, alignItems: 'center', width: '100%' },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border,
  },
  metaChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: 12,
    paddingVertical: 14,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: 6 },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: 16,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabUnderline: {
    position: 'absolute', bottom: -1, left: 0, right: 0,
    height: 2, backgroundColor: colors.primary, borderRadius: 1,
  },

  scrollContent: { paddingTop: 8 },
  tabContent: { paddingHorizontal: spacing.md },
});
