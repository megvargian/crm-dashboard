<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<script setup lang="ts">
import type { Customer } from '~/types'
import { useUserStore } from '~/stores/user'
import { z } from 'zod'

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

// Customer validation schema
const customerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone_number: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional()
})

// Wait for user store to initialize
await userStore.fetchClientProfile()

// Check if user is admin or employee
if (userStore.clientProfile?.role !== 'admin' && userStore.clientProfile?.role !== 'employee') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Admin or employee access required'
  })
}

// Data fetching with authorization
const { data: { session } } = await supabase.auth.getSession()
const authHeaders = session ? { 'Authorization': `Bearer ${session.access_token}` } : {}

// Initialize customers data
const customers = ref<Customer[]>([])

// Refresh function
async function refreshCustomers() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch('/api/customers', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch customers')
    }

    const data = await response.json()
    customers.value = data as Customer[]
  } catch (error) {
    console.error('Error refreshing customers:', error)
  }
}

// Initial fetch
await refreshCustomers()

// Search and filters
const searchQuery = ref('')
const genderFilter = ref('all')

// Modal states
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)

// Loading state
const loading = ref(false)

// Customer refs
const editingCustomer = ref<Customer | null>(null)
const customerToDelete = ref<Customer | null>(null)

// Form data
const newCustomer = ref({
  full_name: '',
  email: '',
  phone_number: '',
  gender: '',
  date_of_birth: ''
})

const editCustomer = ref({
  full_name: '',
  email: '',
  phone_number: '',
  gender: '',
  date_of_birth: ''
})

// Computed
const filteredCustomers = computed(() => {
  let filtered = customers.value

  // Apply search filter
  if (searchQuery.value) {
    const searchTerm = searchQuery.value.toLowerCase()
    filtered = filtered.filter(customer =>
      customer.full_name?.toLowerCase().includes(searchTerm)
      || customer.email?.toLowerCase().includes(searchTerm)
      || customer.phone_number?.toLowerCase().includes(searchTerm)
    )
  }

  // Apply gender filter
  if (genderFilter.value !== 'all') {
    filtered = filtered.filter(customer =>
      customer.gender?.toLowerCase() === genderFilter.value.toLowerCase()
    )
  }

  return filtered
})

const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' }
]

// CRUD Operations
async function addCustomer() {
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...newCustomer.value,
        date_of_birth: newCustomer.value.date_of_birth || null,
        gender: newCustomer.value.gender || null,
        phone_number: newCustomer.value.phone_number || null
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to add customer')
    }

    toast.add({
      title: 'Success',
      description: 'Customer added successfully',
      color: 'success'
    })

    showAddModal.value = false
    resetNewCustomerForm()
    await refreshCustomers()
  } catch (error: any) {
    console.error('Error adding customer:', error)
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to add customer',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function openEditModal(customer: Customer) {
  editingCustomer.value = customer
  editCustomer.value = {
    full_name: customer.full_name || '',
    email: customer.email || '',
    phone_number: customer.phone_number || '',
    gender: customer.gender || '',
    date_of_birth: customer.date_of_birth || ''
  }
  showEditModal.value = true
}

async function updateCustomer() {
  if (!editingCustomer.value) return

  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch(`/api/customers?id=${editingCustomer.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...editCustomer.value,
        date_of_birth: editCustomer.value.date_of_birth || null,
        gender: editCustomer.value.gender || null,
        phone_number: editCustomer.value.phone_number || null
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to update customer')
    }

    toast.add({
      title: 'Success',
      description: 'Customer updated successfully',
      color: 'success'
    })

    showEditModal.value = false
    editingCustomer.value = null
    await refreshCustomers()
  } catch (error: any) {
    console.error('Error updating customer:', error)
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to update customer',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function openDeleteModal(customer: Customer) {
  customerToDelete.value = customer
  showDeleteModal.value = true
}

async function deleteCustomer() {
  if (!customerToDelete.value) return

  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
   if (!session) throw new Error('No active session')

    const response = await fetch(`/api/customers?id=${customerToDelete.value.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || 'Failed to delete customer')
    }

    toast.add({
      title: 'Success',
      description: 'Customer deleted successfully',
      color: 'success'
    })

    showDeleteModal.value = false
    customerToDelete.value = null
    await refreshCustomers()
  } catch (error: any) {
    console.error('Error deleting customer:', error)
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to delete customer',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Helper functions
function resetNewCustomerForm() {
  newCustomer.value = {
    full_name: '',
    email: '',
    phone_number: '',
    gender: '',
    date_of_birth: ''
  }
}

function formatDate(dateString: string | undefined) {
  if (!dateString) return 'Not provided'
  return new Date(dateString).toLocaleDateString()
}
</script>

<template>
  <UDashboardPanel id="customers">
    <template #header>
      <UDashboardNavbar title="Customers">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            color="primary"
            label="Add Customer"
            @click="showAddModal = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-1.5 mb-4">
        <UInput
          v-model="searchQuery"
          class="max-w-sm"
          icon="i-lucide-search"
          placeholder="Search customers..."
        />
        <div class="flex items-center gap-1.5">
          <select
            v-model="genderFilter"
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="all">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8">
        Loading customers...
      </div>

      <div v-else-if="filteredCustomers.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
        No customers found.
      </div>

      <div v-else class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Full Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Phone
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Gender
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date of Birth
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th class="relative px-6 py-3">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="customer in filteredCustomers" :key="customer.id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ customer.full_name || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {{ customer.email || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {{ customer.phone_number || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {{ customer.gender || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {{ formatDate(customer.date_of_birth) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {{ formatDate(customer.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex items-center gap-2 justify-end">
                  <UButton
                    icon="i-lucide-edit"
                    color="primary"
                    variant="ghost"
                    size="sm"
                    @click="openEditModal(customer)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    @click="openDeleteModal(customer)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Customer Modal -->
  <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="showAddModal = false">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add New Customer</h3>
      <form @submit.prevent="addCustomer">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name *
            </label>
            <UInput
              v-model="newCustomer.full_name"
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <UInput
              v-model="newCustomer.email"
              type="email"
              placeholder="Enter email"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <UInput
              v-model="newCustomer.phone_number"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender
            </label>
            <select
              v-model="newCustomer.gender"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date of Birth
            </label>
            <UInput
              v-model="newCustomer.date_of_birth"
              type="date"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <UButton
            type="button"
            variant="ghost"
            @click="showAddModal = false"
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            :loading="loading"
            :disabled="!newCustomer.full_name"
          >
            Add Customer
          </UButton>
        </div>
      </form>
    </div>
  </div>

  <!-- Edit Customer Modal -->
  <div v-if="showEditModal && editingCustomer" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="showEditModal = false">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Customer</h3>
      <form @submit.prevent="updateCustomer">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name *
            </label>
            <UInput
              v-model="editCustomer.full_name"
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <UInput
              v-model="editCustomer.email"
              type="email"
              placeholder="Enter email"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number
            </label>
            <UInput
              v-model="editCustomer.phone_number"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender
            </label>
            <select
              v-model="editCustomer.gender"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date of Birth
            </label>
            <UInput
              v-model="editCustomer.date_of_birth"
              type="date"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6">
          <UButton
            type="button"
            variant="ghost"
            @click="showEditModal = false"
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            :loading="loading"
            :disabled="!editCustomer.full_name"
          >
            Update Customer
          </UButton>
        </div>
      </form>
    </div>
  </div>

  <!-- Delete Customer Modal -->
  <div v-if="showDeleteModal && customerToDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="showDeleteModal = false">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Delete Customer</h3>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        Are you sure you want to delete <strong>{{ customerToDelete.full_name }}</strong>?
        This action cannot be undone.
      </p>

      <div class="flex justify-end gap-2">
        <UButton
          variant="ghost"
          @click="showDeleteModal = false"
        >
          Cancel
        </UButton>
        <UButton
          color="error"
          :loading="loading"
          @click="deleteCustomer"
        >
          Delete
        </UButton>
      </div>
    </div>
  </div>
</template>
