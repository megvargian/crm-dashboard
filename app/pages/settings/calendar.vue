<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import type { Booking, CreateBookingData } from '~/types/booking'
import { z } from 'zod'

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

// Data fetching
const { data: bookings, refresh: refreshBookings } = await useFetch<Booking[]>('/api/bookings', {
  default: () => []
})

const { data: employees } = await useFetch('/api/employees', { default: () => [] })
const { data: services } = await useFetch('/api/services', { default: () => [] })
const { data: clients } = await useFetch('/api/customers', { default: () => [] })

// Form state
const showCreateModal = ref(false)
const loading = ref(false)

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

// Calendar state
const currentDate = ref(new Date())
const selectedDate = ref(new Date())

// Calendar computed values
const currentMonth = computed(() => {
  const month = currentDate.value.getMonth()
  const year = currentDate.value.getFullYear()
  return new Date(year, month, 1)
})

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  return new Date(year, month + 1, 0).getDate()
})

const firstDayOfWeek = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  return new Date(year, month, 1).getDay()
})

const monthName = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const calendarDays = computed(() => {
  const days = []
  const totalCells = 42 // 6 weeks × 7 days

  // Previous month's trailing days
  for (let i = firstDayOfWeek.value - 1; i >= 0; i--) {
    const prevMonth = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 0)
    days.push({
      date: prevMonth.getDate() - i,
      isCurrentMonth: false,
      fullDate: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonth.getDate() - i)
    })
  }

  // Current month's days
  for (let day = 1; day <= daysInMonth.value; day++) {
    days.push({
      date: day,
      isCurrentMonth: true,
      fullDate: new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), day)
    })
  }

  // Next month's leading days
  const remainingCells = totalCells - days.length
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonth = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, day)
    days.push({
      date: day,
      isCurrentMonth: false,
      fullDate: nextMonth
    })
  }

  return days
})

const bookingsForDate = (date: Date) => {
  if (!bookings.value) return []
  const dateString = date.toISOString().split('T')[0]
  return bookings.value.filter(booking => booking.booking_date === dateString)
}

const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const isSelected = (date: Date) => {
  return date.toDateString() === selectedDate.value.toDateString()
}

// Navigation functions
const previousMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

const selectDate = (date: Date) => {
  selectedDate.value = date
  if (isAdmin.value) {
    newBooking.value.booking_date = date.toISOString().split('T')[0]
  }
}

// Booking functions
const openCreateModal = (date?: Date) => {
  if (!isAdmin.value) return

  if (date) {
    selectDate(date)
  }
  showCreateModal.value = true
}

const resetForm = () => {
  newBooking.value = {
    client_id: '',
    employee_id: '',
    service_id: '',
    booking_date: selectedDate.value.toISOString().split('T')[0],
    start_time: '',
    notes: ''
  }
}

const createBooking = async () => {
  if (!isAdmin.value) return

  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(newBooking.value)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to create booking')
    }

    toast.add({
      title: 'Success',
      description: 'Booking created successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    showCreateModal.value = false
    resetForm()
    await refreshBookings()
  } catch (error) {
    console.error('Error creating booking:', error)
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to create booking',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Initialize form when modal opens
watch(showCreateModal, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})
</script>

<template>
  <div>
    <UPageCard
      title="Calendar"
      :description="isAdmin ? 'View and manage bookings' : 'View your assigned bookings'"
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        v-if="isAdmin"
        label="New Booking"
        color="neutral"
        class="w-fit lg:ms-auto"
        @click="openCreateModal()"
      />
    </UPageCard>

    <!-- Calendar Navigation -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ monthName }}
      </h2>
      <div class="flex items-center gap-2">
        <UButton
          variant="outline"
          size="sm"
          icon="i-lucide-chevron-left"
          @click="previousMonth"
        />
        <UButton
          variant="outline"
          size="sm"
          @click="currentDate = new Date()"
        >
          Today
        </UButton>
        <UButton
          variant="outline"
          size="sm"
          icon="i-lucide-chevron-right"
          @click="nextMonth"
        />
      </div>
    </div>

    <!-- Calendar Grid -->
    <UCard class="overflow-hidden">
      <!-- Week Headers -->
      <div class="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        <div
          v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
          :key="day"
          class="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
        >
          {{ day }}
        </div>
      </div>

      <!-- Calendar Days -->
      <div class="grid grid-cols-7">
        <div
          v-for="(day, index) in calendarDays"
          :key="index"
          class="min-h-24 border-r border-b border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          :class="[
            !day.isCurrentMonth && 'bg-gray-50 dark:bg-gray-900 text-gray-400',
            isToday(day.fullDate) && 'bg-blue-50 dark:bg-blue-900/20',
            isSelected(day.fullDate) && 'ring-2 ring-blue-500'
          ]"
          @click="selectDate(day.fullDate)"
          @dblclick="openCreateModal(day.fullDate)"
        >
          <div class="flex items-start justify-between">
            <span
              class="text-sm font-medium"
              :class="[
                !day.isCurrentMonth && 'text-gray-400',
                isToday(day.fullDate) && 'text-blue-600 dark:text-blue-400'
              ]"
            >
              {{ day.date }}
            </span>
            <UButton
              v-if="isAdmin && day.isCurrentMonth"
              variant="ghost"
              size="xs"
              icon="i-lucide-plus"
              class="opacity-0 group-hover:opacity-100"
              @click.stop="openCreateModal(day.fullDate)"
            />
          </div>

          <!-- Bookings for this date -->
          <div class="mt-1 space-y-1">
            <div
              v-for="booking in bookingsForDate(day.fullDate).slice(0, 3)"
              :key="booking.id"
              class="text-xs p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 truncate"
            >
              {{ booking.start_time }} - {{ booking.service?.name }}
            </div>
            <div
              v-if="bookingsForDate(day.fullDate).length > 3"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              +{{ bookingsForDate(day.fullDate).length - 3 }} more
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Selected Date Info -->
    <div v-if="bookingsForDate(selectedDate).length" class="mt-6">
      <h3 class="text-lg font-semibold mb-3">
        Bookings for {{ selectedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) }}
      </h3>
      <div class="grid gap-3">
        <UCard
          v-for="booking in bookingsForDate(selectedDate)"
          :key="booking.id"
          class="p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-medium">{{ booking.service?.name }}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ booking.start_time }} - {{ booking.end_time }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Client: {{ booking.client_profile?.first_name }} {{ booking.client_profile?.last_name }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Employee: {{ booking.employee?.first_name }} {{ booking.employee?.last_name }}
              </p>
            </div>
            <div class="text-right">
              <p class="font-medium">${{ booking.total_price }}</p>
              <UBadge
                :color="booking.status === 'confirmed' ? 'green' : booking.status === 'pending' ? 'yellow' : booking.status === 'completed' ? 'blue' : 'red'"
                class="capitalize"
              >
                {{ booking.status }}
              </UBadge>
            </div>
          </div>
          <p v-if="booking.notes" class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Notes: {{ booking.notes }}
          </p>
        </UCard>
      </div>
    </div>

    <!-- Create Booking Modal -->
    <UModal v-if="isAdmin" v-model="showCreateModal">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              Create New Booking
            </h3>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              @click="showCreateModal = false"
            />
          </div>
        </template>

        <UForm
          :schema="bookingSchema"
          :state="newBooking"
          class="space-y-4"
          @submit="createBooking"
        >
          <UFormField name="client_id" label="Client" required>
            <USelectMenu
              v-model="newBooking.client_id"
              :options="clients.map(client => ({
                label: `${client.first_name} ${client.last_name}`,
                value: client.id
              }))"
              placeholder="Select client"
            />
          </UFormField>

          <UFormField name="service_id" label="Service" required>
            <USelectMenu
              v-model="newBooking.service_id"
              :options="services.map(service => ({
                label: `${service.name} - $${service.price}`,
                value: service.id
              }))"
              placeholder="Select service"
            />
          </UFormField>

          <UFormField name="employee_id" label="Employee" required>
            <USelectMenu
              v-model="newBooking.employee_id"
              :options="employees.map(employee => ({
                label: `${employee.first_name} ${employee.last_name}`,
                value: employee.id
              }))"
              placeholder="Select employee"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="booking_date" label="Date" required>
              <UInput v-model="newBooking.booking_date" type="date" />
            </UFormField>

            <UFormField name="start_time" label="Start Time" required>
              <UInput v-model="newBooking.start_time" type="time" />
            </UFormField>
          </div>

          <UFormField name="notes" label="Notes">
            <UTextarea v-model="newBooking.notes" placeholder="Additional notes or instructions" />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton type="button" variant="outline" @click="showCreateModal = false">
              Cancel
            </UButton>
            <UButton type="submit" :loading="loading">
              Create Booking
            </UButton>
          </div>
        </UForm>
      </UCard>
    </UModal>
  </div>
</template>
