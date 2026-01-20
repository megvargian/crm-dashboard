<script setup lang="ts">
import type { Period, Range, Stat } from '~/types'

const props = defineProps<{
  period: Period
  range: Range
}>()

const supabase = useSupabaseClient()

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

const { data: stats } = await useAsyncData<Stat[]>('booking-stats', async () => {
  try {
    // Get authentication session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('No active session for stats')
      return []
    }

    // Format dates for API
    const startDate = props.range.start.toISOString().split('T')[0]
    const endDate = props.range.end.toISOString().split('T')[0]

    // Fetch booking statistics
    const response = await $fetch<any[]>('/api/booking-stats', {
      query: {
        start_date: startDate,
        end_date: endDate
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    })

    // Format the response data
    return response.map((stat) => ({
      title: stat.title,
      icon: stat.icon,
      value: stat.formatter === 'currency' ? formatCurrency(stat.value) : stat.value,
      variation: stat.variation
    }))
  } catch (error) {
    console.error('Error fetching booking stats:', error)
    return []
  }
}, {
  watch: [() => props.period, () => props.range],
  default: () => []
})
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard
      v-for="(stat, index) in stats"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      to="/customers"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex items-center gap-2">
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>

        <UBadge
          :color="stat.variation > 0 ? 'success' : 'error'"
          variant="subtle"
          class="text-xs"
        >
          {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
