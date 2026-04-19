import React, { createContext, useContext, useReducer, useMemo, useState, useEffect, useCallback } from 'react';
import { supabase, Review, ReviewRequest } from '@/lib/supabase';
import { useClientContext } from '@/context/ClientContext';

type ReviewsState = Review[];

type Action =
  | { type: 'SET'; reviews: Review[] }
  | { type: 'REPLY'; id: string; text: string; resolved: boolean };

function reducer(state: ReviewsState, action: Action): ReviewsState {
  switch (action.type) {
    case 'SET':
      return action.reviews;
    case 'REPLY':
      return state.map(r =>
        r.id === action.id
          ? { ...r, replied: true, reply_text: action.text, replied_at: new Date().toISOString(), resolved: action.resolved }
          : r
      );
    default:
      return state;
  }
}

interface ReviewsCtx {
  reviews: Review[];
  unansweredCount: number;
  replyToReview: (id: string, text: string, resolved: boolean) => Promise<void>;
  sentRequests: ReviewRequest[];
  addSentRequests: (requests: Omit<ReviewRequest, 'id' | 'created_at'>[]) => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<ReviewsCtx | null>(null);

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const { clientId } = useClientContext();
  const [reviews, dispatch] = useReducer(reducer, []);
  const [sentRequests, setSentRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const [{ data: reviewData }, { data: requestData }] = await Promise.all([
      supabase.from('reviews').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('review_requests').select('*').eq('client_id', clientId).order('sent_at', { ascending: false }),
    ]);

    if (reviewData) dispatch({ type: 'SET', reviews: reviewData as Review[] });
    if (requestData) setSentRequests(requestData as ReviewRequest[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const unansweredCount = useMemo(
    () => reviews.filter(r => !r.replied).length,
    [reviews]
  );

  async function replyToReview(id: string, text: string, resolved: boolean) {
    dispatch({ type: 'REPLY', id, text, resolved });
    await supabase
      .from('reviews')
      .update({ replied: true, reply_text: text, replied_at: new Date().toISOString(), resolved })
      .eq('id', id);
  }

  async function addSentRequests(requests: Omit<ReviewRequest, 'id' | 'created_at'>[]) {
    if (!clientId) return;
    const rows = requests.map(r => ({ ...r, client_id: clientId }));
    const { data } = await supabase.from('review_requests').insert(rows).select();
    if (data) setSentRequests(prev => [...(data as ReviewRequest[]), ...prev]);
  }

  return (
    <Ctx.Provider value={{ reviews, unansweredCount, replyToReview, sentRequests, addSentRequests, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useReviewsContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useReviewsContext must be used within ReviewsProvider');
  return ctx;
}
