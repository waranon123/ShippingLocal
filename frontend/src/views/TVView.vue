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
      <!-- Slide for each shipping group -->
      <v-carousel-item v-for="(group, index) in shippingGroups" :key="`group-${index}`">
        <div class="full-height">
          <v-card class="elevation-4 rounded-xl pa-10 mx-auto card-container">
            <v-card-title class="text-h2 font-weight-bold text-center py-8 primary-text">
              Shipping No: {{ group.shippingNo }}
              <v-chip v-if="group.pages > 1" class="ml-4 text-h5" color="primary" variant="outlined">
                Page {{ group.currentPage }} / {{ group.pages }}
              </v-chip>
            </v-card-title>
            
            <v-table class="tv-table">
              <thead>
                <tr>
                  <th class="text-left text-h5 font-weight-bold">Terminal</th>
                  <th class="text-left text-h5 font-weight-bold">Dock Code</th>
                  <th class="text-left text-h5 font-weight-bold">Route</th>
                  <th class="text-left text-h5 font-weight-bold">Preparation</th>
                  <th class="text-left text-h5 font-weight-bold">Loading</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="truck in group.trucks" :key="truck.id" class="tv-row">
                  <td class="text-h5 font-weight-medium">{{ truck.terminal }}</td>
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
            
            <!-- Footer with summary -->
            <v-card-text class="mt-4 text-center">
              <v-row>
                <v-col cols="4">
                  <div class="text-h5 text-grey-darken-2">
                    Total in this group: <strong>{{ group.totalTrucks }}</strong>
                  </div>
                </v-col>
                <v-col cols="4">
                  <div class="text-h5 text-grey-darken-2">
                    Date: <strong>{{ formatDate(new Date()) }}</strong>
                  </div>
                </v-col>
                <v-col cols="4">
                  <div class="text-h5 text-grey-darken-2">
                    Time: <strong>{{ currentTime }}</strong>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </div>
      </v-carousel-item>
      
      <!-- No Data Slide -->
      <v-carousel-item v-if="shippingGroups.length === 0">
        <div class="full-height">
          <v-card class="elevation-4 rounded-xl pa-10 mx-auto card-container">
            <v-card-text class="text-center">
              <v-icon size="120" color="grey" class="mb-4">mdi-truck-remove</v-icon>
              <div class="text-h2 text-grey">No Trucks Available</div>
              <div class="text-h5 text-grey mt-4">
                {{ loading ? 'Loading data...' : 'No truck data for today' }}
              </div>
              <div class="text-h6 text-grey mt-4">
                Current Time: {{ currentTime }}
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
            <v-chip color="primary" class="mr-2">Total Trucks: {{ statistics.total }}</v-chip>
            <v-chip color="info" class="mr-2">Groups: {{ uniqueShippingNos.length }}</v-chip>
            <v-chip color="success">Slides: {{ shippingGroups.length }}</v-chip>
          </v-col>
          <v-col cols="12">
            <v-chip>Current Slide: {{ currentSlide + 1 }} / {{ shippingGroups.length }}</v-chip>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTruckStore } from '@/stores/trucks'

const truckStore = useTruckStore()
const currentSlide = ref(0)
const showError = ref(false)
const loading = computed(() => truckStore.loading)
const itemsPerPage = 3 // Max trucks per page
const intervalTime = ref(8000) // 8 seconds per slide
const showControls = ref(false) // Set to true for debugging
const currentTime = ref('')

// Update current time
const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Natural Sort function for shipping numbers
const naturalSort = (a, b) => {
  const extractParts = (str) => {
    const parts = []
    let currentPart = ''
    let isNumeric = false
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      const charIsNumeric = !isNaN(char) && char !== ' '
      
      if (charIsNumeric !== isNumeric && currentPart) {
        parts.push({
          value: isNumeric ? parseInt(currentPart) : currentPart,
          isNumeric
        })
        currentPart = char
        isNumeric = charIsNumeric
      } else {
        currentPart += char
        isNumeric = charIsNumeric
      }
    }
    
    if (currentPart) {
      parts.push({
        value: isNumeric ? parseInt(currentPart) : currentPart,
        isNumeric
      })
    }
    
    return parts
  }
  
  const partsA = extractParts(a)
  const partsB = extractParts(b)
  
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    const partA = partsA[i]
    const partB = partsB[i]
    
    if (partA.isNumeric && partB.isNumeric) {
      if (partA.value !== partB.value) {
        return partA.value - partB.value
      }
    } else if (partA.isNumeric && !partB.isNumeric) {
      return -1
    } else if (!partA.isNumeric && partB.isNumeric) {
      return 1
    } else {
      const comparison = partA.value.localeCompare(partB.value)
      if (comparison !== 0) {
        return comparison
      }
    }
  }
  
  return partsA.length - partsB.length
}

// Get today's trucks
const trucks = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  
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
  
  // Sort by shipping_no and then by loading time
  return filteredTrucks.sort((a, b) => {
    // First sort by shipping_no
    const shippingCompare = naturalSort(a.shipping_no || '', b.shipping_no || '')
    if (shippingCompare !== 0) return shippingCompare
    
    // Then sort by loading_end time
    if (!a.loading_end && !b.loading_end) return 0
    if (!a.loading_end) return 1
    if (!b.loading_end) return -1
    return a.loading_end.localeCompare(b.loading_end)
  })
})

// Get unique shipping numbers with natural sort
const uniqueShippingNos = computed(() => {
  const shippingNos = [...new Set(trucks.value.map(t => t.shipping_no).filter(Boolean))]
  return shippingNos.sort(naturalSort)
})

// Create shipping groups with pagination
const shippingGroups = computed(() => {
  const groups = []
  
  // Group trucks by shipping number
  uniqueShippingNos.value.forEach(shippingNo => {
    const shippingTrucks = trucks.value.filter(t => t.shipping_no === shippingNo)
    
    // If more than 3 trucks for this shipping number, create multiple pages
    if (shippingTrucks.length > itemsPerPage) {
      const totalPages = Math.ceil(shippingTrucks.length / itemsPerPage)
      
      for (let page = 0; page < totalPages; page++) {
        const start = page * itemsPerPage
        const end = Math.min(start + itemsPerPage, shippingTrucks.length)
        
        groups.push({
          shippingNo: shippingNo,
          trucks: shippingTrucks.slice(start, end),
          currentPage: page + 1,
          pages: totalPages,
          totalTrucks: shippingTrucks.length
        })
      }
    } else {
      // Single page for this shipping number
      groups.push({
        shippingNo: shippingNo,
        trucks: shippingTrucks,
        currentPage: 1,
        pages: 1,
        totalTrucks: shippingTrucks.length
      })
    }
  })
  
  return groups.length ? groups : []
})

// Statistics
const statistics = computed(() => {
  return {
    total: trucks.value.length,
    completed: trucks.value.filter(t => 
      t.status_preparation === 'Finished' && t.status_loading === 'Finished'
    ).length,
    inProgress: trucks.value.filter(t => 
      (t.status_preparation !== 'Finished' || t.status_loading !== 'Finished')
    ).length
  }
})

const getStatusColor = (status) => {
  switch (status) {
    case 'On Process': return 'yellow-darken-1'
    case 'Delay': return 'red'
    case 'Finished': return 'green'
    default: return 'grey'
  }
}

const formatTime = (time) => {
  if (!time) return '–'
  try {
    if (time.includes(':')) {
      const [hours, minutes] = time.split(':')
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
    }
    return time
  } catch {
    return time
  }
}

const formatDate = (date) => {
  try {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return ''
  }
}

// Handle carousel changes
const handleCarouselChange = () => {
  console.log('Slide changed to:', currentSlide.value + 1)
}

// Set up auto-refresh
let refreshInterval = null
let timeInterval = null

onMounted(() => {
  // Set date filter to today
  const today = new Date().toISOString().split('T')[0]
  truckStore.setDateFilter(today, today)
  
  // Connect and fetch data
  truckStore.connectWebSocket()
  truckStore.fetchTrucks()
  
  // Update time every second
  updateTime()
  timeInterval = setInterval(updateTime, 1000)
  
  // Auto-refresh data every 30 seconds
  refreshInterval = setInterval(() => {
    truckStore.fetchTrucks()
  }, 30000)
  
  // Toggle controls with keyboard shortcut (Ctrl+Shift+D)
  const handleKeyPress = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      showControls.value = !showControls.value
    }
  }
  window.addEventListener('keydown', handleKeyPress)
  
  // Request wake lock to keep screen on
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').catch(err => {
      console.log('Failed to acquire wake lock:', err)
    })
  }
})

onUnmounted(() => {
  truckStore.disconnectWebSocket()
  
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (timeInterval) {
    clearInterval(timeInterval)
  }
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
  width: min(95vw, 1800px);
  background: white;
  max-height: 90vh;
  overflow: hidden;
}

.tv-table {
  background: transparent !important;
  max-height: calc(85vh - 200px);
  overflow-y: auto;
}

.tv-row td {
  padding: 24px !important;
  border-bottom: 2px solid #e5e7eb;
}

.v-table thead th {
  background-color: #f9fafb;
  padding: 24px !important;
  color: #1f2937;
  font-size: 1.25rem !important;
  position: sticky;
  top: 0;
  z-index: 10;
}

.v-carousel__controls {
  bottom: 32px !important;
  background: rgba(255, 255, 255, 0.95);
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
  width: 350px;
  z-index: 999;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Custom scrollbar for table */
.tv-table::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tv-table::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.tv-table::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.tv-table::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>