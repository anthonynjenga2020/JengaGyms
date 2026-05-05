// Jenga Systems brand colours — dark theme
export const colors = {
  background: '#0F1923',
  surface: '#1A2533',
  surfaceElevated: '#22303F',
  border: '#2A3A4A',
  primary: '#33D169',
  primaryDark: '#28A852',
  accent: '#B3E84C',
  text: '#F0F4F8',
  textSecondary: '#8FA3B4',
  textMuted: '#4A6278',
  danger: '#FF4C4C',
  warning: '#FFB347',
  success: '#33D169',
  info: '#4C9FFF',
} as const;

export const fonts = {
  regular: { fontWeight: '400' as const },
  medium: { fontWeight: '500' as const },
  semibold: { fontWeight: '600' as const },
  bold: { fontWeight: '700' as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};

// ── Lead pipeline stages ─────────────────────────────────────────────────────

export type LeadStage =
  | 'new_lead'
  | 'contacted'
  | 'trial_booked'
  | 'trial_completed'
  | 'joined_gym'
  | 'lost_lead';

export type LeadSource =
  | 'website'
  | 'instagram'
  | 'referral'
  | 'walk_in'
  | 'google_ads'
  | 'other';

export type LeadInterest = 'membership' | 'personal_training' | 'group_classes';

export const LEAD_STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'new_lead',        label: 'New Lead',         color: '#4C9FFF' },
  { key: 'contacted',       label: 'Contacted',         color: '#FFD24C' },
  { key: 'trial_booked',    label: 'Trial Booked',      color: '#A855F7' },
  { key: 'trial_completed', label: 'Trial Completed',   color: '#F97316' },
  { key: 'joined_gym',      label: 'Joined Gym',        color: '#33D169' },
  { key: 'lost_lead',       label: 'Lost Lead',         color: '#FF4C4C' },
];

export const LEAD_SOURCES: { key: LeadSource; label: string }[] = [
  { key: 'website',     label: 'Website' },
  { key: 'instagram',   label: 'Instagram' },
  { key: 'referral',    label: 'Referral' },
  { key: 'walk_in',     label: 'Walk-in' },
  { key: 'google_ads',  label: 'Google Ads' },
  { key: 'other',       label: 'Other' },
];

export const LEAD_INTERESTS: { key: LeadInterest; label: string }[] = [
  { key: 'membership',         label: 'Membership' },
  { key: 'personal_training',  label: 'Personal Training' },
  { key: 'group_classes',      label: 'Group Classes' },
];

export function getStageConfig(key: LeadStage) {
  return LEAD_STAGES.find(s => s.key === key) ?? LEAD_STAGES[0];
}

export const leadStatusConfig: Record<string, { color: string; label: string }> = {
  new_lead:        { color: colors.info,          label: 'New Lead' },
  contacted:       { color: colors.warning,        label: 'Contacted' },
  trial_booked:    { color: colors.primary,        label: 'Trial Booked' },
  trial_completed: { color: colors.accent,         label: 'Trial Done' },
  joined_gym:      { color: colors.success,        label: 'Joined' },
  lost_lead:       { color: colors.danger,         label: 'Lost' },
  // legacy fallbacks
  new:             { color: colors.info,           label: 'New' },
  converted:       { color: colors.success,        label: 'Converted' },
  lost:            { color: colors.danger,         label: 'Lost' },
};

export const campaignTypeConfig = {
  sms:       { label: 'SMS',       icon: 'chatbubble-outline' },
  email:     { label: 'Email',     icon: 'mail-outline' },
  whatsapp:  { label: 'WhatsApp',  icon: 'logo-whatsapp' },
} as const;

export const campaignStatusConfig = {
  draft:     { color: colors.textMuted,      label: 'Draft' },
  active:    { color: colors.success,        label: 'Active' },
  completed: { color: colors.textSecondary,  label: 'Completed' },
  paused:    { color: colors.warning,        label: 'Paused' },
} as const;
