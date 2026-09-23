import type { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  ADMIN_KEY: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
}

export type DriverStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface Driver {
  id: number;
  name: string;
  phone: string;
  lid?: string;
  car: string;
  plate: string;
  status: DriverStatus;
  commission_pct?: number;
  active: number;
  group_jid?: string;
  created_at?: string;
}

export type RideStatus = 'NEW' | 'DISPATCHING' | 'ASSIGNED' | 'ARRIVED' | 'IN_RIDE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface Ride {
  id: number;
  client_phone: string;
  client_name?: string;
  client_offered_price?: number;
  final_price?: number;
  negotiation_state?: 'open' | 'driver_offered' | 'client_countered' | 'agreed' | 'rejected';
  driver_id: number | null;
  from_zone_id: number | null;
  to_zone_id: number | null;
  from_text: string;
  to_text: string;
  price: number;
  status: RideStatus;
  client_chat_id?: string;
  dispatch_group_jid?: string;
  created_at: string;
  updated_at?: string;
  driver_name?: string;
  driver_phone?: string;
  from_name?: string;
  to_name?: string;
}

export interface RideBid {
  id: number;
  ride_id: number;
  driver_id: number;
  driver_name: string;
  driver_phone: string;
  driver_car?: string;
  driver_plate?: string;
  offered_price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  created_at: number;
}

export interface Zone {
  id: number;
  name: string;
  belt: number;
  aliases: string;
}

export interface FixedFare {
  id: number;
  from_zone_id: number;
  to_zone_id: number;
  price: number;
  note?: string;
  from_name?: string;
  to_name?: string;
}

export interface Client {
  phone: string;
  name?: string;
  notes?: string;
  is_vip?: number;
  created_at?: string;
}

export interface Issue {
  id: number;
  ride_id?: number;
  kind: string;
  severity: 'low' | 'med' | 'high';
  detail: string;
  status: 'new' | 'acked' | 'fixed';
  created_at: string;
}
