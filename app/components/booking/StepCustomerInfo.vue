<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'
import { z } from 'zod'

const { bookingState } = useBookingFlow()
const toast = useToast()
const loading = ref(false)
const checkingPhone = ref(false)

const emit = defineEmits(['booking-complete'])

// Form validation
const customerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Gender is required' })
})

const errors = ref<Record<string, string>>({})

// Check if customer exists by phone number
const checkCustomerByPhone = async (phone: string) => {
  if (phone.length < 10) return

  checkingPhone.value = true
  try {
    const response = await $fetch(`/api/customers/check-phone?phone=${encodeURIComponent(phone)}`)

    if (response && (response as any).exists) {
      bookingState.value.existingCustomerId = (response as any).customer.id
      toast.add({
        title: 'Welcome back!',
        description: `We found your account: ${(response as any).customer.full_name}`,
        color: 'success'
      })
    } else {
      bookingState.value.existingCustomerId = null
    }
  } catch (error) {
    console.error('Error checking phone:', error)
    bookingState.value.existingCustomerId = null
  } finally {
    checkingPhone.value = false
  }
}

// Watch phone number changes
watch(() => bookingState.value.customerInfo.phone, (newPhone) => {
  if (newPhone && newPhone.length >= 10) {
    checkCustomerByPhone(newPhone)
  }
})

const submitBooking = async () => {
  errors.value = {}

  // Validate form
  const validationResult = customerSchema.safeParse(bookingState.value.customerInfo)
  if (!validationResult.success) {
    validationResult.error.issues.forEach(issue => {
      errors.value[issue.path[0]] = issue.message
    })
    toast.add({
      title: 'Validation Error',
      description: 'Please fill in all required fields correctly',
      color: 'error'
    })
    return
  }

  loading.value = true

  try {
    let customerId = bookingState.value.existingCustomerId

    // Create new customer if doesn't exist
    if (!customerId) {
      const customerData = {
        first_name: bookingState.value.customerInfo.firstName,
        last_name: bookingState.value.customerInfo.lastName,
        full_name: `${bookingState.value.customerInfo.firstName} ${bookingState.value.customerInfo.lastName}`,
        email: bookingState.value.customerInfo.email,
        phone: bookingState.value.customerInfo.phone,
        gender: bookingState.value.customerInfo.gender
      }

      const customerResponse = await $fetch('/api/customers', {
        method: 'POST',
        body: customerData
      })

      customerId = (customerResponse as any).id
    }

    // Create bookings for each selected service using public endpoint
    const bookingPromises = bookingState.value.selectedServices.map(serviceId => {
      return $fetch('/api/public-bookings', {
        method: 'POST',
        body: {
          client_profile_id: bookingState.value.clientProfileId,
          customer_id: customerId,
          employee_id: bookingState.value.selectedEmployee,
          service_id: serviceId,
          booking_date: bookingState.value.selectedDate,
          start_time: bookingState.value.selectedTime,
          notes: `Booking created via public booking page`
        }
      })
    })

    await Promise.all(bookingPromises)

    toast.add({
      title: '🎉 Booking Confirmed!',
      description: `Your appointment${bookingState.value.selectedServices.length > 1 ? 's have' : ' has'} been successfully booked`,
      color: 'success'
    })

    // Emit event to reset form or show success page
    emit('booking-complete')
  } catch (error: any) {
    console.error('Error creating booking:', error)
    toast.add({
      title: 'Booking Failed',
      description: error?.data?.message || 'Failed to create booking. Please try again.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="step-customer-info">
    <div class="step-description">
      <p class="text-gray-400 mb-6">Please provide your contact information</p>
    </div>

    <form @submit.prevent="submitBooking" class="max-w-2xl mx-auto space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- First Name -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            First Name <span class="text-red-500">*</span>
          </label>
          <input
            v-model="bookingState.customerInfo.firstName"
            type="text"
            class="w-full px-4 py-3 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            :class="errors.firstName ? 'border-red-500' : 'border-gray-700'"
            placeholder="John"
            required
          />
          <p v-if="errors.firstName" class="mt-1 text-sm text-red-500">{{ errors.firstName }}</p>
        </div>

        <!-- Last Name -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Last Name <span class="text-red-500">*</span>
          </label>
          <input
            v-model="bookingState.customerInfo.lastName"
            type="text"
            class="w-full px-4 py-3 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            :class="errors.lastName ? 'border-red-500' : 'border-gray-700'"
            placeholder="Doe"
            required
          />
          <p v-if="errors.lastName" class="mt-1 text-sm text-red-500">{{ errors.lastName }}</p>
        </div>
      </div>

      <!-- Email -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Email <span class="text-red-500">*</span>
        </label>
        <input
          v-model="bookingState.customerInfo.email"
          type="email"
          class="w-full px-4 py-3 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
          :class="errors.email ? 'border-red-500' : 'border-gray-700'"
          placeholder="john.doe@example.com"
          required
        />
        <p v-if="errors.email" class="mt-1 text-sm text-red-500">{{ errors.email }}</p>
      </div>

      <!-- Phone -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Phone Number <span class="text-red-500">*</span>
        </label>
        <div class="relative">
          <input
            v-model="bookingState.customerInfo.phone"
            type="tel"
            class="w-full px-4 py-3 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            :class="errors.phone ? 'border-red-500' : 'border-gray-700'"
            placeholder="+1 (555) 123-4567"
            required
          />
          <div v-if="checkingPhone" class="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
          </div>
        </div>
        <p v-if="errors.phone" class="mt-1 text-sm text-red-500">{{ errors.phone }}</p>
        <p v-if="bookingState.existingCustomerId" class="mt-1 text-sm text-green-500">
          ✓ Existing customer found
        </p>
      </div>

      <!-- Gender -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Gender <span class="text-red-500">*</span>
        </label>
        <div class="grid grid-cols-3 gap-4">
          <label
            class="flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all"
            :class="bookingState.customerInfo.gender === 'male'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 bg-gray-800 hover:border-gray-600'"
          >
            <input
              v-model="bookingState.customerInfo.gender"
              type="radio"
              value="male"
              class="hidden"
            />
            <span class="text-white font-medium">Male</span>
          </label>

          <label
            class="flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all"
            :class="bookingState.customerInfo.gender === 'female'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 bg-gray-800 hover:border-gray-600'"
          >
            <input
              v-model="bookingState.customerInfo.gender"
              type="radio"
              value="female"
              class="hidden"
            />
            <span class="text-white font-medium">Female</span>
          </label>

          <label
            class="flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all"
            :class="bookingState.customerInfo.gender === 'other'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 bg-gray-800 hover:border-gray-600'"
          >
            <input
              v-model="bookingState.customerInfo.gender"
              type="radio"
              value="other"
              class="hidden"
            />
            <span class="text-white font-medium">Other</span>
          </label>
        </div>
        <p v-if="errors.gender" class="mt-1 text-sm text-red-500">{{ errors.gender }}</p>
      </div>

      <!-- Summary -->
      <div class="mt-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
        <h3 class="text-lg font-semibold text-white mb-4">Booking Summary</h3>
        <div class="space-y-2 text-sm">
          <p class="text-gray-400">
            <span class="font-medium text-white">Services:</span>
            {{ bookingState.selectedServices.length }} selected
          </p>
          <p class="text-gray-400">
            <span class="font-medium text-white">Date:</span>
            {{ bookingState.selectedDate }}
          </p>
          <p class="text-gray-400">
            <span class="font-medium text-white">Time:</span>
            {{ bookingState.selectedTime }}
          </p>
        </div>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        class="w-full py-4 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        :disabled="loading"
      >
        <div v-if="loading" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
        <span>{{ loading ? 'Creating Booking...' : 'Confirm Booking' }}</span>
      </button>
    </form>
  </div>
</template>
