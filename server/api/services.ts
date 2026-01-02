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

    // Use service role key to bypass RLS for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check authentication for POST, PUT, DELETE requests
    const method = getMethod(event)

    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      // Try to get token from Authorization header first, then from Supabase cookies
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

      // If no valid token from header, try to get session from cookies
      if (!user) {
        try {
          // Get session from cookies using the public supabase client
          const publicSupabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!)

          // Get cookies from request
          const cookies = parseCookies(getHeader(event, 'cookie') || '')

          // Check for Supabase session in cookies
          if (cookies['sb-access-token'] || cookies['supabase.auth.token']) {
            const sessionToken = cookies['sb-access-token'] || cookies['supabase.auth.token']
            if (sessionToken) {
              const { data: userData, error: userError } = await publicSupabase.auth.getUser(sessionToken)
              if (!userError && userData.user) {
                user = userData.user
                token = sessionToken
              }
            }
          }
        } catch (error) {
          console.error('Failed to get session from cookies:', error)
        }
      }

      if (!user || !token) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Authentication required - please login'
        })
      }

      // Check if user is an employee (block access)
      const { data: employee, error: _employeeCheckError } = await supabase
        .from('employee')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (employee) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Employees cannot access service management'
        })
      }

      // Check if user is admin client
      const { data: profile, error: profileError } = await supabase
        .from('client_profile')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError || !profile || profile.role !== 'admin') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Admin access required'
        })
      }
    }

    if (method === 'POST') {
      // Handle service creation
      const body = await readBody(event)

      const { data: service, error: serviceError } = await supabase
        .from('service')
        .insert({
          name: body.name,
          description: body.description,
          price: body.price,
          categories: body.categories,
          duration_service_in_s: body.duration_service_in_s
        })
        .select()
        .single()

      if (serviceError) {
        console.error('Service creation error:', serviceError)
        throw createError({
          statusCode: 400,
          statusMessage: serviceError.message
        })
      }

      return { success: true, service }
    } else if (method === 'PUT') {
      // Handle service update
      const body = await readBody(event)
      const serviceId = getQuery(event).id

      if (!serviceId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Service ID is required'
        })
      }

      const { data: service, error: serviceError } = await supabase
        .from('service')
        .update({
          name: body.name,
          description: body.description,
          price: body.price,
          categories: body.categories,
          duration_service_in_s: body.duration_service_in_s
        })
        .eq('id', serviceId)
        .select()
        .single()

      if (serviceError) {
        console.error('Service update error:', serviceError)
        throw createError({
          statusCode: 400,
          statusMessage: serviceError.message
        })
      }

      return { success: true, service }
    } else if (method === 'DELETE') {
      // Handle service deletion
      const serviceId = getQuery(event).id

      if (!serviceId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Service ID is required'
        })
      }

      const { error: serviceError } = await supabase
        .from('service')
        .delete()
        .eq('id', serviceId)

      if (serviceError) {
        console.error('Service deletion error:', serviceError)
        throw createError({
          statusCode: 400,
          statusMessage: serviceError.message
        })
      }

      return { success: true }
    } else {
      // GET - Fetch services
      const { data: services, error } = await supabase
        .from('service')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch services'
        })
      }

      return services || []
    }
  } catch (error) {
    console.error('Services API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
