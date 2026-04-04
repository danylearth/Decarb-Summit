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

export interface Message {
  id: string;
  sender: User;
  lastMessage: string;
  timestamp: string;
  isUnread?: boolean;
}
