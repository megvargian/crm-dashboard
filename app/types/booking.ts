export interface Booking {
  id: string
  client_profile_id: string
  client_business_id?: string
  customer_id: string
  employee_id: string
  service_id: string
  booking_date: string // ISO date string
  start_time: string // ISO timestamp string
  end_time: string // ISO timestamp string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  total_price: number
  notes?: string
  created_at: string
  updated_at: string

  // Populated relations
  client_profile?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  employee?: {
    first_name: string
    last_name: string
    email: string
  }
  service?: {
    name: string
    price: number
    duration_service_in_s: number
  }
}

export interface CreateBookingData {
  customer_id: string
  client_profile_id: string
  client_business_id?: string
  employee_id: string
  service_id: string
  booking_date: string
  start_time: string
  notes?: string
}

export interface UpdateBookingData {
  employee_id?: string
  service_id?: string
  booking_date?: string
  start_time?: string
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string
}
