export type ClientProfile = {
  id: string // uuid
  created_at: string // timestamp with time zone
  email?: string
  password?: string
  role?: string
  address?: string
  first_name?: string
  last_name?: string
  profile_picture?: string // now text (URL)
  client_business_id?: string // uuid
}
