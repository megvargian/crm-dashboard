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
    const config = useRuntimeConfig()
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = config.supabase?.serviceKey || process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
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

    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      token = authorizationHeader.replace('Bearer ', '')
      const { data: userData, error: userError } = await supabase.auth.getUser(token)
      if (!userError && userData.user) {
        user = userData.user
      }
    }

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    // Check if user is admin
    const { data: clientProfile } = await supabase
      .from('client_profile')
      .select('role, id, client_business_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (clientProfile?.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }

    // Get query parameters for date range
    const query = getQuery(event)
    const startDate = query.start_date as string
    const endDate = query.end_date as string

    // Build base query with role-based filtering
    let queryBuilder = supabase
      .from('booking')
      .select(`
        *,
        service(price, name),
        client_profile(first_name, last_name),
        employee(first_name, last_name)
      `)

    // Filter by client_business_id if available, otherwise by client_profile_id
    if (clientProfile.client_business_id) {
      queryBuilder = queryBuilder.eq('client_business_id', clientProfile.client_business_id)
    } else {
      queryBuilder = queryBuilder.eq('client_profile_id', clientProfile.id)
    }

    // Apply date range filter if provided
    if (startDate && endDate) {
      queryBuilder = queryBuilder
        .gte('booking_date', startDate)
        .lte('booking_date', endDate)
    }

    // Execute query to get all bookings for calculations
    const { data: bookings, error: bookingsError } = await queryBuilder
    if (bookingsError) {
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
        .select('*, service(price)')

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
      return sum + (booking.service?.price || 0)
    }, 0) || 0

    const prevTotalRevenue = prevBookings.reduce((sum, booking) => {
      return sum + (booking.service?.price || 0)
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
        value: totalBookings,
        variation: bookingsVariation
      },
      {
        title: 'Revenue',
        icon: 'i-lucide-circle-dollar-sign',
        value: totalRevenue,
        variation: revenueVariation,
        formatter: 'currency'
      },
      {
        title: 'Customers',
        icon: 'i-lucide-users',
        value: uniqueCustomers,
        variation: customersVariation
      },
      {
        title: 'Completed',
        icon: 'i-lucide-check-circle',
        value: completedBookings,
        variation: completedVariation
      }
    ]

    return stats
  } catch (error: unknown) {
    console.error('Error fetching booking stats:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to fetch booking statistics'
    })
  }
})
