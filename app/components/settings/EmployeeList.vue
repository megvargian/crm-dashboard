<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Employee } from '~/types'

const props = defineProps<{
  employees: Employee[]
}>()

const emit = defineEmits<{
  removeEmployee: [id: string]
  editEmployee: [employee: Employee]
}>()

const items = (employee: Employee): DropdownMenuItem[] => [{
  label: 'Edit employee',
  onSelect: () => emit('editEmployee', employee)
}, {
  label: 'Remove employee',
  color: 'error' as const,
  onSelect: () => emit('removeEmployee', employee.id)
}]
</script>

<template>
  <ul role="list" class="divide-y divide-default">
    <li
      v-for="(employee, index) in employees"
      :key="index"
      class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
    >
      <div class="flex items-center gap-3 min-w-0">
        <UAvatar
          :alt="employee.full_name"
          :text="employee.full_name?.split(' ').map(n => n[0]).join('') || 'E'"
          size="md"
        />

        <div class="text-sm min-w-0">
          <p class="text-highlighted font-medium truncate">
            {{ employee.full_name }}
          </p>
          <p class="text-muted truncate">
            {{ employee.email }}
          </p>
          <p class="text-xs text-muted">
            {{ employee.phone_number }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <UBadge
          :label="employee.role"
          :color="employee.role === 'admin' ? 'blue' : 'gray'"
          size="xs"
        />
        <UBadge
          :label="employee.is_active ? 'Active' : 'Inactive'"
          :color="employee.is_active ? 'green' : 'red'"
          size="xs"
        />

        <UDropdownMenu :items="items(employee)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
          />
        </UDropdownMenu>
      </div>
    </li>
  </ul>
</template>
