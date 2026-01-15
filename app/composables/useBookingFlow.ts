import { ref, computed } from 'vue'

export interface BookingFlowState {
  clientProfileId: string | null
  selectedServices: string[]
  selectedEmployee: string | null
  selectedDate: string | null
  selectedTime: string | null
  customerInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
    gender: 'male' | 'female' | 'other' | ''
  }
  existingCustomerId: string | null
}

const bookingState = ref<BookingFlowState>({
  clientProfileId: null,
  selectedServices: [],
  selectedEmployee: null,
  selectedDate: null,
  selectedTime: null,
  customerInfo: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: ''
  },
  existingCustomerId: null
})

const currentStep = ref(1)

export const useBookingFlow = () => {
  const resetBooking = () => {
    const savedClientProfileId = bookingState.value.clientProfileId
    bookingState.value = {
      clientProfileId: savedClientProfileId, // Preserve the client profile ID
      selectedServices: [],
      selectedEmployee: null,
      selectedDate: null,
      selectedTime: null,
      customerInfo: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: ''
      },
      existingCustomerId: null
    }
    currentStep.value = 1
  }

  const goToStep = (step: number) => {
    if (step >= 1 && step <= 4) {
      currentStep.value = step
    }
  }

  const nextStep = () => {
    if (currentStep.value < 4) {
      currentStep.value++
    }
  }

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--
    }
  }

  const canProceedToStep2 = computed(() => {
    return bookingState.value.selectedServices.length > 0
  })

  const canProceedToStep3 = computed(() => {
    return bookingState.value.selectedEmployee !== null
  })

  const canProceedToStep4 = computed(() => {
    return bookingState.value.selectedDate !== null && bookingState.value.selectedTime !== null
  })

  const isComplete = computed(() => {
    const info = bookingState.value.customerInfo
    return info.firstName && info.lastName && info.email && info.phone && info.gender
  })

  return {
    bookingState,
    currentStep,
    resetBooking,
    goToStep,
    nextStep,
    prevStep,
    canProceedToStep2,
    canProceedToStep3,
    canProceedToStep4,
    isComplete
  }
}
