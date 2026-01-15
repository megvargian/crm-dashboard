<script setup lang="ts">
import { useBookingFlow } from '~/composables/useBookingFlow'

const { bookingState } = useBookingFlow()

// Fetch employees who can provide the selected services
const { data: employees, pending } = await useFetch('/api/employees', {
  default: () => [],
  query: {
    service_ids: computed(() => bookingState.value.selectedServices.join(','))
  }
})

// Filter employees who can provide at least one of the selected services
const availableEmployees = computed(() => {
  if (!employees.value || bookingState.value.selectedServices.length === 0) {
    return employees.value || []
  }

  // For now, show all employees. Later you can filter by employee_services table
  return employees.value
})

const selectEmployee = (employeeId: string) => {
  bookingState.value.selectedEmployee = employeeId
}
</script>

<template>
  <div class="step-employee">
    <div class="step-description">
      <p class="text-gray-400 mb-6">Choose your preferred service provider</p>
    </div>

    <div v-if="pending" class="text-center py-8">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
    </div>

    <div v-else class="employees-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="employee in availableEmployees"
        :key="employee.id"
        class="employee-card p-6 rounded-lg border-2 transition-all cursor-pointer"
        :class="bookingState.selectedEmployee === employee.id
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-700 bg-gray-800 hover:border-gray-600'"
        @click="selectEmployee(employee.id)"
      >
        <div class="flex flex-col items-center text-center">
          <div class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
            {{ employee.first_name?.charAt(0) }}{{ employee.last_name?.charAt(0) }}
          </div>
          <h3 class="text-lg font-semibold text-white mb-1">
            {{ employee.first_name }} {{ employee.last_name }}
          </h3>
          <p v-if="employee.email" class="text-gray-400 text-sm">
            {{ employee.email }}
          </p>
          <div v-if="bookingState.selectedEmployee === employee.id" class="mt-4">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500 text-white">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Selected
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!pending && availableEmployees.length === 0" class="text-center py-8 text-gray-400">
      No service providers available for the selected services.
    </div>
  </div>
</template>

<style scoped>
.employee-card {
  transition: all 0.2s ease;
}

.employee-card:hover {
  transform: translateY(-2px);
}
</style>
