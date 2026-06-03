import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/lib/theme';
import { useReviewsContext } from '@/context/ReviewsContext';
import { useMessagesContext } from '@/context/MessagesContext';
import { useClient } from '@/hooks/useClient';

type MoreItem = {
  icon: string;
  label: string;
  subtitle: string;
  route: string;
  color: string;
  badge?: number;
};

export default function MoreScreen() {
  const { unansweredCount } = useReviewsContext();
  const { unreadCount } = useMessagesContext();
  const { client } = useClient();

  const items: MoreItem[] = [
    {
      icon: 'calendar-outline',
      label: 'Classes',
      subtitle: 'Schedule & attendance',
      route: '/(tabs)/classes',
      color: '#A855F7',
    },
    {
      icon: 'star-outline',
      label: 'Reviews',
      subtitle: 'Google reviews & rating',
      route: '/(tabs)/reviews',
      color: colors.accent,
      badge: unansweredCount,
    },
    {
      icon: 'megaphone-outline',
      label: 'Marketing',
      subtitle: 'Campaigns & promos',
      route: '/(tabs)/campaigns',
      color: colors.info,
    },
    {
      icon: 'settings-outline',
      label: 'Settings',
      subtitle: 'Gym & account settings',
      route: '/(tabs)/settings',
      color: colors.textSecondary,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        {client?.gym_name ? (
          <Text style={styles.gymName}>{client.gym_name}</Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Grid */}
        <View style={styles.grid}>
          {items.map(item => (
            <TouchableOpacity
              key={item.route}
              style={styles.card}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.72}
            >
              <View style={styles.cardInner}>
                {/* Icon */}
                <View style={[styles.iconBg, { backgroundColor: item.color + '22' }]}>
                  <Ionicons name={item.icon as any} size={26} color={item.color} />
                  {item.badge != null && item.badge > 0 && (
                    <View style={styles.badgeDot}>
                      <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                    </View>
                  )}
                </View>

                {/* Text */}
                <View style={styles.cardText}>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  <Text style={styles.cardSub}>{item.subtitle}</Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Quick links section */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(tabs)/leads')}
            activeOpacity={0.75}
          >
            <Ionicons name="funnel-outline" size={18} color={colors.info} />
            <Text style={styles.quickLabel}>Add Lead</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(tabs)/members')}
            activeOpacity={0.75}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.primary} />
            <Text style={styles.quickLabel}>Add Member</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(tabs)/classes')}
            activeOpacity={0.75}
          >
            <Ionicons name="add-circle-outline" size={18} color="#A855F7" />
            <Text style={styles.quickLabel}>New Class</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(tabs)/campaigns')}
            activeOpacity={0.75}
          >
            <Ionicons name="send-outline" size={18} color={colors.accent} />
            <Text style={styles.quickLabel}>Campaign</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'web' ? 16 : 32,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  gymName: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  content: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
  },

  // ── Nav grid
  grid: { gap: 10 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  iconBg: {
    width: 50, height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.danger,
    borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: colors.background,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  cardText: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // ── Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },

  // ── Quick actions
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
