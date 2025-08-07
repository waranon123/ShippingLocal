<!-- frontend/src/components/ErrorBoundary.vue -->
<template>
  <div v-if="!hasError">
    <slot />
  </div>
  <div v-else class="error-boundary">
    <v-container class="text-center py-8">
      <v-icon color="error" size="64" class="mb-4">mdi-alert-circle</v-icon>
      <h2 class="text-h4 mb-4">Something went wrong</h2>
      <p class="text-body-1 mb-4">
        {{ errorMessage }}
      </p>
      
      <!-- Error details (only in development) -->
      <v-expansion-panels v-if="isDev && errorDetails" class="mb-4">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-icon class="mr-2">mdi-bug</v-icon>
            Error Details (Development)
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <pre class="error-details">{{ errorDetails }}</pre>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      
      <!-- Action buttons -->
      <div class="d-flex justify-center gap-4">
        <v-btn color="primary" @click="retry" prepend-icon="mdi-refresh">
          Try Again
        </v-btn>
        <v-btn color="secondary" variant="outlined" @click="goHome" prepend-icon="mdi-home">
          Go Home
        </v-btn>
        <v-btn v-if="canGoBack" color="info" variant="outlined" @click="goBack" prepend-icon="mdi-arrow-left">
          Go Back
        </v-btn>
      </div>
    </v-container>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Props
const props = defineProps({
  fallbackComponent: {
    type: Object,
    default: null
  },
  onError: {
    type: Function,
    default: null
  }
})

// State
const hasError = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')

// Computed
const isDev = computed(() => import.meta.env.DEV)
const canGoBack = computed(() => window.history.length > 1)

// Error capture
onErrorCaptured((error, instance, info) => {
  console.error('ErrorBoundary caught error:', { error, info })
  
  hasError.value = true
  errorMessage.value = error.message || 'An unexpected error occurred'
  
  if (isDev.value) {
    errorDetails.value = JSON.stringify({
      error: error.stack || error.toString(),
      component: instance?.$options?.name || 'Unknown',
      info: info
    }, null, 2)
  }
  
  // Call custom error handler if provided
  if (props.onError) {
    props.onError(error, instance, info)
  }
  
  // Don't propagate the error
  return false
})

// Methods
const retry = () => {
  hasError.value = false
  errorMessage.value = ''
  errorDetails.value = ''
  
  // Force re-render by navigating to the same route
  const currentPath = router.currentRoute.value.fullPath
  router.replace({ path: '/temp' }).then(() => {
    router.replace({ path: currentPath })
  }).catch(() => {
    // If navigation fails, just reload the page
    window.location.reload()
  })
}

const goHome = () => {
  router.push('/dashboard').catch(() => {
    window.location.href = '/dashboard'
  })
}

const goBack = () => {
  router.go(-1)
}

// Expose methods for parent components
defineExpose({
  retry,
  hasError: readonly(hasError)
})
</script>

<style scoped>
.error-boundary {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.error-details {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  font-size: 12px;
  text-align: left;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.gap-4 {
  gap: 16px;
}
</style>