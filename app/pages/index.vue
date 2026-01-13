<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import type { Booking, CreateBookingData } from '~/types/booking'
import { z } from 'zod'

definePageMeta({
  title: 'Calendar'
})

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

// Wait for user store to initialize
await userStore.fetchClientProfile()

// Role-based access control
const isAdmin = computed(() => userStore.clientProfile?.role === 'admin')
const isEmployee = computed(() => userStore.clientProfile?.role === 'employee')

if (!isAdmin.value && !isEmployee.value) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Access denied. Admin or employee access required.'
  })
}

// Data fetching with proper authorization
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  throw createError({
    statusCode: 401,
    statusMessage: 'No active session'
  })
}

const authHeaders = {
  Authorization: `Bearer ${session.access_token}`
}

const { data: bookings, refresh: refreshBookings } = await useFetch<Booking[]>('/api/bookings', {
  default: () => [],
  headers: authHeaders,
  key: 'bookings-data', // Add unique key for cache management
  server: false, // Ensure it runs on client side
  lazy: false, // Don't lazy load
  onResponse: ({ response }) => {
    console.log('📅 Bookings loaded:', response._data?.length || 0)
    if (Array.isArray(response._data) && response._data.length > 0) {
      console.log('📅 First booking:', response._data[0])
    }
  },
  onResponseError: ({ error }) => {
    console.error('❌ Bookings API error:', error)
  }
})

// Preview booking state for immediate feedback
const previewBooking = ref<CreateBookingData | null>(null)

const { data: employees } = await useFetch('/api/employees', {
  default: () => [],
  headers: authHeaders,
  onResponse: ({ response }) => {
    console.log('Employees API response:', response._data)
    console.log('Employees length:', response._data?.length || 0)
  },
  onResponseError: ({ error }) => {
    console.error('Employees API error:', error)
  }
})
const { data: services } = await useFetch('/api/services', {
  default: () => [],
  headers: authHeaders,
  onResponse: ({ response }) => {
    console.log('Services API response:', response._data)
    console.log('Services length:', response._data?.length || 0)
  },
  onResponseError: ({ error }) => {
    console.error('Services API error:', error)
  }
})
const { data: clients } = await useFetch('/api/customers', {
  default: () => [],
  headers: authHeaders,
  onResponse: ({ response }) => {
    console.log('Customers API response:', response._data)
    console.log('Customers length:', response._data?.length || 0)
    console.log('First customer structure:', response._data?.[0])
  },
  onResponseError: ({ error }) => {
    console.error('Customers API error:', error)
  }
})

// Computed options for dropdowns
const customerOptions = computed(() => {
  if (Array.isArray(clients.value)) {
    return (clients.value as any[]).map(client => ({
      label: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email || 'Unknown Customer',
      value: client.id
    }))
  }
  return []
})

const employeeOptions = computed(() => {
  if (Array.isArray(employees.value)) {
    return (employees.value as any[]).map(emp => ({
      label: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Unknown Employee',
      value: emp.id
    }))
  }
  return []
})

const serviceOptions = computed(() => {
  if (Array.isArray(services.value)) {
    return (services.value as any[]).map(service => ({
      label: `${service.name || 'Unknown Service'} - $${service.price || 0}`,
      value: service.id
    }))
  }
  return []
})
console.log('Service Options:', serviceOptions.value)
console.log('Employee Options:', employeeOptions.value)
console.log('Customer Options:', customerOptions.value)

// Calendar state
const currentDate = ref(new Date())
const selectedDate = ref<Date | null>(null)
const selectedTimeSlot = ref<string | null>(null)
const showCreateModal = ref(false)
const loading = ref(false)
const viewMode = ref<'week' | 'month'>('week')
const editingBooking = ref<Booking | null>(null)

// Add hover state for better UX
const hoveredSlot = ref<{ date: Date, time: string } | null>(null)

// Form validation - only customer_id is required from user input
const bookingSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  service_id: z.string().min(1, 'Service is required'),
  booking_date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Time is required'),
  notes: z.string().optional()
})

const newBooking = ref<CreateBookingData>({
  customer_id: '',
  client_profile_id: '', // Will be auto-populated by backend
  client_business_id: undefined, // Will be auto-populated by backend
  employee_id: '',
  service_id: '',
  booking_date: '',
  start_time: '',
  notes: ''
})

// Calendar utilities
const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, '0')
  const minute = (i % 2) * 30 === 0 ? '00' : '30'
  return `${hour}:${minute}`
})

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const currentWeekStart = computed(() => {
  const date = new Date(currentDate.value)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
})

// Utility functions defined early to avoid initialization issues
const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const formatTime = (date: Date) => {
  // Use UTC to avoid timezone conversion
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

// Extract time from timestamp string
const extractTimeFromTimestamp = (timestamp: string) => {
  if (!timestamp) return ''
  if (timestamp.includes('T')) {
    // It's an ISO timestamp - extract time directly to avoid timezone conversion
    return timestamp.slice(11, 16) // Extract HH:MM from ISO string
  }
  // It's already a time string
  return timestamp
}

const currentWeekDays = computed(() => {
  const days = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart.value)
    date.setDate(date.getDate() + i)
    days.push(date)
  }
  return days
})

// Debug current bookings - moved here after currentWeekDays is defined
watchEffect(() => {
  if (bookings.value?.length > 0) {
    console.log('📅 ===== BOOKING DEBUG INFO =====')
    console.log('📅 Current bookings count:', bookings.value.length)

    const currentWeek = currentWeekDays.value.map(d => formatDate(d))
    console.log('📅 Current week dates:', currentWeek)

    // Check if any bookings match current week
    const weekBookings = bookings.value.filter(booking => {
      const bookingDate = booking.booking_date.includes('T')
        ? booking.booking_date.split('T')[0]
        : booking.booking_date
      return currentWeek.includes(bookingDate)
    })

    console.log('📅 Bookings this week:', weekBookings.length)
    if (weekBookings.length > 0) {
      weekBookings.forEach((booking, index) => {
        const extractedTime = booking.start_time.includes('T')
          ? booking.start_time.slice(11, 16)
          : booking.start_time.slice(0, 5)

        console.log(`📅 Week Booking ${index + 1}:`, {
          id: booking.id,
          date: booking.booking_date.split('T')[0],
          time: extractedTime,
          customer_name: booking.client_profile?.first_name + ' ' + booking.client_profile?.last_name || 'Unknown',
          service_name: booking.service?.name || 'Unknown Service',
          employee_name: booking.employee ? `${booking.employee.first_name} ${booking.employee.last_name}` : 'Unknown Employee'
        })
      })
    }
    console.log('📅 ===== END BOOKING DEBUG =====')
  } else {
    console.log('📅 No bookings found in data')
  }
})

// Watch for week changes and refresh data
watch(currentWeekStart, async () => {
  console.log('📅 Week changed, refreshing booking data...')
  await forceRefreshCalendar()
})

const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const getBookingAtTime = (date: Date, time: string) => {
  const dateStr = formatDate(date)

  if (!bookings.value || bookings.value.length === 0) {
    return null
  }

  const booking = bookings.value.find((booking) => {
    // Extract date from booking_date timestamp
    let bookingDate = ''
    if (booking.booking_date) {
      if (booking.booking_date.includes('T')) {
        // It's a timestamp like "2026-01-02T00:00:00+00:00"
        bookingDate = booking.booking_date.split('T')[0] // Get just the date part
      } else {
        // It's already just a date string
        bookingDate = booking.booking_date
      }
    }

    const dateMatches = bookingDate === dateStr

    // Handle time extraction - now start_time is always timestamptz from database
    let extractedTime = ''

    if (booking.start_time) {
      if (booking.start_time.includes('T')) {
        // It's a timestamptz from database like "2026-01-02T10:30:00.000Z"
        // Extract time directly from ISO string to avoid timezone conversion
        extractedTime = booking.start_time.slice(11, 16) // Get HH:MM from ISO string
      } else if (booking.start_time.match(/^\d{2}:\d{2}$/)) {
        // Legacy: It's already in HH:MM format (shouldn't happen with timestamptz)
        extractedTime = booking.start_time
      } else {
        // Handle any unexpected formats
        console.warn(`⚠️ Unexpected start_time format for booking ${booking.id}: ${booking.start_time}`)
        // Try to extract from booking_date as fallback
        if (booking.booking_date && booking.booking_date.includes('T')) {
          const dateTime = new Date(booking.booking_date)
          extractedTime = dateTime.toTimeString().slice(0, 5)
        }
      }
    }

    const timeMatches = extractedTime === time
    return dateMatches && timeMatches
  })

  return booking
}

// Modern Outlook-style booking colors
const getBookingColor = (booking: Booking | CreateBookingData) => {
  // Preview booking style
  if ('booking_date' in booking && !('status' in booking)) {
    return 'bg-gradient-to-br from-blue-500/90 to-blue-600/90 hover:from-blue-600/90 hover:to-blue-700/90 border border-blue-400/50 shadow-lg shadow-blue-500/25 backdrop-blur-sm'
  }

  const status = (booking as Booking).status
  switch (status) {
    case 'confirmed':
      return 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-400/50 shadow-lg shadow-blue-500/25'
    case 'completed':
      return 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border border-green-400/50 shadow-lg shadow-green-500/25'
    case 'cancelled':
      return 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border border-red-400/50 shadow-lg shadow-red-500/25'
    default: // pending
      return 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-400/50 shadow-lg shadow-blue-500/25'
  }
}

// Get preview booking for a specific time
const getPreviewBookingAtTime = (date: Date, time: string) => {
  if (!previewBooking.value) return null

  const dateStr = formatDate(date)
  if (previewBooking.value.booking_date === dateStr && previewBooking.value.start_time === time) {
    return previewBooking.value
  }
  return null
}
const getBookingsOverlappingTime = (date: Date, time: string) => {
  const dateStr = formatDate(date)
  const slotTime = new Date(`${dateStr}T${time}:00`)

  return bookings.value?.filter((booking) => {
    // Extract date from booking_date timestamp
    let bookingDate = ''
    if (booking.booking_date) {
      if (booking.booking_date.includes('T')) {
        bookingDate = booking.booking_date.split('T')[0]
      } else {
        bookingDate = booking.booking_date
      }
    }

    if (bookingDate !== dateStr) return false

    // Handle start_time and end_time properly - now always timestamptz from database
    let startTime, endTime

    try {
      // start_time should always be a timestamp now
      if (booking.start_time.includes('T')) {
        startTime = new Date(booking.start_time)
      } else {
        // Legacy fallback - combine with booking date
        startTime = new Date(`${bookingDate}T${booking.start_time}:00`)
      }

      // end_time should always be a timestamp now
      if (booking.end_time && booking.end_time.includes('T')) {
        endTime = new Date(booking.end_time)
      } else {
        // Fallback: calculate end time based on service duration or default 30 min
        const duration = booking.service?.duration_service_in_s || (30 * 60) // 30 minutes default
        endTime = new Date(startTime.getTime() + (duration * 1000))
      }
    } catch (error) {
      console.warn('Error parsing booking times:', error)
      return false
    }

    // Check if this time slot falls within the booking duration
    return slotTime >= startTime && slotTime < endTime
  }) || []
}

// Check if any booking occupies this time slot (for preventing clicks on occupied slots)
const isTimeSlotOccupied = (date: Date, time: string) => {
  const overlapping = getBookingsOverlappingTime(date, time)
  return overlapping.length > 0
}

// Calculate booking duration in 30-minute slots
const getBookingDurationSlots = (booking: Booking) => {
  if (!booking.start_time || !booking.end_time) return 1

  const startTime = new Date(booking.start_time)
  const endTime = new Date(booking.end_time)
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationSlots = Math.ceil(durationMs / (30 * 60 * 1000)) // 30 minutes per slot

  return Math.max(1, durationSlots) // At least 1 slot
}

// Check if this is the first slot of a booking
const isBookingStartSlot = (booking: Booking, time: string) => {
  const bookingStartTime = extractTimeFromTimestamp(booking.start_time)
  return bookingStartTime === time
}

// Event handlers
const handleTimeSlotClick = (date: Date, time: string) => {
  // Check if this is the start slot of an existing booking
  const existingBooking = getBookingAtTime(date, time)

  // Check if this slot is occupied by any booking (even if it's not the start slot)
  const isOccupied = isTimeSlotOccupied(date, time)

  console.log(`🖱️ Clicked slot: ${formatDate(date)} ${time}`)
  console.log(`📍 Existing booking at start:`, existingBooking)
  console.log(`🚫 Slot occupied:`, isOccupied)

  if (existingBooking) {
    // Edit existing booking (this is the start slot)
    editBooking(existingBooking)
  } else if (isOccupied) {
    // Find which booking occupies this slot and edit it
    const overlappingBookings = getBookingsOverlappingTime(date, time)
    if (overlappingBookings.length > 0) {
      editBooking(overlappingBookings[0]) // Edit the first overlapping booking
    }
  } else {
    // Create new booking with immediate preview
    editingBooking.value = null
    selectedDate.value = date
    selectedTimeSlot.value = time

    // Set up new booking data
    newBooking.value = {
      customer_id: '',
      client_profile_id: '',
      client_business_id: undefined,
      employee_id: '',
      service_id: '',
      booking_date: formatDate(date) || '',
      start_time: time,
      notes: ''
    }

    // Show immediate preview
    previewBooking.value = { ...newBooking.value }
    showCreateModal.value = true

    console.log('📋 Created preview booking:', previewBooking.value)
  }
}

const editBooking = (booking: Booking) => {
  editingBooking.value = booking

  // Extract date part from booking_date (handle timestamp format)
  let bookingDate = booking.booking_date
  if (bookingDate.includes('T')) {
    bookingDate = bookingDate.split('T')[0] // Get just YYYY-MM-DD part
  }

  newBooking.value = {
    customer_id: booking.customer_id,
    client_profile_id: booking.client_profile_id,
    client_business_id: booking.client_business_id || undefined,
    employee_id: booking.employee_id,
    service_id: booking.service_id,
    booking_date: bookingDate, // Use extracted date
    start_time: extractTimeFromTimestamp(booking.start_time),
    notes: booking.notes || ''
  }
  showCreateModal.value = true

  console.log('📝 Editing booking:', {
    id: booking.id,
    original_date: booking.booking_date,
    extracted_date: bookingDate,
    original_time: booking.start_time,
    extracted_time: extractTimeFromTimestamp(booking.start_time)
  })
}

const navigateWeek = (direction: 'prev' | 'next') => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
  currentDate.value = newDate
}

const goToToday = () => {
  currentDate.value = new Date()
}

// Watch for customer ID changes to auto-populate client_profile_id and client_business_id
watch(() => newBooking.value.customer_id, async (newCustomerId) => {
  if (newCustomerId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const response = await $fetch(`/api/client-profile/get-client-profile?customer_id=${newCustomerId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }) as any

        if (response?.profile) {
          newBooking.value.client_profile_id = response.profile.id || ''
          newBooking.value.client_business_id = response.profile.client_business_id || undefined
        }
      }
    } catch (error) {
      console.error('Error fetching client profile:', error)
      newBooking.value.client_profile_id = ''
      newBooking.value.client_business_id = undefined
    }
  } else {
    newBooking.value.client_profile_id = ''
    newBooking.value.client_business_id = undefined
  }
})

// Real-time preview updates
watch(() => [
  newBooking.value.customer_id,
  newBooking.value.employee_id,
  newBooking.value.service_id,
  newBooking.value.booking_date,
  newBooking.value.start_time
], () => {
  if (showCreateModal.value
    && newBooking.value.customer_id
    && newBooking.value.employee_id
    && newBooking.value.service_id
    && newBooking.value.booking_date
    && newBooking.value.start_time) {
    previewBooking.value = { ...newBooking.value }
    console.log('📅 Preview updated:', previewBooking.value)
  } else if (showCreateModal.value) {
    previewBooking.value = null
  }
}, { deep: true })

// CRUD operations with immediate preview
const createBooking = async () => {
  try {
    loading.value = true

    // Validate form data
    const validationResult = bookingSchema.safeParse(newBooking.value)
    if (!validationResult.success) {
      const errors = validationResult.error.issues?.map(issue => issue.message).join(', ') || 'Invalid form data'
      toast.add({
        title: 'Validation Error',
        description: errors,
        color: 'error'
      })
      return
    }

    // Show immediate preview on calendar
    previewBooking.value = { ...newBooking.value }
    console.log('📅 Showing preview booking:', previewBooking.value)

    // Get fresh session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('No active session')
    }

    // Create booking payload
    const bookingPayload = {
      customer_id: newBooking.value.customer_id,
      client_profile_id: newBooking.value.client_profile_id,
      client_business_id: newBooking.value.client_business_id,
      employee_id: newBooking.value.employee_id,
      service_id: newBooking.value.service_id,
      booking_date: newBooking.value.booking_date,
      start_time: newBooking.value.start_time, // This can be HH:MM format, backend will handle conversion
      notes: newBooking.value.notes
    }

    let response
    if (editingBooking.value) {
      // Update existing booking
      response = await $fetch(`/api/bookings?id=${editingBooking.value.id}`, {
        method: 'PUT',
        body: bookingPayload,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
    } else {
      // Create new booking
      response = await $fetch('/api/bookings', {
        method: 'POST',
        body: bookingPayload,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
    }

    if (response) {
      toast.add({
        title: '✅ Success',
        description: editingBooking.value ? 'Booking updated successfully' : 'Booking created successfully',
        color: 'success'
      })

      // Clear cache and force refresh bookings data
      await clearNuxtData('bookings-data')
      await refreshBookings()

      // Small delay to ensure data is updated before clearing UI state
      await new Promise(resolve => setTimeout(resolve, 100))

      // Clear UI state after successful update
      previewBooking.value = null
      showCreateModal.value = false
      resetForm()
      editingBooking.value = null

      console.log('📅 Booking operation completed, calendar should refresh')
    }
  } catch (error: unknown) {
    console.error('❌ Error creating booking:', error)
    previewBooking.value = null
    toast.add({
      title: 'Error',
      description: (error as any)?.data?.message || 'Failed to create booking',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  newBooking.value = {
    customer_id: '',
    client_profile_id: '',
    client_business_id: undefined,
    employee_id: '',
    service_id: '',
    booking_date: '',
    start_time: '',
    notes: ''
  }
  selectedDate.value = null
  selectedTimeSlot.value = null
  previewBooking.value = null
  editingBooking.value = null // Ensure editing state is cleared
}

const closeModal = () => {
  showCreateModal.value = false
  editingBooking.value = null
  previewBooking.value = null
  resetForm()
}

// Manual refresh function to force update calendar
const forceRefreshCalendar = async () => {
  console.log('🔄 Force refreshing calendar data...')
  await clearNuxtData('bookings-data')
  await refreshBookings()
  console.log('✅ Calendar data refreshed')
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Calendar">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-4">
            <UButton variant="outline" size="sm" @click="goToToday">
              Today
            </UButton>

            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-refresh-cw"
              @click="forceRefreshCalendar"
              title="Refresh calendar data"
            >
              Refresh
            </UButton>

            <div class="flex items-center gap-2">
              <UButton variant="ghost" icon="i-lucide-chevron-left" @click="navigateWeek('prev')" />
              <span class="text-lg font-medium min-w-48 text-center">
                {{ currentWeekStart.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric'
                }) }}
              </span>
              <UButton variant="ghost" icon="i-lucide-chevron-right" @click="navigateWeek('next')" />
            </div>

            <div class="flex items-center rounded-lg border border-gray-600 overflow-hidden">
              <UButton
                :variant="viewMode === 'week' ? 'solid' : 'ghost'"
                size="sm"
                class="rounded-none border-0"
                @click="viewMode = 'week'"
              >
                Week
              </UButton>
              <UButton
                :variant="viewMode === 'month' ? 'solid' : 'ghost'"
                size="sm"
                class="rounded-none border-0 border-l border-gray-600"
                @click="viewMode = 'month'"
              >
                Month
              </UButton>
            </div>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Calendar Grid -->
      <div class="h-full flex flex-col bg-gray-900">
        <!-- Week Days Header -->
        <div class="grid grid-cols-8 border-b border-gray-700 bg-gray-800">
          <div class="p-3 text-sm font-medium text-gray-300 text-center border-r border-gray-700">
            Time
          </div>
          <div
            v-for="(day, index) in currentWeekDays"
            :key="index"
            class="p-3 text-center border-r border-gray-700 last:border-r-0"
            :class="{ 'bg-blue-900': isToday(day) }"
          >
            <div class="text-sm font-medium text-gray-300">
              {{ weekDays[day.getDay()] }}
            </div>
            <div class="text-lg font-semibold mt-1" :class="{ 'text-blue-400': isToday(day), 'text-white': !isToday(day) }">
              {{ day.getDate() }}
            </div>
          </div>
        </div>

        <!-- Time Slots Grid -->
        <div class="flex-1">
          <div class="grid grid-cols-8">
            <div v-for="time in timeSlots" :key="time" class="contents">
              <!-- Time Column -->
              <div class="p-2 text-xs text-gray-400 text-right border-r border-gray-700 bg-gray-800 sticky left-0 z-10 min-h-12 flex items-center justify-end">
                {{ time }}
              </div>

              <!-- Day Columns -->
              <div
                v-for="day in currentWeekDays"
                :key="`${day}-${time}`"
                class="border-r border-gray-700 border-b border-gray-800 min-h-12 p-1 cursor-pointer transition-all duration-200 relative"
                :class="{
                  'bg-gray-800/20': isToday(day),
                  'bg-gray-900': !isToday(day),
                  'bg-blue-900/30 border-blue-500/50': selectedDate && formatDate(selectedDate) === formatDate(day) && selectedTimeSlot === time,
                  'hover:bg-gray-800/30': !(selectedDate && formatDate(selectedDate) === formatDate(day) && selectedTimeSlot === time)
                }"
                @click.stop="handleTimeSlotClick(day, time)"
              >
                <!-- Existing Bookings -->
                <div
                  v-if="getBookingAtTime(day, time) && isBookingStartSlot(getBookingAtTime(day, time)!, time)"
                  :key="getBookingAtTime(day, time)?.id"
                  class="absolute inset-x-1 rounded-lg text-white text-xs p-2.5 cursor-pointer transition-all duration-300 z-10 outlook-booking-block"
                  :class="getBookingColor(getBookingAtTime(day, time)!)"
                  :style="{
                    height: `${getBookingDurationSlots(getBookingAtTime(day, time)!) * 44 + (getBookingDurationSlots(getBookingAtTime(day, time)!) - 1) * 4}px`,
                    minHeight: '44px'
                  }"
                  @click.stop="editBooking(getBookingAtTime(day, time)!)"
                >
                  <!-- Modern Booking Content -->
                  <div class="flex flex-col h-full">
                    <!-- Time Range with Icon -->
                    <div class="flex items-center text-white font-semibold text-xs mb-2">
                      <div class="w-1.5 h-1.5 bg-white rounded-full mr-2 opacity-90" />
                      {{ extractTimeFromTimestamp(getBookingAtTime(day, time)!.start_time) }} -
                      {{ extractTimeFromTimestamp(getBookingAtTime(day, time)!.end_time) }}
                    </div>

                    <!-- Customer Name -->
                    <div class="font-bold text-sm text-white truncate mb-1">
                      {{ getBookingAtTime(day, time)!.client_profile?.first_name || getBookingAtTime(day, time)!.customer?.full_name || 'Customer' }}
                      {{ getBookingAtTime(day, time)!.client_profile?.last_name || '' }}
                    </div>

                    <!-- Service & Duration -->
                    <div class="text-white/90 text-xs truncate">
                      {{ getBookingAtTime(day, time)!.service?.name || 'Service' }}
                      <span v-if="getBookingAtTime(day, time)!.service?.duration_service_in_s" class="text-white/70">
                        ({{ Math.round(getBookingAtTime(day, time)!.service.duration_service_in_s / 3600 * 10) / 10 }}h)
                      </span>
                    </div>
                    <div v-if="getBookingAtTime(day, time)!.employee" class="text-white/80 text-xs truncate">
                      {{ getBookingAtTime(day, time)!.employee?.first_name }} {{ getBookingAtTime(day, time)!.employee?.last_name }}
                    </div>

                    <!-- Status Badge -->
                    <div v-if="getBookingAtTime(day, time)!.status" class="mt-auto pt-1">
                      <span class="inline-block px-2 py-0.5 text-xs rounded-full bg-white/25 capitalize font-medium text-white">
                        {{ getBookingAtTime(day, time)!.status }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Preview Booking -->
                <div
                  v-if="getPreviewBookingAtTime(day, time)"
                  class="absolute inset-x-1 rounded-lg text-white text-xs p-2.5 cursor-pointer transition-all duration-300 z-20 outlook-booking-block animate-pulse"
                  :class="getBookingColor(getPreviewBookingAtTime(day, time)!)"
                  style="height: 44px; min-height: 44px;"
                >
                  <div class="flex flex-col h-full">
                    <div class="flex items-center text-white font-semibold text-xs mb-2">
                      <div class="w-1.5 h-1.5 bg-white rounded-full mr-2 animate-pulse" />
                      {{ previewBooking?.start_time }}
                    </div>
                    <div class="font-bold text-sm text-white truncate mb-1">
                      New Booking
                    </div>
                    <div class="text-white/90 text-xs">
                      Creating...
                    </div>
                  </div>
                </div>

                <!-- Empty Slot Hover Indicator -->
                <div
                  v-if="!getBookingAtTime(day, time) && !getPreviewBookingAtTime(day, time) && !(selectedDate && formatDate(selectedDate) === formatDate(day) && selectedTimeSlot === time)"
                  class="opacity-0 hover:opacity-100 transition-all duration-200 text-center w-full h-full flex items-center justify-center group"
                >
                  <div class="bg-gray-700/80 backdrop-blur-sm px-3 py-1 rounded-lg text-gray-300 text-xs font-medium group-hover:bg-blue-600/80 group-hover:text-white transition-all duration-200">
                    + Add booking
                  </div>
                </div>

                <!-- Selected Slot Indicator -->
                <div
                  v-if="!getBookingAtTime(day, time) && !getPreviewBookingAtTime(day, time) && selectedDate && formatDate(selectedDate) === formatDate(day) && selectedTimeSlot === time"
                  class="absolute inset-x-1 inset-y-1 rounded-lg border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center animate-pulse"
                >
                  <div class="text-blue-300 text-xs font-medium">
                    Selected
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create/Edit Booking Side Panel -->
  <div v-if="showCreateModal" class="fixed inset-0 z-50 overflow-hidden">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50" @click="closeModal" />

    <!-- Slide Panel -->
    <div class="absolute right-0 top-0 h-full w-96 bg-gray-800 shadow-xl transform transition-transform duration-300">
      <div class="flex flex-col h-full">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 class="text-lg font-semibold text-white">
            {{ editingBooking ? 'Edit Booking' : 'Create New Booking' }}
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="closeModal"
          />
        </div>

        <!-- Form Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-6">
            <UFormGroup label="Date" required>
              <UInput
                v-model="newBooking.booking_date"
                type="date"
                required
              />
            </UFormGroup>

            <UFormGroup label="Time" required>
              <select
                v-model="newBooking.start_time"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                required
              >
                <option value="">
                  Select time
                </option>
                <option v-for="time in timeSlots" :key="time" :value="time">
                  {{ time }}
                </option>
              </select>
            </UFormGroup>

            <UFormGroup label="Customer" required>
              <select
                v-model="newBooking.customer_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                required
              >
                <option value="">
                  Select customer
                </option>
                <option v-for="customer in clients" :key="(customer as any)?.id" :value="(customer as any)?.id">
                  {{ (customer as any)?.full_name || (customer as any)?.email || 'Unknown Customer' }}
                </option>
              </select>
            </UFormGroup>

            <UFormGroup label="Employee" required>
              <select
                v-model="newBooking.employee_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                required
              >
                <option value="">
                  Select employee
                </option>
                <option v-for="employee in employees" :key="employee.id" :value="employee.id">
                  {{ `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email || 'Unknown Employee' }}
                </option>
              </select>
            </UFormGroup>

            <UFormGroup label="Service" required>
              <select
                v-model="newBooking.service_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                required
              >
                <option value="">
                  Select service
                </option>
                <option v-for="service in services" :key="service.id" :value="service.id">
                  {{ `${service.name || 'Unknown Service'} - $${service.price || 0}` }}
                </option>
              </select>
            </UFormGroup>

            <UFormGroup label="Notes">
              <UTextarea
                v-model="newBooking.notes"
                placeholder="Additional notes..."
              />
            </UFormGroup>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="p-6 border-t border-gray-700">
          <div class="flex justify-end gap-3">
            <UButton
              label="Cancel"
              color="neutral"
              variant="outline"
              @click="closeModal"
            />
            <UButton
              :label="editingBooking ? 'Update Booking' : 'Create Booking'"
              :loading="loading"
              @click="createBooking"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Modern Outlook-style booking blocks */
.outlook-booking-block {
  backdrop-filter: blur(8px);
  transform: translateZ(0);
  will-change: transform, box-shadow;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.outlook-booking-block:hover {
  transform: translateY(-2px) scale(1.02) translateZ(0);
  box-shadow:
    0 10px 25px rgba(0, 0, 0, 0.3),
    0 4px 10px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* Smooth calendar interactions */
.min-h-12 {
  transition: background-color 0.2s ease;
}

.min-h-12:hover {
  background-color: rgba(55, 65, 81, 0.3) !important;
}

/* Better scroll styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(17, 24, 39, 0.5);
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.9);
}

/* Enhanced animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.outlook-booking-block {
  animation: fadeInUp 0.3s ease-out;
}

/* Modern button styles */
.group:hover .group-hover\:bg-blue-600\/80 {
  background-color: rgba(37, 99, 235, 0.8);
}

/* Loading states */
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}

/* Modern Outlook-style booking blocks */
.outlook-booking-block {
  backdrop-filter: blur(8px);
  transform: translateZ(0);
  will-change: transform, box-shadow;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.outlook-booking-block:hover {
  transform: translateY(-2px) scale(1.02) translateZ(0);
  box-shadow:
    0 10px 25px rgba(0, 0, 0, 0.3),
    0 4px 10px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* Smooth calendar interactions */
.min-h-12 {
  transition: background-color 0.2s ease;
}

.min-h-12:hover {
  background-color: rgba(55, 65, 81, 0.3) !important;
}

/* Better scroll styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(17, 24, 39, 0.5);
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.9);
}

/* Enhanced animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.outlook-booking-block {
  animation: fadeInUp 0.3s ease-out;
}

/* Modern button styles */
.group:hover .group-hover\:bg-blue-600\/80 {
  background-color: rgba(37, 99, 235, 0.8);
}

/* Loading states */
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}
</style>

<style scoped>
.calendar-container .booking-grid {
  position: relative;
}

.calendar-container .booking-block {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(4px);
}

.calendar-container .booking-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Smooth transitions for booking interactions */
.booking-block {
  transition: all 0.2s ease;
}

/* Better scroll styling */
.calendar-container::-webkit-scrollbar {
  width: 8px;
}

.calendar-container::-webkit-scrollbar-track {
  background: rgb(17, 24, 39);
}

.calendar-container::-webkit-scrollbar-thumb {
  background: rgb(75, 85, 99);
  border-radius: 4px;
}

.calendar-container::-webkit-scrollbar-thumb:hover {
  background: rgb(107, 114, 128);
}
</style>
