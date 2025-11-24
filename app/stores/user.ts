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
    }
  }
})
