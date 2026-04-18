# JengaPulse Mobile — Claude Context

## Stack
React Native + Expo 52 + Expo Router (file-based) + TypeScript  
Animations: `react-native-reanimated` (entering/exiting) + `Animated` (RN built-in, width/opacity/translateY)  
Icons: `@expo/vector-icons` Ionicons  
Safe area: `react-native-safe-area-context`

## Directory layout
Note: the working directory IS the mobile app root (`c:/Users/PC/web/JengaGyms/`), NOT a `mobile/` subfolder.
```
JengaGyms/                   ← working directory root
├── app/
│   ├── _layout.tsx          # Root layout — wraps ALL providers
│   ├── (auth)/login.tsx     # Phone/email login
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab bar (Dashboard/Leads/Members/Messages/Classes/Reviews/Settings/Campaigns)
│   │   ├── index.tsx        # Dashboard — KPI cards, recent leads, review alerts
│   │   ├── leads.tsx        # Leads: kanban + list view, search, filter, add/edit modal
│   │   ├── members.tsx      # Members: list, search, filter, check-in, stats bar, add modal
│   │   ├── messages.tsx     # Multi-channel inbox (WhatsApp/SMS/Instagram/Website), open/resolved tabs
│   │   ├── classes.tsx      # Classes: day/week/month view, schedule, create/edit/delete
│   │   ├── reviews.tsx      # Reviews: filter, reply, request review flow
│   │   ├── campaigns.tsx    # Campaigns list (read-only for now)
│   │   └── settings.tsx     # Profile/billing/logout
│   ├── lead/[id].tsx        # Lead detail + activity timeline
│   ├── member/[id].tsx      # Member detail + payments + attendance
│   ├── conversation/[id].tsx
│   └── class/[id].tsx       # Class detail + attendees + waitlist
├── components/
│   ├── CreateCampaignModal.tsx  # 4-step wizard: Type→Audience→Message→Schedule; onLaunch(MockCampaign) callback
│   ├── AddClassModal.tsx    # Create/edit class bottom sheet
│   ├── AddLeadModal.tsx     # Create/edit lead form
│   ├── AddMemberModal.tsx   # Full member registration (plan, DOB, emergency contact, etc.)
│   ├── CheckInModal.tsx     # Member check-in (QR or manual)
│   ├── RecordPaymentModal.tsx
│   ├── RequestReviewModal.tsx
│   ├── LeadCard.tsx         # Compact lead display (kanban card)
│   ├── LeadItem.tsx         # Inline lead list item
│   ├── MemberCard.tsx       # Member card with plan, expiry, check-in badge
│   ├── CampaignItem.tsx     # Campaign card
│   ├── MetricCard.tsx       # KPI card (icon + label + value)
│   └── ReviewItem.tsx       # Review with stars, reply status
├── context/
│   ├── LeadsContext.tsx     # leads CRUD; 6 stages: new_lead→contacted→trial_booked→trial_completed→joined_gym→lost_lead
│   ├── MembersContext.tsx   # members + payments + attendance + checkIns; checkInMember() updates streak/total_visits
│   ├── MessagesContext.tsx  # conversations + messages + quickReplies + teamMembers; unreadCount badge
│   ├── ClassesContext.tsx   # classes + attendees + waitlist + trainers; getDerivedStatus()
│   └── ReviewsContext.tsx   # reviews + sentRequests; unansweredCount badge; replyToReview()
├── hooks/
│   ├── useCampaigns.ts
│   ├── useClient.ts
│   ├── useLeads.ts
│   └── useReviews.ts
├── lib/
│   ├── supabase.ts
│   ├── theme.ts             # colors, spacing, radius, fonts — ALWAYS import from here
│   ├── mockData.ts          # MOCK_LEADS (8 leads, all 6 stages, with activity timelines)
│   ├── mockMembers.ts       # MOCK_MEMBERS (9 members) + payments + attendance
│   ├── mockClasses.ts       # 15+ classes, 4 trainers, attendees, waitlist
│   ├── mockMessages.ts      # 10+ conversations, 3 team members, 10 quick reply templates
│   ├── mockReviews.ts       # 8+ reviews, Google/Facebook
│   ├── mockCampaigns.ts
│   └── mockReviewRequests.ts
└── supabase/schema.sql
```

## Provider wrap order (_layout.tsx)
```
MembersProvider > LeadsProvider > MessagesProvider > ClassesProvider > ReviewsProvider
```
Any new provider goes inside ReviewsProvider.

## Theme — always use these, never hardcode colors
```typescript
import { colors, spacing, radius } from '@/lib/theme';
// colors: background #0F1923 | surface #1A2533 | surfaceElevated #22303F
//         border #2A3A4A | primary #33D169 | accent #B3E84C
//         text #F0F4F8 | textSecondary #8FA3B4 | textMuted #4A6278
//         danger #FF4C4C | warning #FFB347 | success #33D169 | info #4C9FFF
// spacing: xs=4 sm=8 md=16 lg=24 xl=32
// radius:  sm=6 md=10 lg=16 full=9999
```

## Animation patterns
```typescript
// Stagger list items (reanimated):
entering={FadeInDown.delay(index * 60).springify()}

// Bottom sheet slide-up (RN Animated):
const slideAnim = useRef(new Animated.Value(700)).current;
Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();

// Bar width (useNativeDriver: false required):
width: anim.interpolate({ inputRange: [0,100], outputRange: ['0%','100%'], extrapolate: 'clamp' })

// Toast (slides from above):
const slideAnim = useRef(new Animated.Value(-80)).current;
Animated.spring(slideAnim, { toValue: visible ? 0 : -80, useNativeDriver: true }).start();

// remount trick to retrigger entering animations:
<Component key={incrementingKey} />
```

## Bottom sheet pattern
```typescript
// Always: Modal visible={sheetVisible}, backdrop Pressable onPress=onClose
// Sheet: position absolute bottom/left/right, borderTopRadius=radius.lg
// Handle: width 36, height 4, borderRadius 2, backgroundColor colors.border, alignSelf center
// Exit: animate slideAnim to 700, then setVisible(false) in callback
```

## MockReview type
```typescript
{ id, reviewer_name, rating (1-5), content, platform ('google'|'facebook'),
  replied, reply_text?, resolved?, created_at (ISO) }
```

## Member type (key fields)
```typescript
{ id, name, phone, email, status ('active'|'inactive'|'expired'|'frozen'),
  plan_label, last_visit_at (ISO|null), streak, total_visits }
```

## Tab badges
- Messages tab: red badge from `useMessagesContext().unreadCount`
- Reviews tab: orange badge from `useReviewsContext().unansweredCount`

## Key git info
- Repo: anthonynjenga2020/jengasystems
- Branch: claude/build-mobile-app-HEPYM
- Dev: `npx expo start` (run from `c:/Users/PC/web/JengaGyms/`)
