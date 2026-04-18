import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing, radius } from '@/lib/theme';
import { MOCK_AUTOMATIONS, type MockAutomation } from '@/lib/mockAutomations';
import { CreateAutomationSheet } from './CreateAutomationSheet';

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  const thumbAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(thumbAnim, {
      toValue: value ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      style={[
        styles.toggleTrack,
        { backgroundColor: value ? colors.primary : colors.border },
      ]}
    >
      <Animated.View
        style={[
          styles.toggleThumb,
          {
            transform: [
              {
                translateX: thumbAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, 20],
                }),
              },
            ],
          },
        ]}
      />
    </TouchableOpacity>
  );
}

// ── Automation card ───────────────────────────────────────────────────────────

function AutomationCard({
  automation,
  index,
  onToggle,
}: {
  automation: MockAutomation;
  index: number;
  onToggle: () => void;
}) {
  return (
    <RNAnimated.View entering={FadeInDown.delay(index * 80).springify()}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {/* Icon square */}
          <View style={[styles.iconSquare, { backgroundColor: automation.iconColor + '20' }]}>
            <Text style={styles.iconEmoji}>{automation.emoji}</Text>
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            {/* Name + toggle */}
            <View style={styles.nameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{automation.name}</Text>
              <ToggleSwitch value={automation.active} onToggle={onToggle} />
            </View>

            <View style={styles.triggerRow}>
              <Ionicons name="flash-outline" size={12} color={colors.textMuted} />
              <Text style={styles.triggerText} numberOfLines={2}>
                Triggers when: {automation.trigger}
              </Text>
            </View>

            <Text style={styles.actionText} numberOfLines={2}>{automation.actionSummary}</Text>

            <View style={styles.statsRow}>
              <Ionicons name="bar-chart-outline" size={11} color={colors.textMuted} />
              <Text style={styles.statsText}>{automation.statsText}</Text>
            </View>
          </View>
        </View>

        {/* Status bar */}
        <View style={[styles.statusBar, { backgroundColor: automation.active ? colors.primary + '18' : colors.border + '40' }]}>
          <View style={[styles.statusDot, { backgroundColor: automation.active ? colors.primary : colors.textMuted }]} />
          <Text style={[styles.statusText, { color: automation.active ? colors.primary : colors.textMuted }]}>
            {automation.active ? 'Active — running 24/7' : 'Paused'}
          </Text>
        </View>
      </View>
    </RNAnimated.View>
  );
}

// ── Pause confirm snackbar (Modal-based so it renders above ScrollView) ───────

function PauseSnackbar({
  name,
  visible,
  onConfirm,
  onCancel,
}: {
  name: string;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 100, duration: 200, useNativeDriver: true }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.snackbarOverlay} onPress={onCancel} />
      <Animated.View style={[styles.snackbar, { transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.snackbarText} numberOfLines={1}>
          Pause <Text style={{ fontWeight: '700' }}>"{name}"</Text>?
        </Text>
        <TouchableOpacity style={styles.snackbarConfirm} onPress={onConfirm}>
          <Text style={styles.snackbarConfirmText}>Pause</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.snackbarCancel} onPress={onCancel}>
          <Text style={styles.snackbarCancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Toast (Modal-based so it renders above ScrollView) ────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: -60, duration: 200, useNativeDriver: true }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={() => {}}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 56, left: 16, right: 16 }}>
        <Animated.View style={[styles.toast, { transform: [{ translateY: slideAnim }] }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ automations }: { automations: MockAutomation[] }) {
  const active = automations.filter(a => a.active).length;
  const totalTriggers = automations.reduce((sum, a) => {
    const match = a.statsText.match(/Triggered (\d+)×/);
    return sum + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  return (
    <RNAnimated.View entering={FadeIn.duration(300)} style={styles.summaryBar}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryValue}>{automations.length}</Text>
        <Text style={styles.summaryLabel}>Total</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryValue, { color: colors.primary }]}>{active}</Text>
        <Text style={styles.summaryLabel}>Active</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryValue, { color: colors.info }]}>{totalTriggers}</Text>
        <Text style={styles.summaryLabel}>Triggers / mo</Text>
      </View>
    </RNAnimated.View>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function AutomationsTab() {
  const [automations, setAutomations] = useState<MockAutomation[]>(MOCK_AUTOMATIONS);
  const [pendingPauseId, setPendingPauseId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const pendingAutomation = automations.find(a => a.id === pendingPauseId);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }

  function handleToggle(id: string) {
    const auto = automations.find(a => a.id === id);
    if (!auto) return;

    if (auto.active) {
      // Turning off — ask for confirmation
      setPendingPauseId(id);
    } else {
      // Turning on — immediate
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: true } : a));
      showToast(`${auto.name} is now active`);
    }
  }

  function confirmPause() {
    if (!pendingPauseId) return;
    const auto = automations.find(a => a.id === pendingPauseId);
    setAutomations(prev => prev.map(a => a.id === pendingPauseId ? { ...a, active: false } : a));
    setPendingPauseId(null);
    showToast(`${auto?.name ?? 'Automation'} paused`);
  }

  function cancelPause() {
    setPendingPauseId(null);
  }

  function handleSave(newAuto: MockAutomation) {
    setAutomations(prev => [newAuto, ...prev]);
    showToast(`"${newAuto.name}" automation created`);
  }

  return (
    <View style={styles.container}>
      {/* Modals — render above everything */}
      <Toast message={toastMsg} visible={toastVisible} />
      <PauseSnackbar
        name={pendingAutomation?.name ?? ''}
        visible={!!pendingPauseId}
        onConfirm={confirmPause}
        onCancel={cancelPause}
      />

      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tabTitle}>Automations</Text>
          <Text style={styles.tabSubtitle}>
            Set up automatic messages triggered by member and lead actions — runs on autopilot 24/7
          </Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={14} color={colors.primary} />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <SummaryBar automations={automations} />

      {/* Cards list */}
      {automations.length === 0 ? (
        <RNAnimated.View entering={FadeIn.duration(200)} style={styles.emptyState}>
          <Ionicons name="flash-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No automations yet</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.emptyBtnText}>Create your first automation +</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      ) : (
        <View style={styles.cardList}>
          {automations.map((auto, i) => (
            <AutomationCard
              key={auto.id}
              automation={auto}
              index={i}
              onToggle={() => handleToggle(auto.id)}
            />
          ))}
        </View>
      )}

      {/* Create sheet */}
      <CreateAutomationSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleSave}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {},

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 10,
  },
  tabTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  tabSubtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 3 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
    marginTop: 2,
  },
  newBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },

  // Automation card
  cardList: {
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  cardBody: { flex: 1, gap: 5 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },

  triggerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  triggerText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  actionText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500', lineHeight: 17 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statsText: { fontSize: 11, color: colors.textMuted },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },

  // Toggle switch
  toggleTrack: {
    width: 42, height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    flexShrink: 0,
  },
  toggleThumb: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  // Pause snackbar
  snackbarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  snackbar: {
    position: 'absolute',
    bottom: 0,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  snackbarText: { flex: 1, fontSize: 13, color: colors.text },
  snackbarConfirm: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.warning + '20',
  },
  snackbarConfirmText: { fontSize: 13, fontWeight: '700', color: colors.warning },
  snackbarCancel: {
    paddingHorizontal: 10, paddingVertical: 6,
  },
  snackbarCancelText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  // Toast
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: colors.text },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.primary + '20',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
