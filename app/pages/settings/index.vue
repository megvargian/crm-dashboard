<script setup lang="ts">
import * as z from 'zod'
import { useUserStore } from '~/stores/user'

const store = useUserStore()
const fileRef = ref<HTMLInputElement>()
const supabase = useSupabaseClient()
const user = store.user
const toast = useToast()

const profileSchema = z.object({
  first_name: z.string().min(2, 'Too short'),
  last_name: z.string().min(2, 'Too short'),
  address: z.string().optional(),
  profile_picture: z.string().optional()
})

// type ProfileSchema = z.output<typeof profileSchema>

const profile = reactive<{ first_name: string, last_name: string, address: string, profile_picture: string | undefined }>({
  first_name: '',
  last_name: '',
  address: '',
  profile_picture: undefined
})

const loading = ref(false)
const uploading = ref(false)
const originalProfile = ref<{ first_name: string, last_name: string, address: string, profile_picture: string | undefined }>({
  first_name: '',
  last_name: '',
  address: '',
  profile_picture: undefined
})

// Load user profile data
type ClientProfile = {
  first_name: string
  last_name: string
  address?: string
  profile_picture?: string
}

onMounted(async () => {
  if (!user?.id) return

  const { data } = await supabase
    .from('client_profile')
    .select('first_name, last_name, address, profile_picture')
    .eq('user_id', user.id)
    .single<ClientProfile>()

  if (data) {
    profile.first_name = data.first_name ?? ''
    profile.last_name = data.last_name ?? ''
    profile.address = data.address ?? ''
    profile.profile_picture = data.profile_picture ?? undefined

    // Store original values
    originalProfile.value = {
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      address: data.address ?? '',
      profile_picture: data.profile_picture ?? undefined
    }
  }
})

function normalize(val: unknown) {
  return val ?? ''
}

// Check if any field has changed
const hasChanges = computed(() => {
  return normalize(profile.first_name) !== normalize(originalProfile.value.first_name)
    || normalize(profile.last_name) !== normalize(originalProfile.value.last_name)
    || normalize(profile.address) !== normalize(originalProfile.value.address)
    || normalize(profile.profile_picture) !== normalize(originalProfile.value.profile_picture)
})

async function onSubmit(event?: Event) {
  if (event) event.preventDefault()
  if (!user?.id) return

  loading.value = true
  try {
    const { error } = await supabase
      .from('client_profile')
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        address: profile.address
      } as never)
      .eq('user_id', user.id)

    if (error) throw error

    // Update original values after successful save
    originalProfile.value.first_name = profile.first_name
    originalProfile.value.last_name = profile.last_name
    originalProfile.value.address = profile.address

    toast.add({
      title: 'Success',
      description: 'Your profile has been updated.',
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to update profile.',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length || !user?.id) return

  const file = input.files[0]
  if (!file) return
  uploading.value = true

  try {
    // Create unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`
    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('profile_picture')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })
    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile_picture')
      .getPublicUrl(filePath)

    // Update profile with new URL
    const { error: updateError } = await supabase
      .from('client_profile')
      .update({ profile_picture: publicUrl as string } as never)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    profile.profile_picture = publicUrl
    originalProfile.value.profile_picture = publicUrl

    toast.add({
      title: 'Success',
      description: 'Profile picture updated.',
      icon: 'i-lucide-check',
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'Error',
      description: typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : 'Failed to upload image.',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    uploading.value = false
  }
}

function onFileClick() {
  fileRef.value?.click()
}
</script>

<template>
  <UPageCard
    title="Profile"
    description="Update your personal information."
    variant="naked"
    orientation="horizontal"
    class="mb-4"
  />

  <UForm
    id="settings"
    :schema="profileSchema"
    :state="profile"
    @submit="onSubmit()"
  >
    <UPageCard variant="subtle">
      <UFormField
        name="first_name"
        label="First Name"
        description="Your first name."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.first_name"
          autocomplete="off"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="last_name"
        label="Last Name"
        description="Your last name."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.last_name"
          autocomplete="off"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="address"
        label="Address"
        description="Your physical address."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.address"
          autocomplete="off"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="profile_picture"
        label="Profile Picture"
        description="JPG, GIF or PNG. 1MB Max."
        class="flex max-sm:flex-col justify-between sm:items-center gap-4"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar
            :src="profile.profile_picture"
            :alt="`${profile.first_name} ${profile.last_name}`"
            :text="profile.first_name && profile.last_name ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}` : ''"
            size="lg"
          />
          <UButton
            label="Choose"
            color="neutral"
            :loading="uploading"
            @click="onFileClick"
          />
          <input
            ref="fileRef"
            type="file"
            class="hidden"
            accept=".jpg, .jpeg, .png, .gif"
            @change="onFileChange"
          >
        </div>
      </UFormField>
    </UPageCard>
  </UForm>
  <UButton
    label="Save changes"
    color="neutral"
    :loading="loading"
    :disabled="!hasChanges"
    class="w-fit lg:ms-auto mt-4"
    @click="onSubmit()"
  />
</template>
