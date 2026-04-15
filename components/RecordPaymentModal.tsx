import {
  View, Text, TextInput, Modal, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useMembersContext } from '@/context/MembersContext';
import { colors, spacing } from '@/lib/theme';
import type { PaymentMethod } from '@/context/MembersContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  memberId: string;
  defaultAmount?: number;
};

const METHOD_OPTIONS: { key: PaymentMethod; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'mpesa',         label: 'M-Pesa',        icon: 'phone-portrait-outline' },
  { key: 'cash',          label: 'Cash',           icon: 'cash-outline' },
  { key: 'card',          label: 'Card',           icon: 'card-outline' },
  { key: 'bank_transfer', label: 'Bank Transfer',  icon: 'business-outline' },
];

export function RecordPaymentModal({ visible, onClose, memberId, defaultAmount }: Props) {
  const { recordPayment } = useMembersContext();
  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState(String(defaultAmount ?? ''));
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount(String(defaultAmount ?? ''));
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 600, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 600, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(onClose);
  }

  async function handleSave() {
    if (!amount) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    recordPayment({
      member_id: memberId,
      amount: parseFloat(amount),
      method,
      status: 'paid',
      date,
      reference: reference.trim() || null,
      note: note.trim() || null,
    });
    setSaving(false);
    handleClose();
  }

  if (!mounted && !visible) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Record Payment</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Amount */}
          <View style={styles.field}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.prefixRow}>
              <Text style={styles.prefix}>KSh</Text>
              <TextInput
                style={[styles.input, styles.prefixInput]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Payment method */}
          <View style={styles.field}>
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodGrid}>
              {METHOD_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.methodCard, method === opt.key && styles.methodCardActive]}
                  onPress={() => setMethod(opt.key)}
                >
                  <Ionicons name={opt.icon} size={20} color={method === opt.key ? '#000' : colors.textSecondary} />
                  <Text style={[styles.methodLabel, method === opt.key && styles.methodLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date */}
          <View style={styles.field}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Reference */}
          <View style={styles.field}>
            <Text style={styles.label}>Reference / Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. M-Pesa code (optional)"
              placeholderTextColor={colors.textMuted}
              value={reference}
              onChangeText={setReference}
            />
          </View>

          {/* Note */}
          <View style={styles.field}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Optional note..."
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!amount || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!amount || saving}
          >
            {saving
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.saveBtnText}>Save Payment</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%',
    borderTopWidth: 1, borderColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: spacing.md, gap: 16, paddingBottom: 24 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: colors.text,
  },
  textarea: { minHeight: 70, paddingTop: 12 },
  prefixRow: { flexDirection: 'row' },
  prefix: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border, borderRightWidth: 0,
    borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
    paddingHorizontal: 12, paddingVertical: 13,
    fontSize: 14, color: colors.textMuted, fontWeight: '600',
  },
  prefixInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 10, padding: 12,
    alignItems: 'center', gap: 6,
  },
  methodCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  methodLabelActive: { color: '#000' },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
