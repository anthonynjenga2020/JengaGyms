import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import type { Member, MemberStatus } from '@/context/MembersContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export function getMemberAvatarColor(name: string) {
  const palette = ['#4C9FFF', '#A855F7', '#F97316', '#33D169', '#FFD24C', '#FF6B9D', '#06B6D4', '#EC4899'];
  return palette[name.charCodeAt(0) % palette.length];
}

export const memberStatusConfig: Record<MemberStatus, { color: string; label: string }> = {
  active:   { color: '#33D169', label: 'Active' },
  inactive: { color: '#8FA3B4', label: 'Inactive' },
  expired:  { color: '#FF4C4C', label: 'Expired' },
  frozen:   { color: '#7DD3FC', label: 'Frozen' },
};

function lastVisitLabel(dateStr: string | null): string {
  if (!dateStr) return 'Never visited';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function isExpiringSoon(expiryDate: string): boolean {
  const diff = new Date(expiryDate).getTime() - Date.now();
  return diff > 0 && diff <= 7 * 86400000;
}

function isOverdue(nextBillingDate: string | null, status: MemberStatus): boolean {
  if (!nextBillingDate || status !== 'active') return false;
  return new Date(nextBillingDate).getTime() < Date.now();
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  member: Member;
  onPress: () => void;
  isCheckedInToday: boolean;
};

export function MemberCard({ member, onPress, isCheckedInToday }: Props) {
  const statusCfg = memberStatusConfig[member.status];
  const avatarColor = getMemberAvatarColor(member.name);
  const expiring = isExpiringSoon(member.expiry_date);
  const overdue = isOverdue(member.next_billing_date, member.status);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar with status ring */}
      <View style={styles.avatarWrapper}>
        <View style={[styles.avatarRing, { borderColor: statusCfg.color }]}>
          <View style={[styles.avatar, { backgroundColor: avatarColor + '22' }]}>
            <Text style={[styles.avatarText, { color: avatarColor }]}>
              {getInitials(member.name)}
            </Text>
          </View>
        </View>
        {/* Overdue dot */}
        {overdue && <View style={styles.overdueDot} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Row 1: Name + status badge + warning */}
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{member.name}</Text>
          <View style={styles.rightBadges}>
            {expiring && (
              <Ionicons name="warning-outline" size={14} color="#F97316" />
            )}
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
              <Text style={[styles.statusText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Row 2: Plan */}
        <View style={styles.metaRow}>
          <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
          <Text style={styles.planText}>{member.plan_label}</Text>
        </View>

        {/* Row 3: Next billing + Last visit */}
        <View style={styles.twoColRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaSmall}>
              {member.next_billing_date ? formatDate(member.next_billing_date) : '—'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="barbell-outline" size={12} color={colors.textMuted} />
            <Text style={[
              styles.metaSmall,
              isCheckedInToday && { color: colors.primary, fontWeight: '600' },
            ]}>
              {isCheckedInToday ? '✓ Today' : lastVisitLabel(member.last_visit_at)}
            </Text>
          </View>
        </View>

        {/* Row 4: Streak */}
        <View style={styles.metaRow}>
          {member.streak > 0 ? (
            <>
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={styles.streakText}>{member.streak} day streak</Text>
            </>
          ) : (
            <Text style={styles.noVisits}>No recent visits</Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  avatarWrapper: { position: 'relative' },
  avatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, padding: 2,
  },
  avatar: {
    flex: 1, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  overdueDot: {
    position: 'absolute', top: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 1.5, borderColor: colors.background,
  },
  content: { flex: 1, gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  rightBadges: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planText: { fontSize: 13, color: colors.textSecondary },
  twoColRow: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaSmall: { fontSize: 11, color: colors.textMuted },
  fireEmoji: { fontSize: 13 },
  streakText: { fontSize: 12, fontWeight: '600', color: '#F97316' },
  noVisits: { fontSize: 12, color: colors.textMuted },
  chevron: { marginTop: 4 },
});
