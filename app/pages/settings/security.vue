<script setup lang="ts">
import * as z from 'zod'
import type { FormError } from '@nuxt/ui'

const supabase = useSupabaseClient()
const toast = useToast()

const passwordSchema = z.object({
  current: z.string().min(7, 'Must be at least 8 characters'),
  new: z.string().min(8, 'Must be at least 8 characters'),
  confirm: z.string().min(8, 'Must be at least 8 characters')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
  current: undefined,
  new: undefined,
  confirm: undefined
})

const loading = ref(false)

const validate = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []

  if (state.current && state.new && state.current === state.new) {
    errors.push({ name: 'new', message: 'New password must be different from current password' })
  }

  if (state.new && state.confirm && state.new !== state.confirm) {
    errors.push({ name: 'confirm', message: 'Password confirmation does not match' })
  }

  return errors
}

async function updatePassword() {
  if (!password.current || !password.new || !password.confirm) {
    toast.add({
      title: 'Error',
      description: 'Please fill in all fields',
      icon: 'i-lucide-x',
      color: 'error'
    })
    return
  }

  if (password.new !== password.confirm) {
    toast.add({
      title: 'Error',
      description: 'New password and confirmation do not match',
      icon: 'i-lucide-x',
      color: 'error'
    })
    return
  }

  loading.value = true

  try {
    // First, verify the current password by attempting to sign in
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      throw new Error('No authenticated user found')
    }

    // Attempt to sign in with current credentials to verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: password.current
    })

    if (signInError) {
      toast.add({
        title: 'Error',
        description: 'Current password is incorrect',
        icon: 'i-lucide-x',
        color: 'error'
      })
      return
    }

    // If current password is verified, update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password.new
    })

    if (updateError) {
      toast.add({
        title: 'Error',
        description: updateError.message || 'Failed to update password',
        icon: 'i-lucide-x',
        color: 'error'
      })
      return
    }

    toast.add({
      title: 'Success',
      description: 'Password updated successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    // Clear the form
    password.current = undefined
    password.new = undefined
    password.confirm = undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Password update error:', error)
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to update password',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UPageCard
    title="Password"
    description="Confirm your current password before setting a new one."
    variant="subtle"
  >
    <UForm
      :schema="passwordSchema"
      :state="password"
      :validate="validate"
      class="flex flex-col gap-4 max-w-xs"
      @submit="updatePassword"
    >
      <UFormField name="current" label="Current Password" required>
        <UInput
          v-model="password.current"
          type="password"
          placeholder="Enter current password"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

      <UFormField name="new" label="New Password" required>
        <UInput
          v-model="password.new"
          type="password"
          placeholder="Enter new password"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

      <UFormField name="confirm" label="Confirm New Password" required>
        <UInput
          v-model="password.confirm"
          type="password"
          placeholder="Confirm new password"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

      <UButton
        label="Update Password"
        class="w-fit"
        type="submit"
        :loading="loading"
        :disabled="!password.current || !password.new || !password.confirm"
      />
    </UForm>
  </UPageCard>

  <!-- <UPageCard
    title="Account"
    description="No longer want to use our service? You can delete your account here. This action is not reversible. All information related to this account will be deleted permanently."
    class="bg-gradient-to-tl from-error/10 from-5% to-default"
  >
    <template #footer>
      <UButton label="Delete account" color="error" />
    </template>
  </UPageCard> -->
</template>
