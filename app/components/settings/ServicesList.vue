<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = withDefaults(defineProps<{
  services?: any[]
}>(), {
  services: () => []
})

const emit = defineEmits<{
  removeService: [id: string]
  editService: [service: any]
}>()

const items = (service: any): DropdownMenuItem[] => [{
  label: 'Edit service',
  onSelect: () => emit('editService', service)
}, {
  label: 'Remove service',
  color: 'error' as const,
  onSelect: () => emit('removeService', service.id)
}]
</script>

<template>
  <ul v-if="services?.length" role="list" class="divide-y divide-default">
    <li
      v-for="(service, index) in services"
      :key="index"
      class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <UIcon name="i-lucide-wrench" class="w-6 h-6 text-gray-500" />
        </div>

        <div class="text-sm min-w-0 flex-1">
          <p class="text-highlighted font-medium truncate">
            {{ service.name }}
          </p>
          <p class="text-muted truncate">
            {{ service.description || 'No description' }}
          </p>
          <div class="flex items-center gap-4 mt-1">
            <p class="text-xs text-muted">
              <span class="font-medium">${{ service.price }}</span>
              <span v-if="service.duration_service_in_s"> • {{ Math.round(service.duration_service_in_s / 3600 * 10) / 10 }}h</span>
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex flex-col items-end gap-1">
          <div v-if="service.categories && service.categories.length" class="flex flex-wrap gap-1">
            <UBadge
              v-for="category in service.categories.slice(0, 2)"
              :key="category"
              :label="category"
              size="xs"
              color="gray"
            />
            <UBadge
              v-if="service.categories.length > 2"
              :label="`+${service.categories.length - 2}`"
              size="xs"
              color="gray"
            />
          </div>
        </div>

        <UDropdownMenu :items="items(service)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
          />
        </UDropdownMenu>
      </div>
    </li>

  </ul>

  <div v-else class="py-8 px-4 sm:px-6 text-center">
    <div class="flex flex-col items-center gap-2">
      <UIcon name="i-lucide-wrench" class="w-8 h-8 text-gray-400" />
      <p class="text-sm text-gray-500 dark:text-gray-400">No services found</p>
    </div>
  </div>
</template>
