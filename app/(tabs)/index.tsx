import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useClient } from '@/hooks/useClient';
import { useLeads } from '@/hooks/useLeads';
import { useReviews } from '@/hooks/useReviews';
import { useCampaigns } from '@/hooks/useCampaigns';
import { MetricCard } from '@/components/MetricCard';
import { LeadItem } from '@/components/LeadItem';
import { colors, spacing } from '@/lib/theme';

export default function DashboardScreen() {
  const { client, loading: clientLoading } = useClient();
  const { leads, loading: leadsLoading, refresh: refreshLeads } = useLeads(client?.id);
  const { reviews, averageRating, refresh: refreshReviews } = useReviews(client?.id);
  const { campaigns, refresh: refreshCampaigns } = useCampaigns(client?.id);
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshLeads(), refreshReviews(), refreshCampaigns()]);
    setRefreshing(false);
  }

  const newLeads = leads.filter(l => l.status === 'new').length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const unrepliedReviews = reviews.filter(r => !r.replied).length;

  if (clientLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.gymName}>{client?.gym_name ?? 'Your Gym'}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: client?.status === 'active' ? colors.primary : colors.warning }]}>
          <Text style={styles.badgeText}>{client?.plan?.toUpperCase() ?? 'STARTER'}</Text>
        </View>
      </View>

      {/* KPI Metrics */}
      <Text style={styles.sectionTitle}>This Month</Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="New Leads"
          value={newLeads}
          icon="people-outline"
          color={colors.info}
          subtitle={`${leads.length} total`}
        />
        <MetricCard
          label="Converted"
          value={convertedLeads}
          icon="checkmark-circle-outline"
          color={colors.success}
          subtitle={leads.length > 0 ? `${Math.round((convertedLeads / leads.length) * 100)}% rate` : '0% rate'}
        />
        <MetricCard
          label="Avg Rating"
          value={averageRating.toFixed(1)}
          icon="star-outline"
          color={colors.accent}
          subtitle={`${reviews.length} reviews`}
        />
        <MetricCard
          label="Campaigns"
          value={activeCampaigns}
          icon="megaphone-outline"
          color={colors.primary}
          subtitle="active"
        />
      </View>

      {/* Alerts */}
      {unrepliedReviews > 0 && (
        <View style={styles.alert}>
          <Text style={styles.alertText}>
            {unrepliedReviews} review{unrepliedReviews > 1 ? 's' : ''} waiting for a reply
          </Text>
        </View>
      )}

      {/* Recent Leads */}
      <Text style={styles.sectionTitle}>Recent Leads</Text>
      {leadsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
      ) : leads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No leads yet. Share your website to start capturing leads!</Text>
        </View>
      ) : (
        <View style={styles.leadsList}>
          {leads.slice(0, 5).map(lead => (
            <LeadItem key={lead.id} lead={lead} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingTop: 56,
    paddingBottom: 32,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 13,
    color: colors.textMuted,
  },
  gymName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  alert: {
    backgroundColor: '#2A1F0A',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 10,
    padding: 12,
  },
  alertText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  leadsList: {
    gap: 8,
  },
  emptyState: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
