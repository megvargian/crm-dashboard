<script setup lang="ts">
import { useUserStore } from '~/stores/user'
import { z } from 'zod'

const userStore = useUserStore()
const supabase = useSupabaseClient()
const toast = useToast()

const serviceSchema = z.object({
  name: z.string().min(2, 'Service name must be at least 2 characters'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be positive'),
  categories: z.string().optional(),
  duration_hours: z.coerce.number().min(0, 'Duration must be positive').optional()
})

// Wait for user store to initialize
await userStore.fetchClientProfile()

// Check if user is admin client
if (userStore.clientProfile?.role !== 'admin' || userStore.clientProfile?.user_type !== 'client') {
  throw createError({
    statusCode: 403,
    statusMessage: 'Admin client access required'
  })
}

const { data: services, refresh: refreshServices } = await useFetch('/api/services', { default: () => [] })

const q = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const loading = ref(false)
const editingService = ref(null)

const newService = ref({
  name: '',
  description: '',
  price: 0,
  categories: '',
  duration_hours: 0
})

const editService = ref({
  name: '',
  description: '',
  price: 0,
  categories: '',
  duration_hours: 0
})

const filteredServices = computed(() => {
  if (!services.value) return []
  return services.value.filter((service) => {
    return service.name.search(new RegExp(q.value, 'i')) !== -1
      || (service.description && service.description.search(new RegExp(q.value, 'i')) !== -1)
  })
})

async function addService() {
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...newService.value,
        duration_service_in_s: newService.value.duration_hours * 3600, // Convert hours to seconds
        categories: newService.value.categories
          ? newService.value.categories.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
          : []
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || errorData.error || 'Failed to create service')
    }

    const result = await response.json()

    if (result.error) {
      throw new Error(result.error)
    }

    toast.add({
      title: 'Success',
      description: 'Service added successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    showAddModal.value = false
    newService.value = {
      name: '',
      description: '',
      price: 0,
      categories: '',
      duration_service_h: 0
    }
    await refreshServices()
  } catch (error) {
    console.error('Error adding service:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to add service',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function openEditModal(service) {
  editingService.value = service
  editService.value = {
    name: service.name || '',
    description: service.description || '',
    price: Number(service.price) || 0,
    categories: Array.isArray(service.categories)
      ? service.categories.join(', ')
      : service.categories || '',
    duration_hours: service.duration_service_in_s ? Number(service.duration_service_in_s) / 3600 : 0
  }
  showEditModal.value = true
}

async function updateService() {
  if (!editingService.value) return

  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch(`/api/services?id=${editingService.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        ...editService.value,
        price: Number(editService.value.price), // Ensure price is a number
        duration_service_in_s: Number(editService.value.duration_hours) * 3600, // Convert hours to seconds
        categories: editService.value.categories
          ? (typeof editService.value.categories === 'string'
              ? editService.value.categories.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
              : editService.value.categories)
          : []
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || errorData.error || 'Failed to update service')
    }

    toast.add({
      title: 'Success',
      description: 'Service updated successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    showEditModal.value = false
    editingService.value = null
    await refreshServices()
  } catch (error) {
    console.error('Error updating service:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to update service',
      icon: 'i-lucide-x',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function removeService(serviceId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('No active session')
    }

    const response = await fetch(`/api/services?id=${serviceId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.statusMessage || errorData.error || 'Failed to remove service')
    }

    toast.add({
      title: 'Success',
      description: 'Service removed successfully',
      icon: 'i-lucide-check',
      color: 'success'
    })

    await refreshServices()
  } catch (error) {
    console.error('Error removing service:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to remove service',
      icon: 'i-lucide-x',
      color: 'error'
    })
  }
}
</script>

<template>
  <UDashboardPanel id="services">
    <template #header>
      <UDashboardNavbar title="Services">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            label="Add Service"
            color="primary"
            @click.stop="showAddModal = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4">
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Search services"
          autofocus
          class="max-w-sm"
          @click.stop
        />

        <SettingsServicesList :services="filteredServices" @remove-service="removeService" @edit-service="openEditModal" />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Service Form -->
  <div v-if="showAddModal" class="mt-6">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              Add New Service
            </h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create a new service offering
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
        :schema="serviceSchema"
        :state="newService"
        class="space-y-4"
        @submit="addService"
      >
        <UFormField name="name" label="Service Name" required>
          <UInput v-model="newService.name" placeholder="House Cleaning" />
        </UFormField>

        <UFormField name="description" label="Description">
          <UTextarea v-model="newService.description" placeholder="Detailed description of the service" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField name="price" label="Price ($)" required>
            <UInput
              v-model.number="newService.price"
              type="number"
              step="0.01"
              placeholder="99.99"
            />
          </UFormField>

          <UFormField name="duration_service_h" label="Duration (hours)">
            <UInput
              v-model.number="newService.duration_service_h"
              type="number"
              step="0.5"
              placeholder="2.5"
            />
          </UFormField>
        </div>

        <UFormField name="categories" label="Categories">
          <UInput v-model="newService.categories" placeholder="Cleaning, Maintenance, Repair (comma-separated)" />
        </UFormField>

        <div class="flex gap-2 justify-end">
          <UButton type="button" variant="outline" @click="showAddModal = false">
            Cancel
          </UButton>
          <UButton type="submit" :loading="loading">
            Add Service
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>

  <!-- Edit Service Form -->
  <div v-if="showEditModal" class="mt-6">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              Edit Service
            </h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update service information
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
        :schema="serviceSchema"
        :state="editService"
        class="space-y-4"
        @submit="updateService"
      >
        <UFormField name="name" label="Service Name" required>
          <UInput v-model="editService.name" placeholder="House Cleaning" />
        </UFormField>

        <UFormField name="description" label="Description">
          <UTextarea v-model="editService.description" placeholder="Detailed description of the service" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField name="price" label="Price ($)" required>
            <UInput
              v-model.number="editService.price"
              type="number"
              step="0.01"
              placeholder="99.99"
            />
          </UFormField>

          <UFormField name="duration_service_h" label="Duration (hours)">
            <UInput
              v-model.number="editService.duration_hours"
              type="number"
              step="0.5"
              placeholder="2.5"
            />
          </UFormField>
        </div>

        <UFormField name="categories" label="Categories">
          <UInput v-model="editService.categories" placeholder="Cleaning, Maintenance, Repair (comma-separated)" />
        </UFormField>

        <div class="flex gap-2 justify-end">
          <UButton type="button" variant="outline" @click="showEditModal = false">
            Cancel
          </UButton>
          <UButton type="submit" :loading="loading">
            Update Service
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
