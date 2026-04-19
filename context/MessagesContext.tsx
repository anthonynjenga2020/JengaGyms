import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useClientContext } from '@/context/ClientContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Channel = 'whatsapp' | 'sms' | 'instagram' | 'website_chat';
export type ConversationStatus = 'open' | 'resolved';

export type Conversation = {
  id: string;
  client_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  channel: Channel;
  status: ConversationStatus;
  assigned_to: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  tags: string[];
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  client_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sender_name: string;
  sent_at: string;
  read: boolean;
};

export type QuickReplyTemplate = {
  id: string;
  client_id: string;
  category: 'greeting' | 'pricing' | 'booking' | 'follow_up' | 'payment';
  title: string;
  body: string;
};

export type TeamMember = {
  id: string;
  client_id: string;
  name: string;
  role: string;
  avatar_initials: string;
};

// ── State & Actions ───────────────────────────────────────────────────────────

type State = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  quickReplies: QuickReplyTemplate[];
  teamMembers: TeamMember[];
  loading: boolean;
};

type Action =
  | { type: 'SET_ALL'; conversations: Conversation[]; quickReplies: QuickReplyTemplate[]; teamMembers: TeamMember[] }
  | { type: 'SET_MESSAGES'; conversationId: string; messages: Message[] }
  | { type: 'INCOMING_MESSAGE'; message: Message }
  | { type: 'SEND_MESSAGE'; msg: Message }
  | { type: 'MARK_READ'; conversationId: string }
  | { type: 'MARK_UNREAD'; conversationId: string }
  | { type: 'RESOLVE'; conversationId: string }
  | { type: 'REOPEN'; conversationId: string }
  | { type: 'ASSIGN'; conversationId: string; assignedTo: string | null }
  | { type: 'ADD_CONVERSATION'; conversation: Conversation; firstMessage?: Message }
  | { type: 'DELETE_CONVERSATION'; conversationId: string }
  | { type: 'ADD_TAG'; conversationId: string; tag: string }
  | { type: 'REMOVE_TAG'; conversationId: string; tag: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {

    case 'SET_ALL':
      return {
        ...state,
        conversations: action.conversations,
        quickReplies: action.quickReplies,
        teamMembers: action.teamMembers,
        loading: false,
      };

    case 'SET_MESSAGES':
      return { ...state, messages: { ...state.messages, [action.conversationId]: action.messages } };

    case 'SEND_MESSAGE': {
      const { msg } = action;
      const existing = state.messages[msg.conversation_id] ?? [];
      const updatedConvos = state.conversations.map(c =>
        c.id === msg.conversation_id
          ? { ...c, last_message: msg.body, last_message_at: msg.sent_at }
          : c
      );
      return {
        ...state,
        messages: { ...state.messages, [msg.conversation_id]: [...existing, msg] },
        conversations: updatedConvos,
      };
    }

    case 'INCOMING_MESSAGE': {
      const { message } = action;
      const existing = state.messages[message.conversation_id] ?? [];
      if (existing.some(m => m.id === message.id)) return state;
      const updatedConvos = state.conversations.map(c =>
        c.id === message.conversation_id
          ? {
              ...c,
              last_message: message.body,
              last_message_at: message.sent_at,
              unread_count: message.direction === 'inbound' ? c.unread_count + 1 : c.unread_count,
            }
          : c
      );
      return {
        ...state,
        messages: { ...state.messages, [message.conversation_id]: [...existing, message] },
        conversations: updatedConvos,
      };
    }

    case 'MARK_UNREAD':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId ? { ...c, unread_count: 1 } : c
        ),
      };

    case 'DELETE_CONVERSATION': {
      const { [action.conversationId]: _removed, ...restMsgs } = state.messages;
      return {
        ...state,
        conversations: state.conversations.filter(c => c.id !== action.conversationId),
        messages: restMsgs,
      };
    }

    case 'MARK_READ': {
      const msgs = (state.messages[action.conversationId] ?? []).map(m => ({ ...m, read: true }));
      const convos = state.conversations.map(c =>
        c.id === action.conversationId ? { ...c, unread_count: 0 } : c
      );
      return { ...state, messages: { ...state.messages, [action.conversationId]: msgs }, conversations: convos };
    }

    case 'RESOLVE':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId ? { ...c, status: 'resolved', unread_count: 0 } : c
        ),
      };

    case 'REOPEN':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId ? { ...c, status: 'open' } : c
        ),
      };

    case 'ASSIGN':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId ? { ...c, assigned_to: action.assignedTo } : c
        ),
      };

    case 'ADD_CONVERSATION': {
      const msgs = action.firstMessage
        ? { ...state.messages, [action.conversation.id]: [action.firstMessage] }
        : state.messages;
      return { ...state, conversations: [action.conversation, ...state.conversations], messages: msgs };
    }

    case 'ADD_TAG':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId && !c.tags.includes(action.tag)
            ? { ...c, tags: [...c.tags, action.tag] }
            : c
        ),
      };

    case 'REMOVE_TAG':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.conversationId
            ? { ...c, tags: c.tags.filter(t => t !== action.tag) }
            : c
        ),
      };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

type MessagesContextType = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  quickReplies: QuickReplyTemplate[];
  teamMembers: TeamMember[];
  unreadCount: number;
  loading: boolean;
  loadConversationMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, body: string, senderName?: string) => Promise<string>;
  markRead: (conversationId: string) => Promise<void>;
  markUnread: (conversationId: string) => void;
  resolveConversation: (conversationId: string) => Promise<void>;
  reopenConversation: (conversationId: string) => Promise<void>;
  assignConversation: (conversationId: string, assignedTo: string | null) => Promise<void>;
  addConversation: (c: Omit<Conversation, 'id' | 'client_id' | 'created_at'>, firstMessageBody?: string) => Promise<string>;
  deleteConversation: (conversationId: string) => Promise<void>;
  addTag: (conversationId: string, tag: string) => void;
  removeTag: (conversationId: string, tag: string) => void;
  getConversation: (id: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  getTeamMember: (id: string) => TeamMember | undefined;
};

const defaultContext: MessagesContextType = {
  conversations: [], messages: {}, quickReplies: [], teamMembers: [],
  unreadCount: 0, loading: true,
  loadConversationMessages: async () => {},
  sendMessage: async () => '',
  markRead: async () => {},
  markUnread: () => {},
  resolveConversation: async () => {},
  reopenConversation: async () => {},
  assignConversation: async () => {},
  addConversation: async () => '',
  deleteConversation: async () => {},
  addTag: () => {},
  removeTag: () => {},
  getConversation: () => undefined,
  getMessages: () => [],
  getTeamMember: () => undefined,
};

const MessagesContext = createContext<MessagesContextType>(defaultContext);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { clientId } = useClientContext();
  const [state, dispatch] = useReducer(reducer, {
    conversations: [], messages: {}, quickReplies: [], teamMembers: [], loading: true,
  });

  const fetchAll = useCallback(async () => {
    if (!clientId) return;
    const [
      { data: convData },
      { data: qrData },
      { data: tmData },
    ] = await Promise.all([
      supabase.from('conversations').select('*').eq('client_id', clientId).order('last_message_at', { ascending: false }),
      supabase.from('quick_reply_templates').select('*').eq('client_id', clientId),
      supabase.from('team_members').select('*').eq('client_id', clientId),
    ]);
    dispatch({
      type: 'SET_ALL',
      conversations: (convData ?? []) as Conversation[],
      quickReplies: (qrData ?? []) as QuickReplyTemplate[],
      teamMembers: (tmData ?? []) as TeamMember[],
    });
  }, [clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime: subscribe to new inbound messages
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`messages-${clientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          dispatch({ type: 'INCOMING_MESSAGE', message: payload.new as Message });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId]);

  async function loadConversationMessages(conversationId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true });
    dispatch({ type: 'SET_MESSAGES', conversationId, messages: (data ?? []) as Message[] });
  }

  async function sendMessage(conversationId: string, body: string, senderName = 'You'): Promise<string> {
    const sentAt = new Date().toISOString();
    const tempId = `msg${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      conversation_id: conversationId,
      client_id: clientId ?? '',
      direction: 'outbound',
      body,
      sender_name: senderName,
      sent_at: sentAt,
      read: true,
    };
    dispatch({ type: 'SEND_MESSAGE', msg: tempMsg });

    const { data: msgRow } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        client_id: clientId,
        direction: 'outbound',
        body,
        sender_name: senderName,
        sent_at: sentAt,
        read: true,
      })
      .select()
      .single();

    await supabase
      .from('conversations')
      .update({ last_message: body, last_message_at: sentAt })
      .eq('id', conversationId);

    return msgRow?.id ?? tempId;
  }

  async function markRead(conversationId: string) {
    dispatch({ type: 'MARK_READ', conversationId });
    await Promise.all([
      supabase.from('messages').update({ read: true }).eq('conversation_id', conversationId).eq('read', false),
      supabase.from('conversations').update({ unread_count: 0 }).eq('id', conversationId),
    ]);
  }

  function markUnread(conversationId: string) {
    dispatch({ type: 'MARK_UNREAD', conversationId });
    supabase.from('conversations').update({ unread_count: 1 }).eq('id', conversationId);
  }

  async function resolveConversation(conversationId: string) {
    dispatch({ type: 'RESOLVE', conversationId });
    await supabase.from('conversations').update({ status: 'resolved', unread_count: 0 }).eq('id', conversationId);
  }

  async function reopenConversation(conversationId: string) {
    dispatch({ type: 'REOPEN', conversationId });
    await supabase.from('conversations').update({ status: 'open' }).eq('id', conversationId);
  }

  async function assignConversation(conversationId: string, assignedTo: string | null) {
    dispatch({ type: 'ASSIGN', conversationId, assignedTo });
    await supabase.from('conversations').update({ assigned_to: assignedTo }).eq('id', conversationId);
  }

  async function addConversation(
    data: Omit<Conversation, 'id' | 'client_id' | 'created_at'>,
    firstMessageBody?: string,
  ): Promise<string> {
    const { data: convRow, error } = await supabase
      .from('conversations')
      .insert({ ...data, client_id: clientId })
      .select()
      .single();

    if (error || !convRow) {
      const fallbackId = `c${Date.now()}`;
      const now = new Date().toISOString();
      dispatch({ type: 'ADD_CONVERSATION', conversation: { ...data, id: fallbackId, client_id: clientId ?? '', created_at: now } });
      return fallbackId;
    }

    const conversation = convRow as Conversation;
    let firstMessage: Message | undefined;
    if (firstMessageBody) {
      const { data: msgRow } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          client_id: clientId,
          direction: 'outbound',
          body: firstMessageBody,
          sender_name: 'You',
          sent_at: new Date().toISOString(),
          read: true,
        })
        .select()
        .single();
      firstMessage = msgRow as Message | undefined;
    }

    dispatch({ type: 'ADD_CONVERSATION', conversation, firstMessage });
    return conversation.id;
  }

  async function deleteConversation(conversationId: string) {
    dispatch({ type: 'DELETE_CONVERSATION', conversationId });
    await supabase.from('conversations').delete().eq('id', conversationId);
  }

  function addTag(conversationId: string, tag: string) {
    dispatch({ type: 'ADD_TAG', conversationId, tag });
    const convo = state.conversations.find(c => c.id === conversationId);
    if (convo && !convo.tags.includes(tag)) {
      supabase.from('conversations').update({ tags: [...convo.tags, tag] }).eq('id', conversationId);
    }
  }

  function removeTag(conversationId: string, tag: string) {
    dispatch({ type: 'REMOVE_TAG', conversationId, tag });
    const convo = state.conversations.find(c => c.id === conversationId);
    if (convo) {
      supabase.from('conversations').update({ tags: convo.tags.filter(t => t !== tag) }).eq('id', conversationId);
    }
  }

  const unreadCount = useMemo(
    () => state.conversations.filter(c => c.status === 'open').reduce((s, c) => s + c.unread_count, 0),
    [state.conversations]
  );

  const getConversation = (id: string) => state.conversations.find(c => c.id === id);
  const getMessages = (conversationId: string) => state.messages[conversationId] ?? [];
  const getTeamMember = (id: string) => state.teamMembers.find(m => m.id === id);

  return (
    <MessagesContext.Provider value={{
      conversations: state.conversations,
      messages: state.messages,
      quickReplies: state.quickReplies,
      teamMembers: state.teamMembers,
      unreadCount,
      loading: state.loading,
      loadConversationMessages,
      sendMessage, markRead, markUnread,
      resolveConversation, reopenConversation, assignConversation,
      addConversation, deleteConversation, addTag, removeTag,
      getConversation, getMessages, getTeamMember,
    }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessagesContext() {
  return useContext(MessagesContext);
}

// Channel display config
export const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; icon: string }> = {
  whatsapp:     { label: 'WhatsApp', color: '#25D366', icon: 'logo-whatsapp' },
  sms:          { label: 'SMS',      color: '#4C9FFF', icon: 'chatbubble-outline' },
  instagram:    { label: 'Instagram', color: '#E1306C', icon: 'logo-instagram' },
  website_chat: { label: 'Website',  color: '#A855F7', icon: 'globe-outline' },
};
