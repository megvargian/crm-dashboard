<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'
import StepServices from '~/components/booking/StepServices.vue'
import StepEmployee from '~/components/booking/StepEmployee.vue'
import StepDateTime from '~/components/booking/StepDateTime.vue'
import StepCustomerInfo from '~/components/booking/StepCustomerInfo.vue'

definePageMeta({
  title: 'Book Appointment',
  layout: false,
  auth: false // Public page - no authentication required
})

const route = useRoute()
const clientProfileId = route.params.id as string

// Validate that we have a valid UUID
if (!clientProfileId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientProfileId)) {
  throw createError({
    statusCode: 400,
    message: 'Invalid client profile ID'
  })
}

const {
  currentStep,
  bookingState,
  nextStep,
  prevStep,
  canProceedToStep2,
  canProceedToStep3,
  canProceedToStep4,
  resetBooking
} = useBookingFlow()

// Set the client profile ID in the booking state
bookingState.value.clientProfileId = clientProfileId

const stepTitles = [
  'Choose Services',
  'Select Provider',
  'Pick Date & Time',
  'Your Information'
]

const stepDescriptions = [
  'Select one or more services you would like to book',
  'Choose your preferred service provider',
  'Pick a convenient date and time',
  'Enter your contact information'
]

const progressPercentage = computed(() => {
  return (currentStep.value / 4) * 100
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return canProceedToStep2.value
    case 2:
      return canProceedToStep3.value
    case 3:
      return canProceedToStep4.value
    case 4:
      return false // Last step, no next button
    default:
      return false
  }
})

const showSuccess = ref(false)

const handleBookingComplete = () => {
  showSuccess.value = true
}

const startNewBooking = () => {
  showSuccess.value = false
  resetBooking()
  // Re-set the client profile ID after reset
  bookingState.value.clientProfileId = clientProfileId
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
    <!-- Header -->
    <div class="bg-gray-800/50 border-b border-gray-700 backdrop-blur-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">Book Your Appointment</h1>
            <p class="mt-1 text-gray-400">Fast and easy online booking</p>
          </div>
          <div class="text-right">
            <div class="text-sm text-gray-400">Step {{ currentStep }} of 4</div>
            <div class="text-lg font-semibold text-white">{{ stepTitles[currentStep - 1] }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Page -->
    <div v-if="showSuccess" class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-12 text-center">
        <div class="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6">
          <svg class="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>

        <h2 class="text-3xl font-bold text-white mb-4">Booking Confirmed!</h2>
        <p class="text-gray-300 text-lg mb-8">
          Your appointment has been successfully scheduled. You will receive a confirmation email shortly.
        </p>

        <div class="space-y-4">
          <button
            @click="startNewBooking"
            class="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Book Another Appointment
          </button>
          <a
            href="/"
            class="block w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            Return to Home
          </a>
        </div>
      </div>
    </div>

    <!-- Booking Flow -->
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Progress Bar -->
      <div class="mb-8">
        <div class="relative">
          <div class="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-gray-700">
            <div
              :style="{ width: progressPercentage + '%' }"
              class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-500"
            ></div>
          </div>
        </div>

        <!-- Step Indicators -->
        <div class="flex justify-between">
          <div
            v-for="(title, index) in stepTitles"
            :key="index"
            class="flex flex-col items-center"
            :class="{ 'flex-1': index < stepTitles.length - 1 }"
          >
            <div
              class="flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all"
              :class="[
                currentStep > index + 1 ? 'bg-primary-500 border-primary-500 text-white' :
                currentStep === index + 1 ? 'border-primary-500 text-primary-500 bg-gray-800' :
                'border-gray-600 text-gray-500 bg-gray-800'
              ]"
            >
              <span v-if="currentStep > index + 1" class="text-white">✓</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <div class="mt-2 text-xs text-center hidden sm:block" :class="currentStep === index + 1 ? 'text-white font-medium' : 'text-gray-500'">
              {{ title }}
            </div>
          </div>
        </div>
      </div>

      <!-- Step Description -->
      <div class="mb-8 text-center">
        <p class="text-gray-300 text-lg">{{ stepDescriptions[currentStep - 1] }}</p>
      </div>

      <!-- Step Content -->
      <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 mb-8">
        <StepServices v-if="currentStep === 1" />
        <StepEmployee v-else-if="currentStep === 2" />
        <StepDateTime v-else-if="currentStep === 3" />
        <StepCustomerInfo v-else-if="currentStep === 4" @booking-complete="handleBookingComplete" />
      </div>

      <!-- Navigation Buttons -->
      <div class="flex items-center justify-between gap-4">
        <button
          v-if="currentStep > 1"
          @click="prevStep"
          class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div v-else></div>

        <button
          v-if="currentStep < 4"
          @click="nextStep"
          :disabled="!canProceed"
          class="px-6 py-3 font-medium rounded-lg transition-colors flex items-center gap-2 ml-auto"
          :class="canProceed
            ? 'bg-primary-600 hover:bg-primary-700 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
        >
          Next
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
