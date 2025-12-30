<script setup lang="ts">
import type { Employee } from '~/types'
import { useUserStore } from '~/stores/user'
import { z } from 'zod'

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

const employeeSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone_number: z.string().optional(),
  service_types: z.string().optional(),
  role: z.enum(['employee', 'admin']),
  start_working_hour: z.string().optional(),
  end_working_hours: z.string().optional(),
  working_week_days: z.string().optional()
})

// Check if user is admin client
if (userStore.clientProfile?.role !== 'admin' || userStore.clientProfile?.user_type !== 'client') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Admin client access required'
  })
}

const { data: employees, refresh: refreshEmployees } = await useFetch<Employee[]>('/api/employees', { default: () => [] })
const { data: services } = await useFetch('/api/services', { default: () => [] })

const q = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const loading = ref(false)
const editingEmployee = ref<Employee | null>(null)
const selectedServices = ref<string[]>([])
const editSelectedServices = ref<string[]>([])

const newEmployee = ref<{
  full_name: string
  email: string
  password: string
  phone_number?: string
  service_types?: string
  role: 'employee' | 'admin'
  start_working_hour?: string
  end_working_hours?: string
  working_week_days?: string
}>({
  full_name: '',
  email: '',
  password: '',
  phone_number: '',
  service_types: '',
  role: 'employee',
  start_working_hour: '',
  end_working_hours: '',
  working_week_days: ''
})

const editEmployee = ref<{
  full_name: string
  email: string
  phone_number?: string
  service_types?: string
  role: 'employee' | 'admin'
  start_working_hour?: string
  end_working_hours?: string
  working_week_days?: string
}>({
  full_name: '',
  email: '',
  phone_number: '',
  service_types: '',
  role: 'employee',
  start_working_hour: '',
  end_working_hours: '',
  working_week_days: ''
})

const filteredEmployees = computed(() => {
  return employees.value.filter((employee) => {
    return employee.full_name.search(new RegExp(q.value, 'i')) !== -1 || employee.email.search(new RegExp(q.value, 'i')) !== -1
  })
})

async function addEmployee() {
  loading.value = true
  try {
    // Get the current user's session
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    // Send to server API which will handle both auth user creation and employee record
    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...newEmployee.value,
        service_types: newEmployee.value.service_types
          ? newEmployee.value.service_types.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          : [],
        working_week_days: newEmployee.value.working_week_days
          ? newEmployee.value.working_week_days.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          : []
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || errorData.error || 'Failed to create employee')
    }

    const result = await response.json()

    if (result.error) {
      throw new Error(result.error)
    }

    // Assign services if any selected
    if (selectedServices.value.length > 0) {
      await assignServicesToEmployee(result.employee.id, selectedServices.value)
    }

    toast.add({
      title: 'Success',
      description: 'Employee added successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    showAddModal.value = false
    selectedServices.value = []
    newEmployee.value = {
      full_name: '',
      email: '',
      password: '',
      phone_number: '',
      service_types: '',
      role: 'employee',
      start_working_hour: '',
      end_working_hours: '',
      working_week_days: ''
    }
    await refreshEmployees()
  } catch (error) {
    console.error('Error adding employee:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to add employee',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function assignServicesToEmployee(employeeId: string, serviceIds: string[]) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    // First, remove all existing assignments
    const currentAssignments = await fetch(`/api/employee-services?employee_id=${employeeId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })

    if (currentAssignments.ok) {
      const assignments = await currentAssignments.json()
      for (const assignment of assignments) {
        await fetch(`/api/employee-services?employee_id=${employeeId}&service_id=${assignment.service_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
      }
    }

    // Then add new assignments
    for (const serviceId of serviceIds) {
      await fetch('/api/employee-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          employee_id: employeeId,
          service_id: serviceId
        })
      })
    }
  } catch (error) {
    console.error('Error assigning services:', error)
    throw error
  }
}

async function openEditModal(employee: Employee) {
  editingEmployee.value = employee
  editEmployee.value = {
    full_name: employee.full_name || '',
    email: employee.email || '',
    phone_number: employee.phone_number || '',
    service_types: Array.isArray(employee.service_types)
      ? employee.service_types.join(', ')
      : employee.service_types || '',
    role: 'employee',
    start_working_hour: employee.start_working_hour || '',
    end_working_hours: employee.end_working_hours || '',
    working_week_days: Array.isArray(employee.working_week_days)
      ? employee.working_week_days.join(', ')
      : employee.working_week_days || ''
  }

  // Load current services for this employee
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const response = await fetch(`/api/employee-services?employee_id=${employee.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (response.ok) {
        const assignments = await response.json()
        editSelectedServices.value = assignments.map((assignment: any) => assignment.service_id)
      }
    }
  } catch (error) {
    console.error('Failed to load employee services:', error)
    editSelectedServices.value = []
  }

  showEditModal.value = true
}

async function updateEmployee() {
  if (!editingEmployee.value) return

  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    const updateData: Partial<Employee> = {
      full_name: editEmployee.value.full_name,
      phone_number: editEmployee.value.phone_number,
      service_types: editEmployee.value.service_types
        ? editEmployee.value.service_types.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0).join(', ')
        : '',
      role: editEmployee.value.role,
      start_working_hour: editEmployee.value.start_working_hour,
      end_working_hours: editEmployee.value.end_working_hours,
      working_week_days: editEmployee.value.working_week_days
        ? editEmployee.value.working_week_days.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0).join(', ')
        : ''
    }

    const { error } = await supabase
      .from('employee')
      .update(updateData)
      .eq('id', editingEmployee.value.id)

    if (error) throw error

    toast.add({
      title: 'Success',
      description: 'Employee updated successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    // Update service assignments
    if (editingEmployee.value) {
      await assignServicesToEmployee(editingEmployee.value.id, editSelectedServices.value)
    }

    showEditModal.value = false
    editingEmployee.value = null
    editSelectedServices.value = []
    await refreshEmployees()
  } catch (error) {
    console.error('Error updating employee:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to update employee',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function removeEmployee(employeeId: string) {
  try {
    const { error } = await supabase
      .from('employee')
      .delete()
      .eq('id', employeeId)

    if (error) throw error

    toast.add({
      title: 'Success',
      description: 'Employee removed successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    await refreshEmployees()
  } catch (error) {
    console.error('Error removing employee:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to remove employee',
      icon: 'i-lucide-x',
      color: 'error'
    })
  }
}
</script>

<template>
  <div>
    <UPageCard
      title="Employees"
      description="Manage employees and their access."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        label="Add Employee"
        color="neutral"
        class="w-fit lg:ms-auto"
        @click.stop="showAddModal = true"
      />
    </UPageCard>

    <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch', header: 'p-4 mb-0 border-b border-default' }">
      <template #header>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Search employees"
          autofocus
          class="w-full"
          @click.stop
        />
      </template>

      <SettingsEmployeeList :employees="filteredEmployees" @remove-employee="removeEmployee" @edit-employee="openEditModal" />
    </UPageCard>

    <!-- Add Employee Form -->
    <div v-if="showAddModal" class="mt-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Add New Employee
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Create a new employee account
              </p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              class="-my-1"
              @click="showAddModal = false"
            />
          </div>
        </template>
        <UForm
          :schema="employeeSchema"
          :state="newEmployee"
          class="space-y-4"
          @submit="addEmployee"
        >
          <UFormField name="full_name" label="Full Name" required>
            <UInput v-model="newEmployee.full_name" placeholder="John Doe" />
          </UFormField>

          <UFormField name="email" label="Email" required>
            <UInput v-model="newEmployee.email" type="email" placeholder="john@example.com" />
          </UFormField>

          <UFormField name="password" label="Temporary Password" required>
            <UInput v-model="newEmployee.password" type="password" placeholder="Enter temporary password" />
          </UFormField>

          <UFormField name="phone_number" label="Phone Number">
            <UInput v-model="newEmployee.phone_number" placeholder="+1234567890" />
          </UFormField>

          <UFormField name="service_types" label="Service Types">
            <UInput v-model="newEmployee.service_types" placeholder="Cleaning, Maintenance, Repair (comma-separated)" />
          </UFormField>

          <UFormField name="role" label="Role">
            <USelect
              v-model="newEmployee.role"
              :options="[
                { label: 'Employee', value: 'employee' },
                { label: 'Admin', value: 'admin' }
              ]"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="start_working_hour" label="Start Hour">
              <UInput v-model="newEmployee.start_working_hour" type="time" />
            </UFormField>

            <UFormField name="end_working_hours" label="End Hour">
              <UInput v-model="newEmployee.end_working_hours" type="time" />
            </UFormField>
          </div>

          <UFormField name="working_week_days" label="Working Days">
            <UInput v-model="newEmployee.working_week_days" placeholder="Monday, Tuesday, Wednesday, Thursday, Friday (comma-separated)" />
          </UFormField>

          <UFormField name="assigned_services" label="Assigned Services">
            <USelectMenu
              v-model="selectedServices"
              :options="services.map((service: { name: any; price: any; id: any; description: any; duration_service_in_s: any }) => ({
                label: `${service.name} - $${service.price}`,
                value: service.id,
                name: service.name,
                description: service.description,
                price: service.price,
                duration_service_in_s: service.duration_service_in_s
              }))"
              multiple
              searchable
              searchable-placeholder="Search services..."
              placeholder="Select services for this employee"
              option-attribute="label"
              value-attribute="value"
              :search-attributes="['name', 'description']"
              class="w-full"
            >
              <template #option="{ option }">
                <div class="flex items-center justify-between w-full">
                  <div>
                    <div class="font-medium">
                      {{ option.name }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ option.description }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-semibold">
                      ${{ option.price }}
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ Math.round(option.duration_service_in_s / 3600 * 10) / 10 }}h
                    </div>
                  </div>
                </div>
              </template>

              <template #option-empty="{ query }">
                <q>{{ query }}</q> not found
              </template>
            </USelectMenu>
          </UFormField>

          <div class="flex gap-2 justify-end">
            <UButton type="button" variant="outline" @click="showAddModal = false">
              Cancel
            </UButton>
            <UButton type="submit" :loading="loading">
              Add Employee
            </UButton>
          </div>
        </UForm>
      </UCard>
    </div>

    <!-- Edit Employee Form -->
    <div v-if="showEditModal" class="mt-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Edit Employee
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Update employee information
              </p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              class="-my-1"
              @click="showEditModal = false"
            />
          </div>
        </template>
        <UForm
          :schema="employeeSchema.partial({ password: true })"
          :state="editEmployee"
          class="space-y-4"
          @submit="updateEmployee"
        >
          <UFormField name="full_name" label="Full Name" required>
            <UInput v-model="editEmployee.full_name" placeholder="John Doe" />
          </UFormField>

          <UFormField name="email" label="Email" required>
            <UInput
              v-model="editEmployee.email"
              type="email"
              placeholder="john@example.com"
              disabled
            />
          </UFormField>

          <UFormField name="phone_number" label="Phone Number">
            <UInput v-model="editEmployee.phone_number" placeholder="+1234567890" />
          </UFormField>

          <UFormField name="service_types" label="Service Types">
            <UInput v-model="editEmployee.service_types" placeholder="Cleaning, Maintenance, Repair (comma-separated)" />
          </UFormField>

          <UFormField name="role" label="Role">
            <USelect
              v-model="editEmployee.role"
              :options="[
                { label: 'Employee', value: 'employee' },
                { label: 'Admin', value: 'admin' }
              ]"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-4">
            <UFormField name="start_working_hour" label="Start Hour">
              <UInput v-model="editEmployee.start_working_hour" type="time" />
            </UFormField>

            <UFormField name="end_working_hours" label="End Hour">
              <UInput v-model="editEmployee.end_working_hours" type="time" />
            </UFormField>
          </div>

          <UFormField name="working_week_days" label="Working Days">
            <UInput v-model="editEmployee.working_week_days" placeholder="Monday, Tuesday, Wednesday, Thursday, Friday (comma-separated)" />
          </UFormField>

          <UFormField name="assigned_services" label="Assigned Services">
            <USelectMenu
              v-model="editSelectedServices"
              :options="services.map((service: { name: any; price: any; id: any; description: any; duration_service_in_s: any }) => ({
                label: `${service.name} - $${service.price}`,
                value: service.id,
                name: service.name,
                description: service.description,
                price: service.price,
                duration_service_in_s: service.duration_service_in_s
              }))"
              multiple
              searchable
              searchable-placeholder="Search services..."
              placeholder="Select services for this employee"
              option-attribute="label"
              value-attribute="value"
              :search-attributes="['name', 'description']"
              class="w-full"
            >
              <template #option="{ option }">
                <div class="flex items-center justify-between w-full">
                  <div>
                    <div class="font-medium">
                      {{ option.name }}
                    </div>
                    <div class="text-sm text-gray-500">
                      {{ option.description }}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-semibold">
                      ${{ option.price }}
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ Math.round(option.duration_service_in_s / 3600 * 10) / 10 }}h
                    </div>
                  </div>
                </div>
              </template>

              <template #option-empty="{ query }">
                <q>{{ query }}</q> not found
              </template>
            </USelectMenu>
          </UFormField>

          <div class="flex gap-2 justify-end">
            <UButton type="button" variant="outline" @click="showEditModal = false">
              Cancel
            </UButton>
            <UButton type="submit" :loading="loading">
              Update Employee
            </UButton>
          </div>
        </UForm>
      </UCard>
    </div>
  </div>
</template>
