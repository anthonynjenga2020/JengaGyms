import {
  View, Text, TextInput, Modal, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useMembersContext } from '@/context/MembersContext';
import { MOCK_TRAINERS } from '@/lib/mockMembers';
import { colors, spacing } from '@/lib/theme';
import type { Member, MemberStatus, MemberPlan, BillingCycle, Gender } from '@/context/MembersContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  editMember?: Member | null;
};

// ── Reusable sub-components ───────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

function SelectField<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);
  return (
    <View>
      <TouchableOpacity style={styles.selectTrigger} onPress={() => setOpen(o => !o)}>
        <Text style={styles.selectValue}>{selected?.label ?? 'Select...'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={styles.selectList}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={styles.selectOption}
              onPress={() => { onChange(opt.key); setOpen(false); }}
            >
              <Text style={[styles.selectOptionText, value === opt.key && styles.selectOptionActive]}>
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

function PillToggle<T extends string>({
  value, options, onChange, multi,
}: {
  value: T | T[];
  options: { key: T; label: string }[];
  onChange: (v: T | T[]) => void;
  multi?: boolean;
}) {
  function isActive(key: T) {
    return Array.isArray(value) ? value.includes(key) : value === key;
  }
  function toggle(key: T) {
    if (multi && Array.isArray(value)) {
      onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key] as T[]);
    } else {
      onChange(key);
    }
  }
  return (
    <View style={styles.pillRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.pill, isActive(opt.key) && styles.pillActive]}
          onPress={() => toggle(opt.key)}
        >
          <Text style={[styles.pillText, isActive(opt.key) && styles.pillTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────

const PLAN_OPTIONS: { key: MemberPlan; label: string }[] = [
  { key: 'monthly_basic',   label: 'Monthly Basic' },
  { key: 'monthly_premium', label: 'Monthly Premium' },
  { key: 'annual_basic',    label: 'Annual Basic' },
  { key: 'annual_premium',  label: 'Annual Premium' },
  { key: 'pay_per_class',   label: 'Pay Per Class' },
  { key: 'custom',          label: 'Custom' },
];

const BILLING_CYCLE_OPTIONS: { key: BillingCycle; label: string }[] = [
  { key: 'monthly',  label: 'Monthly' },
  { key: 'annual',   label: 'Annual' },
  { key: 'one_time', label: 'One-time' },
];

const STATUS_OPTIONS: { key: MemberStatus; label: string }[] = [
  { key: 'active',   label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'frozen',   label: 'Frozen' },
  { key: 'expired',  label: 'Expired' },
];

const GENDER_OPTIONS: { key: Gender; label: string }[] = [
  { key: 'male',   label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other',  label: 'Prefer not to say' },
];

const TRAINER_OPTIONS: { key: string; label: string }[] = [
  { key: 'none', label: 'No trainer assigned' },
  ...MOCK_TRAINERS.map(t => ({ key: t, label: t })),
];

// ── Main Modal ────────────────────────────────────────────────────────────────

export function AddMemberModal({ visible, onClose, editMember }: Props) {
  const { addMember, updateMember } = useMembersContext();
  const translateY = useRef(new Animated.Value(900)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // Personal Info
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');

  // Membership Info
  const [plan, setPlan] = useState<MemberPlan>('monthly_basic');
  const [startDate, setStartDate] = useState('');
  const [billingAmount, setBillingAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [trainer, setTrainer] = useState('none');
  const [memberStatus, setMemberStatus] = useState<MemberStatus>('active');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editMember) {
      setName(editMember.name);
      setPhone(editMember.phone);
      setEmail(editMember.email);
      setDob(editMember.date_of_birth ?? '');
      setGender(editMember.gender ?? 'male');
      setEcName(editMember.emergency_contact_name ?? '');
      setEcPhone(editMember.emergency_contact_phone ?? '');
      setPlan(editMember.plan);
      setStartDate(editMember.start_date);
      setBillingAmount(String(editMember.billing_amount));
      setBillingCycle(editMember.billing_cycle);
      setTrainer(editMember.assigned_trainer ?? 'none');
      setMemberStatus(editMember.status);
      setNotes(editMember.notes ?? '');
    } else {
      resetForm();
    }
  }, [editMember]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 900, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => { setMounted(false); resetForm(); });
    }
  }, [visible]);

  function resetForm() {
    setName(''); setPhone(''); setEmail(''); setDob('');
    setGender('male'); setEcName(''); setEcPhone('');
    setPlan('monthly_basic'); setStartDate('');
    setBillingAmount(''); setBillingCycle('monthly');
    setTrainer('none'); setMemberStatus('active'); setNotes('');
    setErrors({});
  }

  function validate() {
    const errs: Partial<Record<string, string>> = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    if (!email.trim()) errs.email = 'Email address is required';
    if (!startDate.trim()) errs.startDate = 'Start date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleClose() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 900, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(onClose);
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));

    const expiry = billingCycle === 'annual'
      ? new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)).toISOString().split('T')[0]
      : new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString().split('T')[0];

    const data: Omit<Member, 'id' | 'created_at' | 'updated_at'> = {
      client_id: 'demo',
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      date_of_birth: dob.trim() || null,
      gender,
      emergency_contact_name: ecName.trim() || null,
      emergency_contact_phone: ecPhone.trim() || null,
      plan,
      plan_label: PLAN_OPTIONS.find(p => p.key === plan)?.label ?? plan,
      start_date: startDate,
      expiry_date: expiry,
      billing_amount: parseFloat(billingAmount) || 0,
      billing_cycle: billingCycle,
      next_billing_date: startDate,
      assigned_trainer: trainer === 'none' ? null : trainer,
      status: memberStatus,
      notes: notes.trim() || null,
      streak: 0,
      last_visit_at: null,
      total_visits: 0,
      height_cm: null,
      weight_kg: null,
      fitness_goal: null,
    };

    if (editMember) updateMember(editMember.id, data);
    else addMember(data);

    setSaving(false);
    handleClose();
  }

  if (!mounted && !visible) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editMember ? 'Edit Member' : 'Add New Member'}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Personal Info ── */}
            <SectionHeader title="Personal Info" />

            <Field label="Full Name" required>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="e.g. Peter Njoroge"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </Field>

            <Field label="Phone Number" required>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="+254 7XX XXX XXX"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={v => { setPhone(v); setErrors(e => ({ ...e, phone: undefined })); }}
                keyboardType="phone-pad"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </Field>

            <Field label="Email Address" required>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="member@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: undefined })); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </Field>

            <Field label="Date of Birth">
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={colors.textMuted}
                value={dob}
                onChangeText={setDob}
              />
            </Field>

            <Field label="Gender">
              <PillToggle
                value={gender}
                options={GENDER_OPTIONS}
                onChange={v => setGender(v as Gender)}
              />
            </Field>

            <Field label="Emergency Contact Name">
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
                value={ecName}
                onChangeText={setEcName}
              />
            </Field>

            <Field label="Emergency Contact Phone">
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
                value={ecPhone}
                onChangeText={setEcPhone}
                keyboardType="phone-pad"
              />
            </Field>

            {/* ── Membership Info ── */}
            <SectionHeader title="Membership Info" />

            <Field label="Membership Plan">
              <SelectField value={plan} options={PLAN_OPTIONS} onChange={setPlan} />
            </Field>

            <Field label="Start Date" required>
              <TextInput
                style={[styles.input, errors.startDate && styles.inputError]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={startDate}
                onChangeText={v => { setStartDate(v); setErrors(e => ({ ...e, startDate: undefined })); }}
              />
              {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
            </Field>

            <Field label="Billing Amount (KSh)">
              <View style={styles.prefixInput}>
                <Text style={styles.prefix}>KSh</Text>
                <TextInput
                  style={[styles.input, styles.prefixInputField]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={billingAmount}
                  onChangeText={setBillingAmount}
                  keyboardType="numeric"
                />
              </View>
            </Field>

            <Field label="Billing Cycle">
              <SelectField value={billingCycle} options={BILLING_CYCLE_OPTIONS} onChange={setBillingCycle} />
            </Field>

            <Field label="Assigned Trainer">
              <SelectField
                value={trainer}
                options={TRAINER_OPTIONS as { key: string; label: string }[]}
                onChange={v => setTrainer(v as string)}
              />
            </Field>

            <Field label="Member Status">
              <SelectField value={memberStatus} options={STATUS_OPTIONS} onChange={setMemberStatus} />
            </Field>

            <Field label="Notes">
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
            </Field>

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
                  : <Text style={styles.saveBtnText}>{editMember ? 'Update Member' : 'Save Member'}</Text>
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
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '94%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  form: { flex: 1 },
  formContent: { padding: spacing.md, gap: 14, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 8, marginBottom: -4,
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 12, color: colors.danger },
  textarea: { minHeight: 80, paddingTop: 12 },
  prefixInput: { flexDirection: 'row', alignItems: 'center' },
  prefix: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRightWidth: 0,
    borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
    paddingHorizontal: 12, paddingVertical: 13,
    fontSize: 14, color: colors.textMuted, fontWeight: '600',
  },
  prefixInputField: {
    flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
  },
  selectTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
  },
  selectValue: { fontSize: 15, color: colors.text },
  selectList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  selectOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  selectOptionText: { fontSize: 14, color: colors.textSecondary },
  selectOptionActive: { color: colors.primary, fontWeight: '700' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1.5, borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#000' },
  actions: { gap: 10, marginTop: 8 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { fontSize: 15, color: colors.textMuted },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
