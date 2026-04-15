import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useClient } from '@/hooks/useClient';
import { useLeads } from '@/hooks/useLeads';
import { colors, spacing, leadStatusConfig } from '@/lib/theme';
import type { Lead } from '@/lib/supabase';

const STATUS_OPTIONS: Lead['status'][] = ['new', 'contacted', 'converted', 'lost'];

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useClient();
  const { leads, updateLeadStatus, updateLeadNotes } = useLeads(client?.id);
  const lead = leads.find(l => l.id === id);

  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  if (!lead) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const config = leadStatusConfig[lead.status];

  async function handleStatusChange(status: Lead['status']) {
    setUpdatingStatus(true);
    const error = await updateLeadStatus(lead!.id, status);
    if (error) Alert.alert('Error', error.message);
    setUpdatingStatus(false);
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    const error = await updateLeadNotes(lead!.id, notes);
    if (error) Alert.alert('Error', error.message);
    setSavingNotes(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Back button */}
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>Leads</Text>
      </TouchableOpacity>

      {/* Lead header */}
      <View style={styles.leadHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{lead.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{lead.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: config.color }]} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
      </View>

      {/* Contact info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Info</Text>
        {lead.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>{lead.phone}</Text>
          </View>
        )}
        {lead.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>{lead.email}</Text>
          </View>
        )}
        {lead.interest && (
          <View style={styles.infoRow}>
            <Ionicons name="barbell-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>{lead.interest}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons name="globe-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>{lead.source.replace('_', ' ')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>{formatDate(lead.created_at)}</Text>
        </View>
      </View>

      {/* Status update */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Update Status</Text>
        <View style={styles.statusGrid}>
          {STATUS_OPTIONS.map(s => {
            const cfg = leadStatusConfig[s];
            const isActive = lead.status === s;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusOption,
                  { borderColor: cfg.color },
                  isActive && { backgroundColor: cfg.color },
                ]}
                onPress={() => handleStatusChange(s)}
                disabled={updatingStatus || isActive}
              >
                <Text style={[styles.statusOptionText, isActive && { color: '#000' }, !isActive && { color: cfg.color }]}>
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notes */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add notes about this lead..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingNotes && styles.saveBtnDisabled]}
          onPress={handleSaveNotes}
          disabled={savingNotes}
        >
          {savingNotes
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.saveBtnText}>Save Notes</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 56, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { color: colors.primary, fontSize: 15 },
  leadHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 6 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99, alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    gap: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 14, color: colors.text, flex: 1 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: {
    flex: 1, minWidth: 80,
    paddingVertical: 10,
    borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center',
  },
  statusOptionText: { fontSize: 13, fontWeight: '700' },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12,
    fontSize: 14, color: colors.text,
    minHeight: 100,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
});
