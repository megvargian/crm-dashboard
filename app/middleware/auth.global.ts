export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password']

  // If user is not authenticated and trying to access a protected route
  if (!user.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }

  // If user is authenticated and trying to access auth pages
  if (user.value && publicRoutes.includes(to.path)) {
    return navigateTo('/')
  }
})
