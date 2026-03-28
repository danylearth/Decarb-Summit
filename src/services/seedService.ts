import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';

const DEMO_USERS = [
  {
    id: 'sarah',
    name: 'Sarah Lee',
    handle: 'sarah.l',
    role: 'Sustainability Architect',
    company: 'Vertex',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    isOnline: true,
    onboarded: true,
    bio: 'Pioneering corporate sustainability strategies for the next generation.',
    tags: ['Sustainability', 'ESG', 'Strategy']
  },
  {
    id: 'marcus',
    name: 'Marcus Lee',
    handle: 'marcus.l',
    role: 'Environmental Entrepreneur',
    company: 'EcoStream',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    onboarded: true,
    bio: 'Building the infrastructure for a carbon-negative future.',
    tags: ['CCUS', 'Engineering', 'ClimateTech']
  },
  {
    id: 'elena',
    name: 'Elena Thorne',
    handle: 'elena.t',
    role: 'Lead Systems Architect',
    company: 'EcoLogix',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop',
    isOnline: true,
    isVerified: true,
    onboarded: true,
    bio: 'Building the next generation of modular carbon sequestration units. Looking to connect with supply chain experts in EMEA.',
    tags: ['Carbon Capture', 'SaaS Scaleup', 'Venture Capital']
  },
  {
    id: 'julian',
    name: 'Julian Voss',
    handle: 'julian.v',
    role: 'Carbon Credits Lead',
    company: 'TerraFlow',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    onboarded: true
  }
];

const DEMO_POSTS = [
  {
    authorId: 'sarah',
    content: "Excited to share our progress on the new solar thermal facility. We're hitting 45% more efficiency than last year's pilot. The future of industrial heat is looking brighter. #Decarbonization #CleanTech",
    media: 'https://images.unsplash.com/photo-1509391366360-fe5bb60213ad?w=800&h=600&fit=crop',
    mediaType: 'image',
    likes: 1200,
    comments: 84
  },
  {
    authorId: 'julian',
    content: "Verified nature-based solutions are finally getting the oversight they deserve. We've just integrated new satellite monitoring for our Brazilian projects. Transparency is the only way forward.",
    media: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=600&fit=crop',
    mediaType: 'image',
    likes: 452,
    comments: 12
  },
  {
    authorId: 'elena',
    content: "Just finished the blueprint for the new modular CCUS units. Scalability is no longer a dream, it's a roadmap. #ClimateTech #CCUS #Engineering",
    media: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop',
    mediaType: 'image',
    likes: 890,
    comments: 45
  }
];

const DEMO_RESOURCES = [
  {
    title: 'Decarbonizing Heavy Industry',
    description: 'A deep dive into CCUS technologies and implementation strategies for 2024.',
    type: 'Video',
    category: 'Advanced',
    author: 'Dr. Elena Thorne',
    duration: '45 min',
    stats: '12k views',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop',
    icon: 'Play'
  },
  {
    title: 'ESG Reporting Automation',
    description: 'Leveraging AI to streamline compliance and environmental impact tracking.',
    type: 'Video',
    category: 'Strategy',
    author: 'Marcus Lee',
    duration: '32 min',
    stats: '8k views',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop',
    icon: 'Play'
  },
  {
    title: 'Global Carbon Market Outlook Q3 2024',
    description: '128 Pages • PDF • 14.2 MB',
    type: 'Report',
    category: 'Quarterly Analysis',
    author: 'Alex Sterling',
    duration: '128 pages',
    stats: '5k downloads',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop',
    icon: 'FileText'
  }
];

export async function seedDemoData() {
  console.log('Seeding demo data...');

  try {
    // 1. Seed Users
    for (const user of DEMO_USERS) {
      await setDoc(doc(db, 'users', user.id), user);
    }

    // 2. Seed Posts
    for (const post of DEMO_POSTS) {
      await addDoc(collection(db, 'posts'), {
        ...post,
        timestamp: serverTimestamp()
      });
    }

    // 3. Seed Resources
    for (const resource of DEMO_RESOURCES) {
      await addDoc(collection(db, 'resources'), resource);
    }

    console.log('Seeding complete!');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seeding');
  }
}
