import type { ClientProfile } from '~/types/client_profile'
import type { User } from '~/types/user'

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  const store = useUserStore()
  const supabase = useSupabaseClient()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/book']

  // Check if the route path starts with /book/ (dynamic booking pages)
  const isBookingRoute = to.path.startsWith('/book/')

  // If user is authenticated, ensure we have the latest profile
  if (user.value) {
    const userId = user.value?.sub // This is the UUID
    store.setUser({ id: userId, email: user.value.email } as User)

    // Fetch the full client profile from API to get user_type and role
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && !store.clientProfile) {
        // Only fetch if we don't have profile data yet
        await store.fetchClientProfile()
      }
    } catch (error) {
      console.error('Failed to fetch profile in middleware:', error)
    }

    // Fallback: set profile from user metadata if available
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
  if (!user.value && !publicRoutes.includes(to.path) && !isBookingRoute) {
    return navigateTo('/login')
  }

  // If user is authenticated and trying to access auth pages (but allow booking pages)
  if (user.value && publicRoutes.includes(to.path) && to.path !== '/book' && !isBookingRoute) {
    return navigateTo('/')
  }
})
