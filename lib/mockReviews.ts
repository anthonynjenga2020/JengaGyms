export interface MockReview {
  id: string;
  reviewer_name: string;
  rating: number;
  content: string;
  platform: 'google' | 'facebook';
  replied: boolean;
  reply_text?: string;
  resolved?: boolean;
  created_at: string; // ISO 8601
}

export const MOCK_REVIEWS: MockReview[] = [
  {
    id: 'r1',
    reviewer_name: 'George Kimani',
    rating: 5,
    platform: 'google',
    content:
      'Absolutely love this gym! The trainers are professional and motivating, the equipment is well maintained, and the atmosphere is incredibly positive. I have seen massive improvements in my fitness since joining. Highly recommend to anyone looking to transform their health.',
    replied: true,
    reply_text:
      "Thank you so much George! We're thrilled to hear about your progress. Your dedication and hard work truly makes a difference. See you at the next session!",
    created_at: '2026-04-14T09:30:00Z',
  },
  {
    id: 'r2',
    reviewer_name: 'Sarah Mwangi',
    rating: 4,
    platform: 'google',
    content:
      'Great facilities and friendly staff. The group classes are a lot of fun and the instructors really push you. Only minor issue is parking can be tight during peak hours.',
    replied: false,
    created_at: '2026-04-12T14:15:00Z',
  },
  {
    id: 'r3',
    reviewer_name: 'David Ochieng',
    rating: 5,
    platform: 'facebook',
    content:
      'Best gym in Nairobi, hands down. The equipment is top notch and always clean. I especially love the early morning sessions — great way to start the day. The trainers know their stuff and create programs tailored specifically to your goals.',
    replied: true,
    reply_text:
      'Thank you David! We are proud of our early morning crew. Keep up the great work and we look forward to helping you hit your goals!',
    created_at: '2026-04-10T07:45:00Z',
  },
  {
    id: 'r4',
    reviewer_name: 'Amina Hassan',
    rating: 5,
    platform: 'google',
    content:
      'I was hesitant to join a gym but the team here made me feel so welcome from day one. The personal training sessions have been life changing. Lost 8kg in 3 months!',
    replied: false,
    created_at: '2026-04-08T11:00:00Z',
  },
  {
    id: 'r5',
    reviewer_name: 'Brian Otieno',
    rating: 3,
    platform: 'google',
    content:
      'Decent gym overall. Equipment is good but some of the older machines need servicing. Staff is helpful when you ask for assistance. Would appreciate better air conditioning — gets quite hot in the afternoons.',
    replied: false,
    created_at: '2026-04-05T16:30:00Z',
  },
  {
    id: 'r6',
    reviewer_name: 'Lucy Njeri',
    rating: 5,
    platform: 'facebook',
    content:
      'Joined 6 months ago and the transformation has been incredible. The trainers are so knowledgeable and caring. The classes are well structured and challenging. Best decision I made for my health.',
    replied: true,
    reply_text:
      "Lucy, your journey has been truly inspiring! 6 months of consistency and hard work — you should be so proud. We're honoured to be part of it!",
    created_at: '2026-04-03T10:20:00Z',
  },
  {
    id: 'r7',
    reviewer_name: 'Peter Kamau',
    rating: 4,
    platform: 'google',
    content:
      'Really good gym. The HIIT classes are my favourite and the trainer always brings high energy. Shower facilities could be improved — hot water is sometimes inconsistent.',
    replied: false,
    created_at: '2026-03-28T08:00:00Z',
  },
  {
    id: 'r8',
    reviewer_name: 'Grace Wanjiku',
    rating: 5,
    platform: 'google',
    content:
      'I love this place so much. The community here is unmatched. Everyone is supportive and you always feel motivated. The trainers check in on your progress regularly. 10/10 would recommend.',
    replied: true,
    reply_text:
      'Grace, thank you for the beautiful words! Our community is everything and members like you make it so special. See you at the next class!',
    created_at: '2026-03-22T13:45:00Z',
  },
  {
    id: 'r9',
    reviewer_name: 'James Muthoni',
    rating: 2,
    platform: 'facebook',
    content:
      'Mixed experience. The gym itself is nice but I felt the personal training sessions were rushed and the trainer was not always focused. Price point is also a bit high for what is offered. Would reconsider if improvements are made.',
    replied: false,
    created_at: '2026-03-18T15:00:00Z',
  },
  {
    id: 'r10',
    reviewer_name: 'Faith Akinyi',
    rating: 5,
    platform: 'google',
    content:
      'This gym has completely changed my lifestyle. I went from barely being able to run for 5 minutes to completing a 10km race last month! The coaches are extraordinary and the supportive environment keeps me coming back every single day.',
    replied: false,
    created_at: '2026-03-14T09:00:00Z',
  },
  {
    id: 'r11',
    reviewer_name: 'Kevin Mutua',
    rating: 4,
    platform: 'google',
    content:
      "Solid gym with good variety of equipment. The booking system for classes works well. Would love to see more yoga and pilates classes added to the timetable.",
    replied: true,
    reply_text:
      "Thanks Kevin! We're actually adding yoga to the schedule next month — stay tuned for the announcement!",
    created_at: '2026-03-10T12:30:00Z',
  },
  {
    id: 'r12',
    reviewer_name: 'Monica Chebet',
    rating: 5,
    platform: 'facebook',
    content:
      'Phenomenal gym experience. Clean, modern equipment, brilliant coaches, and a welcoming community. I drive past two other gyms just to come here. Worth every shilling.',
    replied: false,
    created_at: '2026-03-05T17:00:00Z',
  },
  {
    id: 'r13',
    reviewer_name: 'Samuel Kiprop',
    rating: 1,
    platform: 'google',
    content:
      'Very disappointed with my experience. Signed up for a personal training package but the sessions were cancelled multiple times without notice. When I requested a refund I was given the runaround for weeks. Not impressed.',
    replied: false,
    created_at: '2026-02-28T10:45:00Z',
  },
  {
    id: 'r14',
    reviewer_name: 'Esther Wambua',
    rating: 4,
    platform: 'facebook',
    content:
      'Really enjoying my membership here. The spinning classes are intense and effective. Friendly atmosphere and the coaches are always willing to help with form. Parking is the only downside.',
    replied: false,
    created_at: '2026-02-20T14:00:00Z',
  },
];
