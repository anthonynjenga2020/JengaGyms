import {
  View,
  Text,
  TextInput,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLeadsContext } from '@/context/LeadsContext';
import { colors, spacing, LEAD_STAGES, LEAD_SOURCES, LEAD_INTERESTS } from '@/lib/theme';
import type { LeadStage, LeadSource, LeadInterest } from '@/lib/theme';
import type { AppLead } from '@/context/LeadsContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  editLead?: AppLead | null;   // pre-fill when editing
};

type FormErrors = Partial<Record<'name' | 'phone', string>>;

// ── Inline Select Field ───────────────────────────────────────────────────────

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);

  return (
    <View style={selectStyles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={selectStyles.trigger}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={selectStyles.value}>{selected?.label ?? 'Select...'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={selectStyles.list}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={selectStyles.option}
              onPress={() => { onChange(opt.key); setOpen(false); }}
            >
              <Text style={[selectStyles.optionText, value === opt.key && selectStyles.optionTextActive]}>
                {opt.label}
              </Text>
              {value === opt.key && <Ionicons name="checkmark" size={14} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const selectStyles = StyleSheet.create({
  wrapper: { gap: 6, zIndex: 1 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
  },
  value: { fontSize: 15, color: colors.text },
  list: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionText: { fontSize: 14, color: colors.textSecondary },
  optionTextActive: { color: colors.primary, fontWeight: '600' },
});

// ── Main Modal ────────────────────────────────────────────────────────────────

export function AddLeadModal({ visible, onClose, editLead }: Props) {
  const { addLead, updateLead } = useLeadsContext();
  const translateY = useRef(new Animated.Value(700)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<LeadSource>('website');
  const [interests, setInterests] = useState<LeadInterest[]>([]);
  const [stage, setStage] = useState<LeadStage>('new_lead');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // Populate form when editing
  useEffect(() => {
    if (editLead) {
      setName(editLead.name);
      setPhone(editLead.phone ?? '');
      setEmail(editLead.email ?? '');
      setSource(editLead.source);
      setInterests(editLead.interests);
      setStage(editLead.status);
      setNotes(editLead.notes ?? '');
    } else {
      resetForm();
    }
  }, [editLead]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true,
          tension: 65, friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 700, duration: 260, useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0, duration: 260, useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
        resetForm();
      });
    }
  }, [visible]);

  function resetForm() {
    setName(''); setPhone(''); setEmail('');
    setSource('website'); setInterests([]);
    setStage('new_lead'); setNotes('');
    setErrors({});
  }

  function toggleInterest(key: LeadInterest) {
    setInterests(prev =>
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  }

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleClose() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 700, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(onClose);
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    // Simulate async save
    await new Promise(r => setTimeout(r, 300));

    const data = {
      client_id: 'demo',
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      source,
      status: stage,
      interests,
      notes: notes.trim() || null,
      last_contacted_at: null,
    };

    if (editLead) {
      updateLead(editLead.id, data);
    } else {
      addLead(data);
    }

    setSaving(false);
    handleClose();
  }

  if (!mounted && !visible) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kavWrapper}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editLead ? 'Edit Lead' : 'Add New Lead'}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="e.g. Brian Kamau"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="+254 7XX XXX XXX"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={v => { setPhone(v); setErrors(e => ({ ...e, phone: undefined })); }}
                keyboardType="phone-pad"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="optional"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Source */}
            <SelectField
              label="Lead Source"
              value={source}
              options={LEAD_SOURCES}
              onChange={setSource}
            />

            {/* Interests — multi-select pills */}
            <View style={styles.field}>
              <Text style={styles.label}>Interest</Text>
              <View style={styles.pillGroup}>
                {LEAD_INTERESTS.map(i => {
                  const active = interests.includes(i.key);
                  return (
                    <TouchableOpacity
                      key={i.key}
                      style={[styles.interestPill, active && styles.interestPillActive]}
                      onPress={() => toggleInterest(i.key)}
                    >
                      <Text style={[styles.interestPillText, active && styles.interestPillTextActive]}>
                        {i.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Pipeline Stage */}
            <SelectField
              label="Pipeline Stage"
              value={stage}
              options={LEAD_STAGES}
              onChange={setStage}
            />

            {/* Notes */}
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Any extra context..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity onPress={handleClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.saveBtnText}>{editLead ? 'Update Lead' : 'Save Lead'}</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  form: { flex: 1 },
  formContent: {
    padding: spacing.md,
    gap: 18,
    paddingBottom: 40,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 12, color: colors.danger, marginTop: -2 },
  textarea: { minHeight: 80, paddingTop: 12 },
  pillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestPill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1.5, borderColor: colors.border,
  },
  interestPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  interestPillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  interestPillTextActive: { color: '#000' },
  actions: { gap: 10, marginTop: 8 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
