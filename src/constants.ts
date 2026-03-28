import { User, Post, Resource, Message } from './types';

export const MOCK_USERS: Record<string, User> = {
  me: {
    id: 'me',
    name: 'Alex Sterling',
    handle: 'alex.s',
    role: 'Director of Carbon Strategy',
    company: 'Decarb Global',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
  },
  sarah: {
    id: 'sarah',
    name: 'Sarah Lee',
    handle: 'sarah.l',
    role: 'Sustainability Architect',
    company: 'Vertex',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    isOnline: true,
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus Lee',
    handle: 'marcus.l',
    role: 'Environmental Entrepreneur',
    company: 'EcoStream',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
  },
  elena: {
    id: 'elena',
    name: 'Elena Thorne',
    handle: 'elena.t',
    role: 'Lead Systems Architect',
    company: 'EcoLogix',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
    isOnline: true,
    isVerified: true,
    bio: 'Building the next generation of modular carbon sequestration units. Looking to connect with supply chain experts in EMEA.',
    tags: ['Carbon Capture', 'SaaS Scaleup', 'Venture Capital'],
    linkedin: 'linkedin.com/in/elenathorne',
    twitter: 'x.com/elenathorne',
  },
  julian: {
    id: 'julian',
    name: 'Julian Voss',
    handle: 'julian.v',
    role: 'Carbon Credits Lead',
    company: 'TerraFlow',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
  },
};

export const MOCK_POSTS: Post[] = [
  {
    id: '1',
    author: MOCK_USERS.sarah,
    content: "Excited to share our progress on the new solar thermal facility. We're hitting 45% more efficiency than last year's pilot. The future of industrial heat is looking brighter. #Decarbonization #CleanTech",
    media: 'https://images.unsplash.com/photo-1509391366360-fe5bb60213ad?w=800&h=600&fit=crop',
    mediaType: 'image',
    likes: 1200,
    comments: 84,
    timestamp: '2h ago',
  },
  {
    id: '2',
    author: MOCK_USERS.julian,
    content: "Verified nature-based solutions are finally getting the oversight they deserve. We've just integrated new satellite monitoring for our Brazilian projects. Transparency is the only way forward.",
    media: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=600&fit=crop',
    mediaType: 'image',
    likes: 452,
    comments: 12,
    timestamp: '5h ago',
  },
];

export const MOCK_RESOURCES: Resource[] = [
  {
    id: 'r1',
    title: 'Decarbonizing Heavy Industry',
    description: 'A deep dive into CCUS technologies and implementation strategies for 2024.',
    type: 'Video',
    category: 'Advanced',
    author: 'Dr. Elena Thorne',
    duration: '45 min',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop',
  },
  {
    id: 'r2',
    title: 'ESG Reporting Automation',
    description: 'Leveraging AI to streamline compliance and environmental impact tracking.',
    type: 'Video',
    category: 'Strategy',
    author: 'Marcus Lee',
    duration: '32 min',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop',
  },
  {
    id: 'r3',
    title: 'Global Carbon Market Outlook Q3 2024',
    description: '128 Pages • PDF • 14.2 MB',
    type: 'Report',
    category: 'Quarterly Analysis',
    author: 'Alex Sterling',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop',
  },
  {
    id: 'r4',
    title: 'Green Hydrogen: Scaling for Infrastructure',
    description: '45 Pages • PDF • 8.7 MB',
    type: 'Report',
    category: 'Technical Whitepaper',
    author: 'Sarah Lee',
    image: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=800&h=500&fit=crop',
  },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    sender: { ...MOCK_USERS.sarah, name: 'Alex Robinson' }, // Matching image name
    lastMessage: "Great talking about the new decarbonization project! Let's sync...",
    timestamp: 'JUST NOW',
    isUnread: true,
  },
  {
    id: 'm2',
    sender: MOCK_USERS.marcus,
    lastMessage: "The feedback from the board was very positive. Next steps are confirmed.",
    timestamp: '2H AGO',
  },
  {
    id: 'm3',
    sender: MOCK_USERS.elena,
    lastMessage: "Attached is the PDF for the connectivity roadmap we discussed.",
    timestamp: 'YESTERDAY',
  },
];
