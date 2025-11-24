<template>
  <UContainer class="flex items-center justify-center min-h-screen">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold">
            Create Account
          </h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            Sign up to get started
          </p>
        </div>
      </template>

      <UForm
        :state="state"
        :schema="schema"
        class="space-y-4"
        @submit="handleSignup"
      >
        <UFormField name="email" label="Email">
          <UInput
            v-model="state.email"
            type="email"
            placeholder="you@example.com"
            icon="i-lucide-mail"
            size="lg"
          />
        </UFormField>

        <UFormField name="password" label="Password">
          <UInput
            v-model="state.password"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-lock"
            size="lg"
          />
        </UFormField>

        <UFormField name="confirmPassword" label="Confirm Password">
          <UInput
            v-model="state.confirmPassword"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-lock"
            size="lg"
          />
        </UFormField>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="loading"
          :disabled="loading"
        >
          Sign Up
        </UButton>
      </UForm>

      <template #footer>
        <div class="text-center text-sm">
          <span class="text-gray-500 dark:text-gray-400">Already have an account?</span>
          <UButton
            variant="link"
            to="/login"
            size="sm"
            :padded="false"
          >
            Sign in
          </UButton>
        </div>
      </template>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import { z } from 'zod'

definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()
const toast = useToast()

// Redirect if already logged in
watchEffect(() => {
  if (user.value) {
    router.push('/')
  }
})

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords don\'t match',
  path: ['confirmPassword']
})

const state = reactive({
  email: '',
  password: '',
  confirmPassword: ''
})

const loading = ref(false)

async function handleSignup() {
  loading.value = true

  try {
    const { error } = await supabase.auth.signUp({
      email: state.email,
      password: state.password
    })

    if (error) {
      toast.add({
        title: 'Signup Failed',
        description: error.message,
        color: 'error',
        icon: 'i-lucide-circle-x'
      })
    } else {
      toast.add({
        title: 'Account Created!',
        description: 'Please check your email to verify your account.',
        color: 'success',
        icon: 'i-lucide-circle-check'
      })

      // Redirect to login
      await router.push('/login')
    }
  } catch (err) {
    const error = err as Error
    toast.add({
      title: 'Error',
      description: error.message || 'An unexpected error occurred',
      color: 'error',
      icon: 'i-lucide-circle-x'
    })
  } finally {
    loading.value = false
  }
}
</script>
