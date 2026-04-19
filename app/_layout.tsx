import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { ClientProvider } from '@/context/ClientContext';
import { LeadsProvider } from '@/context/LeadsContext';
import { MembersProvider } from '@/context/MembersContext';
import { MessagesProvider } from '@/context/MessagesContext';
import { ClassesProvider } from '@/context/ClassesContext';
import { ReviewsProvider } from '@/context/ReviewsContext';
import type { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (session) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [initialized, session]);

  const appContent = (
    <MembersProvider>
      <LeadsProvider>
        <MessagesProvider>
          <ClassesProvider>
            <ReviewsProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="lead/[id]" />
                <Stack.Screen name="member/[id]" />
                <Stack.Screen name="conversation/[id]" />
                <Stack.Screen name="class/[id]" />
              </Stack>
            </ReviewsProvider>
          </ClassesProvider>
        </MessagesProvider>
      </LeadsProvider>
    </MembersProvider>
  );

  if (session?.user?.id) {
    return (
      <ClientProvider userId={session.user.id}>
        {appContent}
      </ClientProvider>
    );
  }

  return appContent;
}
