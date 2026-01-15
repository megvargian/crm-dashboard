import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const phone = getQuery(event).phone as string

  if (!phone) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Phone number is required'
    })
  }

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseServiceKey = config.supabaseServiceKey

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
    })
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase configuration is missing'
    })
  }

  // Use service role for public access
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Query customer table by phone number
    const { data: customers, error } = await supabase
      .from('customer')
      .select('id, full_name, email, phone_number, gender')
      .eq('phone_number', phone)
      .limit(1)

    if (error) {
      console.error('Error checking phone:', error)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to check phone number: ${error.message}`
      })
    }

    if (customers && customers.length > 0) {
      return {
        exists: true,
        customer: customers[0]
      }
    }

    return {
      exists: false,
      customer: null
    }
  } catch (error: any) {
    console.error('Error in check-phone endpoint:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})
