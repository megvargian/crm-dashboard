<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ClientProfile } from '~/types/client_profile'
import { useUserStore } from '~/stores/user'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const appConfig = useAppConfig()

const colors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']
const neutrals = ['slate', 'gray', 'zinc', 'neutral', 'stone']

const supabaseUser = useSupabaseUser()
const supabase = useSupabaseClient()

const clientProfile = ref<ClientProfile | null>(null)

// Fetch client profile from database
watchEffect(async () => {
  if (supabaseUser.value?.id) {
    const { data } = await supabase
      .from('client_profile')
      .select('first_name, last_name, profile_picture')
      .eq('id', supabaseUser.value.id)
      .single()

    clientProfile.value = data
  }
})

const user = computed(() => {
  // Try client_profile first, then fall back to user_metadata
  const firstName = clientProfile.value?.first_name || supabaseUser.value?.user_metadata?.first_name || ''
  const lastName = clientProfile.value?.last_name || supabaseUser.value?.user_metadata?.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim() || supabaseUser.value?.email || 'User'
  const initials = firstName && lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    : (supabaseUser.value?.email?.charAt(0) || 'U').toUpperCase()

  return {
    name: fullName,
    avatar: {
      src: clientProfile.value?.profile_picture,
      alt: fullName,
      text: initials
    }
  }
})

const items = computed<DropdownMenuItem[][]>(() => [[{
  type: 'label',
  label: user.value.name,
  avatar: user.value.avatar
}], [{
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings'
}], [{
  label: 'Theme',
  icon: 'i-lucide-palette',
  children: [{
    label: 'Primary',
    slot: 'chip',
    chip: appConfig.ui.colors.primary,
    content: {
      align: 'center',
      collisionPadding: 16
    },
    children: colors.map(color => ({
      label: color,
      chip: color,
      slot: 'chip',
      checked: appConfig.ui.colors.primary === color,
      type: 'checkbox',
      onSelect: (e) => {
        e.preventDefault()

        appConfig.ui.colors.primary = color
      }
    }))
  }, {
    label: 'Neutral',
    slot: 'chip',
    chip: appConfig.ui.colors.neutral === 'neutral' ? 'old-neutral' : appConfig.ui.colors.neutral,
    content: {
      align: 'end',
      collisionPadding: 16
    },
    children: neutrals.map(color => ({
      label: color,
      chip: color === 'neutral' ? 'old-neutral' : color,
      slot: 'chip',
      type: 'checkbox',
      checked: appConfig.ui.colors.neutral === color,
      onSelect: (e) => {
        e.preventDefault()

        appConfig.ui.colors.neutral = color
      }
    }))
  }]
}, {
  label: 'Appearance',
  icon: 'i-lucide-sun-moon',
  children: [{
    label: 'Light',
    icon: 'i-lucide-sun',
    type: 'checkbox',
    checked: colorMode.value === 'light',
    onSelect(e: Event) {
      e.preventDefault()

      colorMode.preference = 'light'
    }
  }, {
    label: 'Dark',
    icon: 'i-lucide-moon',
    type: 'checkbox',
    checked: colorMode.value === 'dark',
    onUpdateChecked(checked: boolean) {
      if (checked) {
        colorMode.preference = 'dark'
      }
    },
    onSelect(e: Event) {
      e.preventDefault()
    }
  }]
}], [{
  label: 'Log out',
  icon: 'i-lucide-log-out',
  onSelect: async () => {
    try {
      console.log('Starting logout process...')

      // Clear user store first
      const userStore = useUserStore()
      userStore.clearUser()

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
        throw error
      }

      console.log('Successfully logged out, navigating to login...')

      // Force navigation to login page
      await navigateTo('/login', { replace: true })

      // Reload the page as fallback to ensure clean state
      window.location.href = '/login'
    } catch (error) {
      console.error('Error during logout:', error)

      // Force redirect as fallback even if there's an error
      window.location.href = '/login'
    }
  }
}]])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        ...user,
        label: collapsed ? undefined : user?.name,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{
        trailingIcon: 'text-dimmed'
      }"
    />

    <template #chip-leading="{ item }">
      <div class="inline-flex items-center justify-center shrink-0 size-5">
        <span
          class="rounded-full ring ring-bg bg-(--chip-light) dark:bg-(--chip-dark) size-2"
          :style="{
            '--chip-light': `var(--color-${(item as any).chip}-500)`,
            '--chip-dark': `var(--color-${(item as any).chip}-400)`
          }"
        />
      </div>
    </template>
  </UDropdownMenu>
</template>
