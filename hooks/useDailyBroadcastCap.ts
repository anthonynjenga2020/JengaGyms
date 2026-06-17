import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAILY_CAP = 200;

export function useDailyBroadcastCap() {
  const [sentToday, setSentToday] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load today's count from Supabase on mount
  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('broadcast_stats')
          .select('sent_count')
          .eq('date', today)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        setSentToday(data?.sent_count ?? 0);
      } catch (e) {
        console.error('Failed to load daily broadcast usage', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Increment the count and persist it in Supabase
  const recordSent = useCallback(async (count: number) => {
    const newCount = sentToday + count;
    setSentToday(newCount);
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('broadcast_stats').upsert({ date: today, sent_count: newCount }, { onConflict: 'date' });
    } catch (e) {
      console.error('Failed to persist daily broadcast usage', e);
    }
  }, [sentToday]);

  const remaining = Math.max(0, DAILY_CAP - sentToday);
  const isAtCap = sentToday >= DAILY_CAP;

  return { sentToday, remaining, isAtCap, DAILY_CAP, recordSent, loading };
}
