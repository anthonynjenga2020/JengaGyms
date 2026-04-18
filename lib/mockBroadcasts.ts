import { MOCK_MEMBERS } from './mockMembers';
import { MOCK_LEADS } from './mockData';

export type BroadcastStatus = 'sent' | 'scheduled' | 'failed';

export interface BroadcastRecipient {
  id: string;
  name: string;
  type: 'member' | 'lead';
  deliveryStatus: 'delivered' | 'failed' | 'pending';
}

export interface MockBroadcast {
  id: string;
  recipientLabel: string;
  message: string;
  status: BroadcastStatus;
  sentAt?: string;
  scheduledAt?: string;
  recipientCount: number;
  recipients: BroadcastRecipient[];
}

const now = Date.now();
const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600000).toISOString();
const d = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString();
const ahead = (daysAhead: number, hour = 8) => {
  const dt = new Date(now + daysAhead * 86400000);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
};

export const MOCK_BROADCASTS: MockBroadcast[] = [
  // ── SENT ────────────────────────────────────────────────────────────────────
  {
    id: 'b1',
    recipientLabel: 'John Mutua',
    message: 'Hi John! Quick reminder — your membership expires in 5 days. Renew now and get 10% off next month! Reply RENEW to lock in the deal. 💪',
    status: 'sent',
    sentAt: h(2),
    recipientCount: 1,
    recipients: [
      { id: 'm3', name: 'John Mutua', type: 'member', deliveryStatus: 'delivered' },
    ],
  },
  {
    id: 'b2',
    recipientLabel: 'All Active Members (7)',
    message: 'Hey JengaGym family! 🎉 We\'re extending Saturday hours to 8pm this week only. Come get your weekend workout in! See you there.',
    status: 'sent',
    sentAt: d(3),
    recipientCount: 7,
    recipients: [
      { id: 'm1', name: 'Peter Njoroge',  type: 'member', deliveryStatus: 'delivered' },
      { id: 'm2', name: 'Grace Wanjiru',  type: 'member', deliveryStatus: 'delivered' },
      { id: 'm3', name: 'John Mutua',     type: 'member', deliveryStatus: 'delivered' },
      { id: 'm5', name: 'Mike Ochieng',   type: 'member', deliveryStatus: 'delivered' },
      { id: 'm6', name: 'Nadia Hassan',   type: 'member', deliveryStatus: 'delivered' },
      { id: 'm7', name: 'Tom Otieno',     type: 'member', deliveryStatus: 'delivered' },
      { id: 'm8', name: 'Cynthia Auma',   type: 'member', deliveryStatus: 'failed' },
    ],
  },
  {
    id: 'b3',
    recipientLabel: 'Grace Wanjiru, John Mutua (+1)',
    message: 'Hi {name}! Your payment of KSh 4,500 is due in 3 days. You can pay via M-Pesa Paybill 123456, Account: {gym_name}. Thanks! 🙏',
    status: 'sent',
    sentAt: d(5),
    recipientCount: 3,
    recipients: [
      { id: 'm2', name: 'Grace Wanjiru', type: 'member', deliveryStatus: 'delivered' },
      { id: 'm3', name: 'John Mutua',    type: 'member', deliveryStatus: 'delivered' },
      { id: 'm4', name: 'Sarah Kimani',  type: 'member', deliveryStatus: 'delivered' },
    ],
  },
  {
    id: 'b4',
    recipientLabel: 'All Leads (8)',
    message: 'Hey there! 👋 Have you had a chance to think about joining JengaGym? We\'d love to have you! Book a FREE trial this week — just reply TRIAL.',
    status: 'sent',
    sentAt: d(7),
    recipientCount: 8,
    recipients: [
      { id: 'l1', name: 'Brian Kamau',    type: 'lead', deliveryStatus: 'delivered' },
      { id: 'l2', name: 'Amina Odhiambo', type: 'lead', deliveryStatus: 'delivered' },
      { id: 'l3', name: 'Kevin Mwangi',   type: 'lead', deliveryStatus: 'delivered' },
      { id: 'l4', name: 'Fatuma Hassan',  type: 'lead', deliveryStatus: 'delivered' },
      { id: 'l5', name: 'James Otieno',   type: 'lead', deliveryStatus: 'delivered' },
      { id: 'l6', name: 'Lydia Wanjiku',  type: 'lead', deliveryStatus: 'failed' },
      { id: 'l7', name: 'David Njoroge',  type: 'lead', deliveryStatus: 'delivered' },
      { id: 'l8', name: 'Priya Sharma',   type: 'lead', deliveryStatus: 'delivered' },
    ],
  },
  {
    id: 'b5',
    recipientLabel: 'Expiring This Week (2)',
    message: 'Hi {name}! ⏳ Your JengaGym membership expires soon. Don\'t let your streak end! Renew today and keep your momentum going. 💪',
    status: 'sent',
    sentAt: h(4),
    recipientCount: 2,
    recipients: [
      { id: 'm3', name: 'John Mutua',  type: 'member', deliveryStatus: 'delivered' },
      { id: 'm9', name: 'Zara Kamau', type: 'member', deliveryStatus: 'pending' },
    ],
  },
  // ── SCHEDULED ───────────────────────────────────────────────────────────────
  {
    id: 'b6',
    recipientLabel: 'All Active Members (7)',
    message: 'TGIF! 🏋️ Come work off the week at JengaGym this Saturday. Morning sessions from 7am. Bring a friend — they get to try for FREE! 🎉',
    status: 'scheduled',
    scheduledAt: ahead(1, 8),
    recipientCount: 7,
    recipients: [
      { id: 'm1', name: 'Peter Njoroge', type: 'member', deliveryStatus: 'pending' },
      { id: 'm2', name: 'Grace Wanjiru', type: 'member', deliveryStatus: 'pending' },
      { id: 'm3', name: 'John Mutua',    type: 'member', deliveryStatus: 'pending' },
      { id: 'm5', name: 'Mike Ochieng',  type: 'member', deliveryStatus: 'pending' },
      { id: 'm6', name: 'Nadia Hassan',  type: 'member', deliveryStatus: 'pending' },
      { id: 'm7', name: 'Tom Otieno',    type: 'member', deliveryStatus: 'pending' },
      { id: 'm8', name: 'Cynthia Auma',  type: 'member', deliveryStatus: 'pending' },
    ],
  },
  {
    id: 'b7',
    recipientLabel: 'Inactive 30+ Days (3)',
    message: 'We miss you at JengaGym! 😢 Life gets busy, we get it. But your body misses the grind. Come back this week — first session is on us! Reply YES.',
    status: 'scheduled',
    scheduledAt: ahead(2, 9),
    recipientCount: 3,
    recipients: [
      { id: 'm4', name: 'Sarah Kimani',  type: 'member', deliveryStatus: 'pending' },
      { id: 'm10', name: 'Paul Odhiambo',type: 'member', deliveryStatus: 'pending' },
      { id: 'm11', name: 'Rita Mwangi',  type: 'member', deliveryStatus: 'pending' },
    ],
  },
  {
    id: 'b8',
    recipientLabel: 'Brian Kamau',
    message: 'Hi Brian! Just checking in — have you thought about our membership offer? We\'d love to see you in the gym regularly. Any questions? Reply here! 💪',
    status: 'scheduled',
    scheduledAt: ahead(5, 10),
    recipientCount: 1,
    recipients: [
      { id: 'l1', name: 'Brian Kamau', type: 'lead', deliveryStatus: 'pending' },
    ],
  },
];

// ── Contact model for recipient picker ────────────────────────────────────────

export interface ContactItem {
  id: string;
  name: string;
  type: 'member' | 'lead';
  subtitle: string;
  phone: string;
}

export function getAllContacts(): ContactItem[] {
  return [
    ...MOCK_MEMBERS.map(m => ({
      id: `m_${m.id}`,
      name: m.name,
      type: 'member' as const,
      subtitle: `${m.plan_label} · ${m.status}`,
      phone: m.phone,
    })),
    ...MOCK_LEADS.map(l => ({
      id: `l_${l.id}`,
      name: l.name,
      type: 'lead' as const,
      subtitle: l.status.replace(/_/g, ' '),
      phone: l.phone,
    })),
  ];
}

export function getQuickGroup(group: 'active_members' | 'all_leads' | 'expiring_week' | 'inactive_30'): ContactItem[] {
  const in7 = Date.now() + 7 * 86400000;
  const ago30 = Date.now() - 30 * 86400000;
  switch (group) {
    case 'active_members':
      return MOCK_MEMBERS.filter(m => m.status === 'active').map(m => ({
        id: `m_${m.id}`, name: m.name, type: 'member' as const, subtitle: m.plan_label, phone: m.phone,
      }));
    case 'all_leads':
      return MOCK_LEADS.map(l => ({
        id: `l_${l.id}`, name: l.name, type: 'lead' as const, subtitle: l.status.replace(/_/g, ' '), phone: l.phone,
      }));
    case 'expiring_week':
      return MOCK_MEMBERS.filter(m => {
        if (!m.expiry_date) return false;
        const t = new Date(m.expiry_date).getTime();
        return t >= Date.now() && t <= in7;
      }).map(m => ({
        id: `m_${m.id}`, name: m.name, type: 'member' as const, subtitle: m.plan_label, phone: m.phone,
      }));
    case 'inactive_30':
      return MOCK_MEMBERS.filter(m =>
        !m.last_visit_at || new Date(m.last_visit_at).getTime() < ago30,
      ).map(m => ({
        id: `m_${m.id}`, name: m.name, type: 'member' as const, subtitle: m.plan_label, phone: m.phone,
      }));
  }
}

// ── SMS templates (subset for quick insert) ───────────────────────────────────

export interface SmsTemplate {
  id: string;
  title: string;
  body: string;
}

export const SMS_TEMPLATES: SmsTemplate[] = [
  { id: 't1', title: 'Membership renewal',    body: 'Hi {name}! Your membership expires soon. Renew today and keep your streak going 💪 Reply RENEW to lock in your rate.' },
  { id: 't2', title: 'Payment reminder',      body: 'Hi {name}! A reminder that your payment of KSh {amount} is due. Pay via M-Pesa Paybill 123456, Account: JengaGym. Thanks!' },
  { id: 't3', title: 'Free trial offer',      body: 'Hey {name}! 👋 We\'d love to have you try JengaGym for FREE. Book a 1-day trial this week — just reply YES and we\'ll sort you out.' },
  { id: 't4', title: 'Promo announcement',    body: 'Hi {name}! 🎉 Special offer this month — get 20% off any membership plan. Offer valid until end of month. Reply PROMO to claim.' },
  { id: 't5', title: 'Win-back message',      body: 'We miss you at JengaGym, {name}! 😢 Come back this week and get your first session free. Your fitness journey is waiting. 💪' },
  { id: 't6', title: 'Class reminder',        body: 'Reminder: your {class_name} class is tomorrow at {time}. See you there! 🏋️ Reply CANCEL if you can\'t make it.' },
  { id: 't7', title: 'Birthday message',      body: 'Happy Birthday {name}! 🎂🎉 Wishing you a wonderful day. As a special gift, enjoy a free month upgrade on us. Reply GIFT to claim.' },
  { id: 't8', title: 'General check-in',      body: 'Hey {name}! Just checking in — how are you getting on with your fitness goals? Let us know if you need any support from the JengaGym team. 💪' },
];

// ── Schedule options ───────────────────────────────────────────────────────────

export const SCHEDULE_DAYS = [
  { id: 'today',    label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'in2',      label: 'In 2 days' },
  { id: 'in3',      label: 'In 3 days' },
];

export const SCHEDULE_TIMES = [
  { id: '8am',  label: '8:00 am',  hour: 8 },
  { id: '12pm', label: '12:00 pm', hour: 12 },
  { id: '5pm',  label: '5:00 pm',  hour: 17 },
  { id: '8pm',  label: '8:00 pm',  hour: 20 },
];

export function buildScheduledAt(dayId: string, timeId: string): string {
  const timeOpt = SCHEDULE_TIMES.find(t => t.id === timeId);
  const hour = timeOpt?.hour ?? 8;
  const daysAhead = dayId === 'today' ? 0 : dayId === 'tomorrow' ? 1 : dayId === 'in2' ? 2 : 3;
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
}

export function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  const timeStr = d.toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Tomorrow at ${timeStr}`;
  return `${dateStr} at ${timeStr}`;
}
