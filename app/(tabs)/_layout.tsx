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

function ReviewsTabIcon({ color }: { color: string }) {
  const { unansweredCount } = useReviewsContext();
  return (
    <View>
      <Ionicons name="star-outline" size={22} color={color} />
      {unansweredCount > 0 && (
        <View style={[badge.dot, { backgroundColor: '#FF8C00' }]}>
          <Text style={badge.text}>{unansweredCount > 9 ? '9+' : unansweredCount}</Text>
        </View>
      )}
    </View>
  );
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
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
        name="classes"
        options={{
          title: 'Classes',
          tabBarIcon: ({ color }) => <TabIcon name="calendar-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="settings-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'Reviews',
          tabBarIcon: ({ color }) => <ReviewsTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Marketing',
          tabBarIcon: ({ color }) => <TabIcon name="megaphone-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
