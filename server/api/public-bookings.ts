import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Schema for booking creation from public booking page
const createBookingSchema = z.object({
  client_profile_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  service_id: z.string().uuid(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  start_time: z.string(), // HH:MM format
  notes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl
  const supabaseServiceKey = config.supabaseServiceKey

  if (!supabaseUrl || !supabaseServiceKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase configuration is missing'
    })
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const method = getMethod(event)

  // Only allow POST for public bookings
  if (method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed. Use POST to create bookings.'
    })
  }

  const body = await readBody(event)

  // Validate request body
  const validation = createBookingSchema.safeParse(body)
  if (!validation.success) {
    console.error('Validation failed:', validation.error)
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid booking data: ${validation.error?.errors?.map(e => e.message).join(', ') || 'Validation error'}`
    })
  }

  const { customer_id, client_profile_id, employee_id, service_id, booking_date, start_time, notes } = validation.data

  try {
    // Get client_business_id from client_profile
    const { data: clientProfile, error: clientProfileError } = await supabase
      .from('client_profile')
      .select('client_business_id')
      .eq('id', client_profile_id)
      .single()

    if (clientProfileError || !clientProfile || !clientProfile.client_business_id) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Client profile not found or has no associated business'
      })
    }

    // Get service details to calculate end time
    const { data: service, error: serviceError } = await supabase
      .from('service')
      .select('duration_service_in_s, price')
      .eq('id', service_id)
      .single()

    if (serviceError || !service) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Service not found'
      })
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customer')
      .select('id')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Customer not found'
      })
    }

    // Convert start_time (HH:MM) to full timestamp
    const startDateTime = new Date(`${booking_date}T${start_time}:00`)
    const endDateTime = new Date(startDateTime.getTime() + (service.duration_service_in_s * 1000))

    // Format as ISO strings for database
    const startTimeISO = startDateTime.toISOString()
    const endTimeISO = endDateTime.toISOString()

    // Check for booking conflicts (same employee, overlapping time)
    const { data: conflicts, error: conflictError } = await supabase
      .from('booking')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('booking_date', booking_date)
      .or(`and(start_time.lte.${endTimeISO},end_time.gte.${startTimeISO})`)

    if (conflictError) {
      console.error('Error checking booking conflicts:', conflictError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to check booking availability'
      })
    }

    if (conflicts && conflicts.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This time slot is already booked'
      })
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('booking')
      .insert({
        customer_id,
        client_profile_id,
        client_business_id: clientProfile.client_business_id,
        employee_id,
        service_id,
        booking_date,
        start_time: startTimeISO,
        end_time: endTimeISO,
        status: 'pending',
        total_price: service.price,
        notes: notes || null
      })
      .select(`
        *,
        customer(*),
        employee(*),
        service(*)
      `)
      .single()

    if (bookingError) {
      console.error('Error creating booking:', bookingError)
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to create booking: ${bookingError.message}`
      })
    }

    return booking
  } catch (error: any) {
    // Re-throw if it's already a formatted error
    if (error.statusCode) {
      throw error
    }

    console.error('Unexpected error creating public booking:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'An unexpected error occurred while creating the booking'
    })
  }
})
