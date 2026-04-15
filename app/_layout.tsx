import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { LeadsProvider } from '@/context/LeadsContext';
import { MembersProvider } from '@/context/MembersContext';
import { MessagesProvider } from '@/context/MessagesContext';
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

  return (
    <MembersProvider>
      <LeadsProvider>
        <MessagesProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="lead/[id]" />
            <Stack.Screen name="member/[id]" />
            <Stack.Screen name="conversation/[id]" />
          </Stack>
        </MessagesProvider>
      </LeadsProvider>
    </MembersProvider>
  );
}
