export interface User {
  id: string;
  name: string;
  handle: string;
  role: string;
  company: string;
  avatar: string;
  isOnline?: boolean;
  isVerified?: boolean;
  bio?: string;
  tags?: string[];
  linkedin?: string;
  twitter?: string;
  onboarded?: boolean;
  isAdmin?: boolean;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  media?: string;
  mediaType?: 'image' | 'video';
  likes: number;
  comments: number;
  timestamp: string;
  isSponsored?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  timestamp: any;
  isEdited?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  type: 'Video' | 'Report' | 'Insight';
  category: string;
  author: string;
  duration?: string;
  stats?: string;
  image?: string;
  icon?: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  speaker?: string;
  room?: string;
  track?: string;
  starts_at: string;
  ends_at: string;
  created_at?: string;
}

export interface Question {
  id: string;
  event_id: string;
  author_id: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  upvotes: number;
  is_highlighted: boolean;
  created_at?: string;
}
