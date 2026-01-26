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

const { data: stats, error, pending } = await useAsyncData<Stat[]>('booking-stats', async () => {
  try {
    console.log('📊 Fetching booking stats...')

    // Get authentication session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('❌ No active session for stats')
      throw new Error('Authentication required')
    }

    console.log('✅ Session found, making API request')

    // Format dates for API
    const startDate = props.range.start.toISOString().split('T')[0]
    const endDate = props.range.end.toISOString().split('T')[0]

    console.log('📅 Date range:', { startDate, endDate })

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

    console.log('📈 Raw API response:', response)

    if (!response || !Array.isArray(response)) {
      console.error('❌ Invalid response format:', response)
      return []
    }

    // Format the response data
    const formattedStats = response.map((stat) => ({
      title: stat.title,
      icon: stat.icon,
      value: stat.formatter === 'currency' ? formatCurrency(Number(stat.value)) : stat.value,
      variation: stat.variation
    }))

    console.log('✅ Formatted stats:', formattedStats)
    return formattedStats
  } catch (error) {
    console.error('❌ Error fetching booking stats:', error)
    // Return empty array instead of throwing to prevent component failure
    return []
  }
}, {
  watch: [() => props.period, () => props.range],
  default: () => []
})
</script>

<template>
  <div v-if="pending" class="flex justify-center items-center p-8">
    <UIcon name="i-lucide-loader-2" class="animate-spin size-6" />
    <span class="ml-2">Loading stats...</span>
  </div>

  <div v-else-if="error" class="flex justify-center items-center p-8">
    <UAlert
      icon="i-lucide-alert-circle"
      color="error"
      variant="subtle"
      title="Error loading stats"
      :description="error?.message || 'Failed to load booking statistics'"
    />
  </div>

  <div v-else-if="!stats || stats.length === 0" class="flex justify-center items-center p-8">
    <UAlert
      icon="i-lucide-info"
      color="blue"
      variant="subtle"
      title="No data available"
      description="No booking statistics found for the selected date range."
    />
  </div>

  <UPageGrid v-else class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
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
