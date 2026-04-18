# JengaPulse Mobile — Claude Context

## Stack
React Native + Expo 52 + Expo Router (file-based) + TypeScript  
Animations: `react-native-reanimated` (entering/exiting) + `Animated` (RN built-in, width/opacity/translateY)  
Icons: `@expo/vector-icons` Ionicons  
Safe area: `react-native-safe-area-context`

## Directory layout
```
mobile/
├── app/
│   ├── _layout.tsx          # Root layout — wraps ALL providers
│   ├── (auth)/login.tsx     # Phone/email login
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab bar (Dashboard/Leads/Members/Messages/Classes/Reviews/Settings)
│   │   ├── index.tsx        # Dashboard
│   │   ├── leads.tsx        # Leads list + pipeline
│   │   ├── members.tsx      # Members list
│   │   ├── messages.tsx     # Multi-channel inbox
│   │   ├── classes.tsx      # Classes: day view + week grid + search + filter sheet
│   │   ├── reviews.tsx      # Reviews: summary card + filter + reply sheet + request flow
│   │   └── settings.tsx     # Profile/billing/logout
│   ├── lead/[id].tsx        # Lead detail
│   ├── member/[id].tsx      # Member detail
│   ├── conversation/[id].tsx
│   └── class/[id].tsx       # Class detail + attendees + waitlist
├── components/
│   └── AddClassModal.tsx    # Add/edit class bottom sheet
├── context/
│   ├── LeadsContext.tsx
│   ├── MembersContext.tsx   # Member type has: id, name, phone, email, status, last_visit_at, plan_label
│   ├── MessagesContext.tsx  # unreadCount for tab badge
│   ├── ClassesContext.tsx   # GymClass, ClassAttendee, WaitlistEntry; getDerivedStatus()
│   └── ReviewsContext.tsx   # MockReview, unansweredCount, replyToReview(id, text, resolved)
├── lib/
│   ├── supabase.ts
│   ├── theme.ts             # colors, spacing, radius, fonts — ALWAYS import from here
│   ├── mockMembers.ts       # MOCK_MEMBERS array (Member[])
│   └── mockReviews.ts       # MOCK_REVIEWS (MockReview[]) — 14 reviews, Google/Facebook
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
- Dev: `cd mobile && npx expo start`
