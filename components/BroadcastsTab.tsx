import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, spacing, radius } from '@/lib/theme';
import { formatScheduledAt, type MockBroadcast } from '@/lib/mockBroadcasts';
import { useBroadcasts } from '@/hooks/useBroadcasts';
import { useClientContext } from '@/context/ClientContext';
import { QuickBroadcastSheet } from './QuickBroadcastSheet';
import { BroadcastDetailSheet } from './BroadcastDetailSheet';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const [modalVisible, setModalVisible] = useState(false);
  const anim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.spring(anim, { toValue: 0, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: -60, duration: 200, useNativeDriver: true }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={() => {}}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 56, left: 16, right: 16 }}>
        <Animated.View style={[styles.toast, { transform: [{ translateY: anim }] }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Cancel confirm (Modal-based snackbar) ─────────────────────────────────────

function CancelConfirm({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const anim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      Animated.timing(anim, { toValue: 100, duration: 200, useNativeDriver: true }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.cancelOverlay} onPress={onCancel} />
      <Animated.View style={[styles.cancelBar, { transform: [{ translateY: anim }] }]}>
        <Text style={styles.cancelBarText}>Cancel this scheduled broadcast?</Text>
        <TouchableOpacity style={styles.cancelBarYes} onPress={onConfirm}>
          <Text style={styles.cancelBarYesText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBarNo} onPress={onCancel}>
          <Text style={styles.cancelBarNoText}>No</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Broadcast card ────────────────────────────────────────────────────────────

const STATUS_META = {
  sent:      { icon: 'checkmark-circle-outline' as const, color: '#33D169', label: '✓ Sent' },
  scheduled: { icon: 'time-outline'             as const, color: '#4C9FFF', label: '⏳ Scheduled' },
  failed:    { icon: 'close-circle-outline'     as const, color: '#FF4C4C', label: '✗ Failed' },
};

function BroadcastCard({
  broadcast,
  index,
  isScheduled,
  onPress,
  onEdit,
  onCancel,
}: {
  broadcast: MockBroadcast;
  index: number;
  isScheduled: boolean;
  onPress: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  const meta = STATUS_META[broadcast.status];
  const timeStr = isScheduled && broadcast.scheduledAt
    ? formatScheduledAt(broadcast.scheduledAt)
    : broadcast.sentAt
    ? timeAgo(broadcast.sentAt)
    : '';

  return (
    <RNAnimated.View entering={FadeInDown.delay(index * 70).springify()}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.78}>
        {/* Row 1: label + time */}
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel} numberOfLines={1}>{broadcast.recipientLabel}</Text>
          <Text style={styles.cardTime}>{timeStr}</Text>
        </View>

        {/* Row 2: message preview */}
        <Text style={styles.cardMessage} numberOfLines={1}>{broadcast.message}</Text>

        {/* Row 3: status + count + actions */}
        <View style={styles.cardBottom}>
          <View style={[styles.statusChip, { backgroundColor: meta.color + '20' }]}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <View style={styles.cardBottomRight}>
            {isScheduled && (
              <>
                <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
                  <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={onCancel}>
                  <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                </TouchableOpacity>
              </>
            )}
            <View style={styles.countChip}>
              <Text style={styles.countText}>👥 {broadcast.recipientCount}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

type SubTab = 'recent' | 'scheduled';

export function BroadcastsTab() {
  const { clientId } = useClientContext();
  const { broadcasts, createBroadcast, cancelBroadcast } = useBroadcasts(clientId);
  const [subTab, setSubTab] = useState<SubTab>('recent');
  const [showCompose, setShowCompose] = useState(false);
  const [editBroadcast, setEditBroadcast] = useState<MockBroadcast | null>(null);
  const [detailBroadcast, setDetailBroadcast] = useState<MockBroadcast | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const subTabFade = useRef(new Animated.Value(1)).current;

  const recent = broadcasts
    .filter(b => b.status === 'sent' || b.status === 'failed')
    .sort((a, b) => new Date(b.sentAt ?? 0).getTime() - new Date(a.sentAt ?? 0).getTime());

  const scheduled = broadcasts
    .filter(b => b.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function switchSubTab(tab: SubTab) {
    if (tab === subTab) return;
    Animated.timing(subTabFade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setSubTab(tab);
      Animated.timing(subTabFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }

  async function handleSend(broadcast: MockBroadcast) {
    await createBroadcast(broadcast);
    if (broadcast.status === 'sent') {
      showToast(`✓ Broadcast sent to ${broadcast.recipientCount} recipient${broadcast.recipientCount !== 1 ? 's' : ''}`);
      setSubTab('recent');
    } else {
      showToast(`📅 Broadcast scheduled for ${formatScheduledAt(broadcast.scheduledAt ?? '')}`);
      setSubTab('scheduled');
    }
  }

  function handleEdit(broadcast: MockBroadcast) {
    setEditBroadcast(broadcast);
    setShowCompose(true);
  }

  async function handleCancelScheduled() {
    if (!pendingCancelId) return;
    await cancelBroadcast(pendingCancelId);
    setPendingCancelId(null);
    showToast('Scheduled broadcast cancelled');
  }

  const list = subTab === 'recent' ? recent : scheduled;

  return (
    <View style={styles.container}>
      {/* Modals */}
      <Toast message={toastMsg} visible={toastVisible} />
      <CancelConfirm
        visible={!!pendingCancelId}
        onConfirm={handleCancelScheduled}
        onCancel={() => setPendingCancelId(null)}
      />

      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.tabTitle}>Broadcasts</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => { setEditBroadcast(null); setShowCompose(true); }}>
          <Ionicons name="add" size={14} color={colors.primary} />
          <Text style={styles.newBtnText}>New Broadcast</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        {(['recent', 'scheduled'] as SubTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.subTabItem, subTab === tab && styles.subTabItemActive]}
            onPress={() => switchSubTab(tab)}
          >
            <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
              {tab === 'recent' ? 'Recent' : 'Scheduled'}
            </Text>
            {tab === 'scheduled' && scheduled.length > 0 && (
              <View style={styles.subTabBadge}>
                <Text style={styles.subTabBadgeText}>{scheduled.length}</Text>
              </View>
            )}
            {subTab === tab && <View style={styles.subTabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <Animated.View style={{ opacity: subTabFade }}>
        {list.length === 0 ? (
          <RNAnimated.View entering={FadeIn.duration(200)} style={styles.emptyState}>
            <Ionicons
              name={subTab === 'recent' ? 'send-outline' : 'calendar-outline'}
              size={44}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {subTab === 'recent' ? 'No broadcasts sent yet' : 'No scheduled broadcasts'}
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => { setEditBroadcast(null); setShowCompose(true); }}
            >
              <Text style={styles.emptyBtnText}>Send your first broadcast +</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        ) : (
          <View style={styles.cardList}>
            {list.map((b, i) => (
              <BroadcastCard
                key={b.id}
                broadcast={b}
                index={i}
                isScheduled={subTab === 'scheduled'}
                onPress={() => setDetailBroadcast(b)}
                onEdit={() => handleEdit(b)}
                onCancel={() => setPendingCancelId(b.id)}
              />
            ))}
          </View>
        )}
      </Animated.View>

      {/* Sheets */}
      <QuickBroadcastSheet
        visible={showCompose}
        onClose={() => { setShowCompose(false); setEditBroadcast(null); }}
        onSend={handleSend}
        initialBroadcast={editBroadcast}
      />
      <BroadcastDetailSheet
        broadcast={detailBroadcast}
        onClose={() => setDetailBroadcast(null)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {},

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 12,
  },
  tabTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  newBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Sub-tabs
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  subTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    position: 'relative',
  },
  subTabItemActive: {},
  subTabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  subTabTextActive: { color: colors.primary, fontWeight: '700' },
  subTabUnderline: {
    position: 'absolute',
    bottom: -1, left: 12, right: 12,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  subTabBadge: {
    minWidth: 18, height: 18,
    borderRadius: 9,
    backgroundColor: colors.info,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  subTabBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Cards
  cardList: { paddingHorizontal: spacing.md, gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  cardTime: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },
  cardMessage: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBottomRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  editBtn: {
    width: 28, height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 28, height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.danger + '15',
    borderWidth: 1,
    borderColor: colors.danger + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  countChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: colors.background,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  // Toast
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },

  // Cancel confirm
  cancelOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  cancelBar: {
    position: 'absolute',
    bottom: 0, left: spacing.md, right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cancelBarText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '500' },
  cancelBarYes: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.danger + '20',
  },
  cancelBarYesText: { fontSize: 13, fontWeight: '700', color: colors.danger },
  cancelBarNo: { paddingHorizontal: 10, paddingVertical: 6 },
  cancelBarNoText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 14, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: colors.primary + '20',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
