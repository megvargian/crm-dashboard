
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const createBookingSchema = z.object({
  client_id: z.string().uuid('Invalid client ID'),
  employee_id: z.string().uuid('Invalid employee ID'),
  service_id: z.string().uuid('Invalid service ID'),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  notes: z.string().optional()
})

const updateBookingSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID').optional(),
  service_id: z.string().uuid('Invalid service ID').optional(),
  booking_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  notes: z.string().optional()
})

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

    const method = getMethod(event)

    // For employees: only allow GET requests to view their own bookings
    const { data: employee } = await supabase
      .from('employee')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (employee) {
      if (method !== 'GET') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Employees can only view bookings'
        })
      }

      // Return only bookings assigned to this employee
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          client_profile!bookings_client_id_fkey(first_name, last_name, email),
          employee!bookings_employee_id_fkey(first_name, last_name, email),
          services!bookings_service_id_fkey(name, price, duration_service_in_s)
        `)
        .eq('employee_id', user.id)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to fetch bookings: ${error.message}`
        })
      }

      return bookings || []
    }

    // For admin clients: full CRUD access
    const { data: clientProfile } = await supabase
      .from('client_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!clientProfile || clientProfile.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admin access required'
      })
    }

    switch (method) {
      case 'GET':
        const { data: allBookings, error: fetchError } = await supabase
          .from('bookings')
          .select(`
            *,
            client_profile!bookings_client_id_fkey(first_name, last_name, email),
            employee!bookings_employee_id_fkey(first_name, last_name, email),
            services!bookings_service_id_fkey(name, price, duration_service_in_s)
          `)
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true })

        if (fetchError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to fetch bookings: ${fetchError.message}`
          })
        }

        return allBookings || []

      case 'POST':
        const body = await readBody(event)
        const validatedData = createBookingSchema.parse(body)

        // Get service details to calculate end time and price
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('price, duration_service_in_s')
          .eq('id', validatedData.service_id)
          .single()

        if (serviceError || !service) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid service ID'
          })
        }

        // Calculate end time
        const startTime = new Date(`${validatedData.booking_date}T${validatedData.start_time}:00`)
        const endTime = new Date(startTime.getTime() + (service.duration_service_in_s * 1000))
        const endTimeString = endTime.toTimeString().substring(0, 5)

        const bookingData = {
          ...validatedData,
          end_time: endTimeString,
          total_price: service.price,
          status: 'pending' as const
        }

        const { data: newBooking, error: insertError } = await supabase
          .from('bookings')
          .insert(bookingData)
          .select(`
            *,
            client_profile!bookings_client_id_fkey(first_name, last_name, email),
            employee!bookings_employee_id_fkey(first_name, last_name, email),
            services!bookings_service_id_fkey(name, price, duration_service_in_s)
          `)
          .single()

        if (insertError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to create booking: ${insertError.message}`
          })
        }

        return newBooking

      case 'PUT':
        const updateBody = await readBody(event)
        const { id: bookingId } = getQuery(event)

        if (!bookingId) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Booking ID is required'
          })
        }

        const validatedUpdateData = updateBookingSchema.parse(updateBody)
        let finalUpdateData = { ...validatedUpdateData }

        // If service is being changed, recalculate end time and price
        if (validatedUpdateData.service_id || validatedUpdateData.start_time || validatedUpdateData.booking_date) {
          const currentBookingQuery = await supabase
            .from('bookings')
            .select('service_id, booking_date, start_time')
            .eq('id', bookingId)
            .single()

          if (currentBookingQuery.error) {
            throw createError({
              statusCode: 404,
              statusMessage: 'Booking not found'
            })
          }

          const serviceId = validatedUpdateData.service_id || currentBookingQuery.data.service_id
          const bookingDate = validatedUpdateData.booking_date || currentBookingQuery.data.booking_date
          const startTime = validatedUpdateData.start_time || currentBookingQuery.data.start_time

          const { data: updatedService, error: serviceError } = await supabase
            .from('services')
            .select('price, duration_service_in_s')
            .eq('id', serviceId)
            .single()

          if (serviceError || !updatedService) {
            throw createError({
              statusCode: 400,
              statusMessage: 'Invalid service ID'
            })
          }

          const startDateTime = new Date(`${bookingDate}T${startTime}:00`)
          const endDateTime = new Date(startDateTime.getTime() + (updatedService.duration_service_in_s * 1000))

          finalUpdateData.end_time = endDateTime.toTimeString().substring(0, 5)
          finalUpdateData.total_price = updatedService.price
        }

        const { data: updatedBooking, error: updateError } = await supabase
          .from('bookings')
          .update(finalUpdateData)
          .eq('id', bookingId)
          .select(`
            *,
            client_profile!bookings_client_id_fkey(first_name, last_name, email),
            employee!bookings_employee_id_fkey(first_name, last_name, email),
            services!bookings_service_id_fkey(name, price, duration_service_in_s)
          `)
          .single()

        if (updateError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to update booking: ${updateError.message}`
          })
        }

        return updatedBooking

      case 'DELETE':
        const { id: deleteId } = getQuery(event)

        if (!deleteId) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Booking ID is required'
          })
        }

        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', deleteId)

        if (deleteError) {
          throw createError({
            statusCode: 500,
            statusMessage: `Failed to delete booking: ${deleteError.message}`
          })
        }

        return { success: true }

      default:
        throw createError({
          statusCode: 405,
          statusMessage: 'Method not allowed'
        })
    }
  } catch (error) {
    console.error('Bookings API error:', error)
    if (error.statusCode) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
