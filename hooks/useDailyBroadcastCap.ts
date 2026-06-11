import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_CAP = 200;
const STORAGE_KEY = 'broadcast_daily_usage';

interface DailyUsage {
  date: string; // YYYY-MM-DD
  count: number;
}

export function useDailyBroadcastCap() {
  const [sentToday, setSentToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  // Load persisted count on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const usage: DailyUsage = JSON.parse(raw);
          if (usage.date === todayStr) {
            setSentToday(usage.count);
          } else {
            // New day — reset
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayStr, count: 0 }));
            setSentToday(0);
          }
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayStr, count: 0 }));
        }
      } catch (e) {
        console.error('Failed to load daily broadcast usage', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [todayStr]);

  // Increment the count and persist it
  const recordSent = useCallback(async (count: number) => {
    const newCount = sentToday + count;
    setSentToday(newCount);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayStr, count: newCount }));
    } catch (e) {
      console.error('Failed to persist daily broadcast usage', e);
    }
  }, [sentToday, todayStr]);

  const remaining = Math.max(0, DAILY_CAP - sentToday);
  const isAtCap = sentToday >= DAILY_CAP;

  return { sentToday, remaining, isAtCap, DAILY_CAP, recordSent, loading };
}
