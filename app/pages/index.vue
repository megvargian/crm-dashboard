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
  headers: authHeaders
})
const { data: services } = await useFetch('/api/services', {
  default: () => [],
  headers: authHeaders
})
const { data: clients } = await useFetch('/api/customers', {
  default: () => [],
  headers: authHeaders
})

// Calendar state
const currentDate = ref(new Date())
const selectedDate = ref<Date | null>(null)
const selectedTimeSlot = ref<string | null>(null)
const showCreateModal = ref(false)
const loading = ref(false)
const viewMode = ref<'week' | 'month'>('week')
const editingBooking = ref<Booking | null>(null)

// Form validation
const bookingSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  service_id: z.string().min(1, 'Service is required'),
  booking_date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Time is required'),
  notes: z.string().optional()
})

const newBooking = ref<CreateBookingData>({
  client_id: '',
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
    booking.booking_date === dateStr && booking.start_time === time
  )
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
      client_id: '',
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
    client_id: booking.client_id,
    employee_id: booking.employee_id,
    service_id: booking.service_id,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
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

// CRUD operations
const createBooking = async () => {
  try {
    loading.value = true

    // Validate form data
    const validationResult = bookingSchema.safeParse(newBooking.value)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => err.message).join(', ')
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

    const response = await $fetch('/api/bookings', {
      method: 'POST',
      body: newBooking.value,
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })

    if (response.success) {
      toast.add({
        title: 'Success',
        description: 'Booking created successfully',
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
    client_id: '',
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
                class="border-r border-gray-700 border-b border-gray-800 min-h-12 p-1 cursor-pointer hover:bg-gray-800 relative transition-colors flex items-center justify-center"
                :class="{ 'bg-gray-800/50': isToday(day), 'bg-gray-900': !isToday(day) }"
                @click.stop="handleTimeSlotClick(day, time)"
              >
                <!-- Existing Booking -->
                <div
                  v-if="getBookingAtTime(day, time)"
                  class="bg-blue-600 hover:bg-blue-700 text-white rounded p-2 text-xs w-full h-full min-h-10 flex flex-col justify-center cursor-pointer transition-colors"
                  @click.stop="editBooking(getBookingAtTime(day, time)!)"
                >
                  <div class="font-medium truncate">
                    {{ getBookingAtTime(day, time)?.client_profile?.first_name }} {{ getBookingAtTime(day, time)?.client_profile?.last_name }}
                  </div>
                  <div class="truncate opacity-90">
                    {{ getBookingAtTime(day, time)?.service?.name }}
                  </div>
                </div>

                <!-- Empty Slot Indicator -->
                <div v-else class="text-gray-600 text-xs opacity-0 hover:opacity-100 transition-opacity text-center w-full">
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
              <USelect
                v-model="newBooking.start_time"
                :options="timeSlots.map(time => ({ label: time, value: time }))"
                placeholder="Select time"
                required
              />
            </UFormGroup>

            <UFormGroup label="Client" required>
              <USelect
                v-model="newBooking.client_id"
                :options="clients?.map(client => ({
                  label: `${client.first_name} ${client.last_name}`,
                  value: client.id
                })) || []"
                placeholder="Select client"
                required
              />
            </UFormGroup>

            <UFormGroup label="Employee" required>
              <USelect
                v-model="newBooking.employee_id"
                :options="employees?.map(emp => ({
                  label: `${emp.first_name} ${emp.last_name}`,
                  value: emp.id
                })) || []"
                placeholder="Select employee"
                required
              />
            </UFormGroup>

            <UFormGroup label="Service" required>
              <USelect
                v-model="newBooking.service_id"
                :options="services?.map(service => ({
                  label: `${service.name} - $${service.price}`,
                  value: service.id
                })) || []"
                placeholder="Select service"
                required
              />
            </UFormGroup>

            <UFormGroup label="Notes">
              <UTextarea
                v-model="newBooking.notes"
                placeholder="Additional notes..."
                rows="4"
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
