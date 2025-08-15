<template>
  <v-container fluid class="pa-0 tv-view">
    <v-carousel
      v-model="currentSlide"
      :show-arrows="false"
      hide-delimiter-background
      delimiter-icon="mdi-circle"
      height="100vh"
      cycle
      :interval="intervalTime"
      class="full-screen-carousel"
      @update:model-value="handleCarouselChange"
    >
      <v-carousel-item v-for="(shippingGroup, index) in shippingPages" :key="index">
        <div class="full-height">
          <v-card class="elevation-4 rounded-xl pa-10 mx-auto card-container">
            <v-card-title class="text-h2 font-weight-bold text-center py-8 primary-text">
              Shipping Group - Page {{ index + 1 }} / {{ shippingPages.length }}
            </v-card-title>
            
            <v-table class="tv-table">
              <thead>
                <tr>
                  <th class="text-left text-h5 font-weight-bold">Shipping No.</th>
                  <th class="text-left text-h5 font-weight-bold">Dock Code</th>
                  <th class="text-left text-h5 font-weight-bold">Route</th>
                  <th class="text-left text-h5 font-weight-bold">Preparation</th>
                  <th class="text-left text-h5 font-weight-bold">Loading</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="truck in shippingGroup.trucks" :key="truck.id" class="tv-row">
                  <td class="text-h5 font-weight-medium">{{ truck.shipping_no }}</td>
                  <td class="text-h5 font-weight-medium">{{ truck.dock_code }}</td>
                  <td class="text-h5 font-weight-medium">{{ truck.truck_route }}</td>
                  <td>
                    <v-chip
                      :color="getStatusColor(truck.status_preparation)"
                      class="font-weight-bold text-h5 pa-5 white--text"
                      style="min-width: 140px;"
                    >
                      {{ truck.status_preparation }}
                    </v-chip>
                    <div class="text-h6 mt-3 text-neutral-600">
                      {{ formatTime(truck.preparation_start) }} - {{ formatTime(truck.preparation_end) }}
                    </div>
                  </td>
                  <td>
                    <v-chip
                      :color="getStatusColor(truck.status_loading)"
                      class="font-weight-bold text-h5 pa-5 white--text"
                      style="min-width: 140px;"
                    >
                      {{ truck.status_loading }}
                    </v-chip>
                    <div class="text-h6 mt-3 text-neutral-600">
                      {{ formatTime(truck.loading_start) }} - {{ formatTime(truck.loading_end) }}
                    </div>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </div>
      </v-carousel-item>
      
      <!-- No Data Slide -->
      <v-carousel-item v-if="shippingPages.length === 0 || (shippingPages.length === 1 && shippingPages[0].trucks.length === 0)">
        <div class="full-height">
          <v-card class="elevation-4 rounded-xl pa-10 mx-auto card-container">
            <v-card-text class="text-center">
              <v-icon size="120" color="grey" class="mb-4">mdi-truck-remove</v-icon>
              <div class="text-h2 text-grey">No Trucks Available</div>
              <div class="text-h5 text-grey mt-4">
                {{ loading ? 'Loading data...' : 'No truck data for today' }}
              </div>
            </v-card-text>
          </v-card>
        </div>
      </v-carousel-item>
      
      <v-progress-linear v-if="loading" indeterminate color="primary" class="loading-bar" />
      
      <v-snackbar v-model="showError" color="error" :timeout="5000" bottom>
        {{ truckStore.error }}
        <template v-slot:actions>
          <v-btn color="white" variant="text" @click="showError = false">Close</v-btn>
        </template>
      </v-snackbar>
    </v-carousel>
    
    <!-- Control Panel (for debugging) -->
    <v-card v-if="showControls" class="control-panel">
      <v-card-text>
        <v-row>
          <v-col cols="12">
            <v-slider
              v-model="intervalTime"
              :min="3000"
              :max="30000"
              :step="1000"
              label="Interval (ms)"
              thumb-label
            ></v-slider>
          </v-col>
          <v-col cols="12">
            <div class="text-body-2 mb-2">
              <strong>Statistics:</strong>
            </div>
            <v-chip color="primary" class="mr-2">Total: {{ statistics.total }}</v-chip>
            <v-chip color="yellow-darken-1" class="mr-2">In Progress: {{ statistics.inProgress }}</v-chip>
            <v-chip color="green">Completed: {{ statistics.completed }}</v-chip>
          </v-col>
          <v-col cols="12">
            <v-chip>Current Slide: {{ currentSlide + 1 }} / {{ shippingPages.length }}</v-chip>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTruckStore } from '@/stores/trucks'
import { useRouter } from 'vue-router'

const truckStore = useTruckStore()
const router = useRouter()
const currentSlide = ref(0)
const showError = ref(false)
const loading = computed(() => truckStore.loading)
const itemsPerPage = 3
const intervalTime = ref(8000) // 8 seconds per slide
const showControls = ref(false) // Set to true for debugging

// Session management for guest view
const sessionTimeout = ref(null)
const lastActivity = ref(Date.now())
const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds
const WARNING_BEFORE = 5 * 60 * 1000 // Show warning 5 minutes before timeout

// Function to reset session timeout
const resetSessionTimeout = () => {
  lastActivity.value = Date.now()
  
  // Clear existing timeout
  if (sessionTimeout.value) {
    clearTimeout(sessionTimeout.value)
  }
  
  // Set new timeout
  sessionTimeout.value = setTimeout(() => {
    // Check if user is guest
    const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole')
    if (userRole === 'guest') {
      // Auto refresh session for TV view
      extendSession()
    }
  }, SESSION_DURATION - WARNING_BEFORE)
}

// Function to extend session
const extendSession = async () => {
  try {
    // Call API to refresh session or token
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (token) {
      // Refresh token or extend session
      // await truckStore.refreshSession() // Uncomment if you have this method
      
      // Reset the timeout
      resetSessionTimeout()
      
      console.log('Guest session extended for TV view')
    }
  } catch (error) {
    console.error('Failed to extend session:', error)
  }
}

// Monitor user activity (for TV view, we consider carousel changes as activity)
const handleActivity = () => {
  const now = Date.now()
  // Only reset if more than 1 minute has passed since last activity
  if (now - lastActivity.value > 60000) {
    resetSessionTimeout()
  }
}

// Watch for carousel changes
const handleCarouselChange = () => {
  handleActivity()
}

// Get trucks with enhanced sorting from right code
const trucks = computed(() => {
  // Get today's date
  const today = new Date().toISOString().split('T')[0]
  
  // Filter for today's trucks OR use date filter if set
  const filteredTrucks = truckStore.dateFilter.fromDate || truckStore.dateFilter.toDate
    ? truckStore.trucks.filter(truck => {
        const date = new Date(truck.created_at).toISOString().split('T')[0]
        return (!truckStore.dateFilter.fromDate || date >= truckStore.dateFilter.fromDate) &&
               (!truckStore.dateFilter.toDate || date <= truckStore.dateFilter.toDate)
      })
    : truckStore.trucks.filter(truck => {
        const truckDate = truck.created_at ? truck.created_at.split('T')[0] : ''
        return truckDate === today
      })
  
  // Enhanced sorting from right code
  return filteredTrucks.sort((a, b) => {
    // First: Check if both preparation and loading are finished
    const aIsComplete = a.status_preparation === 'Finished' && a.status_loading === 'Finished'
    const bIsComplete = b.status_preparation === 'Finished' && b.status_loading === 'Finished'
    
    // If one is complete and the other isn't, complete goes to the end
    if (aIsComplete && !bIsComplete) return 1
    if (!aIsComplete && bIsComplete) return -1
    
    // Sort by shipping_no instead of terminal
    if (a.shipping_no !== b.shipping_no) {
      return a.shipping_no.localeCompare(b.shipping_no)
    }
    
    // Then sort by loading_end time (earliest first)
    if (!a.loading_end && !b.loading_end) return 0
    if (!a.loading_end) return 1  // No time goes to end
    if (!b.loading_end) return -1 // No time goes to end
    
    return a.loading_end.localeCompare(b.loading_end)
  })
})

// Enhanced shipping pages grouped by shipping no
const shippingPages = computed(() => {
  // Enhanced trucks with additional data
  const enhancedTrucks = trucks.value.map(truck => ({
    ...truck,
    // Ensure all required fields exist
    shipping_no: truck.shipping_no || 'Unknown',
    terminal: truck.terminal || 'Unknown',
    dock_code: truck.dock_code || 'Unknown',
    truck_route: truck.truck_route || 'Unknown Route',
    status_preparation: truck.status_preparation || 'On Process',
    status_loading: truck.status_loading || 'On Process',
    preparation_start: truck.preparation_start || '',
    preparation_end: truck.preparation_end || '',
    loading_start: truck.loading_start || '',
    loading_end: truck.loading_end || '',
    created_at: truck.created_at || new Date().toISOString(),
    isCompleted: truck.status_preparation === 'Finished' && truck.status_loading === 'Finished'
  }))

  // Create pages with items per page limit
  const result = []
  for (let i = 0; i < enhancedTrucks.length; i += itemsPerPage) {
    result.push({
      trucks: enhancedTrucks.slice(i, i + itemsPerPage)
    })
  }

  return result.length ? result : [{ trucks: [] }]
})

// Statistics from right code
const statistics = computed(() => {
  const total = trucks.value.length
  const completed = trucks.value.filter(t => 
    t.status_preparation === 'Finished' && t.status_loading === 'Finished'
  ).length
  const inProgress = trucks.value.filter(t => 
    (t.status_preparation !== 'Finished' || t.status_loading !== 'Finished')
  ).length
  
  return { total, completed, inProgress }
})

const getStatusColor = (status) => {
  switch (status) {
    case 'On Process': return 'yellow-darken-1'  // Yellow
    case 'Delay': return 'red'                   // Red
    case 'Finished': return 'green'              // Green
    default: return 'grey'
  }
}

// Enhanced getStatusIcon from right code
const getStatusIcon = (status) => {
  switch (status) {
    case 'On Process': return 'mdi-progress-clock'
    case 'Delay': return 'mdi-alert-circle'
    case 'Finished': return 'mdi-check-circle'
    default: return 'mdi-help-circle'
  }
}

// Enhanced formatTime from right code
const formatTime = (time) => {
  if (!time) return '–'
  try {
    // Ensure time is in HH:MM format
    if (time.includes(':')) {
      const [hours, minutes] = time.split(':')
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
    }
    return time
  } catch {
    return time
  }
}

// formatDate from right code
const formatDate = (dateString) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return dateString
  }
}

// Set up auto-refresh every 30 seconds
let refreshInterval = null
let activityInterval = null

onMounted(() => {
  // Set date filter to today (from right code)
  const today = new Date().toISOString().split('T')[0]
  truckStore.setDateFilter(today, today)
  
  // Connect and fetch data
  truckStore.connectWebSocket()
  truckStore.fetchTrucks()
  
  // Auto-refresh data every 30 seconds (from right code)
  refreshInterval = setInterval(() => {
    truckStore.fetchTrucks()
    handleActivity() // Keep session alive on data refresh
  }, 30000)
  
  // Initialize session management for guest
  const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole')
  if (userRole === 'guest') {
    resetSessionTimeout()
    
    // Check session status every minute
    activityInterval = setInterval(() => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivity.value
      
      // Auto-extend session if TV view is still active
      if (timeSinceLastActivity < SESSION_DURATION) {
        extendSession()
      }
    }, 60000) // Check every minute
  }
  
  // Prevent default page visibility change behavior for TV view
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  // Keep screen awake for TV view
  if ('wakeLock' in navigator) {
    requestWakeLock()
  }
  
  // Toggle controls with keyboard shortcut (Ctrl+Shift+D) from right code
  const handleKeyPress = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      showControls.value = !showControls.value
    }
    handleActivity() // Any keyboard activity keeps session alive
  }
  window.addEventListener('keydown', handleKeyPress)
  
  // Add mouse move listener for activity tracking
  window.addEventListener('mousemove', handleActivity)
  
  // Watch for carousel changes
  watch(currentSlide, handleCarouselChange)
})

// Handle page visibility changes
const handleVisibilityChange = () => {
  if (!document.hidden) {
    // Page is visible again, refresh data and reset session
    truckStore.fetchTrucks()
    const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole')
    if (userRole === 'guest') {
      extendSession()
    }
  }
}

// Request wake lock to keep screen on
let wakeLock = null
const requestWakeLock = async () => {
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    console.log('Wake lock active - screen will stay on')
    
    wakeLock.addEventListener('release', () => {
      console.log('Wake lock released')
    })
  } catch (err) {
    console.error(`Failed to acquire wake lock: ${err.message}`)
  }
}

onUnmounted(() => {
  truckStore.disconnectWebSocket()
  
  // Clear all intervals
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (activityInterval) {
    clearInterval(activityInterval)
  }
  if (sessionTimeout.value) {
    clearTimeout(sessionTimeout.value)
  }
  
  // Release wake lock
  if (wakeLock) {
    wakeLock.release()
  }
  
  // Remove event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('mousemove', handleActivity)
})
</script>

<style scoped>
.tv-view {
  background-color: #f8fafc;
  min-height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.full-screen-carousel {
  height: 100vh !important;
  width: 100vw !important;
}

.full-height {
  min-height: 100vh;
  width: 100vw;
  display: grid;
  place-items: center;
}

.card-container {
  width: min(90vw, 1600px);
  background: white;
  max-height: 85vh;
}

.tv-table {
  background: transparent !important;
  max-height: calc(85vh - 140px);
  overflow-y: auto;
}

.tv-row td {
  padding: 20px !important;
  border-bottom: 1px solid #e5e7eb;
}

.v-table thead th {
  background-color: #f9fafb;
  padding: 20px !important;
  color: #1f2937;
}

.v-carousel__controls {
  bottom: 32px !important;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 8px;
  backdrop-filter: blur(4px);
}

.v-carousel__controls .v-btn {
  background-color: white !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin: 0 4px;
}

.loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  z-index: 1000;
}

.primary-text {
  color: #1e88e5 !important;
}

.control-panel {
  position: fixed;
  bottom: 100px;
  right: 20px;
  width: 300px;
  z-index: 999;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}
</style>