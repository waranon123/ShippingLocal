// frontend/src/views/DashboardView.vue - Fixed date filter functionality

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <span class="text-h5">Truck Management Dashboard</span>
            <v-spacer></v-spacer>
            <v-btn color="primary" @click="exportCSV" prepend-icon="mdi-download">
              Export CSV
            </v-btn>
          </v-card-title>
          
          <v-card-text>
            <!-- Debug Info (remove in production) -->
            <v-alert v-if="showDebug" type="info" dense dismissible @click:close="showDebug = false">
              <div class="text-caption">
                <strong>Debug Info:</strong><br>
                Trucks: {{ trucks.length }} | Loading: {{ loading }} | Error: {{ truckStore.error }}<br>
                Date Filter: {{ dateFrom }} to {{ dateTo }}<br>
                API URL: {{ apiUrl }}
              </div>
            </v-alert>
            
            <!-- Date Filter Component -->
            <DateFilter
              v-model:from-date="dateFrom"
              v-model:to-date="dateTo"
              @change="handleDateChange"
            />
            
            <v-divider class="mb-4"></v-divider>
            
            <!-- Search Field -->
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="Search"
              single-line
              hide-details
              clearable
            ></v-text-field>
            
            <!-- Quick Actions -->
            <v-row class="mt-2">
              <v-col cols="auto">
                <v-btn 
                  size="small" 
                  color="info" 
                  variant="outlined" 
                  @click="refreshData"
                  :loading="loading"
                  prepend-icon="mdi-refresh"
                >
                  Refresh
                </v-btn>
              </v-col>
              <v-col cols="auto">
                <v-btn 
                  size="small" 
                  color="secondary" 
                  variant="outlined" 
                  @click="clearFilters"
                  prepend-icon="mdi-filter-remove"
                >
                  Clear Filters
                </v-btn>
              </v-col>
              <v-col cols="auto">
                <v-btn 
                  size="small" 
                  color="warning" 
                  variant="outlined" 
                  @click="toggleDebug"
                  prepend-icon="mdi-bug"
                >
                  Debug
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
          
          <!-- Loading State -->
          <v-progress-linear v-if="loading" indeterminate color="primary"></v-progress-linear>
          
          <!-- Error State -->
          <v-alert v-if="truckStore.error && !loading" type="error" class="ma-4">
            <div class="text-subtitle-1">❌ Error loading data</div>
            <div class="text-body-2">{{ truckStore.error }}</div>
            <v-btn 
              size="small" 
              color="white" 
              variant="text" 
              @click="refreshData" 
              class="mt-2"
            >
              Try Again
            </v-btn>
          </v-alert>
          
          <!-- Data Table -->
          <v-data-table
            :headers="headers"
            :items="filteredTrucks"
            :search="search"
            :loading="loading"
            :no-data-text="getNoDataText()"
            class="elevation-1"
            :items-per-page="15"
          >
            <template v-slot:item.created_at="{ item }">
              {{ formatDateTime(item.created_at) }}
            </template>
            
            <template v-slot:item.status_preparation="{ item }">
              <StatusChip
                :status="item.status_preparation"
                @click="updateStatus(item.id, 'preparation', item.status_preparation)"
              />
            </template>
            
            <template v-slot:item.status_loading="{ item }">
              <StatusChip
                :status="item.status_loading"
                @click="updateStatus(item.id, 'loading', item.status_loading)"
              />
            </template>
            
            <template v-slot:item.actions="{ item }">
              <v-icon
                small
                class="mr-2"
                @click="editItem(item)"
                v-if="canEdit"
              >
                mdi-pencil
              </v-icon>
              <v-icon
                small
                @click="deleteItem(item)"
                v-if="canDelete"
              >
                mdi-delete
              </v-icon>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>
    
    <!-- Edit Dialog -->
    <v-dialog v-model="dialog" max-width="600px">
      <v-card>
        <v-card-title>
          <span class="text-h5">{{ editedIndex === -1 ? 'New Truck' : 'Edit Truck' }}</span>
        </v-card-title>
        <v-card-text>
          <v-form ref="form" v-model="valid">
            <v-container>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.terminal" 
                    label="Terminal"
                    :rules="[v => !!v || 'Terminal is required']" 
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.shipping_no" 
                    label="Shipping No."
                    :rules="[v => !!v || 'Shipping No. is required']" 
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.dock_code" 
                    label="Dock Code"
                    :rules="[v => !!v || 'Dock Code is required']" 
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.truck_route" 
                    label="Truck Route"
                    :rules="[v => !!v || 'Truck Route is required']" 
                    required
                  ></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-divider></v-divider>
                  <div class="text-subtitle-1 mt-2">Preparation Times</div>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.preparation_start" 
                    label="Start Time" 
                    type="time"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.preparation_end" 
                    label="End Time" 
                    type="time"
                  ></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-divider></v-divider>
                  <div class="text-subtitle-1 mt-2">Loading Times</div>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.loading_start" 
                    label="Start Time" 
                    type="time"
                  ></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field 
                    v-model="editedItem.loading_end" 
                    label="End Time" 
                    type="time"
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-container>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="close">Cancel</v-btn>
          <v-btn color="blue-darken-1" variant="text" @click="save" :disabled="!valid">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTruckStore } from '@/stores/trucks'
import StatusChip from '@/components/StatusChip.vue'
import DateFilter from '@/components/DateFilter.vue'
import { saveAs } from 'file-saver'

const authStore = useAuthStore()
const truckStore = useTruckStore()

// Date filter states
const dateFrom = ref(null)
const dateTo = ref(null)

// Component states
const search = ref('')
const dialog = ref(false)
const editedIndex = ref(-1)
const valid = ref(false)
const form = ref(null)
const showDebug = ref(false)

const editedItem = ref({
  terminal: '',
  shipping_no: '',
  dock_code: '',
  truck_route: '',
  preparation_start: '',
  preparation_end: '',
  loading_start: '',
  loading_end: ''
})

const defaultItem = {
  terminal: '',
  shipping_no: '',
  dock_code: '',
  truck_route: '',
  preparation_start: '',
  preparation_end: '',
  loading_start: '',
  loading_end: ''
}

const headers = [
  { title: 'Date', key: 'created_at' },
  { title: 'Terminal', key: 'terminal' },
  { title: 'Shipping No.', key: 'shipping_no' },
  { title: 'Dock Code', key: 'dock_code' },
  { title: 'Truck Route', key: 'truck_route' },
  { title: 'Prep. Start', key: 'preparation_start' },
  { title: 'Prep. End', key: 'preparation_end' },
  { title: 'Loading Start', key: 'loading_start' },
  { title: 'Loading End', key: 'loading_end' },
  { title: 'Prep. Status', key: 'status_preparation' },
  { title: 'Loading Status', key: 'status_loading' }
]

// Computed properties
const loading = computed(() => truckStore.loading)
const trucks = computed(() => truckStore.trucks)
const filteredTrucks = computed(() => trucks.value)
const canEdit = computed(() => authStore.hasRole('user'))
const canDelete = computed(() => authStore.hasRole('admin'))
const apiUrl = computed(() => import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')

// Methods
const handleDateChange = () => {
  console.log('📅 Date filter changed:', { from: dateFrom.value, to: dateTo.value })
  truckStore.setDateFilter(dateFrom.value, dateTo.value)
  refreshData()
}

const refreshData = async () => {
  console.log('🔄 Refreshing data...')
  try {
    await truckStore.fetchTrucks()
    console.log('✅ Data refreshed successfully')
  } catch (error) {
    console.error('❌ Failed to refresh data:', error)
  }
}

const clearFilters = () => {
  console.log('🧹 Clearing filters')
  dateFrom.value = null
  dateTo.value = null
  search.value = ''
  truckStore.setDateFilter(null, null)
  refreshData()
}

const toggleDebug = () => {
  showDebug.value = !showDebug.value
  if (showDebug.value) {
    truckStore.debugState()
  }
}

const getNoDataText = () => {
  if (loading.value) return 'Loading data...'
  if (truckStore.error) return 'Error loading data. Please try again.'
  if (dateFrom.value || dateTo.value) return 'No data found for the selected date range'
  return 'No truck data available'
}

// Format date time
const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.error('Date formatting error:', error)
    return dateString
  }
}

const updateStatus = async (id, type, currentStatus) => {
  if (!canEdit.value) return
  
  const statuses = ['On Process', 'Delay', 'Finished']
  const currentIndex = statuses.indexOf(currentStatus)
  const nextStatus = statuses[(currentIndex + 1) % 3]
  
  try {
    await truckStore.updateStatus(id, type, nextStatus)
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

const editItem = (item) => {
  editedIndex.value = trucks.value.indexOf(item)
  editedItem.value = Object.assign({}, item)
  dialog.value = true
}

const deleteItem = async (item) => {
  if (confirm('Are you sure you want to delete this truck?')) {
    try {
      await truckStore.deleteTruck(item.id)
    } catch (error) {
      console.error('Failed to delete truck:', error)
    }
  }
}

const close = () => {
  dialog.value = false
  setTimeout(() => {
    editedItem.value = Object.assign({}, defaultItem)
    editedIndex.value = -1
  }, 300)
}

const save = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return
  
  try {
    if (editedIndex.value > -1) {
      await truckStore.updateTruck(trucks.value[editedIndex.value].id, editedItem.value)
    } else {
      await truckStore.createTruck(editedItem.value)
    }
    close()
  } catch (error) {
    console.error('Failed to save truck:', error)
  }
}

const exportCSV = () => {
  const csvContent = [
    headers.filter(h => h.key !== 'actions').map(h => h.title).join(','),
    ...trucks.value.map(truck => 
      headers.filter(h => h.key !== 'actions').map(h => {
        if (h.key === 'created_at') {
          return formatDateTime(truck[h.key])
        }
        return truck[h.key] || ''
      }).join(',')
    )
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const fileName = dateFrom.value && dateTo.value 
    ? `truck_data_${dateFrom.value}_to_${dateTo.value}.csv`
    : `truck_data_${new Date().toISOString().split('T')[0]}.csv`
  saveAs(blob, fileName)
}

// Watch for changes in store state
watch(() => truckStore.error, (newError) => {
  if (newError) {
    console.error('🚨 Store error detected:', newError)
  }
})

watch(() => trucks.value.length, (newLength, oldLength) => {
  console.log('📊 Trucks count changed:', oldLength, '->', newLength)
})

// Lifecycle hooks
onMounted(async () => {
  console.log('🚀 Dashboard mounted, initializing...')
  
  // Connect WebSocket first
  truckStore.connectWebSocket()
  
  // Initial data load
  await refreshData()
  
  console.log('✅ Dashboard initialization complete')
})

onUnmounted(() => {
  console.log('👋 Dashboard unmounted, cleaning up...')
  truckStore.disconnectWebSocket()
})
</script>

<style scoped>
.v-card {
  transition: all 0.3s ease;
}

.v-progress-linear {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
}

.text-caption {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
}

.v-alert {
  border-left: 4px solid currentColor;
}
</style>