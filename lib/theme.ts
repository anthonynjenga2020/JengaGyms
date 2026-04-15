// Jenga Systems brand colours — dark theme
export const colors = {
  background: '#0F1923',      // deep dark navy
  surface: '#1A2533',         // card / input background
  surfaceElevated: '#22303F', // elevated cards
  border: '#2A3A4A',          // subtle borders
  primary: '#33D169',         // vibrant green (CTAs, highlights)
  primaryDark: '#28A852',     // pressed state
  accent: '#B3E84C',          // yellow-green (secondary highlights)
  text: '#F0F4F8',            // primary text
  textSecondary: '#8FA3B4',   // secondary text
  textMuted: '#4A6278',       // placeholder / muted text
  danger: '#FF4C4C',          // errors / lost status
  warning: '#FFB347',         // paused / draft status
  success: '#33D169',         // active / converted status
  info: '#4C9FFF',            // new / info status
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

// Lead status → colour + label
export const leadStatusConfig = {
  new: { color: colors.info, label: 'New' },
  contacted: { color: colors.warning, label: 'Contacted' },
  converted: { color: colors.success, label: 'Converted' },
  lost: { color: colors.danger, label: 'Lost' },
} as const;

// Campaign type → label
export const campaignTypeConfig = {
  sms: { label: 'SMS', icon: 'chatbubble-outline' },
  email: { label: 'Email', icon: 'mail-outline' },
  whatsapp: { label: 'WhatsApp', icon: 'logo-whatsapp' },
} as const;

// Campaign status → colour + label
export const campaignStatusConfig = {
  draft: { color: colors.textMuted, label: 'Draft' },
  active: { color: colors.success, label: 'Active' },
  completed: { color: colors.textSecondary, label: 'Completed' },
  paused: { color: colors.warning, label: 'Paused' },
} as const;
