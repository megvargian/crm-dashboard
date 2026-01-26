<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Period, Range } from '~/types'

const props = defineProps<{
  period: Period
  range: Range
}>()

const UBadge = resolveComponent('UBadge')
const supabase = useSupabaseClient()

interface Booking {
  id: string
  booking_date: string
  status: string
  customer_id: string
  service?: {
    name?: string
    price?: number
  }
}

const { data: bookings, error } = await useAsyncData<Booking[]>('recent-bookings', async () => {
  try {
    // Get authentication session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log('❌ No session for bookings')
      return []
    }

    // Format dates for API
    const startDate = props.range.start.toISOString().split('T')[0]
    const endDate = props.range.end.toISOString().split('T')[0]

    console.log('📊 Fetching bookings for date range:', { startDate, endDate })

    // Use the same API endpoint as stats for consistent filtering
    const response = await $fetch<any[]>('/api/booking-stats', {
      query: {
        start_date: startDate,
        end_date: endDate,
        chart_data: 'true'
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })

    console.log('📋 Bookings API response:', { count: response?.length, data: response?.slice(0, 2) })

    // Take only the first 5 bookings for the table
    const recentBookings = Array.isArray(response) ? response.slice(0, 5) : []

    return recentBookings
  } catch (error) {
    console.error('Error fetching recent bookings:', error)
    return []
  }
}, {
  watch: [() => props.period, () => props.range],
  default: () => []
})

const columns: TableColumn<Booking>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => `#${row.getValue('id')?.toString().slice(-4) || 'N/A'}`
  },
  {
    accessorKey: 'booking_date',
    header: 'Date',
    cell: ({ row }) => {
      const date = row.getValue('booking_date') as string
      return new Date(date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const color = {
        pending: 'warning' as const,
        confirmed: 'blue' as const,
        completed: 'success' as const,
        cancelled: 'error' as const
      }[status] || 'neutral' as const

      return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () =>
        status
      )
    }
  },
  {
    accessorKey: 'service',
    header: 'Service',
    cell: ({ row }) => {
      const service = row.getValue('service') as any
      return service?.name || 'N/A'
    }
  },
  {
    accessorKey: 'service',
    header: () => h('div', { class: 'text-right' }, 'Amount'),
    cell: ({ row }) => {
      const service = row.getValue('service') as any
      const amount = service?.price || 0

      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(amount)

      return h('div', { class: 'text-right font-medium' }, formatted)
    }
  }
]
</script>

<template>
  <div v-if="error" class="flex justify-center items-center p-8">
    <UAlert
      icon="i-lucide-alert-circle"
      color="error"
      variant="subtle"
      title="Error loading bookings"
      description="Failed to load recent bookings data"
    />
  </div>

  <div v-else-if="!bookings || bookings.length === 0" class="flex justify-center items-center p-8">
    <UAlert
      icon="i-lucide-info"
      color="blue"
      variant="subtle"
      title="No bookings found"
      description="No bookings found for the selected date range."
    />
  </div>

  <UTable
    v-else
    :data="bookings"
    :columns="columns"
    class="shrink-0"
    :ui="{
      base: 'table-fixed border-separate border-spacing-0',
      thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
      tbody: '[&>tr]:last:[&>td]:border-b-0',
      th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
      td: 'border-b border-default'
    }"
  />
</template>
