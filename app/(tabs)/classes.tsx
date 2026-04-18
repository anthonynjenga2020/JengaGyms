import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Platform, Animated, useWindowDimensions, ScrollView,
  TextInput, Modal, Pressable, Switch,
} from 'react-native';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import {
  useClassesContext,
  CATEGORY_COLORS, CATEGORY_LABELS, STATUS_COLORS,
  getDerivedStatus,
} from '@/context/ClassesContext';
import { colors, spacing } from '@/lib/theme';
import type { GymClass, ClassCategory, DerivedStatus } from '@/context/ClassesContext';
import { AddClassModal } from '@/components/AddClassModal';

// ── Date helpers ──────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];
const DAYS_BEFORE = 14;
const DAYS_AFTER  = 30;

const ALL_DAYS = Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, i) => {
  const d = new Date(Date.now() + (i - DAYS_BEFORE) * 86400000);
  return {
    dateStr: d.toISOString().split('T')[0],
    dayName: d.toLocaleDateString('en-KE', { weekday: 'short' }),
    dayNum:  d.getDate(),
    month:   d.toLocaleDateString('en-KE', { month: 'short' }),
  };
});

const TODAY_INDEX = DAYS_BEFORE;

function fmt12(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Week-view grid constants ──────────────────────────────────────────────────

const HOUR_H       = 56;               // px per hour
const GRID_START_H = 5;                // 05:00
const GRID_END_H   = 23;               // 23:00
const TOTAL_HOURS  = GRID_END_H - GRID_START_H;   // 18
const GRID_H       = TOTAL_HOURS * HOUR_H;         // 1008
const TIME_AXIS_W  = 44;

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getWeekDays(): Array<{ dateStr: string; dayName: string; dayNum: number }> {
  const now = new Date();
  const dow = now.getDay();                             // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-KE', { weekday: 'short' }),
      dayNum:  d.getDate(),
    };
  });
}

// Computed once at module load — represents current week
const WEEK_DAYS = getWeekDays();

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(cur);
      if (cur >= target) clearInterval(t);
    }, 20);
    return () => clearInterval(t);
  }, [target]);
  return val;
}

// ── Animated capacity bar ─────────────────────────────────────────────────────

function CapacityBar({ booked, max }: { booked: number; max: number }) {
  const pct     = max > 0 ? Math.min(booked / max, 1) : 0;
  const isFull  = booked >= max;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const barColor = widthAnim.interpolate({
    inputRange: [0, 0.79, 0.8, 1],
    outputRange: [colors.primary, colors.primary, '#F97316', isFull ? '#EF4444' : '#F97316'],
  });

  return (
    <View style={barStyles.wrapper}>
      {/* Track */}
      <View style={barStyles.track}>
        <Animated.View
          style={[
            barStyles.fill,
            {
              width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      {isFull ? (
        <View style={barStyles.fullBadge}>
          <Text style={barStyles.fullText}>Full</Text>
        </View>
      ) : (
        <Text style={barStyles.countText}>{booked} / {max} spots</Text>
      )}
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  track: {
    flex: 1, height: 4, backgroundColor: colors.border,
    borderRadius: 2, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  countText: { fontSize: 11, color: colors.textMuted, fontWeight: '500', flexShrink: 0 },
  fullBadge: {
    backgroundColor: '#EF4444' + '20',
    borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2,
  },
  fullText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
});

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReturnType<typeof getDerivedStatus> }) {
  const color = STATUS_COLORS[status];
  const label = {
    upcoming: 'Upcoming', in_progress: 'In Progress',
    completed: 'Completed', cancelled: 'Cancelled',
  }[status];
  return (
    <View style={[badgeStyles.pill, { backgroundColor: color + '20' }]}>
      {status === 'in_progress' && <View style={[badgeStyles.dot, { backgroundColor: color }]} />}
      <Text style={[badgeStyles.text, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700' },
});

// ── Class Card ────────────────────────────────────────────────────────────────

function ClassCard({ cls, index }: { cls: GymClass; index: number }) {
  const { getTrainer } = useClassesContext();
  const trainer = getTrainer(cls.trainer_id);
  const status  = getDerivedStatus(cls);
  const catColor = CATEGORY_COLORS[cls.category];

  return (
    <RNAnimated.View entering={FadeInDown.delay(index * 70).duration(350).springify()}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/class/${cls.id}`)}
        activeOpacity={0.75}
      >
        {/* Category bar */}
        <View style={[styles.categoryBar, { backgroundColor: catColor }]} />

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Row 1: name + status */}
          <View style={styles.cardRow}>
            <Text style={styles.className} numberOfLines={1}>{cls.name}</Text>
            <StatusBadge status={status} />
          </View>

          {/* Row 2: time */}
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.cardMetaText}>
              {fmt12(cls.start_time)} — {fmt12(cls.end_time)}
            </Text>
          </View>

          {/* Row 3: trainer */}
          {trainer && (
            <View style={styles.cardMeta}>
              <View style={[styles.trainerDot, { backgroundColor: trainer.color }]}>
                <Text style={styles.trainerInitials}>{trainer.avatar_initials}</Text>
              </View>
              <Text style={styles.cardMetaText}>{trainer.name}</Text>
            </View>
          )}

          {/* Row 4: capacity bar */}
          <View style={styles.cardMeta}>
            <Ionicons name="people-outline" size={13} color={colors.textMuted} />
            <CapacityBar booked={cls.booked_count} max={cls.max_capacity} />
          </View>

          {/* Location */}
          {cls.location && (
            <View style={styles.cardMeta}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.cardMetaText}>{cls.location}</Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ classes }: { classes: GymClass[] }) {
  const totalClasses = useCountUp(classes.length);
  const totalSpots   = useCountUp(classes.reduce((s, c) => s + c.max_capacity, 0));
  const booked       = useCountUp(classes.reduce((s, c) => s + c.booked_count, 0));

  return (
    <View style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryValue, { color: colors.primary }]}>{totalClasses}</Text>
        <Text style={styles.summaryLabel}>Classes Today</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryValue, { color: colors.text }]}>{totalSpots}</Text>
        <Text style={styles.summaryLabel}>Total Spots</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryValue, { color: '#F97316' }]}>{booked}</Text>
        <Text style={styles.summaryLabel}>Booked</Text>
      </View>
    </View>
  );
}

// ── Date Strip ────────────────────────────────────────────────────────────────

function DateStrip({
  selected, onSelect,
}: { selected: string; onSelect: (d: string) => void }) {
  const listRef = useRef<FlatList>(null);
  const { getClassesForDay } = useClassesContext();

  // Auto-scroll to today on mount
  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: TODAY_INDEX, animated: true, viewPosition: 0.5 });
    }, 150);
  }, []);

  return (
    <FlatList
      ref={listRef}
      data={ALL_DAYS}
      horizontal
      keyExtractor={d => d.dateStr}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dateStripContent}
      getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
      renderItem={({ item }) => {
        const isToday    = item.dateStr === TODAY;
        const isSelected = item.dateStr === selected;
        const hasClasses = getClassesForDay(item.dateStr).length > 0;

        return (
          <TouchableOpacity
            style={styles.dateItem}
            onPress={() => onSelect(item.dateStr)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
              {isToday ? 'Today' : item.dayName}
            </Text>
            <View style={[
              styles.dayCircle,
              isToday && styles.dayCircleToday,
              isSelected && !isToday && styles.dayCircleSelected,
            ]}>
              <Text style={[
                styles.dayNum,
                isToday && styles.dayNumToday,
                isSelected && !isToday && styles.dayNumSelected,
              ]}>
                {item.dayNum}
              </Text>
            </View>
            {/* Dot indicator if classes exist */}
            {hasClasses && (
              <View style={[styles.hasClassDot, { backgroundColor: isSelected ? colors.primary : colors.textMuted }]} />
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────

type FilterFn = (c: GymClass) => boolean;

function WeekView({ classes, filterFn }: { classes: GymClass[]; filterFn: FilterFn }) {
  const { width }      = useWindowDimensions();
  const { getTrainer } = useClassesContext();
  const COL_W = Math.floor((width - TIME_AXIS_W) / 7);

  const now         = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const nowLineTop  = ((currentMins / 60) - GRID_START_H) * HOUR_H;
  const showNowLine = currentMins >= GRID_START_H * 60 && currentMins < GRID_END_H * 60;

  return (
    <View style={{ flex: 1 }}>
      {/* ── Fixed column headers ── */}
      <View style={wv.headerRow}>
        <View style={{ width: TIME_AXIS_W }} />
        {WEEK_DAYS.map(day => {
          const isToday = day.dateStr === TODAY;
          return (
            <View key={day.dateStr} style={[wv.colHeader, { width: COL_W }]}>
              <Text style={[wv.colDayName, isToday && { color: colors.primary }]}>
                {day.dayName.toUpperCase()}
              </Text>
              <View style={[wv.colDayCircle, isToday && { backgroundColor: colors.primary }]}>
                <Text style={[wv.colDayNum, isToday && { color: '#000' }]}>
                  {day.dayNum}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Scrollable time grid ── */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[wv.grid, { height: GRID_H + 24 }]}>

          {/* Time axis */}
          <View style={[wv.timeAxis, { width: TIME_AXIS_W }]}>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <Text key={i} style={[wv.timeLabel, { top: i * HOUR_H - 7 }]}>
                {String(GRID_START_H + i).padStart(2, '0')}:00
              </Text>
            ))}
          </View>

          {/* Day columns */}
          {WEEK_DAYS.map((day, colIndex) => {
            const isToday    = day.dateStr === TODAY;
            const dayClasses = classes.filter(c => c.date === day.dateStr && filterFn(c));

            return (
              <RNAnimated.View
                key={day.dateStr}
                entering={FadeInRight.delay(colIndex * 55).springify()}
                style={[wv.column, { width: COL_W, height: GRID_H }, isToday && wv.todayCol]}
              >
                {/* Horizontal hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <View key={i} style={[wv.gridLine, { top: i * HOUR_H }]} />
                ))}

                {/* Current-time red line (today only) */}
                {isToday && showNowLine && (
                  <View style={[wv.nowLine, { top: nowLineTop }]}>
                    <View style={wv.nowDot} />
                  </View>
                )}

                {/* Class blocks */}
                {dayClasses.map(cls => {
                  const startMins = timeToMins(cls.start_time);
                  const endMins   = timeToMins(cls.end_time);
                  const top    = ((startMins / 60) - GRID_START_H) * HOUR_H;
                  const height = Math.max(((endMins - startMins) / 60) * HOUR_H, 26);
                  const cat    = CATEGORY_COLORS[cls.category];
                  const trainer = getTrainer(cls.trainer_id);

                  return (
                    <TouchableOpacity
                      key={cls.id}
                      style={[wv.block, { top, height, width: COL_W - 3, backgroundColor: cat + '28', borderLeftColor: cat }]}
                      onPress={() => router.push(`/class/${cls.id}`)}
                      activeOpacity={0.75}
                    >
                      <Text style={[wv.blockName, { color: cat }]} numberOfLines={2}>
                        {cls.name}
                      </Text>
                      {height >= 40 && trainer && (
                        <Text style={wv.blockTrainer} numberOfLines={1}>
                          {trainer.name.split(' ')[0]}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </RNAnimated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const wv = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
    paddingBottom: 4,
  },
  colHeader: { alignItems: 'center', paddingVertical: 6, gap: 3 },
  colDayName: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  colDayCircle: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  colDayNum: { fontSize: 12, fontWeight: '700', color: colors.text },

  grid: { flexDirection: 'row' },
  timeAxis: { position: 'relative' },
  timeLabel: {
    position: 'absolute', right: 4,
    fontSize: 9, color: colors.textMuted, fontWeight: '500',
  },
  column: {
    position: 'relative',
    borderLeftWidth: 1, borderLeftColor: colors.border,
    overflow: 'hidden',
  },
  todayCol: { backgroundColor: colors.primary + '07' },

  gridLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: colors.border, opacity: 0.55,
  },
  nowLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: colors.danger, zIndex: 10,
  },
  nowDot: {
    position: 'absolute', left: -4, top: -3,
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger,
  },
  block: {
    position: 'absolute', left: 1,
    borderRadius: 4, borderLeftWidth: 2,
    padding: 3, zIndex: 5,
  },
  blockName: { fontSize: 9, fontWeight: '700', lineHeight: 12 },
  blockTrainer: { fontSize: 8, color: colors.textMuted, lineHeight: 11, marginTop: 1 },
});

// ── Filter constants ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: { key: DerivedStatus; label: string }[] = [
  { key: 'upcoming',    label: 'Upcoming' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed' },
  { key: 'cancelled',   label: 'Cancelled' },
];

// ── Search Bar ────────────────────────────────────────────────────────────────

function SearchBar({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  return (
    <View style={sb.row}>
      <Ionicons name="search-outline" size={15} color={colors.textMuted} />
      <TextInput
        style={sb.input}
        placeholder="Search classes or trainers..."
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={onChange}
        returnKeyType="search"
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
          <Ionicons name="close-circle" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const sb = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 10,
  },
  input: { flex: 1, fontSize: 14, color: colors.text },
});

// ── Filter Sheet ──────────────────────────────────────────────────────────────

type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  filterTrainers: string[];
  filterCategories: ClassCategory[];
  filterStatuses: DerivedStatus[];
  filterAvailableOnly: boolean;
  onApply: (t: string[], c: ClassCategory[], s: DerivedStatus[], a: boolean) => void;
  onReset: () => void;
};

function FilterSheet({
  visible, onClose,
  filterTrainers, filterCategories, filterStatuses, filterAvailableOnly,
  onApply, onReset,
}: FilterSheetProps) {
  const { trainers } = useClassesContext();
  const translateY = useRef(new Animated.Value(600)).current;
  const backdrop   = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // Draft state — only applied when "Apply" is tapped
  const [dT, setDT] = useState<string[]>([]);
  const [dC, setDC] = useState<ClassCategory[]>([]);
  const [dS, setDS] = useState<DerivedStatus[]>([]);
  const [dA, setDA] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setDT(filterTrainers); setDC(filterCategories);
      setDS(filterStatuses); setDA(filterAvailableOnly);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 600, duration: 260, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  function toggle<T>(arr: T[], val: T, set: (a: T[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  function handleReset() {
    onReset(); onClose();
  }

  function handleApply() {
    onApply(dT, dC, dS, dA); onClose();
  }

  const draftCount = dT.length + dC.length + dS.length + (dA ? 1 : 0);

  if (!mounted) return null;

  return (
    <Modal transparent animationType="none" visible={mounted} onRequestClose={onClose}>
      <Animated.View style={[fs.backdrop, { opacity: backdrop }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[fs.sheet, { transform: [{ translateY }] }]}>
        <View style={fs.handle} />

        {/* Header */}
        <View style={fs.header}>
          <Text style={fs.title}>Filters</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={fs.resetTxt}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={fs.scroll} showsVerticalScrollIndicator={false}>
          {/* Trainers */}
          <Text style={fs.sectionLabel}>TRAINER</Text>
          <View style={fs.pillRow}>
            {trainers.map(t => {
              const on = dT.includes(t.id);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[fs.pill, on && { backgroundColor: t.color + '28', borderColor: t.color }]}
                  onPress={() => toggle(dT, t.id, setDT)}
                >
                  <View style={[fs.trainerAvatar, { backgroundColor: t.color }]}>
                    <Text style={fs.trainerInit}>{t.avatar_initials}</Text>
                  </View>
                  <Text style={[fs.pillTxt, on && { color: t.color }]}>
                    {t.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Categories */}
          <Text style={fs.sectionLabel}>CATEGORY</Text>
          <View style={fs.pillRow}>
            {(Object.keys(CATEGORY_LABELS) as ClassCategory[]).map(cat => {
              const on    = dC.includes(cat);
              const color = CATEGORY_COLORS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[fs.pill, on && { backgroundColor: color + '28', borderColor: color }]}
                  onPress={() => toggle(dC, cat, setDC)}
                >
                  {on && <View style={[fs.catDot, { backgroundColor: color }]} />}
                  <Text style={[fs.pillTxt, on && { color }]}>{CATEGORY_LABELS[cat]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Statuses */}
          <Text style={fs.sectionLabel}>STATUS</Text>
          <View style={fs.pillRow}>
            {STATUS_OPTIONS.map(({ key, label }) => {
              const on    = dS.includes(key);
              const color = STATUS_COLORS[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[fs.pill, on && { backgroundColor: color + '28', borderColor: color }]}
                  onPress={() => toggle(dS, key, setDS)}
                >
                  <Text style={[fs.pillTxt, on && { color }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Availability */}
          <View style={fs.switchRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={fs.switchLabel}>Available classes only</Text>
              <Text style={fs.switchSub}>Hide classes that are full</Text>
            </View>
            <Switch
              value={dA}
              onValueChange={setDA}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={dA ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Apply button */}
        <View style={fs.footer}>
          <TouchableOpacity style={fs.applyBtn} onPress={handleApply}>
            <Text style={fs.applyTxt}>
              Apply Filters{draftCount > 0 ? ` (${draftCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 12, gap: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  resetTxt: { fontSize: 14, color: colors.info, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: spacing.md },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 0.8, marginTop: 16, marginBottom: 8,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 99, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: colors.background,
  },
  pillTxt: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  trainerAvatar: {
    width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  trainerInit: { fontSize: 7, fontWeight: '800', color: '#fff' },
  catDot: { width: 7, height: 7, borderRadius: 4 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginTop: 16,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchSub: { fontSize: 12, color: colors.textMuted },
  footer: {
    paddingHorizontal: spacing.md, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  applyBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  applyTxt: { fontSize: 15, fontWeight: '700', color: '#000' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ClassesScreen() {
  const { classes, getClassesForDay, getTrainer } = useClassesContext();
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [addVisible, setAddVisible]     = useState(false);
  const [viewMode, setViewMode]         = useState<'day' | 'week'>('day');
  const [weekViewKey, setWeekViewKey]   = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');

  // Filter state
  const [filterTrainers,      setFilterTrainers]      = useState<string[]>([]);
  const [filterCategories,    setFilterCategories]    = useState<ClassCategory[]>([]);
  const [filterStatuses,      setFilterStatuses]      = useState<DerivedStatus[]>([]);
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false);

  const activeFilterCount =
    filterTrainers.length + filterCategories.length +
    filterStatuses.length + (filterAvailableOnly ? 1 : 0);

  function switchToWeek() {
    setViewMode('week');
    setWeekViewKey(k => k + 1);
  }

  function handleApplyFilters(t: string[], c: ClassCategory[], s: DerivedStatus[], a: boolean) {
    setFilterTrainers(t); setFilterCategories(c);
    setFilterStatuses(s); setFilterAvailableOnly(a);
  }

  function handleResetFilters() {
    setFilterTrainers([]); setFilterCategories([]);
    setFilterStatuses([]); setFilterAvailableOnly(false);
  }

  // Filter predicate shared by day view and week view
  const filterFn = useCallback((c: GymClass): boolean => {
    if (filterCategories.length > 0 && !filterCategories.includes(c.category)) return false;
    if (filterTrainers.length > 0   && !filterTrainers.includes(c.trainer_id))  return false;
    if (filterStatuses.length > 0   && !filterStatuses.includes(getDerivedStatus(c))) return false;
    if (filterAvailableOnly && c.booked_count >= c.max_capacity) return false;
    return true;
  }, [filterCategories, filterTrainers, filterStatuses, filterAvailableOnly]);

  // Day view: apply filters then search
  const dayClasses = useMemo(() => {
    let result = getClassesForDay(selectedDate).filter(filterFn);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => {
        const t = getTrainer(c.trainer_id);
        return c.name.toLowerCase().includes(q) || (t?.name.toLowerCase().includes(q) ?? false);
      });
    }
    return result;
  }, [selectedDate, getClassesForDay, filterFn, searchQuery, getTrainer]);

  const todayClasses = useMemo(
    () => getClassesForDay(TODAY),
    [getClassesForDay],
  );

  // Change key on date change to remount FlatList and re-trigger animations
  const [listKey, setListKey] = useState(TODAY);
  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setListKey(date);
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Classes</Text>

        {/* View-mode toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'day' && styles.viewBtnActive]}
            onPress={() => setViewMode('day')}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={viewMode === 'day' ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'week' && styles.viewBtnActive]}
            onPress={switchToWeek}
          >
            <Ionicons
              name="calendar-number-outline"
              size={18}
              color={viewMode === 'week' ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Filter button with active-count badge */}
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons
            name="options-outline"
            size={19}
            color={activeFilterCount > 0 ? colors.primary : colors.textMuted}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeTxt}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {viewMode === 'day' ? (
        <>
          {/* Date strip */}
          <DateStrip selected={selectedDate} onSelect={handleDateSelect} />

          {/* Search bar */}
          <SearchBar query={searchQuery} onChange={setSearchQuery} />

          {/* Summary bar — always shows today's unfiltered stats */}
          <SummaryBar classes={todayClasses} />

          {/* Selected day label */}
          <View style={styles.dayLabel}>
            <Text style={styles.dayLabelText}>
              {selectedDate === TODAY
                ? 'Today'
                : new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={styles.dayLabelCount}>
              {dayClasses.length} class{dayClasses.length !== 1 ? 'es' : ''}
              {(activeFilterCount > 0 || searchQuery) ? ' · filtered' : ''}
            </Text>
          </View>

          {/* Class list */}
          <FlatList
            key={listKey}
            data={dayClasses}
            keyExtractor={c => c.id}
            renderItem={({ item, index }) => <ClassCard cls={item} index={index} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={52} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>
                  {searchQuery || activeFilterCount > 0
                    ? 'No classes match your search'
                    : 'No classes scheduled'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery || activeFilterCount > 0
                    ? 'Try adjusting your filters or search term.'
                    : selectedDate === TODAY
                    ? 'Nothing on the schedule for today.'
                    : `Nothing scheduled for ${new Date(selectedDate).toLocaleDateString('en-KE', { weekday: 'long' })}.`}
                </Text>
                {!searchQuery && activeFilterCount === 0 && (
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setAddVisible(true)}>
                    <Ionicons name="add" size={16} color="#000" />
                    <Text style={styles.emptyBtnText}>Schedule a Class</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </>
      ) : (
        <WeekView key={weekViewKey} classes={classes} filterFn={filterFn} />
      )}

      {/* Add / Edit class modal */}
      <AddClassModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        defaultDate={selectedDate}
      />

      {/* Filter sheet */}
      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filterTrainers={filterTrainers}
        filterCategories={filterCategories}
        filterStatuses={filterStatuses}
        filterAvailableOnly={filterAvailableOnly}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 12,
    gap: 8,
    backgroundColor: colors.background,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, flex: 1 },

  // View-mode toggle pill
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 3, gap: 2,
  },
  viewBtn: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  viewBtnActive: { backgroundColor: colors.surfaceElevated },

  // Filter button
  filterBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBtnActive: { borderColor: colors.primary },
  filterBadge: {
    position: 'absolute', top: -5, right: -5,
    backgroundColor: colors.primary,
    borderRadius: 9, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 2, borderColor: colors.background,
  },
  filterBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#000' },

  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.info,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.info, shadowOpacity: 0.35, shadowRadius: 6, elevation: 5,
  },

  // Date strip
  dateStripContent: { paddingHorizontal: spacing.md, paddingBottom: 10, gap: 4 },
  dateItem: { width: 48, alignItems: 'center', gap: 4, paddingVertical: 2 },
  dayName: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  dayNameSelected: { color: colors.primary },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  dayCircleToday: { backgroundColor: colors.primary },
  dayCircleSelected: { borderWidth: 1.5, borderColor: colors.primary },
  dayNum: { fontSize: 15, fontWeight: '600', color: colors.text },
  dayNumToday: { color: '#000' },
  dayNumSelected: { color: colors.primary },
  hasClassDot: { width: 4, height: 4, borderRadius: 2 },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: 12,
    paddingVertical: 14,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  summaryLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  // Day label
  dayLabel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: 10,
  },
  dayLabelText: { fontSize: 15, fontWeight: '700', color: colors.text },
  dayLabelCount: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  // List
  list: { paddingHorizontal: spacing.md, paddingBottom: 32, gap: 10 },

  // Class card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', alignItems: 'center',
  },
  categoryBar: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: 13, gap: 7 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  className: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMetaText: { fontSize: 12, color: colors.textSecondary },
  trainerDot: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  trainerInitials: { fontSize: 8, fontWeight: '800', color: '#fff' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 11, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
});
