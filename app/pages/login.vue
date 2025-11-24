<template>
  <UContainer class="flex items-center justify-center min-h-screen">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold">
            Welcome Back
          </h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            Sign in to your account
          </p>
        </div>
      </template>

      <UForm
        :state="state"
        :schema="schema"
        class="space-y-4"
        @submit="handleLogin"
      >
        <UFormField name="email" label="Email">
          <UInput
            v-model="state.email"
            type="email"
            placeholder="you@example.com"
            icon="i-lucide-mail"
            size="lg"
            class="w-100"
          />
        </UFormField>

        <UFormField name="password" label="Password">
          <UInput
            v-model="state.password"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-lock"
            size="lg"
            class="w-100"
          />
        </UFormField>

        <div class="flex items-center justify-between">
          <UCheckbox v-model="state.rememberMe" label="Remember me" />
          <!-- <UButton
            variant="link"
            to="/forgot-password"
            size="sm"
            :padded="false"
          >
            Forgot password?
          </UButton> -->
        </div>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="loading"
          :disabled="loading"
        >
          Sign In
        </UButton>
      </UForm>
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
  password: z.string().min(6, 'Password must be at least 6 characters')
})

const state = reactive({
  email: '',
  password: '',
  rememberMe: false
})

const loading = ref(false)

async function handleLogin() {
  loading.value = true

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: state.email,
      password: state.password
    })

    if (error) {
      toast.add({
        title: 'Login Failed',
        description: error.message,
        color: 'error',
        icon: 'i-lucide-circle-x'
      })
    } else {
      toast.add({
        title: 'Welcome back!',
        description: 'You have successfully signed in.',
        color: 'success',
        icon: 'i-lucide-circle-check'
      })

      // Redirect to dashboard
      await router.push('/')
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
