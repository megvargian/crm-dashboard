import { createClient } from '@supabase/supabase-js'

// Helper function to parse cookies
function parseCookies(cookieHeader: string) {
  const cookies: Record<string, string> = {}
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=').map(c => c.trim())
      if (name && value) {
        cookies[name] = decodeURIComponent(value)
      }
    })
  }
  return cookies
}

export default eventHandler(async (event) => {
  try {
    console.log('🔍 Booking stats API called')
    const config = useRuntimeConfig()
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = config.supabase?.serviceKey || process.env.SUPABASE_SECRET_KEY

    console.log('📊 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyPrefix: supabaseServiceKey?.substring(0, 20) + '...'
    })

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase configuration')
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const method = getMethod(event)

    if (method !== 'GET') {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
      })
    }

    // Get authentication
    let token = null
    let user = null
    const authorizationHeader = getHeader(event, 'authorization')

    console.log('🔐 Auth check:', { hasAuthHeader: !!authorizationHeader })

    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      token = authorizationHeader.replace('Bearer ', '')
      const { data: userData, error: userError } = await supabase.auth.getUser(token)
      if (!userError && userData.user) {
        user = userData.user
        console.log('✅ User authenticated:', user.id)
      } else {
        console.error('❌ User authentication failed:', userError)
      }
    }

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    // Check if user is admin
    console.log('🔍 Fetching client profile for user:', user.id)
    const { data: clientProfile, error: profileError } = await supabase
      .from('client_profile')
      .select('role, id, client_business_id')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('👤 Client profile:', clientProfile, profileError)

    if (profileError) {
      console.error('❌ Error fetching client profile:', profileError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch client profile: ${profileError.message}`
      })
    }

    if (clientProfile?.role !== 'admin') {
      console.error('❌ Access denied - not admin:', clientProfile?.role)
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }

    // Get query parameters for date range and chart flag
    const query = getQuery(event)
    const startDate = query.start_date as string
    const endDate = query.end_date as string
    const isChartData = query.chart_data === 'true'

    console.log('📅 Query params:', { startDate, endDate, isChartData })

    // Build base query with role-based filtering
    // Only select fields needed for stats calculations
    let queryBuilder = supabase
      .from('booking')
      .select(`
        id,
        status,
        customer_id,
        service_id,
        booking_date,
        service!inner(price)
      `)

    // Filter by client_business_id if available, otherwise by client_profile_id
    if (clientProfile.client_business_id) {
      queryBuilder = queryBuilder.eq('client_business_id', clientProfile.client_business_id)
      console.log('🏢 Filtering by client_business_id:', clientProfile.client_business_id)
    } else {
      queryBuilder = queryBuilder.eq('client_profile_id', clientProfile.id)
      console.log('👤 Filtering by client_profile_id:', clientProfile.id)
    }

    // Apply date range filter if provided
    if (startDate && endDate) {
      queryBuilder = queryBuilder
        .gte('booking_date', startDate)
        .lte('booking_date', endDate)
    }

    // Execute query to get all bookings for calculations
    console.log('🔍 Executing booking query...')
    const { data: bookings, error: bookingsError } = await queryBuilder

    console.log('📊 Query result:', {
      bookingsCount: bookings?.length || 0,
      error: bookingsError
    })

    if (bookingsError) {
      console.error('❌ Bookings query failed:', bookingsError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to fetch bookings: ${bookingsError.message}`
      })
    }

    // Get previous period for comparison (same duration, but earlier)
    let prevBookings = []
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const duration = end.getTime() - start.getTime()

      const prevStart = new Date(start.getTime() - duration).toISOString().split('T')[0]
      const prevEnd = new Date(end.getTime() - duration).toISOString().split('T')[0]

      let prevQueryBuilder = supabase
        .from('booking')
        .select(`
          id,
          status,
          customer_id,
          service_id,
          booking_date,
          service!inner(price)
        `)

      if (clientProfile.client_business_id) {
        prevQueryBuilder = prevQueryBuilder.eq('client_business_id', clientProfile.client_business_id)
      } else {
        prevQueryBuilder = prevQueryBuilder.eq('client_profile_id', clientProfile.id)
      }

      const { data: prevBookingsData } = await prevQueryBuilder
        .gte('booking_date', prevStart)
        .lte('booking_date', prevEnd)

      prevBookings = prevBookingsData || []
    }

    // Calculate statistics
    const totalBookings = bookings?.length || 0
    const prevTotalBookings = prevBookings.length
    const bookingsVariation = prevTotalBookings > 0
      ? Math.round(((totalBookings - prevTotalBookings) / prevTotalBookings) * 100)
      : 0

    // Calculate revenue
    const totalRevenue = bookings?.reduce((sum, booking) => {
      const price = Number(booking.service?.price || 0)
      return sum + (isNaN(price) ? 0 : price)
    }, 0) || 0

    const prevTotalRevenue = prevBookings.reduce((sum, booking) => {
      const price = Number(booking.service?.price || 0)
      return sum + (isNaN(price) ? 0 : price)
    }, 0)

    const revenueVariation = prevTotalRevenue > 0
      ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100)
      : 0

    // Calculate unique customers
    const uniqueCustomers = new Set(bookings?.map(b => b.customer_id) || []).size
    const prevUniqueCustomers = new Set(prevBookings.map(b => b.customer_id)).size
    const customersVariation = prevUniqueCustomers > 0
      ? Math.round(((uniqueCustomers - prevUniqueCustomers) / prevUniqueCustomers) * 100)
      : 0

    // Calculate completed bookings
    const completedBookings = bookings?.filter(b => b.status === 'completed').length || 0
    const prevCompletedBookings = prevBookings.filter(b => b.status === 'completed').length
    const completedVariation = prevCompletedBookings > 0
      ? Math.round(((completedBookings - prevCompletedBookings) / prevCompletedBookings) * 100)
      : 0

    const stats = [
      {
        title: 'Total Bookings',
        icon: 'i-lucide-calendar',
        value: Number(totalBookings),
        variation: Number(bookingsVariation) || 0
      },
      {
        title: 'Revenue',
        icon: 'i-lucide-circle-dollar-sign',
        value: Number(totalRevenue),
        variation: Number(revenueVariation) || 0,
        formatter: 'currency'
      },
      {
        title: 'Customers',
        icon: 'i-lucide-users',
        value: Number(uniqueCustomers),
        variation: Number(customersVariation) || 0
      },
      {
        title: 'Completed',
        icon: 'i-lucide-check-circle',
        value: Number(completedBookings),
        variation: Number(completedVariation) || 0
      }
    ]

    console.log('📈 Final stats:', stats)

    // If chart data is requested, return the bookings data instead
    if (isChartData) {
      console.log('📊 Returning chart data instead of stats')
      return bookings || []
    }

    return stats
  } catch (error: unknown) {
    console.error('Error fetching booking stats:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to fetch booking statistics'
    })
  }
})
