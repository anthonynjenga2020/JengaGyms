import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  Modal, Animated, Pressable, ScrollView, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useMessagesContext, CHANNEL_CONFIG } from '@/context/MessagesContext';
import { colors, spacing } from '@/lib/theme';
import type { Message, QuickReplyTemplate, TeamMember } from '@/context/MessagesContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(isoStr: string) {
  const date = new Date(isoStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function needsDateSeparator(msgs: Message[], index: number): boolean {
  if (index === 0) return true;
  const curr = new Date(msgs[index].sent_at).toDateString();
  const prev = new Date(msgs[index - 1].sent_at).toDateString();
  return curr !== prev;
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isOutbound = msg.direction === 'outbound';
  return (
    <View style={[bubbleStyles.row, isOutbound && bubbleStyles.rowOut]}>
      <View style={[bubbleStyles.bubble, isOutbound ? bubbleStyles.bubbleOut : bubbleStyles.bubbleIn]}>
        {!isOutbound && (
          <Text style={bubbleStyles.senderName}>{msg.sender_name}</Text>
        )}
        <Text style={[bubbleStyles.body, isOutbound && bubbleStyles.bodyOut]}>{msg.body}</Text>
        <Text style={[bubbleStyles.time, isOutbound && bubbleStyles.timeOut]}>
          {formatTime(msg.sent_at)}
          {isOutbound && <Text> · {msg.sender_name}</Text>}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: { marginBottom: 6, paddingHorizontal: spacing.md, alignItems: 'flex-start' },
  rowOut: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
    gap: 4,
  },
  bubbleIn: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleOut: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  senderName: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  bodyOut: { color: '#000' },
  time: { fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end' },
  timeOut: { color: '#00000066' },
});

// ── Quick Reply Sheet ─────────────────────────────────────────────────────────

const REPLY_CATEGORIES = ['greeting', 'pricing', 'booking', 'follow_up', 'payment'] as const;
type ReplyCategory = typeof REPLY_CATEGORIES[number];
const CATEGORY_LABELS: Record<ReplyCategory, string> = {
  greeting: 'Greeting',
  pricing: 'Pricing',
  booking: 'Booking',
  follow_up: 'Follow-up',
  payment: 'Payment',
};

function QuickReplySheet({
  visible, onClose, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (body: string) => void;
}) {
  const { quickReplies } = useMessagesContext();
  const translateY = useRef(new Animated.Value(700)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState<ReplyCategory>('greeting');

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdrop, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 700, duration: 250, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  const filtered = quickReplies.filter(r => r.category === category);

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[qrStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={qrStyles.handle} />
        <View style={qrStyles.header}>
          <Text style={qrStyles.title}>Quick Replies</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Category pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={qrStyles.pillRow}>
          {REPLY_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[qrStyles.pill, category === cat && qrStyles.pillActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[qrStyles.pillText, category === cat && qrStyles.pillTextActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Templates */}
        <ScrollView contentContainerStyle={qrStyles.templateList}>
          {filtered.map(tmpl => (
            <TouchableOpacity
              key={tmpl.id}
              style={qrStyles.template}
              onPress={() => { onSelect(tmpl.body); onClose(); }}
            >
              <Text style={qrStyles.templateTitle}>{tmpl.title}</Text>
              <Text style={qrStyles.templateBody} numberOfLines={2}>{tmpl.body}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const qrStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%',
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
  pillRow: { paddingHorizontal: spacing.md, paddingVertical: 12, gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 99, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  pillTextActive: { color: '#000', fontWeight: '700' },
  templateList: { padding: spacing.md, gap: 10 },
  template: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, gap: 6,
  },
  templateTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  templateBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
});

// ── Assign Sheet ──────────────────────────────────────────────────────────────

function AssignSheet({
  visible, onClose, currentAssignee, conversationId,
}: {
  visible: boolean;
  onClose: () => void;
  currentAssignee: string | null;
  conversationId: string;
}) {
  const { teamMembers, assignConversation } = useMessagesContext();
  const translateY = useRef(new Animated.Value(500)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdrop, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 500, duration: 250, useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  function select(id: string | null) {
    assignConversation(conversationId, id);
    onClose();
  }

  const AVATAR_COLORS = ['#4C9FFF', '#33D169', '#F97316'];

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[assignStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={assignStyles.handle} />
        <View style={assignStyles.header}>
          <Text style={assignStyles.title}>Assign Conversation</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={assignStyles.list}>
          {/* Unassign option */}
          <TouchableOpacity
            style={[assignStyles.row, !currentAssignee && assignStyles.rowActive]}
            onPress={() => select(null)}
          >
            <View style={[assignStyles.avatar, { backgroundColor: colors.border }]}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} />
            </View>
            <View style={assignStyles.info}>
              <Text style={assignStyles.memberName}>Unassigned</Text>
              <Text style={assignStyles.memberRole}>No one assigned</Text>
            </View>
            {!currentAssignee && <Ionicons name="checkmark" size={18} color={colors.primary} />}
          </TouchableOpacity>

          {teamMembers.map((m, i) => (
            <TouchableOpacity
              key={m.id}
              style={[assignStyles.row, currentAssignee === m.id && assignStyles.rowActive]}
              onPress={() => select(m.id)}
            >
              <View style={[assignStyles.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] + '22' }]}>
                <Text style={[assignStyles.avatarText, { color: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                  {m.avatar_initials}
                </Text>
              </View>
              <View style={assignStyles.info}>
                <Text style={assignStyles.memberName}>{m.name}</Text>
                <Text style={assignStyles.memberRole}>{m.role}</Text>
              </View>
              {currentAssignee === m.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

const assignStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
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
  list: { padding: spacing.md, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  rowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  info: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.text },
  memberRole: { fontSize: 12, color: colors.textMuted },
});

// ── Main Conversation Screen ───────────────────────────────────────────────────

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getConversation, getMessages, sendMessage, markRead, resolveConversation, reopenConversation, getTeamMember } = useMessagesContext();

  const conv = getConversation(id);
  const messages = getMessages(id);

  const [text, setText] = useState('');
  const [quickReplyVisible, setQuickReplyVisible] = useState(false);
  const [assignVisible, setAssignVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Mark as read on open
  useEffect(() => {
    if (id) markRead(id);
  }, [id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !conv) return;
    sendMessage(id, trimmed);
    setText('');
  }

  function handleQuickReplySelect(body: string) {
    setText(body);
  }

  function handleResolve() {
    if (!conv) return;
    if (conv.status === 'resolved') {
      reopenConversation(id);
    } else {
      Alert.alert('Resolve Conversation', 'Mark this conversation as resolved?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resolve', onPress: () => { resolveConversation(id); router.back(); } },
      ]);
    }
  }

  function handleMenu() {
    if (!conv) return;
    Alert.alert(conv.contact_name, 'Conversation options', [
      { text: 'Assign to team member', onPress: () => setAssignVisible(true) },
      { text: `Call ${conv.contact_phone}`, onPress: () => Linking.openURL(`tel:${conv.contact_phone}`) },
      { text: conv.status === 'resolved' ? 'Reopen' : 'Resolve', onPress: handleResolve },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (!conv) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textMuted }}>Conversation not found</Text>
      </View>
    );
  }

  const cfg = CHANNEL_CONFIG[conv.channel];
  const assignee = conv.assigned_to ? getTeamMember(conv.assigned_to) : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerNameRow}>
            <Text style={styles.headerName} numberOfLines={1}>{conv.contact_name}</Text>
            <View style={[styles.channelBadge, { backgroundColor: cfg.color + '22' }]}>
              <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
              <Text style={[styles.channelLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          {assignee ? (
            <Text style={styles.assigneeLabel}>Assigned to {assignee.name.split(' ')[0]}</Text>
          ) : (
            <Text style={styles.assigneeLabel}>{conv.contact_phone}</Text>
          )}
        </View>

        <TouchableOpacity onPress={handleMenu} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Status bar for resolved */}
      {conv.status === 'resolved' && (
        <View style={styles.resolvedBar}>
          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          <Text style={styles.resolvedText}>Conversation resolved</Text>
          <TouchableOpacity onPress={() => reopenConversation(id)}>
            <Text style={styles.reopenLink}>Reopen</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View>
            {needsDateSeparator(messages, index) && (
              <View style={styles.dateSeparator}>
                <View style={styles.dateLine} />
                <Text style={styles.dateSeparatorText}>{formatDateSeparator(item.sent_at)}</Text>
                <View style={styles.dateLine} />
              </View>
            )}
            <MessageBubble msg={item} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="chatbubble-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyChatText}>No messages yet. Send the first one!</Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input area */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputArea}>
          <TouchableOpacity
            style={styles.inputAction}
            onPress={() => setQuickReplyVisible(true)}
          >
            <Ionicons name="flash-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={conv.status === 'resolved' ? 'Conversation resolved' : 'Type a message...'}
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            editable={conv.status !== 'resolved'}
          />

          {conv.status !== 'resolved' ? (
            <TouchableOpacity
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim()}
            >
              <Ionicons name="send" size={18} color={text.trim() ? '#000' : colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.resolveBtn} onPress={() => reopenConversation(id)}>
              <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Resolve button row */}
        {conv.status !== 'resolved' && (
          <TouchableOpacity style={styles.resolveRow} onPress={handleResolve}>
            <Ionicons name="checkmark-circle-outline" size={15} color={colors.textMuted} />
            <Text style={styles.resolveRowText}>Mark as resolved</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>

      <QuickReplySheet
        visible={quickReplyVisible}
        onClose={() => setQuickReplyVisible(false)}
        onSelect={handleQuickReplySelect}
      />

      <AssignSheet
        visible={assignVisible}
        onClose={() => setAssignVisible(false)}
        currentAssignee={conv.assigned_to}
        conversationId={id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 4,
  },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, gap: 2 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  channelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
  },
  channelLabel: { fontSize: 10, fontWeight: '700' },
  assigneeLabel: { fontSize: 12, color: colors.textMuted },

  resolvedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.primary + '30',
  },
  resolvedText: { flex: 1, fontSize: 13, color: colors.primary, fontWeight: '600' },
  reopenLink: { fontSize: 13, color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },

  messageList: { paddingTop: 16, paddingBottom: 8 },

  dateSeparator: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginVertical: 12, paddingHorizontal: spacing.md,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dateSeparatorText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyChatText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  inputAction: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 2,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceElevated },
  resolveBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  resolveRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  resolveRowText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
});
