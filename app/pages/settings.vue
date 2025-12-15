<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()

// Watch for profile changes
watch(() => userStore.clientProfile, (newProfile) => {
  console.log('Profile changed:', newProfile)
}, { immediate: true })

// Filter navigation based on user role
const allLinks = [[{
  label: 'General',
  icon: 'i-lucide-user',
  to: '/settings',
  exact: true
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

// Remove Employees tab if user is not admin
const links = computed(() => {
  console.log('Computing links...')
  console.log('User profile:', userStore.clientProfile)
  console.log('User role:', userStore.clientProfile?.role)

  const filteredLinks = allLinks.map(group =>
    group.filter((link) => {
      if (link.label === 'Employees') {
        const isAdmin = userStore.clientProfile?.role === 'admin'
        console.log('Employee tab check - isAdmin:', isAdmin)
        return isAdmin
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
