<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'

const { bookingState } = useBookingFlow()

// Fetch services from API (no auth required for public booking)
const { data: services, pending, error, refresh } = useFetch('/api/services', {
  default: () => [],
  lazy: true,
  server: false, // Force client-side fetching for public page
  onResponse({ response }) {
    console.log('📦 Services API Response:', response._data)
    console.log('📦 Services count:', response._data?.length)
  },
  onResponseError({ error }) {
    console.error('❌ Services API Error:', error)
  }
})

// Trigger the fetch on component mount
await refresh()

onMounted(() => {
  console.log('🚀 StepServices component mounted, fetching services...')
})

// Watch services data
watchEffect(() => {
  console.log('📋 Services data:', services.value)
  console.log('📋 Services is array:', Array.isArray(services.value))
  console.log('📋 Services length:', services.value?.length)
  console.log('⏳ Pending:', pending.value)
  console.log('❌ Error:', error.value)
})

const toggleService = (serviceId: string) => {
  const index = bookingState.value.selectedServices.indexOf(serviceId)
  if (index > -1) {
    bookingState.value.selectedServices.splice(index, 1)
  } else {
    bookingState.value.selectedServices.push(serviceId)
  }
}

const isServiceSelected = (serviceId: string) => {
  return bookingState.value.selectedServices.includes(serviceId)
}
</script>

<template>
  <div class="step-services">
    <div class="step-description">
      <p class="text-gray-400 mb-6">Select one or more services you'd like to book</p>
    </div>

    <div v-if="pending" class="text-center py-8">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
      <p class="text-gray-400 mt-4">Loading services...</p>
    </div>

    <div v-else-if="error" class="text-center py-8">
      <p class="text-red-500 mb-2">Error loading services</p>
      <p class="text-gray-400 text-sm">{{ error }}</p>
    </div>

    <div v-else-if="!services || services.length === 0" class="text-center py-8 text-gray-400">
      No services available at this time.
    </div>

    <div v-else class="services-grid grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="service in services"
        :key="service.id"
        class="service-card p-6 rounded-lg border-2 transition-all cursor-pointer"
        :class="isServiceSelected(service.id)
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-700 bg-gray-800 hover:border-gray-600'"
        @click="toggleService(service.id)"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-white mb-2">{{ service.name }}</h3>
            <p v-if="service.description" class="text-gray-400 text-sm mb-3">
              {{ service.description }}
            </p>
            <div class="flex items-center gap-4 text-sm">
              <span class="text-blue-400 font-semibold">${{ service.price }}</span>
              <span v-if="service.duration_service_in_s" class="text-gray-400">
                {{ Math.round(service.duration_service_in_s / 3600 * 10) / 10 }}h
              </span>
            </div>
          </div>
          <div
            class="flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all"
            :class="isServiceSelected(service.id)
              ? 'border-blue-500 bg-blue-500'
              : 'border-gray-600'"
          >
            <svg v-if="isServiceSelected(service.id)" class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-card {
  transition: all 0.2s ease;
}

.service-card:hover {
  transform: translateY(-2px);
}
</style>
