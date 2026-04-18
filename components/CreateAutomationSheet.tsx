import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import {
  TRIGGER_OPTIONS,
  ACTION_TYPE_OPTIONS,
  WAIT_DURATIONS,
  PERSONALIZATION_TOKENS,
  LEAD_STAGES,
  type ActionStep,
  type ActionType,
  type MockAutomation,
} from '@/lib/mockAutomations';

// ── Action step editor ────────────────────────────────────────────────────────

function ActionStepEditor({
  step,
  stepIndex,
  totalSteps,
  onUpdate,
  onRemove,
}: {
  step: ActionStep;
  stepIndex: number;
  totalSteps: number;
  onUpdate: (patch: Partial<ActionStep>) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNumBadge}>
          <Text style={styles.stepNumText}>Step {stepIndex + 1}</Text>
        </View>
        {totalSteps > 1 && (
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
      >
        {ACTION_TYPE_OPTIONS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.typeChip, step.type === t.id && styles.typeChipActive]}
            onPress={() => onUpdate({ type: t.id as ActionType })}
          >
            <Text style={styles.typeChipEmoji}>{t.emoji}</Text>
            <Text style={[styles.typeChipText, step.type === t.id && styles.typeChipTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Send SMS */}
      {step.type === 'send_sms' && (
        <View style={{ gap: 8 }}>
          <TextInput
            style={styles.messageInput}
            multiline
            numberOfLines={4}
            placeholder="Write your message..."
            placeholderTextColor={colors.textMuted}
            value={step.message ?? ''}
            onChangeText={text => onUpdate({ message: text })}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {PERSONALIZATION_TOKENS.map(tok => (
              <TouchableOpacity
                key={tok}
                style={styles.tokenChip}
                onPress={() => onUpdate({ message: (step.message ?? '') + tok })}
              >
                <Text style={styles.tokenText}>{tok}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.inputHint}>Tap a token to insert it into the message</Text>
        </View>
      )}

      {/* Wait */}
      {step.type === 'wait' && (
        <View style={styles.durationRow}>
          {WAIT_DURATIONS.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.durationChip, step.waitDuration === d.id && styles.durationChipActive]}
              onPress={() => onUpdate({ waitDuration: d.id })}
            >
              <Text style={[styles.durationText, step.waitDuration === d.id && styles.durationTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Update Stage */}
      {step.type === 'update_stage' && (
        <View style={{ gap: 6 }}>
          {LEAD_STAGES.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.stageRow, step.stage === s && styles.stageRowActive]}
              onPress={() => onUpdate({ stage: s })}
            >
              <Text style={[styles.stageText, step.stage === s && styles.stageTextActive]}>{s}</Text>
              {step.stage === s && <Ionicons name="checkmark" size={14} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Assign to Team */}
      {step.type === 'assign_team' && (
        <View style={styles.comingSoonNote}>
          <Ionicons name="people-outline" size={16} color={colors.textMuted} />
          <Text style={styles.comingSoonText}>Assigned to first available team member</Text>
        </View>
      )}

      {/* Add Tag */}
      {step.type === 'add_tag' && (
        <TextInput
          style={styles.singleInput}
          placeholder="Tag name (e.g. hot-lead, vip)"
          placeholderTextColor={colors.textMuted}
          value={step.tag ?? ''}
          onChangeText={text => onUpdate({ tag: text })}
        />
      )}
    </View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (automation: MockAutomation) => void;
}

export function CreateAutomationSheet({ visible, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(700)).current;

  const [trigger, setTrigger] = useState('');
  const [triggerDays, setTriggerDays] = useState(7);
  const [steps, setSteps] = useState<ActionStep[]>([{ id: '1', type: 'send_sms', message: '' }]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 700,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (!visible) resetForm();
  }, [visible]);

  function resetForm() {
    setTrigger('');
    setTriggerDays(7);
    setSteps([{ id: '1', type: 'send_sms', message: '' }]);
    setName('');
  }

  function handleTriggerSelect(id: string) {
    setTrigger(id);
    const opt = TRIGGER_OPTIONS.find(t => t.id === id);
    if (opt) {
      setName(opt.suggestedName);
      if (opt.defaultDays) setTriggerDays(opt.defaultDays);
    }
  }

  function addStep() {
    if (steps.length >= 3) return;
    setSteps(prev => [...prev, { id: String(Date.now()), type: 'send_sms', message: '' }]);
  }

  function removeStep(id: string) {
    setSteps(prev => prev.filter(s => s.id !== id));
  }

  function updateStep(id: string, patch: Partial<ActionStep>) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function buildActionSummary(): string {
    return steps.map((s, i) => {
      const prefix = i === 0 ? '→' : '+';
      if (s.type === 'send_sms') return `${prefix} Sends SMS${i > 0 ? ` (step ${i + 1})` : ' immediately'}`;
      if (s.type === 'wait') return `${prefix} Wait ${WAIT_DURATIONS.find(d => d.id === s.waitDuration)?.label ?? ''}`;
      if (s.type === 'update_stage') return `${prefix} Update stage to ${s.stage ?? '—'}`;
      if (s.type === 'assign_team') return `${prefix} Assign to team`;
      if (s.type === 'add_tag') return `${prefix} Add tag "${s.tag ?? ''}"`;
      return '';
    }).join(' ');
  }

  function buildTriggerLabel(): string {
    const opt = TRIGGER_OPTIONS.find(t => t.id === trigger);
    if (!opt) return '';
    if (opt.hasDays) return `${opt.label} (${triggerDays} ${opt.daysLabel?.includes('Hours') ? 'hrs' : 'days'})`;
    return opt.label;
  }

  function handleSave() {
    if (!trigger || !name.trim()) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      const opt = TRIGGER_OPTIONS.find(t => t.id === trigger);
      onSave({
        id: `auto${Date.now()}`,
        name: name.trim(),
        emoji: '⚡',
        iconColor: colors.primary,
        trigger: buildTriggerLabel(),
        actionSummary: buildActionSummary(),
        statsText: 'Triggered 0× this month | 0 conversions',
        active: true,
      });
      onClose();
    }, 800);
  }

  const selectedTriggerOpt = TRIGGER_OPTIONS.find(t => t.id === trigger);
  const canSave = !!trigger && !!name.trim();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>New Automation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 8 }}>

            {/* Trigger selector */}
            <View style={{ gap: 10 }}>
              <Text style={styles.fieldLabel}>1. Choose a Trigger</Text>
              <View style={{ gap: 6 }}>
                {TRIGGER_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.triggerRow, trigger === opt.id && styles.triggerRowActive]}
                    onPress={() => handleTriggerSelect(opt.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.triggerText, trigger === opt.id && styles.triggerTextActive]}>
                        {opt.label}
                      </Text>
                    </View>
                    {trigger === opt.id && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Days picker */}
              {selectedTriggerOpt?.hasDays && (
                <View style={styles.dayPicker}>
                  <Text style={styles.dayPickerLabel}>{selectedTriggerOpt.daysLabel}:</Text>
                  <View style={styles.dayPickerControls}>
                    <TouchableOpacity
                      onPress={() => setTriggerDays(d => Math.max(1, d - 1))}
                      style={styles.dayBtn}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.dayValue}>{triggerDays}</Text>
                    <TouchableOpacity
                      onPress={() => setTriggerDays(d => d + 1)}
                      style={styles.dayBtn}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Action builder */}
            {trigger && (
              <View style={{ gap: 10 }}>
                <Text style={styles.fieldLabel}>2. Build the Action</Text>
                {steps.map((step, i) => (
                  <ActionStepEditor
                    key={step.id}
                    step={step}
                    stepIndex={i}
                    totalSteps={steps.length}
                    onUpdate={patch => updateStep(step.id, patch)}
                    onRemove={() => removeStep(step.id)}
                  />
                ))}
                {steps.length < 3 && (
                  <TouchableOpacity style={styles.addStepBtn} onPress={addStep}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={styles.addStepText}>Add Action Step +</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Name input */}
            {trigger && (
              <View style={{ gap: 8 }}>
                <Text style={styles.fieldLabel}>3. Automation Name</Text>
                <TextInput
                  style={styles.singleInput}
                  placeholder="e.g. New Lead Welcome"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Automation'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '92%',
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    gap: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },

  // Field label
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Trigger rows
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  triggerText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  triggerTextActive: { color: colors.primary, fontWeight: '700' },

  // Day picker
  dayPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  dayPickerLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  dayPickerControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBtn: {
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  dayValue: { fontSize: 18, fontWeight: '700', color: colors.text, minWidth: 28, textAlign: 'center' },

  // Step card
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepNumBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primary + '20',
  },
  stepNumText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  // Type chips
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  typeChipEmoji: { fontSize: 13 },
  typeChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  typeChipTextActive: { color: colors.primary },

  // Message input
  messageInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  tokenChip: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.info + '20',
    borderWidth: 1,
    borderColor: colors.info + '40',
  },
  tokenText: { fontSize: 11, color: colors.info, fontWeight: '600' },
  inputHint: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },

  // Wait durations
  durationRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durationChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  durationText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  durationTextActive: { color: colors.primary },

  // Stage rows
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageRowActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  stageText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  stageTextActive: { color: colors.primary, fontWeight: '700' },

  comingSoonNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
  },
  comingSoonText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

  // Single input
  singleInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },

  // Add step button
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary + '50',
    borderStyle: 'dashed',
  },
  addStepText: { fontSize: 14, fontWeight: '600', color: colors.primary },

  // Footer
  footer: { gap: 8, paddingTop: 4 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: colors.border },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
});
