import {
  View, Text, TextInput, Modal, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Pressable, ActivityIndicator,
  Platform, Switch,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  useClassesContext,
  CATEGORY_COLORS, CATEGORY_LABELS,
} from '@/context/ClassesContext';
import { colors, spacing } from '@/lib/theme';
import type { GymClass, ClassCategory, ClassTrainer } from '@/context/ClassesContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function addOneHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getRecurringPreview(date: string, repeat: string, endDate: string): string {
  if (!date || !repeat) return '';
  const d = new Date(date + 'T12:00:00');
  const labels: Record<string, string> = { daily: 'day', weekly: d.toLocaleDateString('en-KE', { weekday: 'long' }), monthly: 'month' };
  const cycleLabel = labels[repeat] ?? repeat;
  const untilPart = endDate
    ? `until ${new Date(endDate + 'T12:00:00').toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'indefinitely';
  return `This class will repeat every ${cycleLabel} ${untilPart}.`;
}

function isValidDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function isValidTime(s: string) { return /^\d{2}:\d{2}$/.test(s); }

const TODAY = new Date().toISOString().split('T')[0];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={sectionStyles.label}>{label.toUpperCase()}</Text>;
}

const sectionStyles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginTop: 4 },
});

type SelectOption<T extends string> = { key: T; label: string; sub?: string; color?: string };

function SelectField<T extends string>({
  label, value, options, onChange, error,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);

  return (
    <View style={sf.wrapper}>
      <Text style={sf.label}>{label}</Text>
      <TouchableOpacity
        style={[sf.trigger, error && sf.triggerError]}
        onPress={() => setOpen(o => !o)}
      >
        <View style={sf.triggerLeft}>
          {selected?.color && (
            <View style={[sf.colorDot, { backgroundColor: selected.color }]} />
          )}
          <Text style={sf.triggerText}>{selected?.label ?? 'Select...'}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={sf.dropdown}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[sf.option, value === opt.key && sf.optionActive]}
              onPress={() => { onChange(opt.key); setOpen(false); }}
            >
              <View style={sf.optLeft}>
                {opt.color && <View style={[sf.colorDot, { backgroundColor: opt.color }]} />}
                <View>
                  <Text style={[sf.optLabel, value === opt.key && sf.optLabelActive]}>{opt.label}</Text>
                  {opt.sub && <Text style={sf.optSub}>{opt.sub}</Text>}
                </View>
              </View>
              {value === opt.key && <Ionicons name="checkmark" size={14} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && <Text style={sf.error}>{error}</Text>}
    </View>
  );
}

const sf = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 13,
  },
  triggerError: { borderColor: colors.danger },
  triggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  triggerText: { fontSize: 15, color: colors.text },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  dropdown: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, marginTop: 2, overflow: 'hidden',
    zIndex: 50,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 13, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionActive: { backgroundColor: colors.primary + '12' },
  optLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optLabel: { fontSize: 14, color: colors.textSecondary },
  optLabelActive: { color: colors.primary, fontWeight: '600' },
  optSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  error: { fontSize: 12, color: colors.danger },
});

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultDate?: string;
  editClass?: GymClass;
};

// ── Main Component ────────────────────────────────────────────────────────────

export function AddClassModal({ visible, onClose, defaultDate, editClass }: Props) {
  const { addClass, updateClass, trainers } = useClassesContext();
  const translateY = useRef(new Animated.Value(700)).current;
  const backdrop   = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const isEdit = !!editClass;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name,         setName]         = useState('');
  const [category,     setCategory]     = useState<ClassCategory>('hiit');
  const [description,  setDescription]  = useState('');
  const [classType,    setClassType]    = useState<'recurring' | 'one_time'>('recurring');
  const [date,         setDate]         = useState(defaultDate ?? TODAY);
  const [startTime,    setStartTime]    = useState('07:00');
  const [endTime,      setEndTime]      = useState('08:00');
  const [location,     setLocation]     = useState('');
  const [maxCapacity,  setMaxCapacity]  = useState('20');
  const [trainerId,    setTrainerId]    = useState(trainers[0]?.id ?? '');
  const [allowWaitlist, setAllowWaitlist] = useState(false);
  const [maxWaitlist,  setMaxWaitlist]  = useState('5');
  const [repeat,       setRepeat]       = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [endDate,      setEndDate]      = useState('');
  const [classStatus,  setClassStatus]  = useState<'active' | 'cancelled'>('active');
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  // ── Populate when editing ───────────────────────────────────────────────────
  useEffect(() => {
    if (editClass) {
      setName(editClass.name);
      setCategory(editClass.category);
      setDescription(editClass.description ?? '');
      setClassType(editClass.type);
      setDate(editClass.date);
      setStartTime(editClass.start_time);
      setEndTime(editClass.end_time);
      setLocation(editClass.location ?? '');
      setMaxCapacity(String(editClass.max_capacity));
      setTrainerId(editClass.trainer_id);
      setAllowWaitlist(editClass.allow_waitlist);
      setMaxWaitlist(String(editClass.max_waitlist));
      if (editClass.repeat) setRepeat(editClass.repeat);
      setEndDate(editClass.end_date ?? '');
      setClassStatus(editClass.status);
    } else {
      setName(''); setCategory('hiit'); setDescription('');
      setClassType('recurring'); setDate(defaultDate ?? TODAY);
      setStartTime('07:00'); setEndTime('08:00'); setLocation('');
      setMaxCapacity('20'); setTrainerId(trainers[0]?.id ?? '');
      setAllowWaitlist(false); setMaxWaitlist('5');
      setRepeat('weekly'); setEndDate(''); setClassStatus('active');
    }
    setErrors({});
  }, [editClass, visible]);

  // ── Auto-suggest end time when start changes ────────────────────────────────
  function handleStartTimeChange(t: string) {
    setStartTime(t);
    if (isValidTime(t)) setEndTime(addOneHour(t));
  }

  // ── Animation ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdrop, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 700, duration: 250, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 700, duration: 250, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onClose);
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim())            e.name         = 'Class name is required';
    if (!isValidDate(date))      e.date         = 'Enter a valid date (YYYY-MM-DD)';
    if (!isValidTime(startTime)) e.startTime    = 'Enter a valid start time (HH:MM)';
    if (!isValidTime(endTime))   e.endTime      = 'Enter a valid end time (HH:MM)';
    if (endTime <= startTime)    e.endTime      = 'End time must be after start time';
    if (!maxCapacity || isNaN(Number(maxCapacity)) || Number(maxCapacity) < 1)
                                 e.maxCapacity  = 'Enter a valid capacity (min 1)';
    if (!trainerId)              e.trainerId    = 'Select a trainer';
    if (endDate && !isValidDate(endDate)) e.endDate = 'Enter a valid end date (YYYY-MM-DD)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));

    const payload = {
      name: name.trim(),
      category,
      description: description.trim() || null,
      type: classType,
      date,
      start_time: startTime,
      end_time: endTime,
      location: location.trim() || null,
      max_capacity: Number(maxCapacity),
      booked_count: editClass?.booked_count ?? 0,
      trainer_id: trainerId,
      status: classStatus,
      allow_waitlist: allowWaitlist,
      max_waitlist: allowWaitlist ? Number(maxWaitlist) : 0,
      repeat: classType === 'recurring' ? repeat : undefined,
      end_date: (classType === 'recurring' && endDate) ? endDate : null,
    };

    if (isEdit && editClass) {
      updateClass(editClass.id, payload);
    } else {
      addClass(payload);
    }

    setSaving(false);
    handleClose();
  }

  if (!mounted && !visible) return null;

  // ── Options ──────────────────────────────────────────────────────────────────
  const categoryOptions = (Object.keys(CATEGORY_COLORS) as ClassCategory[]).map(k => ({
    key: k, label: CATEGORY_LABELS[k], color: CATEGORY_COLORS[k],
  }));

  const trainerOptions = trainers.map(t => ({
    key: t.id, label: t.name, sub: t.specialization,
  }));

  const statusOptions = [
    { key: 'active' as const, label: 'Scheduled' },
    { key: 'cancelled' as const, label: 'Cancelled' },
  ];

  const repeatOptions = [
    { key: 'daily' as const, label: 'Daily' },
    { key: 'weekly' as const, label: 'Weekly' },
    { key: 'monthly' as const, label: 'Monthly' },
  ];

  const recurringPreview = classType === 'recurring' && isValidDate(date)
    ? getRecurringPreview(date, repeat, endDate)
    : '';

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{isEdit ? 'Edit Class' : 'Schedule a Class'}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── CLASS INFO ── */}
          <SectionHeader label="Class Info" />

          {/* Class name */}
          <View style={styles.field}>
            <Text style={styles.label}>Class Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g. Morning HIIT, Yoga Flow"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
            {errors.name && <Text style={styles.error}>{errors.name}</Text>}
          </View>

          {/* Category */}
          <SelectField
            label="Category *"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
          />

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="What will members expect?"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Class type */}
          <View style={styles.field}>
            <Text style={styles.label}>Class Type</Text>
            <View style={styles.pillRow}>
              {(['recurring', 'one_time'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pill, classType === t && styles.pillActive]}
                  onPress={() => setClassType(t)}
                >
                  <Text style={[styles.pillText, classType === t && styles.pillTextActive]}>
                    {t === 'recurring' ? 'Recurring' : 'One-time'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── SCHEDULE INFO ── */}
          <SectionHeader label="Schedule" />

          {/* Date */}
          <View style={styles.field}>
            <Text style={styles.label}>Date *</Text>
            <TextInput
              style={[styles.input, errors.date && styles.inputError]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={date}
              onChangeText={setDate}
            />
            {errors.date && <Text style={styles.error}>{errors.date}</Text>}
          </View>

          {/* Recurring options */}
          {classType === 'recurring' && (
            <>
              <SelectField
                label="Repeat"
                value={repeat}
                options={repeatOptions}
                onChange={setRepeat}
              />
              <View style={styles.field}>
                <Text style={styles.label}>End Date (optional)</Text>
                <TextInput
                  style={[styles.input, errors.endDate && styles.inputError]}
                  placeholder="YYYY-MM-DD (leave blank = forever)"
                  placeholderTextColor={colors.textMuted}
                  value={endDate}
                  onChangeText={setEndDate}
                />
                {errors.endDate && <Text style={styles.error}>{errors.endDate}</Text>}
              </View>

              {recurringPreview !== '' && (
                <View style={styles.previewBox}>
                  <Ionicons name="refresh-outline" size={13} color={colors.primary} />
                  <Text style={styles.previewText}>{recurringPreview}</Text>
                </View>
              )}
            </>
          )}

          {/* Start / End time */}
          <View style={styles.twoCol}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Start Time *</Text>
              <TextInput
                style={[styles.input, errors.startTime && styles.inputError]}
                placeholder="HH:MM"
                placeholderTextColor={colors.textMuted}
                value={startTime}
                onChangeText={handleStartTimeChange}
              />
              {errors.startTime && <Text style={styles.error}>{errors.startTime}</Text>}
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>End Time *</Text>
              <TextInput
                style={[styles.input, errors.endTime && styles.inputError]}
                placeholder="HH:MM"
                placeholderTextColor={colors.textMuted}
                value={endTime}
                onChangeText={setEndTime}
              />
              {errors.endTime && <Text style={styles.error}>{errors.endTime}</Text>}
            </View>
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>Location / Room</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Studio A, Main Floor"
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          {/* ── CAPACITY & TRAINER ── */}
          <SectionHeader label="Capacity & Trainer" />

          {/* Max capacity */}
          <View style={styles.field}>
            <Text style={styles.label}>Max Capacity *</Text>
            <TextInput
              style={[styles.input, errors.maxCapacity && styles.inputError]}
              placeholder="e.g. 20"
              placeholderTextColor={colors.textMuted}
              value={maxCapacity}
              onChangeText={setMaxCapacity}
              keyboardType="numeric"
            />
            {errors.maxCapacity && <Text style={styles.error}>{errors.maxCapacity}</Text>}
          </View>

          {/* Trainer */}
          <SelectField
            label="Assigned Trainer *"
            value={trainerId}
            options={trainerOptions}
            onChange={setTrainerId}
            error={errors.trainerId}
          />

          {/* Allow waitlist */}
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Allow Waitlist</Text>
              <Text style={styles.switchSub}>Members can join a waitlist when class is full</Text>
            </View>
            <Switch
              value={allowWaitlist}
              onValueChange={setAllowWaitlist}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={allowWaitlist ? colors.primary : colors.textMuted}
            />
          </View>

          {allowWaitlist && (
            <View style={styles.field}>
              <Text style={styles.label}>Max Waitlist Spots</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textMuted}
                value={maxWaitlist}
                onChangeText={setMaxWaitlist}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* ── STATUS ── */}
          <SectionHeader label="Status" />

          <SelectField
            label="Class Status"
            value={classStatus}
            options={statusOptions}
            onChange={setClassStatus}
          />

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#000" size="small" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#000" />
                  <Text style={styles.saveBtnText}>
                    {isEdit ? 'Save Changes' : 'Schedule Class'}
                  </Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '94%',
    borderTopWidth: 1, borderColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: spacing.md, gap: 14, paddingBottom: 32 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  textarea: { minHeight: 80, paddingTop: 12 },
  error: { fontSize: 12, color: colors.danger },

  twoCol: { flexDirection: 'row', gap: 10 },

  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#000', fontWeight: '700' },

  previewBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.primary + '12',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  previewText: { flex: 1, fontSize: 13, color: colors.primary, lineHeight: 18 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14,
  },
  switchInfo: { flex: 1, gap: 2, marginRight: 12 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchSub: { fontSize: 12, color: colors.textMuted },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, color: colors.textMuted },
});
