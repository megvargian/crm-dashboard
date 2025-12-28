export interface Booking {
  id: string
  client_id: string
  employee_id: string
  service_id: string
  booking_date: string // ISO date string
  start_time: string // HH:mm format
  end_time: string // HH:mm format
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  total_price: number
  notes?: string
  created_at: string
  updated_at: string

  // Populated relations
  client_profile?: {
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
  client_id: string
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
