import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getStageConfig, LEAD_SOURCES } from '@/lib/theme';
import type { AppLead } from '@/context/LeadsContext';

type Props = {
  lead: AppLead;
  onPress: () => void;
  compact?: boolean;   // used in kanban columns
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string) {
  const palette = ['#4C9FFF', '#A855F7', '#F97316', '#33D169', '#FFD24C', '#FF6B9D', '#06B6D4'];
  const idx = name.charCodeAt(0) % palette.length;
  return palette[idx];
}

function lastContactedLabel(dateStr: string | null): string {
  if (!dateStr) return 'Not yet contacted';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Contacted today';
  if (days === 1) return 'Last contacted 1 day ago';
  return `Last contacted ${days} days ago`;
}

export function LeadCard({ lead, onPress, compact = false }: Props) {
  const stage = getStageConfig(lead.status);
  const sourceLabel = LEAD_SOURCES.find(s => s.key === lead.source)?.label ?? lead.source;
  const avatarColor = getAvatarColor(lead.name);

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={onPress} activeOpacity={0.75}>
        <View style={[styles.compactAvatar, { backgroundColor: avatarColor + '22' }]}>
          <Text style={[styles.compactAvatarText, { color: avatarColor }]}>
            {getInitials(lead.name)}
          </Text>
        </View>
        <Text style={styles.compactName} numberOfLines={1}>{lead.name}</Text>
        {lead.phone && (
          <View style={styles.compactRow}>
            <Ionicons name="call-outline" size={11} color={colors.textMuted} />
            <Text style={styles.compactPhone}>{lead.phone}</Text>
          </View>
        )}
        <View style={[styles.sourceTag, { backgroundColor: colors.surface }]}>
          <Text style={styles.sourceTagText}>{sourceLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor + '22' }]}>
        <Text style={[styles.avatarText, { color: avatarColor }]}>{getInitials(lead.name)}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Row 1: name + stage badge */}
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
          <View style={[styles.stageBadge, { backgroundColor: stage.color + '22' }]}>
            <Text style={[styles.stageText, { color: stage.color }]}>{stage.label}</Text>
          </View>
        </View>

        {/* Row 2: phone */}
        {lead.phone && (
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{lead.phone}</Text>
          </View>
        )}

        {/* Row 3: source + interests */}
        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{sourceLabel}</Text>
          </View>
          {lead.interests.slice(0, 2).map(interest => (
            <View key={interest} style={[styles.tag, styles.interestTag]}>
              <Text style={[styles.tagText, styles.interestTagText]}>
                {interest === 'personal_training' ? 'Training' : interest === 'group_classes' ? 'Classes' : 'Membership'}
              </Text>
            </View>
          ))}
        </View>

        {/* Row 4: last contacted */}
        <Text style={styles.lastContacted}>{lastContactedLabel(lead.last_contacted_at)}</Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  content: { flex: 1, gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  stageText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: colors.textSecondary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 1 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: colors.surfaceElevated,
  },
  tagText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  interestTag: { backgroundColor: colors.primary + '15' },
  interestTagText: { color: colors.primary },
  lastContacted: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  chevron: { marginTop: 4 },

  // Compact (kanban)
  compactCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
    marginBottom: 8,
  },
  compactAvatar: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  compactAvatarText: { fontSize: 13, fontWeight: '700' },
  compactName: { fontSize: 13, fontWeight: '600', color: colors.text },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compactPhone: { fontSize: 11, color: colors.textMuted },
  sourceTag: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, alignSelf: 'flex-start',
  },
  sourceTagText: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },
});
