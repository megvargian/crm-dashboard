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

    const method = getMethod(event)

    if (method === 'GET') {
      // GET - Fetch client profiles
      const { data: clientProfiles, error } = await supabase
        .from('client_profile')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to fetch client profiles'
        })
      }

      return clientProfiles || []
    } else {
      throw createError({
        statusCode: 405,
        statusMessage: 'Method not allowed'
      })
    }
  } catch (error) {
    console.error('Client Profiles API error:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
