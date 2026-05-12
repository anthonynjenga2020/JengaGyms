import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClient } from '@/hooks/useClient';
import { useLeads } from '@/hooks/useLeads';
import { useReviews } from '@/hooks/useReviews';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useMembersContext } from '@/context/MembersContext';
import { MetricCard } from '@/components/MetricCard';
import { LeadItem } from '@/components/LeadItem';
import { colors, spacing } from '@/lib/theme';
import type { Member } from '@/context/MembersContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpiringSoon(m: Member): boolean {
  const diff = new Date(m.expiry_date).getTime() - Date.now();
  return diff > 0 && diff <= 7 * 86_400_000;
}

function isOverdue(m: Member): boolean {
  return (
    m.next_billing_date != null &&
    m.status === 'active' &&
    new Date(m.next_billing_date).getTime() < Date.now()
  );
}

function daysLeft(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
}

function formatKsh(n: number): string {
  return `${n.toLocaleString('en-KE')}`;
}

function openWhatsApp(phone: string, message: string) {
  const clean = phone.replace(/\D/g, '').replace(/^0/, '254');
  const url = `whatsapp://send?phone=${clean}&text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`)
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AlertCard({
  icon,
  iconColor,
  bg,
  border,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  iconColor: string;
  bg: string;
  border: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[alertStyles.card, { backgroundColor: bg, borderColor: border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon as any} size={18} color={iconColor} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[alertStyles.title, { color: iconColor }]}>{title}</Text>
        <Text style={alertStyles.sub}>{subtitle}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={14} color={iconColor} />}
    </TouchableOpacity>
  );
}

const alertStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
  },
  title: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});

function ExpiringMemberRow({ member }: { member: Member }) {
  const days = daysLeft(member.expiry_date);
  const msg =
    `Habari ${member.name.split(' ')[0]}! 👋\n\n` +
    `Quick reminder — your *${member.plan_label}* membership expires in *${days} day${days === 1 ? '' : 's'}*.\n\n` +
    `Renew now to keep your access going:\n` +
    `Reply here or visit the gym front desk.\n\n` +
    `— ${member.name.split(' ')[0].includes('Gym') ? 'The Team' : 'The Gym Team'}`;

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.info}>
        <Text style={rowStyles.name} numberOfLines={1}>{member.name}</Text>
        <Text style={rowStyles.meta}>
          <Text style={{ color: '#F97316', fontWeight: '600' }}>
            {days}d left
          </Text>
          {' · '}{member.plan_label}
        </Text>
      </View>
      <TouchableOpacity
        style={rowStyles.waBtn}
        onPress={() => openWhatsApp(member.phone, msg)}
      >
        <Ionicons name="logo-whatsapp" size={14} color={colors.primary} />
        <Text style={rowStyles.waBtnText}>Remind</Text>
      </TouchableOpacity>
    </View>
  );
}

function OverdueMemberRow({ member }: { member: Member }) {
  const msg =
    `Habari ${member.name.split(' ')[0]}! 👋\n\n` +
    `Your *${member.plan_label}* payment of *Ksh ${formatKsh(member.billing_amount)}* is overdue.\n\n` +
    `Please pay via M-Pesa or visit the gym to keep your membership active.\n\n` +
    `Any issues, just reply here!\n\n` +
    `— The Gym Team`;

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.info}>
        <Text style={rowStyles.name} numberOfLines={1}>{member.name}</Text>
        <Text style={rowStyles.meta}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>
            Ksh {formatKsh(member.billing_amount)}
          </Text>
          {' · '}{member.plan_label}
        </Text>
      </View>
      <TouchableOpacity
        style={[rowStyles.waBtn, { borderColor: colors.danger + '55', backgroundColor: colors.danger + '15' }]}
        onPress={() => openWhatsApp(member.phone, msg)}
      >
        <Ionicons name="logo-whatsapp" size={14} color={colors.danger} />
        <Text style={[rowStyles.waBtnText, { color: colors.danger }]}>Chase</Text>
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '15',
  },
  waBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { client, loading: clientLoading } = useClient();
  const { leads, loading: leadsLoading, refresh: refreshLeads } = useLeads(client?.id);
  const { reviews, averageRating, refresh: refreshReviews } = useReviews(client?.id);
  const { campaigns, refresh: refreshCampaigns } = useCampaigns(client?.id);
  const { members, checkIns } = useMembersContext();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshLeads(), refreshReviews(), refreshCampaigns()]);
    setRefreshing(false);
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const newLeads       = leads.filter(l => l.status === 'new_lead').length;
  const convertedLeads = leads.filter(l => l.status === 'joined_gym').length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const unrepliedReviews = reviews.filter(r => !r.replied).length;

  const todayStr         = new Date().toISOString().split('T')[0];
  const todayCheckIns    = checkIns.filter(ci => ci.date === todayStr).length;
  const expiringMembers  = members.filter(isExpiringSoon);
  const overdueMembers   = members.filter(isOverdue);
  const monthlyRevenue   = members
    .filter(m => m.status === 'active')
    .reduce((sum, m) => sum + (m.billing_cycle === 'monthly' ? m.billing_amount : 0), 0);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  if (clientLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.gymName}>{client?.gym_name ?? 'Your Gym'}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: client?.status === 'active' ? colors.primary : colors.warning }]}>
          <Text style={styles.badgeText}>{client?.plan?.toUpperCase() ?? 'STARTER'}</Text>
        </View>
      </View>

      {/* ── Today at a Glance ── */}
      <View style={styles.todaySection}>
        <Text style={styles.sectionTitle}>Today at a Glance</Text>

        <View style={styles.todayRow}>
          {/* Check-ins today */}
          <View style={styles.todayStat}>
            <Ionicons name="barbell-outline" size={18} color={colors.primary} />
            <Text style={styles.todayStatValue}>{todayCheckIns}</Text>
            <Text style={styles.todayStatLabel}>Check-ins{'\n'}today</Text>
          </View>
          {/* Expiring soon */}
          <View style={[styles.todayStat, expiringMembers.length > 0 && styles.todayStatWarn]}>
            <Ionicons name="warning-outline" size={18} color={expiringMembers.length > 0 ? '#F97316' : colors.textMuted} />
            <Text style={[styles.todayStatValue, expiringMembers.length > 0 && { color: '#F97316' }]}>
              {expiringMembers.length}
            </Text>
            <Text style={styles.todayStatLabel}>Expiring{'\n'}this week</Text>
          </View>
          {/* Overdue */}
          <View style={[styles.todayStat, overdueMembers.length > 0 && styles.todayStatDanger]}>
            <Ionicons name="alert-circle-outline" size={18} color={overdueMembers.length > 0 ? colors.danger : colors.textMuted} />
            <Text style={[styles.todayStatValue, overdueMembers.length > 0 && { color: colors.danger }]}>
              {overdueMembers.length}
            </Text>
            <Text style={styles.todayStatLabel}>Overdue{'\n'}payments</Text>
          </View>
          {/* Monthly revenue */}
          <View style={styles.todayStat}>
            <Ionicons name="cash-outline" size={18} color={colors.accent} />
            <Text style={[styles.todayStatValue, { color: colors.accent, fontSize: monthlyRevenue >= 100000 ? 14 : 18 }]}>
              {monthlyRevenue >= 1000
                ? `${Math.round(monthlyRevenue / 1000)}k`
                : formatKsh(monthlyRevenue)}
            </Text>
            <Text style={styles.todayStatLabel}>Monthly{'\n'}revenue</Text>
          </View>
        </View>
      </View>

      {/* ── Expiring Members ── */}
      {expiringMembers.length > 0 && (
        <View style={styles.actionSection}>
          <View style={styles.actionHeader}>
            <Ionicons name="warning-outline" size={15} color="#F97316" />
            <Text style={[styles.sectionTitle, { color: '#F97316' }]}>
              {expiringMembers.length} member{expiringMembers.length > 1 ? 's' : ''} expiring this week
            </Text>
          </View>
          <View style={styles.actionList}>
            {expiringMembers.map(m => (
              <ExpiringMemberRow key={m.id} member={m} />
            ))}
          </View>
        </View>
      )}

      {/* ── Overdue Payments ── */}
      {overdueMembers.length > 0 && (
        <View style={styles.actionSection}>
          <View style={styles.actionHeader}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={[styles.sectionTitle, { color: colors.danger }]}>
              {overdueMembers.length} overdue payment{overdueMembers.length > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.actionList}>
            {overdueMembers.map(m => (
              <OverdueMemberRow key={m.id} member={m} />
            ))}
          </View>
        </View>
      )}

      {/* ── Review alert ── */}
      {unrepliedReviews > 0 && (
        <AlertCard
          icon="star-outline"
          iconColor={colors.accent}
          bg="#1A1500"
          border={colors.accent + '55'}
          title={`${unrepliedReviews} review${unrepliedReviews > 1 ? 's' : ''} waiting for a reply`}
          subtitle="Responding to reviews boosts your Google ranking"
          onPress={() => router.push('/(tabs)/reviews')}
        />
      )}

      {/* ── KPI Metrics ── */}
      <Text style={styles.sectionTitle}>This Month</Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="New Leads"
          value={newLeads}
          icon="people-outline"
          color={colors.info}
          subtitle={`${leads.length} total`}
        />
        <MetricCard
          label="Converted"
          value={convertedLeads}
          icon="checkmark-circle-outline"
          color={colors.success}
          subtitle={leads.length > 0 ? `${Math.round((convertedLeads / leads.length) * 100)}% rate` : '0% rate'}
        />
        <MetricCard
          label="Avg Rating"
          value={averageRating.toFixed(1)}
          icon="star-outline"
          color={colors.accent}
          subtitle={`${reviews.length} reviews`}
        />
        <MetricCard
          label="Campaigns"
          value={activeCampaigns}
          icon="megaphone-outline"
          color={colors.primary}
          subtitle="active"
        />
      </View>

      {/* ── Top Member Streaks ── */}
      {members.filter(m => m.streak > 0).length > 0 && (
        <View style={styles.streakSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Text style={{ fontSize: 16 }}>🔥</Text>
            <Text style={styles.sectionTitle}>Top Streaks</Text>
          </View>
          {[...members]
            .filter(m => m.streak > 0)
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 3)
            .map((m, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <View key={m.id} style={styles.streakRow}>
                  <Text style={styles.streakMedal}>{medals[i]}</Text>
                  <Text style={styles.streakName} numberOfLines={1}>{m.name}</Text>
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakCount}>{m.streak}d</Text>
                  </View>
                </View>
              );
            })}
        </View>
      )}

      {/* ── Recent Leads ── */}
      <Text style={styles.sectionTitle}>Recent Leads</Text>
      {leadsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
      ) : leads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No leads yet. Share your website to start capturing leads!</Text>
        </View>
      ) : (
        <View style={styles.leadsList}>
          {leads.slice(0, 5).map(lead => (
            <LeadItem key={lead.id} lead={lead} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingTop: 56,
    paddingBottom: 32,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    color: colors.textMuted,
  },
  gymName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  // ── Today section
  todaySection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  todayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  todayStatWarn: {
    backgroundColor: '#F9731610',
    borderRadius: 10,
  },
  todayStatDanger: {
    backgroundColor: colors.danger + '10',
    borderRadius: 10,
  },
  todayStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  todayStatLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  // ── Action sections (expiring / overdue)
  actionSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionList: {
    paddingHorizontal: 12,
  },
  // ── General
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  leadsList: {
    gap: 8,
  },
  emptyState: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  // ── Streak leaderboard
  streakSection: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  streakMedal: { fontSize: 18, width: 26, textAlign: 'center' },
  streakName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  streakBadge: {
    backgroundColor: '#F97316' + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  streakCount: { fontSize: 13, fontWeight: '700', color: '#F97316' },
});
