import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Platform, Animated,
} from 'react-native';
import { useState, useMemo, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useMembersContext } from '@/context/MembersContext';
import { MemberCard } from '@/components/MemberCard';
import { AddMemberModal } from '@/components/AddMemberModal';
import { CheckInModal } from '@/components/CheckInModal';
import { colors, spacing } from '@/lib/theme';
import type { Member, MemberStatus } from '@/context/MembersContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | MemberStatus;
type SortKey = 'name_az' | 'name_za' | 'newest' | 'expiring_soon' | 'last_visit' | 'overdue_payment';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name_az',         label: 'Name A–Z' },
  { key: 'name_za',         label: 'Name Z–A' },
  { key: 'newest',          label: 'Newest Member' },
  { key: 'expiring_soon',   label: 'Expiring Soon' },
  { key: 'last_visit',      label: 'Last Visit (Recent)' },
  { key: 'overdue_payment', label: 'Overdue Payment' },
];

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'expired',  label: 'Expired' },
  { key: 'frozen',   label: 'Frozen' },
];

function daysToExpiry(expiryDate: string) {
  return (new Date(expiryDate).getTime() - Date.now()) / 86400000;
}

function isExpiringSoon(m: Member) {
  const days = daysToExpiry(m.expiry_date);
  return days > 0 && days <= 7;
}

function isOverdue(m: Member) {
  return m.next_billing_date != null &&
    m.status === 'active' &&
    new Date(m.next_billing_date).getTime() < Date.now();
}

function sortMembers(members: Member[], sort: SortKey): Member[] {
  return [...members].sort((a, b) => {
    switch (sort) {
      case 'name_az':   return a.name.localeCompare(b.name);
      case 'name_za':   return b.name.localeCompare(a.name);
      case 'newest':    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'expiring_soon': {
        const da = daysToExpiry(a.expiry_date);
        const db = daysToExpiry(b.expiry_date);
        if (da <= 7 && db > 7) return -1;
        if (db <= 7 && da > 7) return 1;
        return da - db;
      }
      case 'last_visit': {
        const ta = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0;
        const tb = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0;
        return tb - ta;
      }
      case 'overdue_payment': {
        const aO = isOverdue(a) ? 0 : 1;
        const bO = isOverdue(b) ? 0 : 1;
        return aO - bO;
      }
    }
  });
}

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(current);
      if (current >= target) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [target]);
  return count;
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ members }: { members: Member[] }) {
  const activeCount    = members.filter(m => m.status === 'active').length;
  const expiringCount  = members.filter(isExpiringSoon).length;
  const inactiveCount  = members.filter(m => m.status === 'inactive').length;

  const active   = useCountUp(activeCount);
  const expiring = useCountUp(expiringCount);
  const inactive = useCountUp(inactiveCount);

  return (
    <View style={statsStyles.bar}>
      <View style={statsStyles.item}>
        <Text style={[statsStyles.value, { color: colors.primary }]}>{active}</Text>
        <Text style={statsStyles.label}>Active</Text>
      </View>
      <View style={statsStyles.divider} />
      <View style={statsStyles.item}>
        <Text style={[statsStyles.value, { color: '#F97316' }]}>{expiring}</Text>
        <Text style={statsStyles.label}>Expiring Soon</Text>
      </View>
      <View style={statsStyles.divider} />
      <View style={statsStyles.item}>
        <Text style={[statsStyles.value, { color: colors.textMuted }]}>{inactive}</Text>
        <Text style={statsStyles.label}>Inactive</Text>
      </View>
    </View>
  );
}

const statsStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: 12,
    paddingVertical: 14,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  value: { fontSize: 26, fontWeight: '700', lineHeight: 30 },
  label: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  divider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
});

// ── Revenue Bar ───────────────────────────────────────────────────────────────

function RevenueBar({ members }: { members: Member[] }) {
  const monthly = members
    .filter(m => m.status === 'active' && m.billing_cycle === 'monthly')
    .reduce((s, m) => s + m.billing_amount, 0);

  const atRisk = members
    .filter(m => isExpiringSoon(m) || isOverdue(m))
    .reduce((s, m) => s + m.billing_amount, 0);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-KE');

  if (monthly === 0) return null;

  return (
    <View style={revenueStyles.bar}>
      <View style={revenueStyles.item}>
        <Text style={revenueStyles.label}>Monthly MRR</Text>
        <Text style={[revenueStyles.value, { color: colors.primary }]}>Ksh {fmt(monthly)}</Text>
      </View>
      <View style={revenueStyles.divider} />
      <View style={revenueStyles.item}>
        <Text style={revenueStyles.label}>At Risk</Text>
        <Text style={[revenueStyles.value, { color: atRisk > 0 ? '#F97316' : colors.textMuted }]}>
          {atRisk > 0 ? `Ksh ${fmt(atRisk)}` : '—'}
        </Text>
      </View>
    </View>
  );
}

const revenueStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: 12,
    paddingVertical: 12,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  value: { fontSize: 18, fontWeight: '700' },
  divider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
});

// ── Sort Dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const label = SORT_OPTIONS.find(o => o.key === value)?.label ?? 'Name A–Z';
  return (
    <View style={{ zIndex: 10, position: 'relative' }}>
      <TouchableOpacity style={sortStyles.trigger} onPress={() => setOpen(o => !o)}>
        <Text style={sortStyles.triggerText}>Sort: {label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <RNAnimated.View entering={FadeIn.duration(150)} style={sortStyles.dropdown}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={sortStyles.option}
              onPress={() => { onChange(opt.key); setOpen(false); }}
            >
              <Text style={[sortStyles.optText, value === opt.key && sortStyles.optTextActive]}>
                {opt.label}
              </Text>
              {value === opt.key && <Ionicons name="checkmark" size={13} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </RNAnimated.View>
      )}
    </View>
  );
}

const sortStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  triggerText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  dropdown: {
    position: 'absolute', top: 32, right: 0,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    minWidth: 180, zIndex: 100,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optText: { fontSize: 13, color: colors.textSecondary },
  optTextActive: { color: colors.primary, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MembersScreen() {
  const { members, isCheckedInToday } = useMembersContext();
  const [filter, setFilter]     = useState<FilterKey>('all');
  const [sort, setSort]         = useState<SortKey>('name_az');
  const [search, setSearch]     = useState('');
  const [addVisible, setAddVisible]       = useState(false);
  const [checkInVisible, setCheckInVisible] = useState(false);

  const filtered = useMemo(() => {
    let result = members;

    if (filter !== 'all') result = result.filter(m => m.status === filter);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.plan_label.toLowerCase().includes(q)
      );
    }

    return sortMembers(result, sort);
  }, [members, filter, search, sort]);

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Members</Text>
        <View style={styles.headerRight}>
          {/* Check-in button */}
          <TouchableOpacity style={styles.checkInBtn} onPress={() => setCheckInVisible(true)}>
            <Ionicons name="qr-code-outline" size={18} color={colors.text} />
            <Text style={styles.checkInLabel}>Check In</Text>
          </TouchableOpacity>
          {/* Add button */}
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search members..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <FlatList
        data={FILTER_PILLS}
        horizontal
        keyExtractor={i => i.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const isActive = filter === item.key;
          return (
            <TouchableOpacity
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Stats bar */}
      <StatsBar members={members} />

      {/* Revenue bar */}
      <RevenueBar members={members} />

      {/* Count + sort */}
      <View style={styles.metaRow}>
        <Text style={styles.countLabel}>{filtered.length} Member{filtered.length !== 1 ? 's' : ''}</Text>
        <SortDropdown value={sort} onChange={setSort} />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={m => m.id}
        renderItem={({ item, index }) => (
          <RNAnimated.View entering={FadeInDown.delay(index * 60).duration(380).springify()}>
            <MemberCard
              member={item}
              onPress={() => router.push(`/member/${item.id}`)}
              isCheckedInToday={isCheckedInToday(item.id)}
            />
          </RNAnimated.View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No members found</Text>
            <Text style={styles.emptySubtext}>
              {search ? 'No members match your search.' : 'Tap + to add your first member.'}
            </Text>
          </View>
        }
      />

      <AddMemberModal visible={addVisible} onClose={() => setAddVisible(false)} />
      <CheckInModal visible={checkInVisible} onClose={() => setCheckInVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  checkInLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.info,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.info, shadowOpacity: 0.4,
    shadowRadius: 8, elevation: 6,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  filterRow: { paddingHorizontal: spacing.md, paddingBottom: 12, gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 99, borderWidth: 1.5, borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#000', fontWeight: '700' },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: 10, zIndex: 10,
  },
  countLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 32, gap: 10 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
