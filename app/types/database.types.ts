export type Database = {
  public: {
    Tables: {
      booking: {
        Row: {
          id: string
          created_at: string
          booking_date: string
          booking_time: string
          status: string
          customer_id: string
          service_id: string
          employee_id: string
          client_profile_id: string
          client_business_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          booking_date: string
          booking_time: string
          status?: string
          customer_id: string
          service_id: string
          employee_id: string
          client_profile_id: string
          client_business_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          booking_date?: string
          booking_time?: string
          status?: string
          customer_id?: string
          service_id?: string
          employee_id?: string
          client_profile_id?: string
          client_business_id?: string | null
          notes?: string | null
        }
      }
      service: {
        Row: {
          id: string
          name: string
          price: number
          duration: number | null
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          price: number
          duration?: number | null
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          price?: number
          duration?: number | null
          description?: string | null
        }
      }
      client_profile: {
        Row: {
          id: string
          user_id: string
          email: string
          first_name: string
          last_name: string
          role: string
          client_business_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          first_name: string
          last_name: string
          role?: string
          client_business_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: string
          client_business_id?: string | null
          created_at?: string
        }
      }
      employee: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string
          role: string
          is_active: boolean
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          email: string
          role: string
          is_active?: boolean
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string
          role?: string
          is_active?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
