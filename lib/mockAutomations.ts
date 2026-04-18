export interface MockAutomation {
  id: string;
  name: string;
  emoji: string;
  iconColor: string;
  trigger: string;
  actionSummary: string;
  statsText: string;
  active: boolean;
}

export const MOCK_AUTOMATIONS: MockAutomation[] = [
  {
    id: 'auto1',
    name: 'New Lead Welcome',
    emoji: '🆕',
    iconColor: '#4C9FFF',
    trigger: 'New lead submitted',
    actionSummary: '→ Sends welcome SMS immediately',
    statsText: 'Triggered 28× this month | 6 conversions',
    active: true,
  },
  {
    id: 'auto2',
    name: 'Trial Reminder',
    emoji: '📅',
    iconColor: '#A855F7',
    trigger: 'Trial booked (24 hrs before)',
    actionSummary: '→ Sends reminder SMS with class details',
    statsText: 'Triggered 14× this month | 11 showed up',
    active: true,
  },
  {
    id: 'auto3',
    name: 'Trial Follow-up',
    emoji: '🔁',
    iconColor: '#33D169',
    trigger: 'Trial completed',
    actionSummary: '→ SMS after 1 day + follow-up after 3 days',
    statsText: 'Triggered 11× this month | 4 joined',
    active: true,
  },
  {
    id: 'auto4',
    name: 'Member Inactivity Alert',
    emoji: '💤',
    iconColor: '#FF8C00',
    trigger: 'Member inactive for 14 days',
    actionSummary: '→ Sends re-engagement SMS',
    statsText: 'Triggered 19× this month | 7 returned',
    active: true,
  },
  {
    id: 'auto5',
    name: 'Payment Reminder',
    emoji: '💳',
    iconColor: '#FFB347',
    trigger: 'Billing date is 3 days away',
    actionSummary: '→ Sends payment reminder SMS with M-Pesa details',
    statsText: 'Triggered 22× this month | 18 paid on time',
    active: true,
  },
  {
    id: 'auto6',
    name: 'Birthday Message',
    emoji: '🎂',
    iconColor: '#EC4899',
    trigger: "Member's birthday (day of)",
    actionSummary: '→ Sends birthday message + special offer',
    statsText: 'Triggered 8× this month | 3 upgrades',
    active: false,
  },
];

export interface TriggerOption {
  id: string;
  label: string;
  suggestedName: string;
  hasDays?: boolean;
  daysLabel?: string;
  defaultDays?: number;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  { id: 'new_lead',          label: 'New lead submitted',           suggestedName: 'New Lead Welcome' },
  { id: 'trial_booked',      label: 'Trial booked',                 suggestedName: 'Trial Reminder',    hasDays: true, daysLabel: 'Hours before trial', defaultDays: 24 },
  { id: 'trial_completed',   label: 'Trial completed',              suggestedName: 'Trial Follow-up' },
  { id: 'member_joined',     label: 'Member joined',                suggestedName: 'Member Onboarding' },
  { id: 'member_inactive',   label: 'Member inactive',              suggestedName: 'Inactivity Alert',  hasDays: true, daysLabel: 'Days since last visit', defaultDays: 14 },
  { id: 'billing_soon',      label: 'Billing date approaching',     suggestedName: 'Payment Reminder',  hasDays: true, daysLabel: 'Days before billing',   defaultDays: 3 },
  { id: 'birthday',          label: "Member's birthday",            suggestedName: 'Birthday Message' },
  { id: 'review_received',   label: 'Review received',              suggestedName: 'Review Thank You' },
  { id: 'class_booked',      label: 'Class booked',                 suggestedName: 'Class Confirmation' },
  { id: 'member_expired',    label: 'Membership expired',           suggestedName: 'Renewal Reminder' },
];

export type ActionType = 'send_sms' | 'wait' | 'update_stage' | 'assign_team' | 'add_tag';

export interface ActionStep {
  id: string;
  type: ActionType;
  message?: string;
  waitDuration?: string;
  stage?: string;
  teamMember?: string;
  tag?: string;
}

export const ACTION_TYPE_OPTIONS: { id: ActionType; label: string; emoji: string }[] = [
  { id: 'send_sms',     label: 'Send SMS',       emoji: '💬' },
  { id: 'wait',         label: 'Wait',           emoji: '⏳' },
  { id: 'update_stage', label: 'Update Stage',   emoji: '🔄' },
  { id: 'assign_team',  label: 'Assign to Team', emoji: '👤' },
  { id: 'add_tag',      label: 'Add Tag',        emoji: '🏷️' },
];

export const WAIT_DURATIONS: { id: string; label: string }[] = [
  { id: '1d', label: '1 day' },
  { id: '2d', label: '2 days' },
  { id: '3d', label: '3 days' },
  { id: '1w', label: '1 week' },
];

export const PERSONALIZATION_TOKENS = [
  '{name}', '{gym_name}', '{plan}', '{expiry_date}', '{trainer_name}', '{class_name}',
];

export const LEAD_STAGES = ['New Lead', 'Contacted', 'Trial Booked', 'Trial Completed', 'Joined Gym', 'Lost Lead'];
