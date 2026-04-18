import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, MOCK_QUICK_REPLIES, MOCK_TEAM_MEMBERS } from '@/lib/mockMessages';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Channel = 'whatsapp' | 'sms' | 'instagram' | 'website_chat';
export type ConversationStatus = 'open' | 'resolved';

export type Conversation = {
  id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  channel: Channel;
  status: ConversationStatus;
  assigned_to: string | null;   // TeamMember id
  last_message: string;
  last_message_at: string;
  unread_count: number;
  tags: string[];
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sender_name: string;
  sent_at: string;
  read: boolean;
};

export type QuickReplyTemplate = {
  id: string;
  category: 'greeting' | 'pricing' | 'booking' | 'follow_up' | 'payment';
  title: string;
  body: string;
};

export type TeamMember = {
  id: string;
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
};

type Action =
  | { type: 'SEND_MESSAGE'; conversationId: string; body: string; senderName: string; msgId: string }
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

    case 'SEND_MESSAGE': {
      const msg: Message = {
        id: action.msgId,
        conversation_id: action.conversationId,
        direction: 'outbound',
        body: action.body,
        sender_name: action.senderName,
        sent_at: new Date().toISOString(),
        read: true,
      };
      const existing = state.messages[action.conversationId] ?? [];
      const updatedConvos = state.conversations.map(c =>
        c.id === action.conversationId
          ? { ...c, last_message: action.body, last_message_at: msg.sent_at }
          : c
      );
      return {
        ...state,
        messages: { ...state.messages, [action.conversationId]: [...existing, msg] },
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
  sendMessage: (conversationId: string, body: string, senderName?: string) => string;
  markRead: (conversationId: string) => void;
  markUnread: (conversationId: string) => void;
  resolveConversation: (conversationId: string) => void;
  reopenConversation: (conversationId: string) => void;
  assignConversation: (conversationId: string, assignedTo: string | null) => void;
  addConversation: (c: Omit<Conversation, 'id' | 'created_at'>, firstMessageBody?: string) => string;
  deleteConversation: (conversationId: string) => void;
  getConversation: (id: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  getTeamMember: (id: string) => TeamMember | undefined;
};

const MessagesContext = createContext<MessagesContextType | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    conversations: MOCK_CONVERSATIONS,
    messages: MOCK_MESSAGES,
    quickReplies: MOCK_QUICK_REPLIES,
    teamMembers: MOCK_TEAM_MEMBERS,
  });

  const unreadCount = useMemo(
    () => state.conversations.filter(c => c.status === 'open').reduce((s, c) => s + c.unread_count, 0),
    [state.conversations]
  );

  function sendMessage(conversationId: string, body: string, senderName = 'You'): string {
    const msgId = `msg${Date.now()}`;
    dispatch({ type: 'SEND_MESSAGE', conversationId, body, senderName, msgId });
    return msgId;
  }

  function markUnread(conversationId: string) {
    dispatch({ type: 'MARK_UNREAD', conversationId });
  }

  function deleteConversation(conversationId: string) {
    dispatch({ type: 'DELETE_CONVERSATION', conversationId });
  }

  function markRead(conversationId: string) {
    dispatch({ type: 'MARK_READ', conversationId });
  }

  function resolveConversation(conversationId: string) {
    dispatch({ type: 'RESOLVE', conversationId });
  }

  function reopenConversation(conversationId: string) {
    dispatch({ type: 'REOPEN', conversationId });
  }

  function assignConversation(conversationId: string, assignedTo: string | null) {
    dispatch({ type: 'ASSIGN', conversationId, assignedTo });
  }

  function addConversation(data: Omit<Conversation, 'id' | 'created_at'>, firstMessageBody?: string): string {
    const id = `c${Date.now()}`;
    const now = new Date().toISOString();
    const conversation: Conversation = { ...data, id, created_at: now };
    const firstMessage: Message | undefined = firstMessageBody
      ? { id: `msg${Date.now()}`, conversation_id: id, direction: 'outbound', body: firstMessageBody, sender_name: 'You', sent_at: now, read: true }
      : undefined;
    dispatch({ type: 'ADD_CONVERSATION', conversation, firstMessage });
    return id;
  }

  function getConversation(id: string) {
    return state.conversations.find(c => c.id === id);
  }

  function getMessages(conversationId: string) {
    return state.messages[conversationId] ?? [];
  }

  function getTeamMember(id: string) {
    return state.teamMembers.find(m => m.id === id);
  }

  return (
    <MessagesContext.Provider value={{
      conversations: state.conversations,
      messages: state.messages,
      quickReplies: state.quickReplies,
      teamMembers: state.teamMembers,
      unreadCount,
      sendMessage, markRead, markUnread, resolveConversation, reopenConversation,
      assignConversation, addConversation, deleteConversation,
      getConversation, getMessages, getTeamMember,
    }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessagesContext() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessagesContext must be used inside MessagesProvider');
  return ctx;
}

// Channel display config
export const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; icon: string }> = {
  whatsapp:     { label: 'WhatsApp', color: '#25D366', icon: 'logo-whatsapp' },
  sms:          { label: 'SMS',      color: '#4C9FFF', icon: 'chatbubble-outline' },
  instagram:    { label: 'Instagram', color: '#E1306C', icon: 'logo-instagram' },
  website_chat: { label: 'Website',  color: '#A855F7', icon: 'globe-outline' },
};
