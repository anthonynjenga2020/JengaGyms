import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform as RNPlatform,
} from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import { useMembersContext } from '@/context/MembersContext';
import type { Member } from '@/context/MembersContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReviewPlatform = 'google' | 'facebook';

interface CustomContact {
  id: string;
  name: string;
  phone: string;
  isCustom: true;
}

type SelectedContact = Member | CustomContact;

function isCustom(c: SelectedContact): c is CustomContact {
  return (c as CustomContact).isCustom === true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#4C9FFF', '#A855F7', '#F97316', '#33D169', '#FF4C4C', '#FFD24C', '#EC4899'];

function getAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function relativeDate(iso: string | null): string {
  if (!iso) return 'Never visited';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  selected,
  onToggle,
  index,
}: {
  member: Member;
  selected: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <Reanimated.View entering={FadeInDown.delay(index * 40).springify()}>
      <TouchableOpacity
        style={[s.memberRow, selected && s.memberRowSelected]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={[s.avatar, { backgroundColor: getAvatarColor(member.name) }]}>
          <Text style={s.avatarText}>{getInitials(member.name)}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.memberName}>{member.name}</Text>
          <Text style={s.memberMeta}>
            {member.phone} · {relativeDate(member.last_visit_at)}
          </Text>
        </View>

        <View style={[s.checkCircle, selected && s.checkCircleActive]}>
          {selected && <Ionicons name="checkmark" size={13} color="#000" />}
        </View>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

// ─── Step 1 — Select Contacts ─────────────────────────────────────────────────

function StepOne({
  selected,
  onToggle,
  onSelectAll,
  onAddCustom,
  onNext,
}: {
  selected: Set<string>;
  onToggle: (m: Member) => void;
  onSelectAll: () => void;
  onAddCustom: (name: string, phone: string) => void;
  onNext: () => void;
}) {
  const { members } = useMembersContext();
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return members.filter(
      m => m.name.toLowerCase().includes(q) || m.phone.includes(q)
    );
  }, [members, query]);

  function handleAddCustom() {
    if (!customName.trim() || !customPhone.trim()) return;
    onAddCustom(customName.trim(), customPhone.trim());
    setCustomName('');
    setCustomPhone('');
  }

  const activeMembers = members.filter(m => m.status === 'active');

  return (
    <>
      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search members..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Select all link */}
      <TouchableOpacity onPress={onSelectAll} style={s.selectAllRow}>
        <Ionicons name="people-outline" size={14} color={colors.primary} />
        <Text style={s.selectAllText}>
          Select All Active Members ({activeMembers.length})
        </Text>
      </TouchableOpacity>

      {/* Member list */}
      <ScrollView
        style={{ maxHeight: 280 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((m, i) => (
          <MemberRow
            key={m.id}
            member={m}
            selected={selected.has(m.id)}
            onToggle={() => onToggle(m)}
            index={i}
          />
        ))}
        {filtered.length === 0 && (
          <Text style={s.emptySearch}>No members match "{query}"</Text>
        )}
      </ScrollView>

      {/* Or enter manually */}
      <View style={s.manualSection}>
        <View style={s.manualDivider}>
          <View style={s.divLine} />
          <Text style={s.divLabel}>Or enter manually</Text>
          <View style={s.divLine} />
        </View>
        <View style={s.manualRow}>
          <TextInput
            style={[s.manualInput, { flex: 1 }]}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={customName}
            onChangeText={setCustomName}
          />
          <TextInput
            style={[s.manualInput, { flex: 1 }]}
            placeholder="Phone"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={customPhone}
            onChangeText={setCustomPhone}
          />
          <TouchableOpacity
            style={[s.addBtn, (!customName.trim() || !customPhone.trim()) && { opacity: 0.4 }]}
            onPress={handleAddCustom}
            disabled={!customName.trim() || !customPhone.trim()}
          >
            <Text style={s.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Next button */}
      <TouchableOpacity
        style={[s.primaryBtn, selected.size === 0 && { opacity: 0.4 }]}
        onPress={onNext}
        disabled={selected.size === 0}
      >
        <Text style={s.primaryBtnText}>
          Next →{selected.size > 0 ? `  (${selected.size} selected)` : ''}
        </Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Step 2 — Platform & Message ──────────────────────────────────────────────

function StepTwo({
  selectedCount,
  onBack,
  onSend,
}: {
  selectedCount: number;
  onBack: () => void;
  onSend: () => void;
}) {
  const [platform, setPlatform] = useState<ReviewPlatform | null>(null);
  const [reviewLink, setReviewLink] = useState('');
  const [saveLink, setSaveLink] = useState(false);
  const [sendVia] = useState<'sms'>('sms'); // WhatsApp coming soon
  const [message, setMessage] = useState(
    "Hi [Name]! 😊 We hope you're enjoying your experience at [Gym Name]. We'd love to hear your feedback — it only takes 30 seconds!\n\nLeave us a review here: [Link]\n\nThank you! 🙏"
  );

  const linkPlaceholder =
    platform === 'google'
      ? 'https://g.page/r/your-gym/review'
      : 'https://facebook.com/your-page/reviews';

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 8 }}
    >
      {/* Back link */}
      <TouchableOpacity style={s.backRow} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color={colors.primary} />
        <Text style={s.backText}>Back</Text>
      </TouchableOpacity>

      {/* Platform cards */}
      <Text style={s.fieldLabel}>Choose Platform</Text>
      <View style={s.platformCards}>
        {(['google', 'facebook'] as ReviewPlatform[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[s.platformCard, platform === p && s.platformCardActive]}
            onPress={() => setPlatform(p)}
            activeOpacity={0.8}
          >
            {platform === p && (
              <View style={s.platformCheck}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              </View>
            )}
            <Text style={s.platformIcon}>{p === 'google' ? '🌐' : '📘'}</Text>
            <Text style={s.platformCardTitle}>
              {p === 'google' ? 'Google' : 'Facebook'}
            </Text>
            <Text style={s.platformCardSub}>
              {p === 'google'
                ? 'Send your Google review link'
                : 'Send your Facebook review link'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Review link input — shown once platform selected */}
      {platform && (
        <Reanimated.View entering={FadeInDown.springify()}>
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>
            Your {platform.charAt(0).toUpperCase() + platform.slice(1)} Review Link
          </Text>
          <TextInput
            style={s.linkInput}
            placeholder={linkPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={reviewLink}
            onChangeText={setReviewLink}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={s.helperText}>Paste your direct review page link here</Text>
          <View style={s.saveLinkRow}>
            <Text style={s.saveLinkLabel}>Save this link for next time</Text>
            <Switch
              value={saveLink}
              onValueChange={setSaveLink}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={saveLink ? colors.primary : colors.textMuted}
            />
          </View>
        </Reanimated.View>
      )}

      {/* Message preview */}
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Message Preview</Text>
      <TextInput
        style={s.messageInput}
        multiline
        value={message}
        onChangeText={setMessage}
        placeholderTextColor={colors.textMuted}
      />

      {/* Send via pills */}
      <Text style={[s.fieldLabel, { marginTop: 14 }]}>Send via</Text>
      <View style={s.sendViaRow}>
        <View style={[s.sendViaPill, s.sendViaPillActive]}>
          <Text style={[s.sendViaPillText, s.sendViaPillTextActive]}>SMS</Text>
        </View>
        <View style={[s.sendViaPill, s.sendViaPillDisabled]}>
          <Text style={s.sendViaPillText}>WhatsApp</Text>
          <Text style={s.comingSoon}>  soon</Text>
        </View>
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[s.primaryBtn, { marginTop: 16 }, !platform && { opacity: 0.4 }]}
        onPress={onSend}
        disabled={!platform}
      >
        <Text style={s.primaryBtnText}>
          Send Request{selectedCount > 1 ? `s to ${selectedCount} members` : ''}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── RequestReviewModal ───────────────────────────────────────────────────────

export function RequestReviewModal({
  visible,
  onClose,
  onSent,
}: {
  visible: boolean;
  onClose: () => void;
  onSent: (count: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { members } = useMembersContext();

  const slideAnim = useRef(new Animated.Value(800)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Step 1 → slide current content out left, new content in from right
  const slideOffset = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customContacts, setCustomContacts] = useState<CustomContact[]>([]);

  const totalSelected = selectedIds.size + customContacts.length;

  // Open/close sheet animation
  useEffect(() => {
    if (visible) {
      setStep(1);
      setSelectedIds(new Set());
      setCustomContacts([]);
      slideOffset.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 800, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function goToStep2() {
    Animated.timing(slideOffset, {
      toValue: -1,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setStep(2));
  }

  function goToStep1() {
    setStep(1);
    Animated.timing(slideOffset, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }

  function handleToggleMember(m: Member) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(m.id) ? next.delete(m.id) : next.add(m.id);
      return next;
    });
  }

  function handleSelectAll() {
    const activeIds = members.filter(m => m.status === 'active').map(m => m.id);
    setSelectedIds(new Set(activeIds));
  }

  function handleAddCustom(name: string, phone: string) {
    const cc: CustomContact = { id: `custom_${Date.now()}`, name, phone, isCustom: true };
    setCustomContacts(prev => [...prev, cc]);
  }

  function handleSend() {
    onSent(totalSelected);
    onClose();
  }

  const slideTranslate = slideOffset.interpolate({
    inputRange: [-1, 0],
    outputRange: [-400, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={RNPlatform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, s.backdrop, { opacity: backdropAnim }]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.sheetHeader}>
            <View>
              <Text style={s.sheetTitle}>Request a Review</Text>
              <Text style={s.sheetSubtitle}>
                {step === 1
                  ? totalSelected > 0
                    ? `${totalSelected} selected`
                    : 'Choose who to send to'
                  : 'Choose platform & message'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={s.stepRow}>
            {[1, 2].map(n => (
              <View key={n} style={[s.stepDot, step >= n && s.stepDotActive]} />
            ))}
          </View>

          {/* Content with slide transition */}
          <Animated.View style={{ transform: [{ translateX: slideTranslate }], flex: 1 }}>
            {step === 1 ? (
              <StepOne
                selected={selectedIds}
                onToggle={handleToggleMember}
                onSelectAll={handleSelectAll}
                onAddCustom={handleAddCustom}
                onNext={goToStep2}
              />
            ) : (
              <StepTwo
                selectedCount={totalSelected}
                onBack={goToStep1}
                onSend={handleSend}
              />
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: '92%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sheetSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  stepRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  stepDot: {
    width: 24, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.primary },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  selectAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // Member rows
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    marginBottom: 2,
  },
  memberRowSelected: { backgroundColor: colors.primary + '12' },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.text },
  memberMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  emptySearch: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  // Manual entry
  manualSection: { marginTop: 4 },
  manualDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divLabel: { fontSize: 12, color: colors.textMuted },
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  manualInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#0F1923' },

  // Step 2
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },

  platformCards: { flexDirection: 'row', gap: 10 },
  platformCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  platformCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  platformCheck: { position: 'absolute', top: 8, right: 8 },
  platformIcon: { fontSize: 24 },
  platformCardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  platformCardSub: { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 15 },

  linkInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  helperText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  saveLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  saveLinkLabel: { fontSize: 13, fontWeight: '600', color: colors.text },

  messageInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 13,
    color: colors.text,
    minHeight: 110,
    textAlignVertical: 'top',
    lineHeight: 19,
  },

  sendViaRow: { flexDirection: 'row', gap: 8 },
  sendViaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  sendViaPillActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  sendViaPillDisabled: { opacity: 0.5 },
  sendViaPillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  sendViaPillTextActive: { color: colors.primary },
  comingSoon: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic' },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#0F1923' },
});
