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
const isAdmin = computed(() => userStore.clientProfile?.role === 'admin' && userStore.clientProfile?.user_type === 'client')
const isEmployee = computed(() => userStore.clientProfile?.user_type === 'employee')

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
  headers: authHeaders
})

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
  return clients.value?.map(client => ({
    label: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email || 'Unknown Customer',
    value: client.id
  })) || []
})

const employeeOptions = computed(() => {
  return employees.value?.map(emp => ({
    label: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || 'Unknown Employee',
    value: emp.id
  })) || []
})

const serviceOptions = computed(() => {
  return services.value?.map(service => ({
    label: `${service.name || 'Unknown Service'} - $${service.price || 0}`,
    value: service.id
  })) || []
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
  client_business_id: null, // Will be auto-populated by backend
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

const currentWeekDays = computed(() => {
  const days = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart.value)
    date.setDate(date.getDate() + i)
    days.push(date)
  }
  return days
})

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const formatTime = (date: Date) => {
  return date.toTimeString().slice(0, 5)
}

// Extract time from timestamp string
const extractTimeFromTimestamp = (timestamp: string) => {
  if (!timestamp) return ''
  if (timestamp.includes('T')) {
    // It's a timestamp, extract time
    const date = new Date(timestamp)
    return formatTime(date)
  }
  // It's already a time string
  return timestamp
}

const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const getBookingsForDay = (date: Date) => {
  const dateStr = formatDate(date)
  return bookings.value.filter(booking => booking.booking_date === dateStr)
}

const getBookingAtTime = (date: Date, time: string) => {
  const dateStr = formatDate(date)
  return bookings.value.find(booking =>
    booking.booking_date === dateStr && extractTimeFromTimestamp(booking.start_time) === time
  )
}

// Get all bookings that overlap with a specific time slot
const getBookingsOverlappingTime = (date: Date, time: string) => {
  const dateStr = formatDate(date)
  const slotTime = new Date(`${dateStr}T${time}:00`)

  return bookings.value.filter(booking => {
    if (booking.booking_date !== dateStr) return false

    const startTime = new Date(booking.start_time)
    const endTime = new Date(booking.end_time)

    // Check if this time slot falls within the booking duration
    return slotTime >= startTime && slotTime < endTime
  })
}

// Calculate booking duration in 30-minute slots
const getBookingDurationSlots = (booking: Booking) => {
  const startTime = new Date(booking.start_time)
  const endTime = new Date(booking.end_time)
  const durationMs = endTime.getTime() - startTime.getTime()
  return Math.ceil(durationMs / (30 * 60 * 1000)) // 30 minutes per slot
}

// Check if this is the first slot of a booking
const isBookingStartSlot = (booking: Booking, time: string) => {
  const bookingStartTime = extractTimeFromTimestamp(booking.start_time)
  return bookingStartTime === time
}

// Get booking display color based on status
const getBookingColor = (booking: Booking) => {
  switch (booking.status) {
    case 'confirmed':
      return 'bg-green-600 hover:bg-green-700 border-green-500'
    case 'completed':
      return 'bg-gray-600 hover:bg-gray-700 border-gray-500'
    case 'cancelled':
      return 'bg-red-600 hover:bg-red-700 border-red-500'
    default: // pending
      return 'bg-blue-600 hover:bg-blue-700 border-blue-500'
  }
}

// Event handlers
const handleTimeSlotClick = (date: Date, time: string) => {
  const existingBooking = getBookingAtTime(date, time)
  if (existingBooking) {
    // Edit existing booking
    editBooking(existingBooking)
  } else {
    // Create new booking
    editingBooking.value = null
    selectedDate.value = date
    selectedTimeSlot.value = time
    newBooking.value = {
      customer_id: '',
      client_profile_id: '',
      client_business_id: null,
      employee_id: '',
      service_id: '',
      booking_date: formatDate(date),
      start_time: time,
      notes: ''
    }
    showCreateModal.value = true
  }
}

const editBooking = (booking: Booking) => {
  editingBooking.value = booking
  newBooking.value = {
    customer_id: booking.customer_id,
    client_profile_id: booking.client_profile_id,
    client_business_id: booking.client_business_id || null,
    employee_id: booking.employee_id,
    service_id: booking.service_id,
    booking_date: booking.booking_date,
    start_time: extractTimeFromTimestamp(booking.start_time),
    notes: booking.notes || ''
  }
  showCreateModal.value = true
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
        })

        if (response?.profile) {
          newBooking.value.client_profile_id = response.profile.id || ''
          newBooking.value.client_business_id = response.profile.client_business_id || null
        }
      }
    } catch (error) {
      console.error('Error fetching client profile:', error)
      newBooking.value.client_profile_id = ''
      newBooking.value.client_business_id = null
    }
  } else {
    newBooking.value.client_profile_id = ''
    newBooking.value.client_business_id = null
  }
})

// CRUD operations
const createBooking = async () => {
  try {
    loading.value = true

    // Validate form data
    const validationResult = bookingSchema.safeParse(newBooking.value)
    if (!validationResult.success) {
      const errors = validationResult.error.errors?.map(err => err.message).join(', ') || 'Invalid form data'
      toast.add({
        title: 'Validation Error',
        description: errors,
        color: 'red'
      })
      return
    }

    // Get fresh session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('No active session')
    }

    // Include all booking data including client_profile_id and client_business_id
    const bookingPayload = {
      customer_id: newBooking.value.customer_id,
      client_profile_id: newBooking.value.client_profile_id,
      client_business_id: newBooking.value.client_business_id,
      employee_id: newBooking.value.employee_id,
      service_id: newBooking.value.service_id,
      booking_date: newBooking.value.booking_date,
      start_time: newBooking.value.start_time,
      notes: newBooking.value.notes
    }

    const response = await $fetch('/api/bookings', {
      method: 'POST',
      body: bookingPayload,
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })

    if (response) {
      toast.add({
        title: 'Success',
        description: editingBooking.value ? 'Booking updated successfully' : 'Booking created successfully',
        color: 'green'
      })
      showCreateModal.value = false
      await refreshBookings()
      resetForm()
    }
  } catch (error: any) {
    console.error('Error creating booking:', error)
    toast.add({
      title: 'Error',
      description: error?.data?.message || 'Failed to create booking',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  newBooking.value = {
    customer_id: '',
    client_profile_id: '', // Will be auto-populated by backend
    client_business_id: null, // Will be auto-populated by backend
    employee_id: '',
    service_id: '',
    booking_date: '',
    start_time: '',
    notes: ''
  }
  selectedDate.value = null
  selectedTimeSlot.value = null
}

const closeModal = () => {
  showCreateModal.value = false
  editingBooking.value = null
  resetForm()
}
</script>

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

<template>
  <UDashboardPanel id="calendar">
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

            <UButtonGroup size="sm">
              <UButton
                :variant="viewMode === 'week' ? 'solid' : 'outline'"
                @click="viewMode = 'week'"
              >
                Week
              </UButton>
              <UButton
                :variant="viewMode === 'month' ? 'solid' : 'outline'"
                @click="viewMode = 'month'"
              >
                Month
              </UButton>
            </UButtonGroup>
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
                v-for="(day, dayIndex) in currentWeekDays"
                :key="`${day}-${time}`"
                class="border-r border-gray-700 border-b border-gray-800 min-h-12 p-1 cursor-pointer hover:bg-gray-800 relative transition-colors"
                :class="{ 'bg-gray-800/50': isToday(day), 'bg-gray-900': !isToday(day) }"
                @click.stop="handleTimeSlotClick(day, time)"
              >
                <!-- Booking Block -->
                <div
                  v-for="booking in getBookingsOverlappingTime(day, time)"
                  :key="booking.id"
                  v-show="isBookingStartSlot(booking, time)"
                  class="absolute inset-x-1 rounded-lg border-l-4 text-white text-xs p-2 cursor-pointer transition-all z-10"
                  :class="getBookingColor(booking)"
                  :style="{
                    height: `${getBookingDurationSlots(booking) * 48 - 4}px`,
                    minHeight: '44px'
                  }"
                  @click.stop="editBooking(booking)"
                >
                  <!-- Booking Content -->
                  <div class="flex flex-col h-full">
                    <!-- Time Range -->
                    <div class="font-medium text-xs mb-1 opacity-90">
                      {{ extractTimeFromTimestamp(booking.start_time) }} - {{ extractTimeFromTimestamp(booking.end_time) }}
                    </div>

                    <!-- Customer Name -->
                    <div class="font-semibold truncate mb-1">
                      {{ booking.client_profile?.first_name }} {{ booking.client_profile?.last_name }}
                    </div>

                    <!-- Service Name -->
                    <div class="truncate opacity-90 text-xs">
                      {{ booking.service?.name }}
                    </div>

                    <!-- Employee Name -->
                    <div class="truncate opacity-75 text-xs mt-1" v-if="booking.employee">
                      with {{ booking.employee?.first_name }} {{ booking.employee?.last_name }}
                    </div>

                    <!-- Status Badge -->
                    <div class="mt-auto pt-1">
                      <span class="inline-block px-2 py-1 text-xs rounded-full bg-white/20 capitalize">
                        {{ booking.status }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Empty Slot Indicator -->
                <div
                  v-if="getBookingsOverlappingTime(day, time).length === 0"
                  class="text-gray-600 text-xs opacity-0 hover:opacity-100 transition-opacity text-center w-full h-full flex items-center justify-center"
                >
                  + Add booking
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
    <div class="absolute inset-0 bg-black/50" @click="closeModal"></div>

    <!-- Slide Panel -->
    <div class="absolute right-0 top-0 h-full w-96 bg-gray-800 shadow-xl transform transition-transform duration-300">
      <div class="flex flex-col h-full">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 class="text-lg font-semibold text-white">
            {{ editingBooking ? 'Edit Booking' : 'Create New Booking' }}
          </h3>
          <UButton
            color="gray"
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
                <option value="">Select time</option>
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
                <option value="">Select customer</option>
                <option v-for="customer in clients" :key="customer.id" :value="customer.id">
                  {{ customer.full_name || customer.email || 'Unknown Customer' }}
                </option>
              </select>
            </UFormGroup>

            <UFormGroup label="Employee" required>
              <select
                v-model="newBooking.employee_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                required
              >
                <option value="">Select employee</option>
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
                <option value="">Select service</option>
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
              color="gray"
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
