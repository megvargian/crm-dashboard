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
  console.log('get-client-profile API called')

  try {
    const config = useRuntimeConfig()

    // Try multiple ways to get the configuration for better Netlify compatibility
    const supabaseUrl = config.supabaseUrl
      || config.public?.supabaseUrl
      || process.env.SUPABASE_URL
      || process.env.NUXT_SUPABASE_URL

    const supabaseServiceKey = config.supabaseServiceKey
      || config.supabase?.serviceKey
      || process.env.SUPABASE_SECRET_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.NUXT_SUPABASE_SERVICE_KEY

    console.log('Supabase URL exists:', !!supabaseUrl)
    console.log('Supabase Service Key exists:', !!supabaseServiceKey)
    console.log('Config keys:', Object.keys(config))

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')))
      throw createError({
        statusCode: 500,
        statusMessage: 'Supabase configuration missing'
      })
    }

    // Use service role key to bypass RLS for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // First check if user is an employee
    const { data: employee, error: employeeError } = await supabase
      .from('employee')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (employeeError) {
      console.error('Employee check error:', employeeError)
      // Don't throw here, just continue to check client_profile
    }

    // If user is an employee, return employee data
    if (employee) {
      console.log('User is employee:', employee.id)
      return {
        profile: {
          ...employee,
          user_type: 'employee'
        }
      }
    }

    console.log('User is not employee, checking client_profile for user ID:', user.id)

    // If not an employee, check client_profile table
    const { data: profile, error: profileError } = await supabase
      .from('client_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Profile error:', profileError)
      throw createError({
        statusCode: 500,
        statusMessage: `Profile error: ${profileError.message}`
      })
    }

    if (!profile) {
      console.error('No profile found for user:', user.id)
      throw createError({
        statusCode: 404,
        statusMessage: 'User profile not found'
      })
    }

    console.log('Found client profile:', profile.id)

    return {
      profile: {
        ...profile,
        user_type: 'client'
      }
    }
  } catch (error) {
    console.error('Client profile API error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      statusMessage: error.statusMessage
    })

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message}`
    })
  }
})
