import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TouchableHighlight,
  TextInput, Platform, Alert, Modal, Pressable, ScrollView,
  Animated as RNAnimated,
} from 'react-native';
import { useState, useMemo, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMessagesContext, CHANNEL_CONFIG } from '@/context/MessagesContext';
import { useMembersContext } from '@/context/MembersContext';
import { useLeadsContext } from '@/context/LeadsContext';
import { colors, spacing } from '@/lib/theme';
import type { Conversation, Channel, ConversationStatus } from '@/context/MessagesContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) {
    return new Date(isoStr).toLocaleDateString('en-KE', { weekday: 'short' });
  }
  return new Date(isoStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#4C9FFF', '#A855F7', '#F97316', '#33D169', '#FFD24C', '#FF6B9D', '#06B6D4'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// Orange = customer waiting (unread), Green = active (recently replied), Grey = inactive (>24h)
function contactStatus(conv: Conversation): 'waiting' | 'active' | 'inactive' {
  if (conv.unread_count > 0) return 'waiting';
  const diff = Date.now() - new Date(conv.last_message_at).getTime();
  if (diff < 24 * 3600000) return 'active';
  return 'inactive';
}

const STATUS_COLORS = { waiting: '#F97316', active: '#33D169', inactive: '#8FA3B4' };

// ── Channel filter config ─────────────────────────────────────────────────────

type ChannelFilter = 'all' | Channel;
const CHANNEL_PILLS: { key: ChannelFilter; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'sms',          label: 'SMS' },
  { key: 'whatsapp',     label: 'WhatsApp' },
  { key: 'website_chat', label: 'Website Chat' },
  { key: 'instagram',    label: 'Instagram' },
];

// ── Conversation Card ─────────────────────────────────────────────────────────

function ConversationCard({
  item, teamMember, onLongPress,
}: {
  item: Conversation;
  teamMember?: string;
  onLongPress: () => void;
}) {
  const cfg = CHANNEL_CONFIG[item.channel];
  const ac = avatarColor(item.contact_name);
  const hasUnread = item.unread_count > 0;
  const dotStatus = contactStatus(item);

  return (
    <TouchableHighlight
      underlayColor={colors.surfaceElevated}
      style={[styles.card, hasUnread && styles.cardUnread]}
      onPress={() => router.push(`/conversation/${item.id}`)}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      <View style={styles.cardInner}>
        {hasUnread && <View style={styles.unreadBar} />}

        {/* Avatar + channel badge + status dot */}
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatar, { backgroundColor: ac + '22' }]}>
            <Text style={[styles.avatarText, { color: ac }]}>{getInitials(item.contact_name)}</Text>
          </View>
          <View style={[styles.channelBadge, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon as any} size={8} color="#fff" />
          </View>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[dotStatus] }]} />
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.contactName, hasUnread && styles.contactNameBold]} numberOfLines={1}>
              {item.contact_name}
            </Text>
            <Text style={styles.timeLabel}>{timeAgo(item.last_message_at)}</Text>
          </View>

          <View style={styles.cardMidRow}>
            <Text
              style={[styles.lastMessage, hasUnread && styles.lastMessageBold]}
              numberOfLines={1}
            >
              {item.last_message}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unread_count}</Text>
              </View>
            )}
          </View>

          {(teamMember || item.status === 'resolved') && (
            <View style={styles.cardBottomRow}>
              {teamMember ? (
                <View style={styles.assigneeChip}>
                  <Ionicons name="person-outline" size={10} color={colors.primary} />
                  <Text style={styles.assigneeText}>{teamMember.split(' ')[0]}</Text>
                </View>
              ) : null}
              {item.status === 'resolved' && (
                <View style={styles.resolvedChip}>
                  <Text style={styles.resolvedChipText}>Resolved</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableHighlight>
  );
}

// ── New Conversation Sheet (2-step) ───────────────────────────────────────────

type ContactEntry = { id: string; name: string; phone: string; type: 'member' | 'lead' };

function NewConversationSheet({ onClose }: { onClose: () => void }) {
  const { addConversation } = useMessagesContext();
  const { members } = useMembersContext();
  const { leads } = useLeadsContext();

  const translateY = useRef(new RNAnimated.Value(700)).current;
  const backdrop = useRef(new RNAnimated.Value(0)).current;

  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [selected, setSelected] = useState<ContactEntry | null>(null);
  const [channel, setChannel] = useState<Channel>('sms');

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      RNAnimated.timing(backdrop, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  function handleClose() {
    RNAnimated.parallel([
      RNAnimated.timing(translateY, { toValue: 700, duration: 250, useNativeDriver: true }),
      RNAnimated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onClose);
  }

  // Combine members + leads into a single contact list
  const allContacts: ContactEntry[] = useMemo(() => [
    ...members.map(m => ({ id: m.id, name: m.name, phone: m.phone, type: 'member' as const })),
    ...leads.filter(l => l.phone).map(l => ({ id: l.id, name: l.name, phone: l.phone!, type: 'lead' as const })),
  ], [members, leads]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allContacts.slice(0, 20);
    const q = query.toLowerCase();
    return allContacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [allContacts, query]);

  function handleSelectContact(contact: ContactEntry) {
    setSelected(contact);
  }

  async function handleNext() {
    const contactName = selected?.name ?? 'Unknown';
    const contactPhone = selected?.phone ?? manualPhone.trim();
    if (!contactPhone) return;

    const newId = await addConversation({
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: null,
      channel,
      status: 'open',
      assigned_to: null,
      last_message: '',
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      tags: [],
    });

    handleClose();
    setTimeout(() => router.push(`/conversation/${newId}`), 320);
  }

  const canProceed = selected !== null || manualPhone.trim().length >= 9;

  const channels: Channel[] = ['sms', 'whatsapp', 'instagram', 'website_chat'];

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </RNAnimated.View>
      <RNAnimated.View style={[ncStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={ncStyles.handle} />

        {/* Header */}
        <View style={ncStyles.header}>
          <Text style={ncStyles.title}>New Message</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={ncStyles.searchBar}>
          <Ionicons name="search-outline" size={17} color={colors.textMuted} />
          <TextInput
            style={ncStyles.searchInput}
            placeholder="Search members & leads..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Contact list */}
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          style={ncStyles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const ac = avatarColor(item.name);
            const isSelected = selected?.id === item.id;
            return (
              <TouchableOpacity
                style={[ncStyles.contactRow, isSelected && ncStyles.contactRowSelected]}
                onPress={() => { handleSelectContact(item); setShowManual(false); }}
              >
                <View style={[ncStyles.contactAvatar, { backgroundColor: ac + '22' }]}>
                  <Text style={[ncStyles.contactAvatarText, { color: ac }]}>{getInitials(item.name)}</Text>
                </View>
                <View style={ncStyles.contactInfo}>
                  <Text style={ncStyles.contactName}>{item.name}</Text>
                  <Text style={ncStyles.contactPhone}>{item.phone}</Text>
                </View>
                <View style={[ncStyles.typeBadge, item.type === 'member' ? ncStyles.typeBadgeMember : ncStyles.typeBadgeLead]}>
                  <Text style={ncStyles.typeBadgeText}>{item.type}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <TouchableOpacity style={ncStyles.manualRow} onPress={() => { setShowManual(s => !s); setSelected(null); }}>
              <Ionicons name="keypad-outline" size={16} color={colors.textSecondary} />
              <Text style={ncStyles.manualLabel}>Or enter a number manually</Text>
              <Ionicons name={showManual ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
            </TouchableOpacity>
          }
        />

        {showManual && (
          <View style={ncStyles.manualInput}>
            <TextInput
              style={ncStyles.phoneInput}
              placeholder="+254700000000"
              placeholderTextColor={colors.textMuted}
              value={manualPhone}
              onChangeText={setManualPhone}
              keyboardType="phone-pad"
              autoFocus
            />
          </View>
        )}

        {/* Channel selector */}
        <View style={ncStyles.channelSection}>
          <Text style={ncStyles.channelLabel}>Channel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ncStyles.channelRow}>
            {channels.map(ch => {
              const cfg = CHANNEL_CONFIG[ch];
              const active = channel === ch;
              return (
                <TouchableOpacity
                  key={ch}
                  style={[ncStyles.channelChip, active && { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}
                  onPress={() => setChannel(ch)}
                >
                  <Ionicons name={cfg.icon as any} size={14} color={active ? cfg.color : colors.textMuted} />
                  <Text style={[ncStyles.channelChipText, active && { color: cfg.color }]}>{cfg.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Next button */}
        <View style={ncStyles.footer}>
          <TouchableOpacity
            style={[ncStyles.nextBtn, !canProceed && ncStyles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed}
          >
            <Text style={ncStyles.nextBtnText}>
              {selected ? `Start conversation with ${selected.name.split(' ')[0]}` : 'Start Conversation'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#000" />
          </TouchableOpacity>
        </View>
      </RNAnimated.View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const {
    conversations, getTeamMember, unreadCount,
    markRead, markUnread, resolveConversation, reopenConversation, deleteConversation,
  } = useMessagesContext();

  const [tab, setTab]                       = useState<ConversationStatus>('open');
  const [channelFilter, setChannelFilter]   = useState<ChannelFilter>('all');
  const [unreadOnly, setUnreadOnly]         = useState(false);
  const [search, setSearch]                 = useState('');
  const [newConvoVisible, setNewConvoVisible] = useState(false);
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);

  const inboxCount    = useMemo(() => conversations.filter(c => c.status === 'open').length, [conversations]);
  const resolvedCount = useMemo(() => conversations.filter(c => c.status === 'resolved').length, [conversations]);

  const filtered = useMemo(() => {
    let list = conversations.filter(c => c.status === tab);

    if (channelFilter !== 'all') list = list.filter(c => c.channel === channelFilter);
    if (unreadOnly) list = list.filter(c => c.unread_count > 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_phone.includes(q) ||
        c.last_message.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  }, [conversations, tab, channelFilter, unreadOnly, search]);

  function handleLongPress(item: Conversation) {
    Alert.alert(item.contact_name, undefined, [
      {
        text: item.unread_count > 0 ? 'Mark as Read' : 'Mark as Unread',
        onPress: () => item.unread_count > 0 ? markRead(item.id) : markUnread(item.id),
      },
      { text: 'Assign to Team Member', onPress: () => setAssignTargetId(item.id) },
      {
        text: item.status === 'resolved' ? 'Reopen' : 'Resolve',
        onPress: () => item.status === 'resolved' ? reopenConversation(item.id) : resolveConversation(item.id),
      },
      { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(item.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Messages</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadSub}>{unreadCount} unread</Text>
          )}
        </View>
        <TouchableOpacity style={styles.composeBtn} onPress={() => setNewConvoVisible(true)}>
          <Ionicons name="create-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Channel filter pills */}
      <FlatList
        data={CHANNEL_PILLS}
        horizontal
        keyExtractor={i => i.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        renderItem={({ item }) => {
          const isActive = channelFilter === item.key;
          const cfg = item.key !== 'all' ? CHANNEL_CONFIG[item.key as Channel] : null;
          return (
            <TouchableOpacity
              style={[
                styles.pill,
                isActive && { backgroundColor: cfg?.color ?? colors.primary, borderColor: cfg?.color ?? colors.primary },
              ]}
              onPress={() => setChannelFilter(item.key)}
            >
              {cfg && <Ionicons name={cfg.icon as any} size={11} color={isActive ? '#fff' : colors.textSecondary} />}
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Inbox / Resolved tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'open' && styles.tabBtnActive]}
          onPress={() => setTab('open')}
        >
          <Text style={[styles.tabText, tab === 'open' && styles.tabTextActive]}>
            Inbox ({inboxCount})
          </Text>
          {tab === 'open' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'resolved' && styles.tabBtnActive]}
          onPress={() => setTab('resolved')}
        >
          <Text style={[styles.tabText, tab === 'resolved' && styles.tabTextActive]}>
            Resolved ({resolvedCount})
          </Text>
          {tab === 'resolved' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Unread Only toggle */}
      <TouchableOpacity
        style={[styles.unreadToggle, unreadOnly && styles.unreadToggleActive]}
        onPress={() => setUnreadOnly(o => !o)}
      >
        <View style={[styles.unreadDot, unreadOnly && styles.unreadDotActive]} />
        <Text style={[styles.unreadToggleText, unreadOnly && styles.unreadToggleTextActive]}>
          Unread Only
        </Text>
        {unreadOnly && <Ionicons name="close-circle" size={14} color={colors.primary} />}
      </TouchableOpacity>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(300).springify()}>
            <ConversationCard
              item={item}
              teamMember={item.assigned_to ? getTeamMember(item.assigned_to)?.name : undefined}
              onLongPress={() => handleLongPress(item)}
            />
          </Animated.View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {search || unreadOnly ? 'No conversations found' : tab === 'open' ? 'All caught up!' : 'No resolved conversations'}
            </Text>
            <Text style={styles.emptySubtext}>
              {!search && !unreadOnly && tab === 'open' && 'Tap ✏️ to start a new conversation.'}
            </Text>
            {!search && !unreadOnly && tab === 'open' && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setNewConvoVisible(true)}>
                <Text style={styles.emptyBtnText}>Start a Conversation</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {newConvoVisible && (
        <NewConversationSheet onClose={() => setNewConvoVisible(false)} />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  unreadSub: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  composeBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
  },

  pillRow: { paddingHorizontal: spacing.md, paddingBottom: 10, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 99, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingBottom: 10, position: 'relative' },
  tabBtnActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.text },
  tabIndicator: {
    position: 'absolute', bottom: -1, left: '20%', right: '20%',
    height: 2, backgroundColor: colors.primary, borderRadius: 1,
  },

  unreadToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md, marginBottom: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unreadToggleActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  unreadDotActive: { backgroundColor: colors.primary },
  unreadToggleText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  unreadToggleTextActive: { color: colors.primary },

  list: { paddingHorizontal: spacing.md, paddingBottom: 32, gap: 8 },

  card: {
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardUnread: { borderColor: colors.primary + '55' },
  cardInner: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, paddingRight: 13, paddingLeft: 11, gap: 11 },

  unreadBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: colors.primary,
  },

  avatarWrapper: { position: 'relative', marginTop: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  channelBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.surface,
  },
  statusDot: {
    position: 'absolute', top: -1, left: -1,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: colors.surface,
  },

  cardContent: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  contactName: { fontSize: 15, fontWeight: '500', color: colors.text, flex: 1 },
  contactNameBold: { fontWeight: '700' },
  timeLabel: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },

  cardMidRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastMessage: { fontSize: 13, color: colors.textMuted, flex: 1 },
  lastMessageBold: { color: colors.textSecondary, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.primary, borderRadius: 99,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  unreadCount: { fontSize: 11, fontWeight: '700', color: '#000' },

  cardBottomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  assigneeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primary + '18',
    borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2,
  },
  assigneeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  resolvedChip: {
    backgroundColor: colors.textMuted + '20',
    borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2,
  },
  resolvedChipText: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
});

const ncStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '88%',
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
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    margin: spacing.md, marginBottom: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.text },
  list: { flex: 1 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  contactRowSelected: { backgroundColor: colors.primary + '10' },
  contactAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  contactAvatarText: { fontSize: 14, fontWeight: '700' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600', color: colors.text },
  contactPhone: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  typeBadgeMember: { backgroundColor: colors.primary + '22' },
  typeBadgeLead: { backgroundColor: '#A855F7' + '22' },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  manualRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  manualLabel: { flex: 1, fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  manualInput: { marginHorizontal: spacing.md, marginBottom: 8 },
  phoneInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text,
  },
  channelSection: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 12, paddingBottom: 4,
  },
  channelLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, paddingHorizontal: spacing.md, marginBottom: 8 },
  channelRow: { paddingHorizontal: spacing.md, gap: 8 },
  channelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: colors.surfaceElevated,
  },
  channelChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  footer: { paddingHorizontal: spacing.md, paddingTop: 12 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 15,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
