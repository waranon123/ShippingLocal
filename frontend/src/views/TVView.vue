<template>
  <v-container fluid class="pa-0 tv-view">
    <v-carousel
      v-model="currentSlide"
      :show-arrows="false"
      hide-delimiter-background
      delimiter-icon="mdi-circle"
      height="100vh"
      cycle
      interval="10000"
      class="full-screen-carousel"
    >
      <v-carousel-item v-for="(terminalGroup, index) in terminalPages" :key="index">
        <div class="full-height">
          <v-card class="elevation-4 rounded-xl pa-10 mx-auto card-container">
            <v-card-title class="text-h2 font-weight-bold text-center py-8 primary-text">
              Terminal {{ terminalGroup.terminal }} - Page {{ index + 1 }}
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
                <tr v-for="truck in terminalGroup.trucks" :key="truck.id" class="tv-row">
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
      <v-progress-linear v-if="truckStore.loading" indeterminate color="primary" class="loading-bar" />
      <v-snackbar v-model="showError" color="error" :timeout="5000" bottom>
        {{ truckStore.error }}
        <template v-slot:actions>
          <v-btn color="white" variant="text" @click="showError = false">Close</v-btn>
        </template>
      </v-snackbar>
    </v-carousel>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTruckStore } from '@/stores/trucks'

const truckStore = useTruckStore()
const currentSlide = ref(0)
const showError = ref(false)
const itemsPerPage = 5

const trucks = computed(() => truckStore.trucks)
const terminalPages = computed(() => {
  // Filter trucks based on date range
  const filteredTrucks = truckStore.dateFilter.fromDate || truckStore.dateFilter.toDate
    ? trucks.value.filter(truck => {
        const date = new Date(truck.created_at).toISOString().split('T')[0]
        return (!truckStore.dateFilter.fromDate || date >= truckStore.dateFilter.fromDate) &&
               (!truckStore.dateFilter.toDate || date <= truckStore.dateFilter.toDate)
      })
    : trucks.value

  // Group trucks by terminal
  const groupedByTerminal = filteredTrucks.reduce((acc, truck) => {
    if (!acc[truck.terminal]) {
      acc[truck.terminal] = []
    }
    acc[truck.terminal].push(truck)
    return acc
  }, {})

  // Create pages for each terminal, splitting large terminals into multiple pages
  const result = []
  Object.keys(groupedByTerminal).forEach(terminal => {
    const terminalTrucks = groupedByTerminal[terminal]
    for (let i = 0; i < terminalTrucks.length; i += itemsPerPage) {
      result.push({
        terminal,
        trucks: terminalTrucks.slice(i, i + itemsPerPage)
      })
    }
  })

  return result.length ? result : [{ terminal: 'No Data', trucks: [] }]
})

const getStatusColor = (status) => {
  switch (status) {
    case 'On Process': return 'amber'
    case 'Delay': return 'red'
    case 'Finished': return 'green'
    default: return 'grey'
  }
}

const formatTime = (time) => {
  if (!time) return '–'
  try {
    const [hours, minutes] = time.split(':')
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
  } catch {
    return time
  }
}

onMounted(() => {
  truckStore.connectWebSocket()
  truckStore.fetchTrucks()
})

onUnmounted(() => {
  truckStore.disconnectWebSocket()
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
</style>