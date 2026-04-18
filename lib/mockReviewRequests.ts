export interface SentReviewRequest {
  id: string;
  member_name: string;
  member_phone: string;
  platform: 'google' | 'facebook';
  sent_at: string; // ISO 8601
  status: 'pending' | 'reviewed' | 'no_response';
}

export const MOCK_SENT_REQUESTS: SentReviewRequest[] = [
  {
    id: 'rr1',
    member_name: 'Peter Njoroge',
    member_phone: '+254712345001',
    platform: 'google',
    sent_at: '2026-04-15T10:00:00Z',
    status: 'reviewed',
  },
  {
    id: 'rr2',
    member_name: 'Grace Wanjiru',
    member_phone: '+254712345002',
    platform: 'google',
    sent_at: '2026-04-14T14:30:00Z',
    status: 'pending',
  },
  {
    id: 'rr3',
    member_name: 'John Mutua',
    member_phone: '+254712345003',
    platform: 'facebook',
    sent_at: '2026-04-13T09:00:00Z',
    status: 'pending',
  },
  {
    id: 'rr4',
    member_name: 'Mike Ochieng',
    member_phone: '+254712345005',
    platform: 'google',
    sent_at: '2026-04-11T16:00:00Z',
    status: 'reviewed',
  },
  {
    id: 'rr5',
    member_name: 'Wanjiku Mwangi',
    member_phone: '+254712345008',
    platform: 'google',
    sent_at: '2026-04-08T11:00:00Z',
    status: 'no_response',
  },
  {
    id: 'rr6',
    member_name: 'Aisha Abdi',
    member_phone: '+254712345006',
    platform: 'facebook',
    sent_at: '2026-04-05T13:30:00Z',
    status: 'no_response',
  },
  {
    id: 'rr7',
    member_name: 'Sarah Kimani',
    member_phone: '+254712345004',
    platform: 'google',
    sent_at: '2026-03-28T10:00:00Z',
    status: 'reviewed',
  },
  {
    id: 'rr8',
    member_name: 'Daniel Karanja',
    member_phone: '+254712345007',
    platform: 'google',
    sent_at: '2026-03-20T15:00:00Z',
    status: 'no_response',
  },
];
