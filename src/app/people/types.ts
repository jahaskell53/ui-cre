// Timeline item interface
export interface TimelineItem {
  type: 'meeting' | 'import' | 'email' | 'other';
  text: string;
  date: string;
  iconColor?: 'blue' | 'orange' | 'purple' | 'green';
}

// Person interface matching database schema
export interface Person {
  id: string;
  name: string;
  starred: boolean;
  email: string | null;
  phone: string | null;
  category: 'Property Owner' | 'Lender' | 'Realtor' | null;
  signal: boolean;
  address: string | null;
  owned_addresses?: string[];
  timeline?: TimelineItem[];
  created_at?: string;
  updated_at?: string;
}

export interface KanbanCard {
  id: string;
  personId: string;
  personName: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}
