<script setup lang="ts">
const colorMode = useColorMode()
const userStore = useUserStore()
const supabase = useSupabaseClient()

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

// Fetch client profile on app initialization and auth changes
onMounted(async () => {
  // Ensure we have a session before fetching profile
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await userStore.fetchClientProfile()
    console.log('Client Profile on Mount:', userStore.clientProfile)
  }
})

// Watch for auth state changes and refetch profile
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', event, !!session)
  if (event === 'SIGNED_IN' && session) {
    await userStore.fetchClientProfile()
  } else if (event === 'SIGNED_OUT') {
    userStore.clearUser()
  } else if (event === 'TOKEN_REFRESHED' && session) {
    // Also fetch profile on token refresh to ensure data is up to date
    await userStore.fetchClientProfile()
  }
})

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Nuxt Dashboard Template'
const description = 'A professional dashboard template built with Nuxt UI, featuring multiple pages, data visualization, and comprehensive management capabilities for creating powerful admin interfaces.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/dashboard-light.png',
  twitterImage: 'https://ui.nuxt.com/assets/templates/nuxt/dashboard-light.png',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
