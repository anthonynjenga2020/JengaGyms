import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';
import { useMessagesContext } from '@/context/MessagesContext';
import { useReviewsContext } from '@/context/ReviewsContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color }: { name: IoniconName; color: string }) {
  return <Ionicons name={name} size={22} color={color} />;
}

function MessageTabIcon({ color }: { color: string }) {
  const { unreadCount } = useMessagesContext();
  return (
    <View>
      <Ionicons name="chatbubbles-outline" size={22} color={color} />
      {unreadCount > 0 && (
        <View style={badge.dot}>
          <Text style={badge.text}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

function MoreTabIcon({ color }: { color: string }) {
  const { unansweredCount } = useReviewsContext();
  return (
    <View>
      <Ionicons name="ellipsis-horizontal-circle-outline" size={22} color={color} />
      {unansweredCount > 0 && (
        <View style={[badge.dot, { backgroundColor: '#FF8C00' }]}>
          <Text style={badge.text}>{unansweredCount > 9 ? '9+' : unansweredCount}</Text>
        </View>
      )}
    </View>
  );
}

const badge = StyleSheet.create({
  dot: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: colors.danger,
    borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  text: { fontSize: 9, fontWeight: '700', color: '#fff' },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      {/* ── Visible tabs (5) ─────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="grid-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color }) => <TabIcon name="funnel-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          tabBarIcon: ({ color }) => <TabIcon name="people-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <MessageTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <MoreTabIcon color={color} />,
        }}
      />

      {/* ── Hidden tabs (reachable via router.push) ──────── */}
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Classes',
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'Reviews',
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Marketing',
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
