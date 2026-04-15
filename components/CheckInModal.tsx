import {
  View, Text, TextInput, Modal, StyleSheet, TouchableOpacity,
  FlatList, Animated, Pressable, Alert, Platform,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useMembersContext } from '@/context/MembersContext';
import { getInitials, getMemberAvatarColor, memberStatusConfig } from '@/components/MemberCard';
import { colors, spacing } from '@/lib/theme';
import type { Member } from '@/context/MembersContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Step = 'search' | 'confirm';

function lastVisitLabel(dateStr: string | null): string {
  if (!dateStr) return 'Never visited';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function CheckInModal({ visible, onClose }: Props) {
  const { members, checkInMember, isCheckedInToday } = useMembersContext();
  const translateY = useRef(new Animated.Value(700)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);

  const filtered = members.filter(m => {
    if (!query.trim()) return false;
    const q = query.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 700, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
        setQuery('');
        setSelected(null);
        setStep('search');
      });
    }
  }, [visible]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 700, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(onClose);
  }

  function handleSelectMember(member: Member) {
    setSelected(member);
    setStep('confirm');
  }

  function handleConfirmCheckIn() {
    if (!selected) return;
    checkInMember(selected.id);
    handleClose();
    // Small delay so modal closes first, then alert shows
    setTimeout(() => {
      Alert.alert('✓ Checked In', `${selected.name} checked in successfully!`);
    }, 400);
  }

  if (!mounted && !visible) return null;

  const statusCfg = selected ? memberStatusConfig[selected.status] : null;
  const avatarColor = selected ? getMemberAvatarColor(selected.name) : colors.primary;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          {step === 'confirm' && (
            <TouchableOpacity onPress={() => setStep('search')} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>
            {step === 'search' ? 'Check In Member' : 'Confirm Check-In'}
          </Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {step === 'search' ? (
          <View style={styles.searchContent}>
            {/* Search box */}
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or phone..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {query.trim().length === 0 ? (
              <View style={styles.emptyHint}>
                <Ionicons name="person-outline" size={36} color={colors.textMuted} />
                <Text style={styles.emptyText}>Type a name or phone number</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyHint}>
                <Text style={styles.emptyText}>No members found</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={m => m.id}
                renderItem={({ item }) => {
                  const checkedIn = isCheckedInToday(item.id);
                  const sc = memberStatusConfig[item.status];
                  return (
                    <TouchableOpacity
                      style={[styles.resultRow, checkedIn && styles.resultRowChecked]}
                      onPress={() => !checkedIn && handleSelectMember(item)}
                      disabled={checkedIn}
                    >
                      <View style={[styles.resultAvatar, { backgroundColor: getMemberAvatarColor(item.name) + '22' }]}>
                        <Text style={[styles.resultAvatarText, { color: getMemberAvatarColor(item.name) }]}>
                          {getInitials(item.name)}
                        </Text>
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        <Text style={styles.resultPhone}>{item.phone}</Text>
                      </View>
                      {checkedIn ? (
                        <View style={styles.checkedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          <Text style={styles.checkedText}>Today</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                style={styles.resultList}
              />
            )}

            {/* QR placeholder */}
            <View style={styles.qrRow}>
              <Ionicons name="qr-code-outline" size={18} color={colors.textMuted} />
              <Text style={styles.qrText}>Scan QR — Coming soon</Text>
            </View>
          </View>
        ) : (
          /* Confirm step */
          <View style={styles.confirmContent}>
            {selected && (
              <>
                {/* Member card */}
                <View style={styles.confirmCard}>
                  <View style={[styles.confirmAvatar, { backgroundColor: avatarColor + '22' }]}>
                    <Text style={[styles.confirmAvatarText, { color: avatarColor }]}>
                      {getInitials(selected.name)}
                    </Text>
                  </View>
                  <Text style={styles.confirmName}>{selected.name}</Text>
                  <View style={[styles.confirmBadge, { backgroundColor: statusCfg!.color + '22' }]}>
                    <Text style={[styles.confirmBadgeText, { color: statusCfg!.color }]}>
                      {statusCfg!.label}
                    </Text>
                  </View>
                  <View style={styles.confirmMeta}>
                    <Ionicons name="pricetag-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.confirmMetaText}>{selected.plan_label}</Text>
                  </View>
                  <View style={styles.confirmMeta}>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.confirmMetaText}>
                      Last visit: {lastVisitLabel(selected.last_visit_at)}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmCheckIn}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                  <Text style={styles.confirmBtnText}>Confirm Check-In</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('search')}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%',
    borderTopWidth: 1, borderColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { marginRight: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  searchContent: { flex: 1, padding: spacing.md, gap: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.text },
  emptyHint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  emptyText: { fontSize: 14, color: colors.textMuted },
  resultList: { flex: 1 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultRowChecked: { opacity: 0.5 },
  resultAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  resultAvatarText: { fontSize: 16, fontWeight: '700' },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', color: colors.text },
  resultPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  checkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkedText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  qrRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  qrText: { fontSize: 13, color: colors.textMuted },

  // Confirm step
  confirmContent: { padding: spacing.md, gap: 16 },
  confirmCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    padding: 20, alignItems: 'center', gap: 8,
  },
  confirmAvatar: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmAvatarText: { fontSize: 24, fontWeight: '700' },
  confirmName: { fontSize: 20, fontWeight: '700', color: colors.text },
  confirmBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  confirmBadgeText: { fontSize: 12, fontWeight: '700' },
  confirmMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmMetaText: { fontSize: 13, color: colors.textSecondary },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, color: colors.textMuted },
});
