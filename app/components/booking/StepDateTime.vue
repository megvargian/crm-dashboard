<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'

const { bookingState } = useBookingFlow()

const selectedDate = ref<Date | null>(null)
const currentMonth = ref(new Date())

// Generate time slots (8 AM to 8 PM, 30-minute intervals)
const timeSlots = computed(() => {
  const slots = []
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 20 && minute > 0) break // Stop at 8:00 PM
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      slots.push(time)
    }
  }
  return slots
})

// Fetch bookings for the selected employee and date
const { data: existingBookings, refresh: refreshBookings } = await useFetch('/api/bookings', {
  lazy: true,
  server: false,
  default: () => [],
  query: computed(() => ({
    employee_id: bookingState.value.selectedEmployee,
    date: selectedDate.value ? formatDate(selectedDate.value) : null
  })),
  watch: [selectedDate, () => bookingState.value.selectedEmployee]
})

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const isTimeSlotAvailable = (time: string) => {
  if (!selectedDate.value || !existingBookings.value) return true

  const dateStr = formatDate(selectedDate.value)

  // Convert the time slot to minutes for comparison
  const [slotHour, slotMinute] = time.split(':').map(Number)
  const slotTimeInMinutes = slotHour * 60 + slotMinute

  return !existingBookings.value.some((booking: any) => {
    const bookingDate = booking.booking_date.split('T')[0]
    if (bookingDate !== dateStr) return false

    // Extract start and end times
    const startTime = booking.start_time.includes('T')
      ? booking.start_time.slice(11, 16)
      : booking.start_time.slice(0, 5)

    const endTime = booking.end_time.includes('T')
      ? booking.end_time.slice(11, 16)
      : booking.end_time.slice(0, 5)

    // Convert start and end times to minutes
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startTimeInMinutes = startHour * 60 + startMinute

    const [endHour, endMinute] = endTime.split(':').map(Number)
    const endTimeInMinutes = endHour * 60 + endMinute

    // Check if the slot falls within the booking range (inclusive of both start and end)
    return slotTimeInMinutes >= startTimeInMinutes && slotTimeInMinutes <= endTimeInMinutes
  })
}

const selectTimeSlot = (time: string) => {
  if (!selectedDate.value) return

  // Don't allow selecting unavailable time slots
  if (!isTimeSlotAvailable(time)) return

  bookingState.value.selectedDate = formatDate(selectedDate.value)
  bookingState.value.selectedTime = time
}

const isSelected = (time: string) => {
  return bookingState.value.selectedTime === time &&
         bookingState.value.selectedDate === (selectedDate.value ? formatDate(selectedDate.value) : null)
}

// Calendar helpers
const daysInMonth = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days = []
  const startPadding = firstDay.getDay() // 0 = Sunday

  // Add empty slots for padding
  for (let i = 0; i < startPadding; i++) {
    days.push(null)
  }

  // Add actual days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  return days
})

const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const isPastDate = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

const selectDate = (date: Date | null) => {
  if (!date || isPastDate(date)) return
  selectedDate.value = date
}

const isDateSelected = (date: Date) => {
  return selectedDate.value?.toDateString() === date.toDateString()
}

const previousMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1)
}

const nextMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1)
}

const monthName = computed(() => {
  return currentMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

watch(selectedDate, () => {
  refreshBookings()
})
</script>

<template>
  <div class="step-datetime">
    <div class="step-description">
      <p class="text-gray-400 mb-6">Select a date and time for your appointment</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Calendar -->
      <div class="calendar-section">
        <div class="flex items-center justify-between mb-4">
          <button @click="previousMonth" class="p-2 hover:bg-gray-700 rounded-lg transition">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 class="text-lg font-semibold text-white">{{ monthName }}</h3>
          <button @click="nextMonth" class="p-2 hover:bg-gray-700 rounded-lg transition">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div class="calendar-grid grid grid-cols-7 gap-2">
          <div v-for="day in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']" :key="day"
               class="text-center text-sm font-medium text-gray-400 py-2">
            {{ day }}
          </div>

          <div
            v-for="(date, index) in daysInMonth"
            :key="index"
            class="aspect-square flex items-center justify-center rounded-lg text-sm transition-all cursor-pointer"
            :class="{
              'bg-blue-500 text-white font-bold': date && isDateSelected(date),
              'bg-blue-500/20 text-blue-400 font-bold': date && isToday(date) && !isDateSelected(date),
              'text-gray-400 hover:bg-gray-700': date && !isPastDate(date) && !isDateSelected(date) && !isToday(date),
              'text-gray-600 cursor-not-allowed': date && isPastDate(date),
              '': !date
            }"
            @click="selectDate(date)"
          >
            {{ date?.getDate() }}
          </div>
        </div>
      </div>

      <!-- Time Slots -->
      <div class="time-slots-section">
        <h3 class="text-lg font-semibold text-white mb-4">
          {{ selectedDate ? 'Available Times' : 'Select a date first' }}
        </h3>

        <div v-if="selectedDate" class="time-slots-grid grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-2">
          <button
            v-for="time in timeSlots"
            :key="time"
            class="py-3 px-4 rounded-lg text-sm font-medium transition-all relative"
            :class="{
              'bg-blue-500 text-white': isSelected(time),
              'bg-gray-700 text-white hover:bg-gray-600': !isSelected(time) && isTimeSlotAvailable(time),
              'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50': !isTimeSlotAvailable(time)
            }"
            :disabled="!isTimeSlotAvailable(time)"
            @click="selectTimeSlot(time)"
          >
            {{ time }}
            <span v-if="!isTimeSlotAvailable(time)" class="absolute top-1 right-1 text-xs">🔒</span>
          </button>
        </div>

        <div v-else class="text-center py-8 text-gray-400">
          Please select a date to see available time slots
        </div>

        <!-- Legend -->
        <div v-if="selectedDate" class="mt-4 flex gap-4 text-xs text-gray-400 justify-center">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-gray-700 rounded"></div>
            <span>Available</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-gray-800 opacity-50 rounded"></div>
            <span>Booked</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="bookingState.selectedDate && bookingState.selectedTime"
         class="mt-6 p-4 bg-blue-500/10 border border-blue-500 rounded-lg">
      <p class="text-blue-400 text-center">
        <span class="font-semibold">Selected:</span>
        {{ bookingState.selectedDate }} at {{ bookingState.selectedTime }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.time-slots-grid::-webkit-scrollbar {
  width: 6px;
}

.time-slots-grid::-webkit-scrollbar-track {
  background: rgba(17, 24, 39, 0.5);
  border-radius: 3px;
}

.time-slots-grid::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 3px;
}

.time-slots-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.9);
}
</style>
