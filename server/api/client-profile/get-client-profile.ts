import { createClient } from '@supabase/supabase-js'

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

    // Get authorization header
    const authorizationHeader = getHeader(event, 'authorization')

    if (!authorizationHeader) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authorization header is required'
      })
    }

    const token = authorizationHeader.replace('Bearer ', '')

    // Verify token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid token'
      })
    }

    // Get client profile data
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
      throw createError({
        statusCode: 404,
        statusMessage: 'Client profile not found'
      })
    }

    return { profile }
  } catch (error) {
    console.error('Client profile API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
