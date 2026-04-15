import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useLeadsContext } from '@/context/LeadsContext';
import { LeadCard } from '@/components/LeadCard';
import { AddLeadModal } from '@/components/AddLeadModal';
import { colors, spacing, LEAD_STAGES } from '@/lib/theme';
import type { LeadStage } from '@/lib/theme';
import type { AppLead } from '@/context/LeadsContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const KANBAN_COL_WIDTH = SCREEN_WIDTH * 0.72;

type FilterKey = 'all' | LeadStage;
type SortKey = 'newest' | 'oldest' | 'last_contacted' | 'name_az';
type ViewMode = 'list' | 'kanban';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest',         label: 'Newest' },
  { key: 'oldest',         label: 'Oldest' },
  { key: 'last_contacted', label: 'Last Contacted' },
  { key: 'name_az',        label: 'Name A–Z' },
];

function sortLeads(leads: AppLead[], sort: SortKey): AppLead[] {
  return [...leads].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'last_contacted': {
        const aT = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
        const bT = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
        return bT - aT;
      }
      case 'name_az':
        return a.name.localeCompare(b.name);
    }
  });
}

// ── Sort Dropdown ─────────────────────────────────────────────────────────────

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (k: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = SORT_OPTIONS.find(o => o.key === value)?.label ?? 'Newest';

  return (
    <View style={{ position: 'relative', zIndex: 10 }}>
      <TouchableOpacity style={sortStyles.trigger} onPress={() => setOpen(o => !o)}>
        <Text style={sortStyles.triggerText}>Sort: {label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <Animated.View entering={FadeIn.duration(150)} style={sortStyles.dropdown}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={sortStyles.option}
              onPress={() => { onChange(opt.key); setOpen(false); }}
            >
              <Text style={[sortStyles.optionText, value === opt.key && sortStyles.optionTextActive]}>
                {opt.label}
              </Text>
              {value === opt.key && (
                <Ionicons name="checkmark" size={14} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>
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
  triggerText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  dropdown: {
    position: 'absolute', top: 34, right: 0,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    minWidth: 160, zIndex: 100,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 10,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  optionTextActive: { color: colors.primary, fontWeight: '700' },
});

// ── Kanban Board ──────────────────────────────────────────────────────────────

function KanbanBoard({ leads }: { leads: AppLead[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={kanbanStyles.board}
      decelerationRate="fast"
    >
      {LEAD_STAGES.map((stage, colIdx) => {
        const columnLeads = leads.filter(l => l.status === stage.key);
        return (
          <Animated.View
            key={stage.key}
            entering={FadeInDown.delay(colIdx * 80).duration(350).springify()}
            style={[kanbanStyles.column, { width: KANBAN_COL_WIDTH }]}
          >
            {/* Column header */}
            <View style={[kanbanStyles.colHeader, { borderTopColor: stage.color }]}>
              <Text style={kanbanStyles.colTitle}>{stage.label}</Text>
              <View style={[kanbanStyles.countBadge, { backgroundColor: stage.color + '22' }]}>
                <Text style={[kanbanStyles.countText, { color: stage.color }]}>
                  {columnLeads.length}
                </Text>
              </View>
            </View>

            {/* Cards */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {columnLeads.length === 0 ? (
                <View style={kanbanStyles.emptyCol}>
                  <Text style={kanbanStyles.emptyColText}>No leads</Text>
                </View>
              ) : (
                columnLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    compact
                    onPress={() => router.push(`/lead/${lead.id}`)}
                  />
                ))
              )}
            </ScrollView>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const kanbanStyles = StyleSheet.create({
  board: {
    paddingHorizontal: spacing.md,
    paddingBottom: 32,
    gap: 12,
  },
  column: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 520,
    overflow: 'hidden',
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  countBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 99,
  },
  countText: { fontSize: 12, fontWeight: '700' },
  emptyCol: { padding: 16, alignItems: 'center' },
  emptyColText: { fontSize: 12, color: colors.textMuted },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function LeadsScreen() {
  const { leads } = useLeadsContext();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [modalVisible, setModalVisible] = useState(false);

  const filtered = useMemo(() => {
    let result = leads;

    // Stage filter
    if (filter !== 'all') {
      result = result.filter(l => l.status === filter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q)
      );
    }

    return sortLeads(result, sort);
  }, [leads, filter, search, sort]);

  const filterKeys: FilterKey[] = ['all', ...LEAD_STAGES.map(s => s.key as LeadStage)];

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={styles.header}>
        <Text style={styles.title}>Leads</Text>
        <View style={styles.headerRight}>
          {/* View toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={viewMode === 'list' ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'kanban' && styles.toggleBtnActive]}
              onPress={() => setViewMode('kanban')}
            >
              <Ionicons
                name="grid-outline"
                size={18}
                color={viewMode === 'kanban' ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Add button */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {filterKeys.map(key => {
          const isAll = key === 'all';
          const stage = isAll ? null : LEAD_STAGES.find(s => s.key === key);
          const label = isAll ? 'All' : (stage?.label ?? key);
          const isActive = filter === key;
          const activeColor = stage?.color ?? colors.primary;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.pill,
                isActive
                  ? { backgroundColor: activeColor, borderColor: activeColor }
                  : { borderColor: colors.border },
              ]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Count + sort row */}
      <View style={styles.metaRow}>
        <Text style={styles.countLabel}>{filtered.length} Lead{filtered.length !== 1 ? 's' : ''}</Text>
        <SortDropdown value={sort} onChange={setSort} />
      </View>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
          <KanbanBoard leads={filtered} />
        </Animated.View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70).duration(400).springify()}>
              <LeadCard
                lead={item}
                onPress={() => router.push(`/lead/${item.id}`)}
              />
            </Animated.View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No leads found</Text>
              <Text style={styles.emptySubtext}>
                {search
                  ? 'No leads match your search.'
                  : 'Tap + to add your first lead.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Lead Modal */}
      <AddLeadModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 12,
    backgroundColor: colors.background,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleBtn: {
    padding: 7,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary + '20',
  },

  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.info,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.info,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },

  filterRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    zIndex: 10,
  },
  countLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: 32,
    gap: 10,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
