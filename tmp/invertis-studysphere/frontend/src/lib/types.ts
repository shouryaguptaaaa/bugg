export type Role = 'super_admin' | 'admin' | 'content_manager' | 'student';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'suspended';
  enrollmentNo?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Ref { _id: string; name: string; code?: string }

export interface Material {
  _id: string;
  title: string;
  description: string;
  subject?: Ref & { code?: string };
  module?: Ref;
  category?: Ref;
  semester?: { _id: string; number: number; name: string };
  branch?: Ref;
  course?: Ref;
  academicYear?: string;
  examType?: string;
  tags: string[];
  file: { originalName: string; mimeType: string; ext: string; size: number };
  uploadedBy?: { _id: string; name: string };
  status: 'draft' | 'pending' | 'published' | 'rejected';
  rejectionReason?: string;
  publishAt?: string;
  featured: boolean;
  views: number;
  downloads: number;
  versions?: { replacedAt: string; originalName?: string; size?: number; note?: string }[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> { items: T[]; total: number; page: number; pages: number }

export interface Settings {
  siteName: string;
  tagline: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerCredit: string;
  allowRegistration: boolean;
  company: {
    name: string; tagline: string; kind: string; description: string; founder: string; founderTitle: string;
    website: string; email: string; phone: string; logoUrl: string;
    portfolio: { name?: string; description?: string; url?: string }[];
  };
}
