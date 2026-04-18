export type CampaignStatus = 'active' | 'scheduled' | 'completed' | 'draft' | 'paused';
export type CampaignType = 'sms_broadcast' | 'follow_up' | 'reactivation' | 'promotion' | 'event';

export interface MockCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: CampaignType;
  sent: number;
  total: number;
  responses: number;
  conversions: number;
  recipients: number;
  created_at: string;
  scheduled_at?: string;
}

export const CAMPAIGN_TYPE_META: Record<
  CampaignType,
  { label: string; emoji: string; color: string }
> = {
  sms_broadcast: { label: 'SMS Broadcast',      emoji: '💬', color: '#4C9FFF' },
  follow_up:     { label: 'Follow-up Sequence', emoji: '🔁', color: '#A855F7' },
  reactivation:  { label: 'Reactivation',       emoji: '🎯', color: '#FF8C00' },
  promotion:     { label: 'Promotion',          emoji: '🎉', color: '#33D169' },
  event:         { label: 'Event',              emoji: '📅', color: '#EC4899' },
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
    total: 67,
    responses: 24,
    conversions: 8,
    recipients: 67,
    created_at: '2026-03-15T09:30:00Z',
  },
];
