import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Platform,
} from 'react-native';
import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMessagesContext, CHANNEL_CONFIG } from '@/context/MessagesContext';
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
  if (days < 7) return `${days}d`;
  return new Date(isoStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = ['#4C9FFF', '#A855F7', '#F97316', '#33D169', '#FFD24C', '#FF6B9D', '#06B6D4'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── Channel pill ──────────────────────────────────────────────────────────────

type ChannelFilter = 'all' | Channel;
const CHANNEL_PILLS: { key: ChannelFilter; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'whatsapp',     label: 'WhatsApp' },
  { key: 'sms',          label: 'SMS' },
  { key: 'instagram',    label: 'Instagram' },
  { key: 'website_chat', label: 'Website' },
];

// ── Conversation Card ─────────────────────────────────────────────────────────

function ConversationCard({ item, teamMember }: { item: Conversation; teamMember?: string }) {
  const cfg = CHANNEL_CONFIG[item.channel];
  const ac = avatarColor(item.contact_name);
  const hasUnread = item.unread_count > 0;

  return (
    <TouchableOpacity
      style={[styles.card, hasUnread && styles.cardUnread]}
      onPress={() => router.push(`/conversation/${item.id}`)}
      activeOpacity={0.75}
    >
      {/* Unread left border */}
      {hasUnread && <View style={styles.unreadBar} />}

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: ac + '22' }]}>
        <Text style={[styles.avatarText, { color: ac }]}>{getInitials(item.contact_name)}</Text>
        {/* Channel badge */}
        <View style={[styles.channelBadge, { backgroundColor: cfg.color }]}>
          <Ionicons name={cfg.icon as any} size={8} color="#fff" />
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.contactName, hasUnread && styles.contactNameBold]} numberOfLines={1}>
            {item.contact_name}
          </Text>
          <Text style={styles.timeLabel}>{timeAgo(item.last_message_at)}</Text>
        </View>

        <View style={styles.cardBottomRow}>
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

        {/* Tags + assignee */}
        {(item.tags.length > 0 || teamMember) && (
          <View style={styles.cardMeta}>
            {item.tags.slice(0, 2).map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {teamMember && (
              <View style={styles.assigneeChip}>
                <Ionicons name="person-outline" size={10} color={colors.textMuted} />
                <Text style={styles.assigneeText}>{teamMember.split(' ')[0]}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { conversations, getTeamMember, unreadCount } = useMessagesContext();
  const [tab, setTab] = useState<ConversationStatus>('open');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [search, setSearch] = useState('');
  const [newConvoVisible, setNewConvoVisible] = useState(false);

  const filtered = useMemo(() => {
    let list = conversations.filter(c => c.status === tab);

    if (channelFilter !== 'all') {
      list = list.filter(c => c.channel === channelFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_phone.includes(q) ||
        c.last_message.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  }, [conversations, tab, channelFilter, search]);

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

      {/* Open / Resolved tabs */}
      <View style={styles.statusTabs}>
        {(['open', 'resolved'] as ConversationStatus[]).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.statusTab, tab === s && styles.statusTabActive]}
            onPress={() => setTab(s)}
          >
            <Text style={[styles.statusTabText, tab === s && styles.statusTabTextActive]}>
              {s === 'open' ? 'Inbox' : 'Resolved'}
            </Text>
            {s === 'open' && unreadCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
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
              style={[styles.pill, isActive && { backgroundColor: cfg?.color ?? colors.primary, borderColor: cfg?.color ?? colors.primary }]}
              onPress={() => setChannelFilter(item.key)}
            >
              {cfg && <Ionicons name={cfg.icon as any} size={11} color={isActive ? '#fff' : colors.textSecondary} />}
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Count */}
      <Text style={styles.countLabel}>
        {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
      </Text>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).duration(300).springify()}>
            <ConversationCard
              item={item}
              teamMember={item.assigned_to ? getTeamMember(item.assigned_to)?.name : undefined}
            />
          </Animated.View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No conversations</Text>
            <Text style={styles.emptySubtext}>
              {tab === 'open' ? 'All caught up! New messages will appear here.' : 'No resolved conversations yet.'}
            </Text>
          </View>
        }
      />

      {/* New conversation sheet placeholder */}
      {newConvoVisible && (
        <NewConversationSheet onClose={() => setNewConvoVisible(false)} />
      )}
    </View>
  );
}

// ── New Conversation Sheet (inline) ───────────────────────────────────────────

import { Modal, Animated as RNAnimated, Pressable, ActivityIndicator } from 'react-native';
import { useRef as useRNRef, useEffect as useRNEffect } from 'react';

function NewConversationSheet({ onClose }: { onClose: () => void }) {
  const { addConversation } = useMessagesContext();
  const translateY = useRNRef(new RNAnimated.Value(600)).current;
  const backdrop = useRNRef(new RNAnimated.Value(0)).current;

  useRNEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      RNAnimated.timing(backdrop, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function handleClose() {
    RNAnimated.parallel([
      RNAnimated.timing(translateY, { toValue: 600, duration: 250, useNativeDriver: true }),
      RNAnimated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onClose);
  }

  async function handleSend() {
    if (!name.trim() || !phone.trim() || !message.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    addConversation({
      contact_name: name.trim(),
      contact_phone: phone.trim(),
      contact_email: null,
      channel,
      status: 'open',
      assigned_to: null,
      last_message: message.trim(),
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      tags: [],
    }, message.trim());
    setSaving(false);
    handleClose();
  }

  const channels: Channel[] = ['whatsapp', 'sms', 'instagram', 'website_chat'];

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </RNAnimated.View>
      <RNAnimated.View style={[newStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={newStyles.handle} />
        <View style={newStyles.header}>
          <Text style={newStyles.title}>New Conversation</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={newStyles.content}>
          {/* Channel selector */}
          <View style={newStyles.field}>
            <Text style={newStyles.label}>Channel</Text>
            <View style={newStyles.channelRow}>
              {channels.map(ch => {
                const cfg = CHANNEL_CONFIG[ch];
                const active = channel === ch;
                return (
                  <TouchableOpacity
                    key={ch}
                    style={[newStyles.channelChip, active && { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}
                    onPress={() => setChannel(ch)}
                  >
                    <Ionicons name={cfg.icon as any} size={16} color={active ? cfg.color : colors.textMuted} />
                    <Text style={[newStyles.channelLabel, active && { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={newStyles.field}>
            <Text style={newStyles.label}>Contact Name *</Text>
            <TextInput
              style={newStyles.input}
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={newStyles.field}>
            <Text style={newStyles.label}>Phone Number *</Text>
            <TextInput
              style={newStyles.input}
              placeholder="+254700000000"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={newStyles.field}>
            <Text style={newStyles.label}>Message *</Text>
            <TextInput
              style={[newStyles.input, newStyles.textarea]}
              placeholder="Type your opening message..."
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[newStyles.sendBtn, (!name.trim() || !phone.trim() || !message.trim() || saving) && newStyles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!name.trim() || !phone.trim() || !message.trim() || saving}
          >
            {saving
              ? <ActivityIndicator color="#000" size="small" />
              : <>
                  <Ionicons name="send-outline" size={16} color="#000" />
                  <Text style={newStyles.sendBtnText}>Send Message</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </RNAnimated.View>
    </Modal>
  );
}

const newStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%',
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
  content: { padding: spacing.md, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text,
  },
  textarea: { minHeight: 80, paddingTop: 12 },
  channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  channelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: colors.surfaceElevated,
  },
  channelLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 15, marginTop: 4,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});

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

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },

  statusTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md, marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 3,
  },
  statusTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  statusTabActive: { backgroundColor: colors.surfaceElevated },
  statusTabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  statusTabTextActive: { color: colors.text },
  tabBadge: {
    backgroundColor: colors.danger, borderRadius: 99,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  pillRow: { paddingHorizontal: spacing.md, paddingBottom: 10, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 99, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#fff', fontWeight: '700' },

  countLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500', paddingHorizontal: spacing.md, paddingBottom: 8 },

  list: { paddingHorizontal: spacing.md, paddingBottom: 32 },
  separator: { height: 1, backgroundColor: colors.border },

  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.surface,
    paddingVertical: 14, paddingRight: 14, paddingLeft: 12,
    gap: 12,
    borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardUnread: { borderColor: colors.primary + '55' },
  unreadBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: colors.primary,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  channelBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.surface,
  },
  cardContent: { flex: 1, gap: 3 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  contactName: { fontSize: 15, fontWeight: '500', color: colors.text, flex: 1 },
  contactNameBold: { fontWeight: '700' },
  timeLabel: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastMessage: { fontSize: 13, color: colors.textMuted, flex: 1 },
  lastMessageBold: { color: colors.textSecondary, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.primary, borderRadius: 99,
    minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  unreadCount: { fontSize: 11, fontWeight: '700', color: '#000' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  tag: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.border,
  },
  tagText: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },
  assigneeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primary + '18',
    borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2,
  },
  assigneeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
