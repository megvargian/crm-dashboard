<script setup lang="ts">
definePageMeta({
  title: 'Book Appointment',
  layout: false
})

// This page requires a client_profile_id in the URL
// Redirect to an error page or show instructions
const message = 'Invalid booking link. Please use a valid booking URL with a client profile ID.'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-6">
        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h2 class="text-2xl font-bold text-white mb-4">Invalid Booking Link</h2>
      <p class="text-gray-300 mb-6">
        This booking page requires a valid client profile ID in the URL.
      </p>
      <p class="text-sm text-gray-400 mb-8">
        Please contact the business to get the correct booking link.
      </p>

      <a
<script setup lang="ts">
definePageMeta({
  title: 'Book Appointment',
  layout: false
})

// This page requires a client_profile_id in the URL
// Redirect to an error page or show instructions
const message = 'Invalid booking link. Please use a valid booking URL with a client profile ID.'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-6">
        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h2 class="text-2xl font-bold text-white mb-4">Invalid Booking Link</h2>
      <p class="text-gray-300 mb-6">
        This booking page requires a valid client profile ID in the URL.
      </p>
      <p class="text-sm text-gray-400 mb-8">
        Please contact the business to get the correct booking link.
      </p>

      <a
        href="/"
        class="block w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
      >
        Return to Home
      </a>
    </div>
  </div>
</template>
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.9);
}
</style>
