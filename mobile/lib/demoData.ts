import type { User, Post, Event, Resource } from './types';

export const DEMO_USERS: User[] = [
  { id: 'demo-user-002', name: 'Maya Chen', handle: 'mayachen', role: 'Head of Clean Energy', company: 'GreenGrid Solutions', avatar: 'https://picsum.photos/seed/demo2/200/200', bio: 'Building the next generation of renewable energy infrastructure.', tags: ['Renewable Energy', 'Grid Storage', 'Policy'], isOnline: true, isVerified: true },
  { id: 'demo-user-003', name: 'James Okafor', handle: 'jamesokafor', role: 'VP Sustainability', company: 'SteelPath Industries', avatar: 'https://picsum.photos/seed/demo3/200/200', bio: 'Decarbonizing heavy industry through process innovation and green hydrogen.', tags: ['Green Hydrogen', 'Heavy Industry', 'Circular Economy'], isOnline: false, isVerified: true },
  { id: 'demo-user-004', name: 'Elena Rodriguez', handle: 'elenarodriguez', role: 'Climate Policy Director', company: 'EU Green Deal Office', avatar: 'https://picsum.photos/seed/demo4/200/200', bio: 'Shaping regulatory frameworks for industrial decarbonization across Europe.', tags: ['Policy & Regulation', 'Carbon Markets', 'ESG Reporting'], isOnline: true, isVerified: false },
  { id: 'demo-user-005', name: 'Raj Patel', handle: 'rajpatel', role: 'CTO', company: 'CarbonCapture.ai', avatar: 'https://picsum.photos/seed/demo5/200/200', bio: 'AI-powered direct air capture. Making negative emissions scalable and affordable.', tags: ['Carbon Capture', 'AI/ML', 'Deep Tech'], isOnline: false, isVerified: true },
  { id: 'demo-user-006', name: 'Sofia Lindqvist', handle: 'sofialindqvist', role: 'Investment Partner', company: 'Nordic Climate Ventures', avatar: 'https://picsum.photos/seed/demo6/200/200', bio: 'Backing the boldest climate tech founders. $500M deployed into industrial decarb.', tags: ['Venture Capital', 'Green Finance', 'Cleantech'], isOnline: true, isVerified: true },
];

export const DEMO_POSTS: (Post & { author: User })[] = [
  {
    id: 'post-001', content: 'Just closed a $12M Series A for direct air capture technology. The industrial decarbonization space is heating up — pun intended. Grateful for everyone at the summit who made introductions happen.', likes: 24, comments: 8, timestamp: '2 hours ago', author: DEMO_USERS[3],
  },
  {
    id: 'post-002', content: 'Key insight from today\'s panel: Green hydrogen won\'t reach cost parity by 2030 without massive policy intervention. The technology is ready, the economics aren\'t. We need carbon border adjustments NOW.', likes: 47, comments: 15, timestamp: '4 hours ago', author: DEMO_USERS[1],
  },
  {
    id: 'post-003', content: 'Excited to announce our new partnership with SteelPath Industries on a pilot green hydrogen plant in Rotterdam. This is what summits like this are for — turning conversations into action.', likes: 62, comments: 21, timestamp: '6 hours ago', author: DEMO_USERS[0],
    media: 'https://picsum.photos/seed/postmedia1/800/600', mediaType: 'image',
  },
  {
    id: 'post-004', content: 'The EU Carbon Border Adjustment Mechanism enters its permanent phase next year. If your company isn\'t preparing now, you\'re already behind. Happy to connect with anyone who needs guidance on compliance.', likes: 35, comments: 12, timestamp: '8 hours ago', author: DEMO_USERS[2],
  },
  {
    id: 'post-005', content: 'We just published our annual State of Industrial Decarbonization report. TL;DR: Progress is real but too slow. Heavy industry emissions are down 4% YoY, but we need 8% to hit 2035 targets.', likes: 89, comments: 34, timestamp: '1 day ago', author: DEMO_USERS[4],
  },
];

export const DEMO_CONVERSATIONS = [
  { id: 'conv-001', otherUser: DEMO_USERS[0], lastMessage: 'Looking forward to your keynote tomorrow!', timestamp: '10:30 AM', isUnread: true },
  { id: 'conv-002', otherUser: DEMO_USERS[3], lastMessage: 'Can we set up a follow-up call about the DAC partnership?', timestamp: '9:15 AM', isUnread: true },
  { id: 'conv-003', otherUser: DEMO_USERS[4], lastMessage: 'Thanks for the intro to the Nordic team. Great people.', timestamp: 'Yesterday', isUnread: false },
  { id: 'conv-004', otherUser: DEMO_USERS[1], lastMessage: 'The hydrogen panel slot is confirmed for 2pm.', timestamp: 'Yesterday', isUnread: false },
];

export const DEMO_MESSAGES = [
  { id: 'msg-001', content: 'Hey Alex! Really enjoyed your talk on CCUS scaling challenges.', sender: 'them' as const, time: '9:00 AM', isRead: true },
  { id: 'msg-002', content: 'Thanks Maya! Your work on grid storage is exactly what we need for the capture-to-storage pipeline.', sender: 'me' as const, time: '9:05 AM', isRead: true },
  { id: 'msg-003', content: 'We should explore a pilot together. GreenGrid has spare capacity in our Rotterdam facility.', sender: 'them' as const, time: '9:12 AM', isRead: true },
  { id: 'msg-004', content: 'That would be incredible. Let me loop in our engineering team. Free for coffee tomorrow at 10?', sender: 'me' as const, time: '9:15 AM', isRead: true },
  { id: 'msg-005', content: 'Looking forward to your keynote tomorrow!', sender: 'them' as const, time: '10:30 AM', isRead: false },
];

export const DEMO_EVENTS: Event[] = [
  { id: 'evt-001', title: 'Opening Keynote: The State of Industrial Decarbonization', speaker: 'Dr. Sarah Mitchell', room: 'Main Hall', track: 'Keynote', starts_at: new Date(Date.now() + 3600000).toISOString(), ends_at: new Date(Date.now() + 7200000).toISOString(), description: 'A comprehensive overview of where industrial decarbonization stands in 2026, the gaps we need to close, and the technologies that will get us there.' },
  { id: 'evt-002', title: 'Green Hydrogen: From Pilot to Scale', speaker: 'James Okafor & Maya Chen', room: 'Room A', track: 'Energy', starts_at: new Date(Date.now() + 10800000).toISOString(), ends_at: new Date(Date.now() + 14400000).toISOString(), description: 'Panel discussion on the practical challenges and breakthroughs in scaling green hydrogen for heavy industry.' },
  { id: 'evt-003', title: 'Carbon Capture Economics in 2026', speaker: 'Raj Patel', room: 'Room B', track: 'Technology', starts_at: new Date(Date.now() + 10800000).toISOString(), ends_at: new Date(Date.now() + 14400000).toISOString(), description: 'Deep dive into the latest cost curves for DAC and point-source capture, and what it takes to reach commercial viability.' },
  { id: 'evt-004', title: 'EU CBAM: Compliance Workshop', speaker: 'Elena Rodriguez', room: 'Workshop Room', track: 'Policy', starts_at: new Date(Date.now() + 18000000).toISOString(), ends_at: new Date(Date.now() + 21600000).toISOString(), description: 'Hands-on workshop on preparing for the EU Carbon Border Adjustment Mechanism permanent phase.' },
  { id: 'evt-005', title: 'Climate Tech Venture Landscape', speaker: 'Sofia Lindqvist', room: 'Room A', track: 'Finance', starts_at: new Date(Date.now() + 25200000).toISOString(), ends_at: new Date(Date.now() + 28800000).toISOString(), description: 'Where is climate VC money flowing? What sectors are overfunded vs underfunded? How to position your startup.' },
  { id: 'evt-006', title: 'Networking Dinner', speaker: undefined, room: 'Rooftop Terrace', track: 'Social', starts_at: new Date(Date.now() + 32400000).toISOString(), ends_at: new Date(Date.now() + 39600000).toISOString(), description: 'Informal dinner for all summit attendees. Connect over food and drinks with a view of the city.' },
];

export const DEMO_RESOURCES: Resource[] = [
  { id: 'res-001', title: 'State of Industrial Decarbonization 2026', description: 'Comprehensive annual report covering emissions trends, technology readiness, and policy developments across heavy industry sectors.', type: 'Report', category: 'Annual Report', author: 'Decarb Research Institute', image: 'https://picsum.photos/seed/res1/800/600' },
  { id: 'res-002', title: 'Green Hydrogen Masterclass', description: 'From electrolysis fundamentals to infrastructure scaling — everything you need to know about green hydrogen in heavy industry.', type: 'Video', category: 'Masterclass', author: 'Dr. James Okafor', duration: '45 min', image: 'https://picsum.photos/seed/res2/800/600' },
  { id: 'res-003', title: 'CBAM Compliance Checklist', description: 'Step-by-step guide for companies preparing for the EU Carbon Border Adjustment Mechanism.', type: 'Report', category: 'Compliance', author: 'EU Green Deal Office', image: 'https://picsum.photos/seed/res3/800/600' },
  { id: 'res-004', title: 'Direct Air Capture: Technology Deep Dive', description: 'Technical overview of current DAC approaches, energy requirements, and cost reduction pathways.', type: 'Video', category: 'Technology', author: 'Raj Patel', duration: '32 min', image: 'https://picsum.photos/seed/res4/800/600' },
  { id: 'res-005', title: 'Climate Tech Investment Trends Q1 2026', description: 'Analysis of venture capital flows into climate tech, with focus on industrial decarbonization startups.', type: 'Insight', category: 'Market Analysis', author: 'Nordic Climate Ventures', image: 'https://picsum.photos/seed/res5/800/600' },
];
