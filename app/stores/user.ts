import { defineStore } from 'pinia'
import type { ClientProfile } from '~/types/client_profile'
import type { User } from '~/types/user'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: {
      id: '', // uuid
      created_at: '', // timestamp with time zone
      email: '',
      display_name: ''
    } as User | null,
    clientProfile: {
      id: '', // uuid
      created_at: '', // timestamp with time zone
      email: '',
      password: '',
      role: '',
      address: '',
      first_name: '',
      last_name: '',
      profile_picture: '', // now text (URL)
      client_business_id: '' // uuid
    } as ClientProfile | null
  }),
  actions: {
    setUser(userData: ClientProfile) {
      this.user = userData
    },
    setClientProfile(profile: ClientProfile) {
      this.clientProfile = profile
    },
    clearUser() {
      this.user = {} as ClientProfile | null
      this.clientProfile = null
    },
    isProfileLoaded() {
      return this.clientProfile && this.clientProfile.id
    },
    async fetchClientProfile(forceRefresh = false) {
      const supabase = useSupabaseClient()

      // Skip if already loaded and not forcing refresh
      if (!forceRefresh && this.isProfileLoaded()) {
        console.log('Profile already loaded, skipping fetch')
        return this.clientProfile
      }

      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          console.log('No active session')
          return null
        }

        console.log('Fetching client profile from API...')

        // Call the get-client-profile API
        const response = await fetch('/api/client-profile/get-client-profile', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Profile fetch failed:', errorData)
          throw new Error(errorData.statusMessage || 'Failed to fetch client profile')
        }

        const result = await response.json()

        if (result.profile) {
          this.setClientProfile(result.profile)
          console.log('Client profile loaded successfully:', result.profile)
          return result.profile
        } else {
          console.warn('No profile data in response')
          return null
        }
      } catch (error) {
        console.error('Failed to fetch client profile:', error)
        return null
      }
    }
  }
})
