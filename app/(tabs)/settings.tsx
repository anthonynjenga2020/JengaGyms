import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClient } from '@/hooks/useClient';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { useEffect, useState } from 'react';
import type { Subscription } from '@/lib/supabase';

const PLAN_LABELS: Record<string, { label: string; price: string; color: string }> = {
  starter: { label: 'Starter', price: '2,000 KSh/mo', color: colors.info },
  growth: { label: 'Growth', price: '4,500 KSh/mo', color: colors.primary },
  pro: { label: 'Pro', price: '8,000 KSh/mo', color: colors.accent },
};

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress}>
      <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { client, loading } = useClient();
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!client?.id) return;
    supabase
      .from('subscriptions')
      .select('*')
      .eq('client_id', client.id)
      .eq('is_active', true)
      .single()
      .then(({ data }) => setSubscription(data));
  }, [client?.id]);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  const planInfo = client?.plan ? PLAN_LABELS[client.plan] : null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Profile */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {client?.gym_name?.charAt(0).toUpperCase() ?? 'G'}
          </Text>
        </View>
        <View>
          <Text style={styles.profileName}>{client?.gym_name ?? 'Your Gym'}</Text>
          <Text style={styles.profileEmail}>{client?.email ?? ''}</Text>
          {planInfo && (
            <View style={[styles.planBadge, { backgroundColor: planInfo.color + '22' }]}>
              <Text style={[styles.planBadgeText, { color: planInfo.color }]}>
                {planInfo.label} Plan
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Subscription */}
      <Text style={styles.sectionLabel}>Subscription</Text>
      <View style={styles.section}>
        <SettingRow
          icon="card-outline"
          label="Current plan"
          value={planInfo ? `${planInfo.label} — ${planInfo.price}` : 'No active plan'}
        />
        {subscription?.next_billing_date && (
          <SettingRow
            icon="calendar-outline"
            label="Next billing date"
            value={new Date(subscription.next_billing_date).toLocaleDateString('en-KE', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          />
        )}
        <SettingRow
          icon="receipt-outline"
          label="Billing history"
          onPress={() => Alert.alert('Coming soon', 'Billing history will be available soon.')}
        />
      </View>

      {/* Gym info */}
      <Text style={styles.sectionLabel}>Your Gym</Text>
      <View style={styles.section}>
        {client?.phone && (
          <SettingRow icon="call-outline" label="Phone" value={client.phone} />
        )}
        {client?.address && (
          <SettingRow icon="location-outline" label="Address" value={client.address} />
        )}
        {client?.website_url && (
          <SettingRow icon="globe-outline" label="Website" value={client.website_url} />
        )}
      </View>

      {/* Support */}
      <Text style={styles.sectionLabel}>Support</Text>
      <View style={styles.section}>
        <SettingRow
          icon="chatbubble-outline"
          label="WhatsApp support"
          onPress={() => Alert.alert('Contact us', 'Message us on WhatsApp: +254104926969')}
        />
        <SettingRow
          icon="information-circle-outline"
          label="About JengaPulse"
          value="v1.0.0"
        />
      </View>

      {/* Sign out */}
      <View style={styles.section}>
        <SettingRow
          icon="log-out-outline"
          label="Sign out"
          onPress={handleSignOut}
          danger
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56, paddingBottom: 48, gap: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 16,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  profileAvatarText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  profileName: { fontSize: 18, fontWeight: '700', color: colors.text },
  profileEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  planBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 99, marginTop: 6, alignSelf: 'flex-start',
  },
  planBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12, fontWeight: '700',
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 8, marginBottom: 4, marginLeft: 4,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBox: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBoxDanger: { backgroundColor: colors.danger + '15' },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '500', color: colors.text },
  settingLabelDanger: { color: colors.danger },
  settingValue: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
