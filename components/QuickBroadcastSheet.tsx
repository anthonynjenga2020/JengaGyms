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
import { useRef, useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInRight, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/lib/theme';
import {
  getAllContacts,
  getQuickGroup,
  SMS_TEMPLATES,
  SCHEDULE_DAYS,
  SCHEDULE_TIMES,
  buildScheduledAt,
  formatScheduledAt,
  type ContactItem,
  type MockBroadcast,
} from '@/lib/mockBroadcasts';
import { PERSONALIZATION_TOKENS } from '@/lib/mockAutomations';

const MAX_CHARS = 160;

// ── Template picker modal ─────────────────────────────────────────────────────

function TemplatePicker({ visible, onClose, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (body: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.tplOverlay} onPress={onClose}>
        <View style={styles.tplSheet}>
          <Text style={styles.tplTitle}>SMS Templates</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {SMS_TEMPLATES.map((t, i) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tplRow, i > 0 && styles.tplRowBorder]}
                onPress={() => { onSelect(t.body); onClose(); }}
              >
                <Text style={styles.tplName}>{t.title}</Text>
                <Text style={styles.tplPreview} numberOfLines={2}>{t.body}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Recipient chip ─────────────────────────────────────────────────────────────

function RecipientChip({ contact, onRemove }: { contact: ContactItem; onRemove: () => void }) {
  const firstName = contact.name.split(' ')[0];
  return (
    <RNAnimated.View entering={FadeInRight.springify()}>
      <View style={[
        styles.chip,
        { backgroundColor: contact.type === 'member' ? colors.primary + '22' : colors.info + '22' },
      ]}>
        <Text style={[styles.chipText, { color: contact.type === 'member' ? colors.primary : colors.info }]}>
          {firstName}
        </Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}>
          <Ionicons name="close" size={12} color={contact.type === 'member' ? colors.primary : colors.info} />
        </TouchableOpacity>
      </View>
    </RNAnimated.View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (broadcast: MockBroadcast) => void;
  initialBroadcast?: MockBroadcast | null;
}

export function QuickBroadcastSheet({ visible, onClose, onSend, initialBroadcast }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(700)).current;
  const allContacts = useMemo(() => getAllContacts(), []);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDay, setScheduleDay] = useState('tomorrow');
  const [scheduleTime, setScheduleTime] = useState('8am');
  const [sending, setSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 700,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    if (!visible) {
      setTimeout(resetForm, 350);
    } else if (initialBroadcast) {
      prefill(initialBroadcast);
    }
  }, [visible]);

  function resetForm() {
    setSelectedIds(new Set());
    setSearchQuery('');
    setMessage('');
    setSendMode('now');
    setScheduleDay('tomorrow');
    setScheduleTime('8am');
    setSending(false);
  }

  function prefill(b: MockBroadcast) {
    setMessage(b.message);
    const ids = new Set(b.recipients.map(r => `${r.type === 'member' ? 'm' : 'l'}_${r.id}`));
    setSelectedIds(ids);
    if (b.scheduledAt) {
      setSendMode('schedule');
    }
  }

  const selectedContacts = allContacts.filter(c => selectedIds.has(c.id));

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allContacts;
    return allContacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q),
    );
  }, [searchQuery, allContacts]);

  function toggleContact(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectGroup(group: Parameters<typeof getQuickGroup>[0]) {
    const contacts = getQuickGroup(group);
    setSelectedIds(prev => {
      const next = new Set(prev);
      contacts.forEach(c => next.add(c.id));
      return next;
    });
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  function buildRecipientLabel(): string {
    if (selectedContacts.length === 0) return '';
    if (selectedContacts.length === 1) return selectedContacts[0].name;
    if (selectedContacts.length === 2) return `${selectedContacts[0].name} & ${selectedContacts[1].name}`;
    return `${selectedContacts[0].name}, ${selectedContacts[1].name} (+${selectedContacts.length - 2})`;
  }

  function buildPreview(): string {
    return message
      .replace(/{name}/g, 'John')
      .replace(/{gym_name}/g, 'JengaGym')
      .replace(/{plan}/g, 'Monthly Premium')
      .replace(/{expiry_date}/g, '30 Apr 2026')
      .replace(/{trainer_name}/g, 'James')
      .replace(/{class_name}/g, 'Yoga')
      .replace(/{amount}/g, '4,500')
      .replace(/{time}/g, '7:00 AM')
      .replace(/{date}/g, 'Mon 21 Apr');
  }

  function handleSend() {
    if (!message.trim() || selectedIds.size === 0) return;
    setSending(true);
    const scheduledAt = sendMode === 'schedule' ? buildScheduledAt(scheduleDay, scheduleTime) : undefined;

    setTimeout(() => {
      setSending(false);
      const broadcast: MockBroadcast = {
        id: `b${Date.now()}`,
        recipientLabel: buildRecipientLabel(),
        message: message.trim(),
        status: sendMode === 'now' ? 'sent' : 'scheduled',
        sentAt: sendMode === 'now' ? new Date().toISOString() : undefined,
        scheduledAt,
        recipientCount: selectedIds.size,
        recipients: selectedContacts.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          deliveryStatus: sendMode === 'now' ? 'delivered' : 'pending',
        })),
      };
      onSend(broadcast);
      onClose();
    }, 900);
  }

  const canSend = selectedIds.size > 0 && message.trim().length > 0 && !sending;
  const charCount = message.length;
  const charOver = charCount > MAX_CHARS;
  const scheduledLabel = sendMode === 'schedule'
    ? formatScheduledAt(buildScheduledAt(scheduleDay, scheduleTime))
    : null;

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={onClose} />
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 8, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Handle + header */}
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New Broadcast</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 20, paddingBottom: 8 }}
            >
              {/* ── RECIPIENTS ── */}
              <View style={{ gap: 10 }}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.fieldLabel}>Recipients</Text>
                  {selectedIds.size > 1 && (
                    <TouchableOpacity onPress={clearAll}>
                      <Text style={styles.clearAll}>Clear all</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Selected chips */}
                {selectedContacts.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}
                  >
                    {selectedContacts.map(c => (
                      <RecipientChip
                        key={c.id}
                        contact={c}
                        onRemove={() => toggleContact(c.id)}
                      />
                    ))}
                  </ScrollView>
                )}

                {/* Search */}
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search members or leads..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Contact list */}
                {searchQuery.length > 0 ? (
                  <View style={styles.contactList}>
                    {filteredContacts.length === 0 ? (
                      <Text style={styles.noResults}>No contacts found</Text>
                    ) : (
                      filteredContacts.slice(0, 8).map((c, i) => {
                        const selected = selectedIds.has(c.id);
                        const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[styles.contactRow, i > 0 && styles.contactBorder, selected && styles.contactRowSelected]}
                            onPress={() => toggleContact(c.id)}
                          >
                            <View style={[styles.contactAvatar, { backgroundColor: c.type === 'member' ? colors.primary + '25' : colors.info + '25' }]}>
                              <Text style={[styles.contactInitials, { color: c.type === 'member' ? colors.primary : colors.info }]}>{initials}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.contactName}>{c.name}</Text>
                              <Text style={styles.contactSub} numberOfLines={1}>{c.subtitle}</Text>
                            </View>
                            <View style={[styles.typePill, { backgroundColor: c.type === 'member' ? colors.primary + '20' : colors.info + '20' }]}>
                              <Text style={[styles.typePillText, { color: c.type === 'member' ? colors.primary : colors.info }]}>
                                {c.type}
                              </Text>
                            </View>
                            {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                ) : (
                  /* Quick group buttons */
                  <View style={styles.groupGrid}>
                    {([
                      { key: 'active_members', label: 'All Active Members', icon: 'people' },
                      { key: 'all_leads',       label: 'All Leads',          icon: 'funnel' },
                      { key: 'expiring_week',   label: 'Expiring This Week', icon: 'calendar' },
                      { key: 'inactive_30',     label: 'Inactive 30+ Days',  icon: 'moon' },
                    ] as const).map(g => {
                      const count = getQuickGroup(g.key).length;
                      return (
                        <TouchableOpacity
                          key={g.key}
                          style={styles.groupBtn}
                          onPress={() => selectGroup(g.key)}
                        >
                          <Ionicons name={`${g.icon}-outline` as any} size={16} color={colors.primary} />
                          <Text style={styles.groupBtnText}>{g.label}</Text>
                          <Text style={styles.groupBtnCount}>{count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {selectedIds.size > 0 && (
                  <RNAnimated.View entering={FadeIn.duration(200)}>
                    <Text style={styles.selectedCount}>
                      {selectedIds.size} recipient{selectedIds.size !== 1 ? 's' : ''} selected
                    </Text>
                  </RNAnimated.View>
                )}
              </View>

              {/* ── MESSAGE ── */}
              <View style={{ gap: 10 }}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.fieldLabel}>Message</Text>
                  <TouchableOpacity
                    style={styles.templateBtn}
                    onPress={() => setShowTemplates(true)}
                  >
                    <Ionicons name="flash-outline" size={13} color={colors.primary} />
                    <Text style={styles.templateBtnText}>Use Template</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.textareaWrap}>
                  <TextInput
                    style={styles.textarea}
                    multiline
                    numberOfLines={5}
                    placeholder="Write your message..."
                    placeholderTextColor={colors.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    textAlignVertical="top"
                  />
                  <Text style={[styles.charCount, charOver && styles.charCountOver]}>
                    {charCount}/{MAX_CHARS}
                  </Text>
                </View>

                {/* Personalization tokens */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {PERSONALIZATION_TOKENS.map(tok => (
                    <TouchableOpacity
                      key={tok}
                      style={styles.tokenChip}
                      onPress={() => setMessage(prev => prev + tok)}
                    >
                      <Text style={styles.tokenText}>{tok}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Live preview */}
                {message.trim().length > 0 && (
                  <RNAnimated.View entering={FadeIn.duration(200)} style={styles.previewWrap}>
                    <Text style={styles.previewLabel}>Preview</Text>
                    <View style={styles.previewBubble}>
                      <Text style={styles.previewText}>{buildPreview()}</Text>
                    </View>
                  </RNAnimated.View>
                )}
              </View>

              {/* ── SEND OPTIONS ── */}
              <View style={{ gap: 10 }}>
                <Text style={styles.fieldLabel}>When to Send</Text>
                <View style={styles.sendOptionRow}>
                  <TouchableOpacity
                    style={[styles.sendOptionCard, sendMode === 'now' && styles.sendOptionCardActive]}
                    onPress={() => setSendMode('now')}
                  >
                    <Text style={styles.sendOptionEmoji}>🚀</Text>
                    <Text style={[styles.sendOptionLabel, sendMode === 'now' && { color: colors.primary }]}>Send Now</Text>
                    {sendMode === 'now' && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendOptionCard, sendMode === 'schedule' && styles.sendOptionCardActive]}
                    onPress={() => setSendMode('schedule')}
                  >
                    <Text style={styles.sendOptionEmoji}>📅</Text>
                    <Text style={[styles.sendOptionLabel, sendMode === 'schedule' && { color: colors.primary }]}>Schedule</Text>
                    {sendMode === 'schedule' && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                </View>

                {/* Schedule date/time pickers */}
                {sendMode === 'schedule' && (
                  <RNAnimated.View entering={FadeIn.duration(200)} style={{ gap: 10 }}>
                    <View>
                      <Text style={styles.pickerLabel}>Day</Text>
                      <View style={styles.chipRow}>
                        {SCHEDULE_DAYS.map(d => (
                          <TouchableOpacity
                            key={d.id}
                            style={[styles.schedChip, scheduleDay === d.id && styles.schedChipActive]}
                            onPress={() => setScheduleDay(d.id)}
                          >
                            <Text style={[styles.schedChipText, scheduleDay === d.id && styles.schedChipTextActive]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View>
                      <Text style={styles.pickerLabel}>Time</Text>
                      <View style={styles.chipRow}>
                        {SCHEDULE_TIMES.map(t => (
                          <TouchableOpacity
                            key={t.id}
                            style={[styles.schedChip, scheduleTime === t.id && styles.schedChipActive]}
                            onPress={() => setScheduleTime(t.id)}
                          >
                            <Text style={[styles.schedChipText, scheduleTime === t.id && styles.schedChipTextActive]}>
                              {t.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    {scheduledLabel && (
                      <View style={styles.schedPreview}>
                        <Ionicons name="calendar-outline" size={14} color={colors.info} />
                        <Text style={styles.schedPreviewText}>Sends {scheduledLabel}</Text>
                      </View>
                    )}
                  </RNAnimated.View>
                )}
              </View>
            </ScrollView>

            {/* Send button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
              >
                {sending ? (
                  <Text style={styles.sendBtnText}>Sending...</Text>
                ) : (
                  <Text style={styles.sendBtnText}>
                    {sendMode === 'now'
                      ? `Send to ${selectedIds.size} recipient${selectedIds.size !== 1 ? 's' : ''}`
                      : `Schedule for ${selectedIds.size} recipient${selectedIds.size !== 1 ? 's' : ''}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <TemplatePicker
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={body => setMessage(body)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '94%',
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    gap: 14,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },

  // Field label
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearAll: { fontSize: 12, fontWeight: '600', color: colors.danger },

  // Chips
  chipsRow: { gap: 6, flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipText: { fontSize: 12, fontWeight: '700' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  // Contact list
  contactList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  contactBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  contactRowSelected: { backgroundColor: colors.primary + '08' },
  contactAvatar: {
    width: 34, height: 34, borderRadius: radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  contactInitials: { fontSize: 12, fontWeight: '700' },
  contactName: { fontSize: 13, fontWeight: '600', color: colors.text },
  contactSub: { fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
  typePill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full },
  typePillText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  noResults: { fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 20 },

  // Group buttons
  groupGrid: { gap: 8 },
  groupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  groupBtnCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  selectedCount: { fontSize: 13, fontWeight: '600', color: colors.primary, textAlign: 'center' },

  // Message
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  templateBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  textareaWrap: { position: 'relative' },
  textarea: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    paddingBottom: 28,
    fontSize: 14,
    color: colors.text,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: {
    position: 'absolute',
    bottom: 8, right: 10,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  charCountOver: { color: colors.danger },
  tokenChip: {
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.info + '20',
    borderWidth: 1,
    borderColor: colors.info + '40',
  },
  tokenText: { fontSize: 11, color: colors.info, fontWeight: '600' },

  // Preview
  previewWrap: { gap: 6 },
  previewLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  previewBubble: {
    backgroundColor: colors.primary + '20',
    borderRadius: 14,
    borderBottomRightRadius: 3,
    padding: 12,
    alignSelf: 'flex-end',
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: colors.primary + '35',
  },
  previewText: { fontSize: 13, color: colors.text, lineHeight: 19 },

  // Send options
  sendOptionRow: { flexDirection: 'row', gap: 10 },
  sendOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sendOptionCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  sendOptionEmoji: { fontSize: 18 },
  sendOptionLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  // Schedule pickers
  pickerLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  schedChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  schedChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  schedChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  schedChipTextActive: { color: colors.primary },
  schedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.info + '15',
    borderRadius: radius.sm,
    padding: 10,
  },
  schedPreviewText: { fontSize: 13, color: colors.info, fontWeight: '600' },

  // Footer
  footer: { paddingTop: 4 },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Template picker
  tplOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  tplSheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '65%',
    padding: spacing.md,
    gap: 12,
  },
  tplTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  tplRow: { paddingVertical: 12, gap: 4 },
  tplRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  tplName: { fontSize: 13, fontWeight: '700', color: colors.text },
  tplPreview: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});
