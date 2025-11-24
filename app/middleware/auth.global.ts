import type { ClientProfile } from '~/types/client_profile'
import type { User } from '~/types/user'

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  const store = useUserStore()
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password']
  // save in pinia store
  if (user.value) {
    const userId = user.value?.sub // This is the UUID
    store.setUser({ id: userId, email: user.value.email } as User)
    if (user.value.user_metadata?.role === 'client') {
      store.setClientProfile({
        id: userId,
        email: user.value.email,
        role: user.value.user_metadata.role,
        first_name: user.value.user_metadata.first_name,
        last_name: user.value.user_metadata.last_name,
        client_business_id: user.value.user_metadata.client_business_id
      } as ClientProfile) // Cast to any to avoid type issues
    }
  }
  // If user is not authenticated and trying to access a protected route
  if (!user.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }

  // If user is authenticated and trying to access auth pages
  if (user.value && publicRoutes.includes(to.path)) {
    return navigateTo('/')
  }
})
