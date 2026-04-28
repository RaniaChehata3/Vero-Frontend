export interface ForumUser {
  id: number;
  fullName: string;
  email: string;
}

export interface Post {
  id?: number;
  title: string;
  content: string;
  category: string;
  createdAt?: string;
  views?: number;
  likes?: number;
  isFlagged?: boolean;
  user?: ForumUser;
}

export interface Comment {
  id?: number;
  content: string;
  correctedContent?: string;
  createdAt?: string;
  likes?: number;
  isToxic?: boolean;
  post?: Partial<Post>;
  user?: ForumUser;
}

export interface Notification {
  id: number;
  user?: ForumUser;
  type: string;
  message: string;
  targetId?: number;
  isRead: boolean;
  createdAt: string;
}
