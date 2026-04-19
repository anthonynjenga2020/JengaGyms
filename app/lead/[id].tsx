import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Modal,
  Animated,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useLeadsContext } from '@/context/LeadsContext';
import { AddLeadModal } from '@/components/AddLeadModal';
import type { LeadActivity } from '@/context/LeadsContext';
import {
  colors,
  spacing,
  getStageConfig,
  LEAD_STAGES,
  LEAD_SOURCES,
  LEAD_INTERESTS,
} from '@/lib/theme';
import type { LeadStage } from '@/lib/theme';
import type { LeadActivity } from '@/context/LeadsContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function getAvatarColor(name: string) {
  const palette = ['#4C9FFF', '#A855F7', '#F97316', '#33D169', '#FFD24C', '#FF6B9D', '#06B6D4'];
  return palette[name.charCodeAt(0) % palette.length];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Quick Action Button ───────────────────────────────────────────────────────

function QuickAction({
  icon, label, color, onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={qaStyles.btn} onPress={onPress}>
      <View style={[qaStyles.icon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={qaStyles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const qaStyles = StyleSheet.create({
  btn: { flex: 1, alignItems: 'center', gap: 6 },
  icon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
});

// ── Activity Icon ─────────────────────────────────────────────────────────────

function activityIcon(type: LeadActivity['type']): {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
} {
  switch (type) {
    case 'lead_created':  return { icon: 'person-add-outline',   color: colors.info };
    case 'stage_changed': return { icon: 'git-branch-outline',   color: colors.accent };
    case 'note_added':    return { icon: 'document-text-outline', color: colors.primary };
    case 'call_made':     return { icon: 'call-outline',          color: '#06B6D4' };
    case 'trial_booked':  return { icon: 'calendar-outline',      color: '#A855F7' };
  }
}

// ── Add Note Modal ────────────────────────────────────────────────────────────

function AddNoteModal({
  visible, onClose, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [text, setText] = useState('');
  const translateY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function handleSave() {
    if (!text.trim()) { Alert.alert('Error', 'Please write a note first.'); return; }
    onSave(text.trim());
    setText('');
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[noteStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={noteStyles.header}>
          <Text style={noteStyles.title}>Add Note</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <TextInput
          style={noteStyles.input}
          placeholder="Write a note about this lead..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          autoFocus
        />
        <TouchableOpacity style={noteStyles.saveBtn} onPress={handleSave}>
          <Text style={noteStyles.saveBtnText}>Add Note</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const noteStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.md, gap: 14,
    borderTopWidth: 1, borderColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 12, fontSize: 14, color: colors.text, minHeight: 100,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
});

// ── Details Tab ───────────────────────────────────────────────────────────────

function DetailsTab({ lead }: { lead: ReturnType<typeof useLeadsContext>['leads'][0] }) {
  const interestLabels = lead.interests.map(
    k => LEAD_INTERESTS.find(i => i.key === k)?.label ?? k
  );
  const sourceLabel = LEAD_SOURCES.find(s => s.key === lead.source)?.label ?? lead.source;

  function Row({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
    return (
      <View style={detailStyles.row}>
        <View style={detailStyles.iconCell}>
          <Ionicons name={icon} size={15} color={colors.textMuted} />
        </View>
        <Text style={detailStyles.rowLabel}>{label}</Text>
        <Text style={detailStyles.rowValue}>{value}</Text>
      </View>
    );
  }

  return (
    <RNAnimated.View entering={FadeIn.duration(200)} style={detailStyles.container}>
      <Row icon="globe-outline" label="Source" value={sourceLabel} />
      <Row icon="barbell-outline" label="Interest" value={interestLabels.join(', ') || '—'} />
      <Row icon="calendar-outline" label="Date added" value={formatDate(lead.created_at)} />
      <Row
        icon="time-outline"
        label="Last contacted"
        value={formatDate(lead.last_contacted_at)}
      />

      {lead.notes && (
        <View style={detailStyles.notesSection}>
          <Text style={detailStyles.notesLabel}>Notes</Text>
          <Text style={detailStyles.notesText}>{lead.notes}</Text>
        </View>
      )}
    </RNAnimated.View>
  );
}

const detailStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 10,
  },
  iconCell: { width: 22 },
  rowLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '500', color: colors.text, maxWidth: '55%', textAlign: 'right' },
  notesSection: { padding: 16, gap: 8 },
  notesLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({ leadId }: { leadId: string }) {
  const { fetchLeadActivities } = useLeadsContext();
  const [activities, setActivities] = useState<LeadActivity[]>([]);

  useEffect(() => {
    fetchLeadActivities(leadId).then(setActivities);
  }, [leadId]);

  return (
    <RNAnimated.View entering={FadeIn.duration(200)} style={actStyles.container}>
      {activities.map((event, idx) => {
        const { icon, color } = activityIcon(event.type);
        const isLast = idx === activities.length - 1;
        return (
          <View key={event.id} style={actStyles.event}>
            {/* Timeline line */}
            <View style={actStyles.lineCol}>
              <View style={[actStyles.dot, { backgroundColor: color }]} />
              {!isLast && <View style={actStyles.line} />}
            </View>
            {/* Content */}
            <View style={[actStyles.content, isLast && { paddingBottom: 0 }]}>
              <View style={actStyles.eventHeader}>
                <View style={[actStyles.iconBox, { backgroundColor: color + '18' }]}>
                  <Ionicons name={icon} size={13} color={color} />
                </View>
                <Text style={actStyles.description}>{event.description}</Text>
              </View>
              <Text style={actStyles.time}>{timeAgo(event.created_at)}</Text>
            </View>
          </View>
        );
      })}
    </RNAnimated.View>
  );
}

const actStyles = StyleSheet.create({
  container: { paddingLeft: 4 },
  event: { flexDirection: 'row', gap: 12 },
  lineCol: { alignItems: 'center', width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  content: {
    flex: 1, paddingBottom: 20, gap: 4,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  iconBox: {
    width: 26, height: 26, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center',
    marginTop: -1,
  },
  description: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  time: { fontSize: 12, color: colors.textMuted, paddingLeft: 34 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

type TabKey = 'details' | 'activity';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getLead, updateLead } = useLeadsContext();
  const lead = getLead(id);

  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [changingStage, setChangingStage] = useState(false);

  if (!lead) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const stage = getStageConfig(lead.status);
  const avatarColor = getAvatarColor(lead.name);

  async function handleCall() {
    if (lead.phone) await Linking.openURL(`tel:${lead.phone}`);
  }

  async function handleSMS() {
    if (lead.phone) await Linking.openURL(`sms:${lead.phone}`);
  }

  async function handleBookTrial() {
    setChangingStage(true);
    updateLead(lead.id, { status: 'trial_booked', last_contacted_at: new Date().toISOString() });
    await new Promise(r => setTimeout(r, 300));
    setChangingStage(false);
    Alert.alert('Trial Booked', `${lead.name} has been moved to Trial Booked.`);
  }

  function handleAddNote(note: string) {
    const existing = lead.notes ? `${lead.notes}\n\n${note}` : note;
    updateLead(lead.id, { notes: existing });
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header / back nav */}
        <RNAnimated.View entering={FadeIn.duration(250)} style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Leads</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditModalVisible(true)} style={styles.editBtn}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </RNAnimated.View>

        {/* Contact Card */}
        <RNAnimated.View entering={FadeInDown.delay(80).duration(400).springify()} style={styles.contactCard}>
          <View style={[styles.avatar, { backgroundColor: avatarColor + '22' }]}>
            <Text style={[styles.avatarText, { color: avatarColor }]}>
              {getInitials(lead.name)}
            </Text>
          </View>

          <Text style={styles.name}>{lead.name}</Text>

          <View style={[styles.stageBadge, { backgroundColor: stage.color + '22' }]}>
            <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
            <Text style={[styles.stageText, { color: stage.color }]}>{stage.label}</Text>
          </View>

          {/* Contact info */}
          {lead.phone && (
            <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
              <Ionicons name="call-outline" size={15} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.primary }]}>{lead.phone}</Text>
            </TouchableOpacity>
          )}
          {lead.email && (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => Linking.openURL(`mailto:${lead.email}`)}
            >
              <Ionicons name="mail-outline" size={15} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.primary }]}>{lead.email}</Text>
            </TouchableOpacity>
          )}

          {/* Tags */}
          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {LEAD_SOURCES.find(s => s.key === lead.source)?.label ?? lead.source}
              </Text>
            </View>
            {lead.interests.map(k => (
              <View key={k} style={[styles.tag, styles.interestTag]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  {LEAD_INTERESTS.find(i => i.key === k)?.label ?? k}
                </Text>
              </View>
            ))}
          </View>
        </RNAnimated.View>

        {/* Quick Actions */}
        <RNAnimated.View entering={FadeInDown.delay(180).duration(400).springify()} style={styles.quickActions}>
          <QuickAction icon="call-outline" label="Call" color={colors.info} onPress={handleCall} />
          <QuickAction icon="chatbubble-outline" label="SMS" color={colors.primary} onPress={handleSMS} />
          <QuickAction
            icon="calendar-outline"
            label="Book Trial"
            color="#A855F7"
            onPress={handleBookTrial}
          />
          <QuickAction
            icon="document-text-outline"
            label="Add Note"
            color={colors.accent}
            onPress={() => setNoteModalVisible(true)}
          />
        </RNAnimated.View>

        {/* Pipeline Stage Selector */}
        <RNAnimated.View entering={FadeInDown.delay(260).duration(400).springify()}>
          <Text style={styles.sectionLabel}>Move Stage</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
            {LEAD_STAGES.map(s => {
              const isActive = lead.status === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.stagePill,
                    { borderColor: s.color },
                    isActive && { backgroundColor: s.color },
                  ]}
                  onPress={() => !isActive && updateLead(lead.id, { status: s.key as LeadStage })}
                  disabled={isActive || changingStage}
                >
                  <Text style={[styles.stagePillText, { color: isActive ? '#000' : s.color }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </RNAnimated.View>

        {/* Tabs */}
        <RNAnimated.View entering={FadeInDown.delay(320).duration(400).springify()}>
          <View style={styles.tabs}>
            {(['details', 'activity'] as TabKey[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'details'
              ? <DetailsTab lead={lead} />
              : <ActivityTab leadId={lead.id} />
            }
          </View>
        </RNAnimated.View>

      </ScrollView>

      {/* Edit modal */}
      <AddLeadModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        editLead={lead}
      />

      {/* Add note modal */}
      <AddNoteModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        onSave={handleAddNote}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingTop: Platform.OS === 'ios' ? 56 : 32, paddingBottom: 48, gap: 20 },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 15, color: colors.primary },
  editBtn: { padding: 4 },

  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 20, alignItems: 'center', gap: 10,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  stageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
  },
  stageDot: { width: 7, height: 7, borderRadius: 3.5 },
  stageText: { fontSize: 13, fontWeight: '700' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  contactText: { fontSize: 15, fontWeight: '500' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  tag: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, backgroundColor: colors.surfaceElevated,
  },
  tagText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  interestTag: { backgroundColor: colors.primary + '15' },

  quickActions: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16, paddingHorizontal: 8,
  },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  stageRow: { gap: 8, paddingBottom: 2 },
  stagePill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, borderWidth: 1.5,
  },
  stagePillText: { fontSize: 12, fontWeight: '700' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 4, gap: 4, marginBottom: 12,
  },
  tab: {
    flex: 1, paddingVertical: 9,
    borderRadius: 8, alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#000' },
  tabContent: {},
});
