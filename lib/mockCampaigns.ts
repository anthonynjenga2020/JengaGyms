export type CampaignStatus = 'active' | 'scheduled' | 'completed' | 'draft' | 'paused';
export type CampaignType = 'sms_broadcast' | 'follow_up' | 'reactivation' | 'promotion' | 'event' | 'review_request';

export interface MockCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: CampaignType;
  sent: number;
  delivered: number;
  total: number;
  responses: number;
  conversions: number;
  recipients: number;
  created_at: string;
  scheduled_at?: string;
}

export interface CampaignRecipient {
  id: string;
  name: string;
  type: 'member' | 'lead';
  status: 'sent' | 'delivered' | 'responded' | 'converted' | 'failed';
  timestamp: string;
  refId: string;
}

export interface CampaignActivity {
  id: string;
  text: string;
  timestamp: string;
  initials: string;
  color: string;
}

export interface CampaignDetail {
  message: string;
  recipients: CampaignRecipient[];
  activities: CampaignActivity[];
  timeSeries: { label: string; value: number }[];
}

export const CAMPAIGN_TYPE_META: Record<
  CampaignType,
  { label: string; emoji: string; color: string }
> = {
  sms_broadcast: { label: 'SMS Broadcast',      emoji: '💬', color: '#4C9FFF' },
  follow_up:     { label: 'Follow-up Sequence', emoji: '🔁', color: '#A855F7' },
  reactivation:  { label: 'Reactivation',       emoji: '🎯', color: '#FF8C00' },
  promotion:     { label: 'Promotion',           emoji: '🎉', color: '#33D169' },
  event:         { label: 'Event',               emoji: '📅', color: '#EC4899' },
  review_request:{ label: 'Review Request',      emoji: '🌟', color: '#FFD700' },
};

export const CAMPAIGN_STATUS_META: Record<
  CampaignStatus,
  { label: string; color: string; bg: string }
> = {
  active:    { label: 'Active',    color: '#33D169', bg: '#33D16922' },
  scheduled: { label: 'Scheduled', color: '#4C9FFF', bg: '#4C9FFF22' },
  completed: { label: 'Completed', color: '#8FA3B4', bg: '#8FA3B422' },
  draft:     { label: 'Draft',     color: '#FFB347', bg: '#FFB34722' },
  paused:    { label: 'Paused',    color: '#FF8C00', bg: '#FF8C0022' },
};

export const MOCK_CAMPAIGNS: MockCampaign[] = [
  {
    id: 'c1',
    name: 'Win-Back Inactive Members',
    status: 'active',
    type: 'reactivation',
    sent: 248,
    delivered: 241,
    total: 300,
    responses: 43,
    conversions: 12,
    recipients: 300,
    created_at: '2026-04-10T09:00:00Z',
  },
  {
    id: 'c2',
    name: 'April Promo — 20% Off',
    status: 'scheduled',
    type: 'promotion',
    sent: 0,
    delivered: 0,
    total: 500,
    responses: 0,
    conversions: 0,
    recipients: 500,
    created_at: '2026-04-14T14:00:00Z',
    scheduled_at: '2026-04-20T08:00:00Z',
  },
  {
    id: 'c3',
    name: 'New Member Welcome Sequence',
    status: 'active',
    type: 'follow_up',
    sent: 86,
    delivered: 84,
    total: 86,
    responses: 31,
    conversions: 9,
    recipients: 86,
    created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'c4',
    name: 'March Fitness Challenge',
    status: 'completed',
    type: 'event',
    sent: 124,
    delivered: 120,
    total: 124,
    responses: 58,
    conversions: 11,
    recipients: 124,
    created_at: '2026-03-01T08:00:00Z',
  },
  {
    id: 'c5',
    name: 'January Re-Engagement',
    status: 'paused',
    type: 'reactivation',
    sent: 43,
    delivered: 41,
    total: 150,
    responses: 8,
    conversions: 2,
    recipients: 150,
    created_at: '2026-01-15T11:00:00Z',
  },
  {
    id: 'c6',
    name: 'Summer Body Campaign',
    status: 'draft',
    type: 'promotion',
    sent: 0,
    delivered: 0,
    total: 0,
    responses: 0,
    conversions: 0,
    recipients: 0,
    created_at: '2026-04-16T16:00:00Z',
  },
  {
    id: 'c7',
    name: 'Post-Trial Follow-up',
    status: 'completed',
    type: 'follow_up',
    sent: 67,
    delivered: 65,
    total: 67,
    responses: 24,
    conversions: 8,
    recipients: 67,
    created_at: '2026-03-15T09:30:00Z',
  },
];

export const MOCK_CAMPAIGN_DETAILS: Record<string, CampaignDetail> = {
  c1: {
    message: "Hi {name}! 👋 We miss you at JengaGym. It's been a while since your last visit — come back this week and get 30% off your next month!\n\nReply YES to claim your offer. 💪",
    timeSeries: [
      { label: 'Day 1', value: 8 },
      { label: 'Day 2', value: 15 },
      { label: 'Day 3', value: 24 },
      { label: 'Day 4', value: 31 },
      { label: 'Day 5', value: 37 },
      { label: 'Day 6', value: 40 },
      { label: 'Day 7', value: 43 },
    ],
    activities: [
      { id: 'a1', text: "John Kamau replied: \"YES, I'm interested!\"", timestamp: '2026-04-15T14:23:00Z', initials: 'JK', color: '#4C9FFF' },
      { id: 'a2', text: 'Sarah Wanjiku converted — joined as member', timestamp: '2026-04-15T13:10:00Z', initials: 'SW', color: '#33D169' },
      { id: 'a3', text: "Mike Otieno's message was delivered", timestamp: '2026-04-15T12:05:00Z', initials: 'MO', color: '#B3E84C' },
      { id: 'a4', text: 'Grace Muthoni replied: "How much is the offer?"', timestamp: '2026-04-15T11:44:00Z', initials: 'GM', color: '#A855F7' },
      { id: 'a5', text: 'David Kipkoech converted — rejoined gym', timestamp: '2026-04-15T10:30:00Z', initials: 'DK', color: '#33D169' },
    ],
    recipients: [
      { id: 'r1', name: 'John Kamau',    type: 'member', status: 'responded',  timestamp: '2026-04-15T14:23:00Z', refId: 'm1' },
      { id: 'r2', name: 'Sarah Wanjiku', type: 'member', status: 'converted',  timestamp: '2026-04-15T13:10:00Z', refId: 'm2' },
      { id: 'r3', name: 'Mike Otieno',   type: 'lead',   status: 'delivered',  timestamp: '2026-04-15T12:05:00Z', refId: 'l1' },
      { id: 'r4', name: 'Grace Muthoni', type: 'member', status: 'responded',  timestamp: '2026-04-15T11:44:00Z', refId: 'm3' },
      { id: 'r5', name: 'David Kipkoech',type: 'member', status: 'converted',  timestamp: '2026-04-15T10:30:00Z', refId: 'm4' },
      { id: 'r6', name: 'Peter Njoroge', type: 'lead',   status: 'delivered',  timestamp: '2026-04-15T09:15:00Z', refId: 'l2' },
      { id: 'r7', name: 'Lucy Akinyi',   type: 'member', status: 'failed',     timestamp: '2026-04-15T09:00:00Z', refId: 'm5' },
      { id: 'r8', name: 'James Mwangi',  type: 'lead',   status: 'sent',       timestamp: '2026-04-15T08:50:00Z', refId: 'l3' },
    ],
  },
  c2: {
    message: "🎉 April Special for JengaGym members! Get 20% OFF your membership renewal this April.\n\nOffer valid until 30th April 2026. Reply PROMO to activate. T&Cs apply.",
    timeSeries: [],
    activities: [],
    recipients: [],
  },
  c3: {
    message: "Welcome to JengaGym, {name}! 🏋️ We're so excited to have you.\n\nHere's what to expect:\n✅ Day 1: Orientation & fitness assessment\n✅ Day 3: First group class\n✅ Day 7: Check-in with your trainer\n\nAny questions? Just reply to this message!",
    timeSeries: [
      { label: 'Wk 1', value: 10 },
      { label: 'Wk 2', value: 21 },
      { label: 'Wk 3', value: 28 },
      { label: 'Wk 4', value: 31 },
    ],
    activities: [
      { id: 'a1', text: 'Ana Lima replied: "Thank you! So excited 😊"', timestamp: '2026-04-12T09:10:00Z', initials: 'AL', color: '#4C9FFF' },
      { id: 'a2', text: 'Tom Mwangi converted — booked orientation', timestamp: '2026-04-11T15:30:00Z', initials: 'TM', color: '#33D169' },
    ],
    recipients: [
      { id: 'r1', name: 'Ana Lima',   type: 'member', status: 'responded', timestamp: '2026-04-12T09:10:00Z', refId: 'm1' },
      { id: 'r2', name: 'Tom Mwangi', type: 'member', status: 'converted', timestamp: '2026-04-11T15:30:00Z', refId: 'm2' },
      { id: 'r3', name: 'Joy Wambui', type: 'member', status: 'delivered', timestamp: '2026-04-10T11:00:00Z', refId: 'm3' },
    ],
  },
  c4: {
    message: "🏃 March Fitness Challenge at JengaGym starts TOMORROW!\n\nComplete 20 check-ins in 31 days to win a FREE month of membership. Are you in?\n\nReply YES to register!",
    timeSeries: [
      { label: 'Wk 1', value: 12 },
      { label: 'Wk 2', value: 28 },
      { label: 'Wk 3', value: 45 },
      { label: 'Wk 4', value: 58 },
    ],
    activities: [
      { id: 'a1', text: 'Brian Odhiambo converted — won free month', timestamp: '2026-03-31T18:00:00Z', initials: 'BO', color: '#33D169' },
      { id: 'a2', text: 'Carol Nyambura replied: "Count me in! 🔥"', timestamp: '2026-03-15T10:00:00Z', initials: 'CN', color: '#4C9FFF' },
    ],
    recipients: [
      { id: 'r1', name: 'Brian Odhiambo',  type: 'member', status: 'converted', timestamp: '2026-03-31T18:00:00Z', refId: 'm1' },
      { id: 'r2', name: 'Carol Nyambura',  type: 'member', status: 'responded', timestamp: '2026-03-15T10:00:00Z', refId: 'm2' },
    ],
  },
  c5: {
    message: "Hi {name}, we haven't seen you at JengaGym in a while! 😢\n\nLife gets busy — we get it. But we're here when you're ready. Your account is still active.\n\nSee you soon? 💪",
    timeSeries: [
      { label: 'Wk 1', value: 4 },
      { label: 'Wk 2', value: 8 },
    ],
    activities: [],
    recipients: [
      { id: 'r1', name: 'Felix Ouma', type: 'member', status: 'responded', timestamp: '2026-01-20T09:00:00Z', refId: 'm1' },
    ],
  },
  c6: {
    message: "☀️ Get your summer body at JengaGym!\n\nJoin our 8-week Summer Body Program starting May 2026. Limited spots available.\n\nReply SUMMER to reserve your spot today!",
    timeSeries: [],
    activities: [],
    recipients: [],
  },
  c7: {
    message: "Hi {name}! Thanks for trying JengaGym last week. How was your experience? 🙏\n\nWe'd love to have you join us full-time.\n\nReply JOIN for our best membership deal, or HELP if you have any questions.",
    timeSeries: [
      { label: 'Wk 1', value: 10 },
      { label: 'Wk 2', value: 18 },
      { label: 'Wk 3', value: 24 },
    ],
    activities: [
      { id: 'a1', text: 'Amina Hassan replied: "I loved it! Tell me more"', timestamp: '2026-03-22T11:15:00Z', initials: 'AH', color: '#4C9FFF' },
      { id: 'a2', text: 'Kevin Oloo converted — signed up for 3 months', timestamp: '2026-03-21T14:00:00Z', initials: 'KO', color: '#33D169' },
    ],
    recipients: [
      { id: 'r1', name: 'Amina Hassan', type: 'lead', status: 'responded', timestamp: '2026-03-22T11:15:00Z', refId: 'l1' },
      { id: 'r2', name: 'Kevin Oloo',   type: 'lead', status: 'converted', timestamp: '2026-03-21T14:00:00Z', refId: 'l2' },
    ],
  },
};
