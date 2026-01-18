// Timeline item interface
export interface TimelineItem {
  type: 'meeting' | 'import' | 'email' | 'other';
  text: string;
  date: string;
  iconColor?: 'blue' | 'orange' | 'purple' | 'green';
}

// Geo address interface
export interface GeoAddress {
  address: string;
  latitude: number | null;
  longitude: number | null;
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
  address_latitude: number | null;
  address_longitude: number | null;
  owned_addresses?: string[];
  owned_addresses_geo?: GeoAddress[];
  timeline?: TimelineItem[];
  bio: string | null;
  birthday: string | null;
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
