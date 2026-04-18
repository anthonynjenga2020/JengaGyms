import React, { createContext, useContext, useReducer, useMemo, useState } from 'react';
import { MOCK_REVIEWS, type MockReview } from '@/lib/mockReviews';
import { MOCK_SENT_REQUESTS, type SentReviewRequest } from '@/lib/mockReviewRequests';

type Action = { type: 'REPLY'; id: string; text: string; resolved: boolean };

function reducer(state: MockReview[], action: Action): MockReview[] {
  switch (action.type) {
    case 'REPLY':
      return state.map(r =>
        r.id === action.id
          ? { ...r, replied: true, reply_text: action.text, resolved: action.resolved }
          : r
      );
    default:
      return state;
  }
}

interface ReviewsCtx {
  reviews: MockReview[];
  unansweredCount: number;
  replyToReview: (id: string, text: string, resolved: boolean) => void;
  sentRequests: SentReviewRequest[];
  addSentRequests: (requests: SentReviewRequest[]) => void;
}

const Ctx = createContext<ReviewsCtx | null>(null);

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [reviews, dispatch] = useReducer(reducer, MOCK_REVIEWS);
  const [sentRequests, setSentRequests] = useState<SentReviewRequest[]>(MOCK_SENT_REQUESTS);

  const unansweredCount = useMemo(
    () => reviews.filter(r => !r.replied).length,
    [reviews]
  );

  function replyToReview(id: string, text: string, resolved: boolean) {
    dispatch({ type: 'REPLY', id, text, resolved });
  }

  function addSentRequests(requests: SentReviewRequest[]) {
    setSentRequests(prev => [...requests, ...prev]);
  }

  return (
    <Ctx.Provider value={{ reviews, unansweredCount, replyToReview, sentRequests, addSentRequests }}>
      {children}
    </Ctx.Provider>
  );
}

export function useReviewsContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useReviewsContext must be used within ReviewsProvider');
  return ctx;
}
