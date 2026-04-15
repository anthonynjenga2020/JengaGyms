import { useEffect, useState, useCallback } from 'react';
import { supabase, Review } from '@/lib/supabase';

export function useReviews(clientId: string | undefined) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setReviews(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function replyToReview(id: string, replyText: string) {
    const { error } = await supabase
      .from('reviews')
      .update({ replied: true, reply_text: replyText, replied_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setReviews(prev =>
        prev.map(r => r.id === id ? { ...r, replied: true, reply_text: replyText } : r)
      );
    }
    return error;
  }

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return { reviews, loading, error, refresh: fetchReviews, replyToReview, averageRating };
}
