<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()

// Ensure profile is loaded when accessing settings
onMounted(async () => {
  if (!userStore.isProfileLoaded()) {
    console.log('Profile not loaded in settings, fetching...')
    await userStore.fetchClientProfile()
  }
})

// Watch for profile changes
watch(() => userStore.clientProfile, (newProfile) => {
  console.log('Profile changed in settings:', newProfile)
}, { immediate: true, deep: true })

// Base navigation items
const baseLinks = [[{
  label: 'General',
  icon: 'i-lucide-user',
  to: '/settings',
  exact: true
}, {
  label: 'Calendar',
  icon: 'i-lucide-calendar',
  to: '/settings/calendar'
}, {
  label: 'Services',
  icon: 'i-lucide-wrench',
  to: '/settings/services'
}, {
  label: 'Employees',
  icon: 'i-lucide-users',
  to: '/settings/employees'
}, {
  label: 'Notifications',
  icon: 'i-lucide-bell',
  to: '/settings/notifications'
}, {
  label: 'Security',
  icon: 'i-lucide-shield',
  to: '/settings/security'
}], [{
  label: 'Documentation',
  icon: 'i-lucide-book-open',
  to: 'https://ui.nuxt.com/docs/getting-started/installation/nuxt',
  target: '_blank'
}]]

// Filter navigation based on user role and type
const links = computed(() => {
  console.log('Computing links...')
  console.log('User profile:', userStore.clientProfile)
  console.log('User role:', userStore.clientProfile?.role)
  console.log('User type:', userStore.clientProfile?.user_type)

  const filteredLinks = baseLinks.map(group =>
    group.filter((link) => {
      if (link.label === 'Calendar') {
        // Calendar is available for both admin clients and employees
        const hasAccess = (userStore.clientProfile?.role === 'admin' && userStore.clientProfile?.user_type === 'client') ||
                         userStore.clientProfile?.user_type === 'employee'
        console.log(`${link.label} tab check - hasAccess:`, hasAccess)
        return hasAccess
      }

      if (link.label === 'Services' || link.label === 'Employees') {
        // Only show Services and Employees tabs for admin clients, not for employees
        const isAdminClient = userStore.clientProfile?.role === 'admin' &&
                             userStore.clientProfile?.user_type === 'client'
        console.log(`${link.label} tab check - isAdminClient:`, isAdminClient)
        console.log('Role:', userStore.clientProfile?.role)
        console.log('Type:', userStore.clientProfile?.user_type)
        return isAdminClient
      }
      return true
    })
  )

  console.log('Final filtered links:', filteredLinks)
  return filteredLinks
}) satisfies ComputedRef<NavigationMenuItem[][]>
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
