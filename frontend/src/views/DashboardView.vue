<!-- frontend/src/views/DashboardView.vue - Enhanced with Shipping Filter -->

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
                Trucks: {{ trucks.length }} | Filtered: {{ filteredTrucks.length }} | Loading: {{ loading }} | Error: {{ truckStore.error }}<br>
                Date Filter: {{ dateFrom }} to {{ dateTo }}<br>
                Shipping Filter: {{ selectedShippingNo || 'All' }}<br>
                Terminal Filter: {{ selectedTerminal || 'All' }}<br>
                API URL: {{ apiUrl }}
              </div>
            </v-alert>
            
            <!-- Date Filter Component -->
            <DateFilter
              v-model:from-date="dateFrom"
              v-model:to-date="dateTo"
              @change="handleDateChange"
            />
            
            <!-- Quick Date Filter Buttons -->
            <v-row class="mt-2 mb-2">
              <v-col cols="12" class="d-flex flex-wrap gap-2">
                <v-btn 
                  size="small" 
                  :variant="isShowingToday ? 'elevated' : 'outlined'"
                  :color="isShowingToday ? 'primary' : undefined"
                  @click="setToday"
                  prepend-icon="mdi-calendar-today"
                >
                  Today
                </v-btn>
                <v-btn 
                  size="small" 
                  variant="outlined"
                  @click="setYesterday"
                  prepend-icon="mdi-calendar-minus"
                >
                  Yesterday
                </v-btn>
                <v-btn 
                  size="small" 
                  variant="outlined"
                  @click="setThisWeek"
                  prepend-icon="mdi-calendar-week"
                >
                  This Week
                </v-btn>
                <v-btn 
                  size="small" 
                  variant="outlined"
                  @click="setLastWeek"
                  prepend-icon="mdi-calendar-week-begin"
                >
                  Last Week
                </v-btn>
                <v-btn 
                  size="small" 
                  variant="outlined"
                  @click="setThisMonth"
                  prepend-icon="mdi-calendar-month"
                >
                  This Month
                </v-btn>
                <v-btn 
                  size="small" 
                  variant="outlined"
                  @click="setLastMonth"
                  prepend-icon="mdi-calendar-month-outline"
                >
                  Last Month
                </v-btn>
                <v-btn 
                  size="small" 
                  variant="outlined"
                  @click="setAllTime"
                  prepend-icon="mdi-calendar-remove"
                >
                  All Time
                </v-btn>
              </v-col>
            </v-row>
            
            <v-divider class="mb-4"></v-divider>
            
            <!-- Filter Row -->
            <v-row class="mb-4">
              <!-- Shipping No Filter -->
              <v-col cols="12" md="3">
                <v-autocomplete
                  v-model="selectedShippingNo"
                  :items="uniqueShippingNos"
                  label="Filter by Shipping No"
                  prepend-icon="mdi-truck-delivery"
                  clearable
                  @update:modelValue="applyFilters"
                  variant="outlined"
                  density="comfortable"
                  :loading="loading"
                  no-data-text="No shipping numbers available"
                >
                  <template v-slot:item="{ item, props }">
                    <v-list-item v-bind="props">
                      <template v-slot:prepend>
                        <v-icon color="primary">mdi-package-variant</v-icon>
                      </template>
                      <v-list-item-title>{{ item.value }}</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ getShippingInfo(item.value) }}
                      </v-list-item-subtitle>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
              
              <!-- Terminal Filter -->
              <v-col cols="12" md="3">
                <v-select
                  v-model="selectedTerminal"
                  :items="uniqueTerminals"
                  label="Filter by Terminal"
                  prepend-icon="mdi-warehouse"
                  clearable
                  @update:modelValue="applyFilters"
                  variant="outlined"
                  density="comfortable"
                  :loading="loading"
                ></v-select>
              </v-col>
              
              <!-- Preparation Status Filter -->
              <v-col cols="12" md="3">
                <v-select
                  v-model="selectedPrepStatus"
                  :items="statusOptions"
                  label="Preparation Status"
                  prepend-icon="mdi-progress-clock"
                  clearable
                  @update:modelValue="applyFilters"
                  variant="outlined"
                  density="comfortable"
                ></v-select>
              </v-col>
              
              <!-- Loading Status Filter -->
              <v-col cols="12" md="3">
                <v-select
                  v-model="selectedLoadStatus"
                  :items="statusOptions"
                  label="Loading Status"
                  prepend-icon="mdi-truck-check"
                  clearable
                  @update:modelValue="applyFilters"
                  variant="outlined"
                  density="comfortable"
                ></v-select>
              </v-col>
            </v-row>
            
            <!-- Search Field -->
            <v-text-field
              v-model="search"
              append-icon="mdi-magnify"
              label="Search (Type to filter table)"
              single-line
              hide-details
              clearable
              variant="outlined"
              density="comfortable"
            ></v-text-field>
            
            <!-- Quick Actions & Filter Summary -->
            <v-row class="mt-2">
              <v-col cols="12" md="8">
                <!-- Active Filters Display -->
                <div v-if="hasActiveFilters" class="d-flex align-center flex-wrap gap-2">
                  <span class="text-caption text-grey-darken-1">Active Filters:</span>
                  
                  <v-chip 
                    v-if="selectedShippingNo" 
                    size="small" 
                    closable 
                    @click:close="selectedShippingNo = null; applyFilters()"
                    color="primary"
                  >
                    <v-icon start size="x-small">mdi-truck-delivery</v-icon>
                    {{ selectedShippingNo }}
                  </v-chip>
                  
                  <v-chip 
                    v-if="selectedTerminal" 
                    size="small" 
                    closable 
                    @click:close="selectedTerminal = null; applyFilters()"
                    color="secondary"
                  >
                    <v-icon start size="x-small">mdi-warehouse</v-icon>
                    Terminal {{ selectedTerminal }}
                  </v-chip>
                  
                  <v-chip 
                    v-if="selectedPrepStatus" 
                    size="small" 
                    closable 
                    @click:close="selectedPrepStatus = null; applyFilters()"
                    :color="getStatusColor(selectedPrepStatus)"
                  >
                    <v-icon start size="x-small">mdi-progress-clock</v-icon>
                    Prep: {{ selectedPrepStatus }}
                  </v-chip>
                  
                  <v-chip 
                    v-if="selectedLoadStatus" 
                    size="small" 
                    closable 
                    @click:close="selectedLoadStatus = null; applyFilters()"
                    :color="getStatusColor(selectedLoadStatus)"
                  >
                    <v-icon start size="x-small">mdi-truck-check</v-icon>
                    Load: {{ selectedLoadStatus }}
                  </v-chip>
                  
                  <v-chip 
                    v-if="dateFrom || dateTo" 
                    size="small" 
                    closable 
                    @click:close="clearDateFilter()"
                    color="info"
                  >
                    <v-icon start size="x-small">mdi-calendar</v-icon>
                    {{ getDateRangeText() }}
                  </v-chip>
                </div>
                
                <!-- No Active Filters Message -->
                <div v-else class="text-caption text-grey">
                  No active filters - showing all trucks
                </div>
              </v-col>
              
              <v-col cols="12" md="4" class="text-md-right">
                <v-btn 
                  size="small" 
                  color="info" 
                  variant="outlined" 
                  @click="refreshData"
                  :loading="loading"
                  prepend-icon="mdi-refresh"
                  class="mr-2"
                >
                  Refresh
                </v-btn>
                <v-btn 
                  size="small" 
                  color="secondary" 
                  variant="outlined" 
                  @click="clearAllFilters"
                  prepend-icon="mdi-filter-remove"
                  :disabled="!hasActiveFilters"
                  class="mr-2"
                >
                  Clear All
                </v-btn>
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
          
          <!-- Summary Stats -->
          <v-row v-if="!loading && filteredTrucks.length > 0" class="ma-2">
            <v-col cols="12">
              <v-alert 
                v-if="isShowingToday" 
                type="info" 
                density="compact" 
                variant="tonal"
                class="mb-3"
              >
                <v-icon class="mr-2">mdi-calendar-today</v-icon>
                <strong>Showing today's data:</strong> {{ formatDate(dateFrom) }}
                <v-btn 
                  size="x-small" 
                  variant="text" 
                  class="ml-2"
                  @click="clearDateFilter"
                >
                  Show All Dates
                </v-btn>
              </v-alert>
            </v-col>
            <v-col cols="6" md="3">
              <v-card variant="outlined" class="text-center pa-2">
                <div class="text-h6 font-weight-bold">{{ filteredTrucks.length }}</div>
                <div class="text-caption">Total Records</div>
              </v-card>
            </v-col>
            <v-col cols="6" md="3">
              <v-card variant="outlined" class="text-center pa-2">
                <div class="text-h6 font-weight-bold text-blue">{{ prepOnProcessCount }}</div>
                <div class="text-caption">Prep On Process</div>
              </v-card>
            </v-col>
            <v-col cols="6" md="3">
              <v-card variant="outlined" class="text-center pa-2">
                <div class="text-h6 font-weight-bold text-orange">{{ prepDelayCount }}</div>
                <div class="text-caption">Prep Delayed</div>
              </v-card>
            </v-col>
            <v-col cols="6" md="3">
              <v-card variant="outlined" class="text-center pa-2">
                <div class="text-h6 font-weight-bold text-green">{{ prepFinishedCount }}</div>
                <div class="text-caption">Prep Finished</div>
              </v-card>
            </v-col>
          </v-row>
          
          <!-- Data Table -->
          <v-data-table
            :headers="headers"
            :items="filteredTrucks"
            :search="search"
            :loading="loading"
            :no-data-text="getNoDataText()"
            class="elevation-1"
            :items-per-page="15"
            :items-per-page-options="[10, 15, 25, 50, 100]"
          >
            <template v-slot:item.created_at="{ item }">
              {{ formatDateTime(item.created_at) }}
            </template>
            
            <template v-slot:item.shipping_no="{ item }">
              <v-chip 
                size="small" 
                color="primary" 
                variant="outlined"
                @click="filterByShipping(item.shipping_no)"
                class="cursor-pointer"
              >
                <v-icon start size="x-small">mdi-package-variant</v-icon>
                {{ item.shipping_no }}
              </v-chip>
            </template>
            
            <template v-slot:item.terminal="{ item }">
              <v-chip 
                size="small" 
                @click="filterByTerminal(item.terminal)"
                class="cursor-pointer"
              >
                {{ item.terminal }}
              </v-chip>
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

// Filter states
const dateFrom = ref(null)
const dateTo = ref(null)
const selectedShippingNo = ref(null)
const selectedTerminal = ref(null)
const selectedPrepStatus = ref(null)
const selectedLoadStatus = ref(null)

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

const statusOptions = ['On Process', 'Delay', 'Finished']

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

// Filtered trucks based on all filters
const filteredTrucks = computed(() => {
  let result = trucks.value
  
  // Apply shipping no filter
  if (selectedShippingNo.value) {
    result = result.filter(truck => truck.shipping_no === selectedShippingNo.value)
  }
  
  // Apply terminal filter
  if (selectedTerminal.value) {
    result = result.filter(truck => truck.terminal === selectedTerminal.value)
  }
  
  // Apply preparation status filter
  if (selectedPrepStatus.value) {
    result = result.filter(truck => truck.status_preparation === selectedPrepStatus.value)
  }
  
  // Apply loading status filter
  if (selectedLoadStatus.value) {
    result = result.filter(truck => truck.status_loading === selectedLoadStatus.value)
  }
  
  return result
})

// Get unique shipping numbers for autocomplete
const uniqueShippingNos = computed(() => {
  const shippingNos = [...new Set(trucks.value.map(t => t.shipping_no))]
  return shippingNos.sort()
})

// Get unique terminals for filter
const uniqueTerminals = computed(() => {
  const terminals = [...new Set(trucks.value.map(t => t.terminal))]
  return terminals.sort()
})

// Stats computations
const prepOnProcessCount = computed(() => 
  filteredTrucks.value.filter(t => t.status_preparation === 'On Process').length
)

const prepDelayCount = computed(() => 
  filteredTrucks.value.filter(t => t.status_preparation === 'Delay').length
)

const prepFinishedCount = computed(() => 
  filteredTrucks.value.filter(t => t.status_preparation === 'Finished').length
)

// Check if showing today's data
const isShowingToday = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return dateFrom.value === today && dateTo.value === today
})

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return !!(selectedShippingNo.value || selectedTerminal.value || 
           selectedPrepStatus.value || selectedLoadStatus.value || 
           dateFrom.value || dateTo.value)
})

const canEdit = computed(() => authStore.hasRole('user'))
const canDelete = computed(() => authStore.hasRole('admin'))
const apiUrl = computed(() => import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')

// Quick date filter methods
const setToday = () => {
  const today = new Date().toISOString().split('T')[0]
  dateFrom.value = today
  dateTo.value = today
  truckStore.setDateFilter(today, today)
  applyFilters()
}

const setYesterday = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]
  dateFrom.value = dateStr
  dateTo.value = dateStr
  truckStore.setDateFilter(dateStr, dateStr)
  applyFilters()
}

const setThisWeek = () => {
  const today = new Date()
  const monday = new Date(today)
  const dayOfWeek = today.getDay()
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  monday.setDate(today.getDate() - daysToSubtract)
  
  const mondayStr = monday.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  
  dateFrom.value = mondayStr
  dateTo.value = todayStr
  truckStore.setDateFilter(mondayStr, todayStr)
  applyFilters()
}

const setLastWeek = () => {
  const today = new Date()
  const lastMonday = new Date(today)
  const lastSunday = new Date(today)
  
  const dayOfWeek = today.getDay()
  const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6
  const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek
  
  lastMonday.setDate(today.getDate() - daysToLastMonday)
  lastSunday.setDate(today.getDate() - daysToLastSunday)
  
  const mondayStr = lastMonday.toISOString().split('T')[0]
  const sundayStr = lastSunday.toISOString().split('T')[0]
  
  dateFrom.value = mondayStr
  dateTo.value = sundayStr
  truckStore.setDateFilter(mondayStr, sundayStr)
  applyFilters()
}

const setThisMonth = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  
  const firstDayStr = firstDay.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  
  dateFrom.value = firstDayStr
  dateTo.value = todayStr
  truckStore.setDateFilter(firstDayStr, todayStr)
  applyFilters()
}

const setLastMonth = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
  
  const firstDayStr = firstDay.toISOString().split('T')[0]
  const lastDayStr = lastDay.toISOString().split('T')[0]
  
  dateFrom.value = firstDayStr
  dateTo.value = lastDayStr
  truckStore.setDateFilter(firstDayStr, lastDayStr)
  applyFilters()
}

const setAllTime = () => {
  dateFrom.value = null
  dateTo.value = null
  truckStore.setDateFilter(null, null)
  applyFilters()
}

// Methods
const getShippingInfo = (shippingNo) => {
  const truck = trucks.value.find(t => t.shipping_no === shippingNo)
  if (truck) {
    return `Terminal ${truck.terminal} - ${truck.dock_code}`
  }
  return ''
}

const getStatusColor = (status) => {
  switch (status) {
    case 'On Process': return 'blue'
    case 'Delay': return 'orange'
    case 'Finished': return 'green'
    default: return 'grey'
  }
}

const getDateRangeText = () => {
  if (dateFrom.value && dateTo.value) {
    return `${dateFrom.value} to ${dateTo.value}`
  } else if (dateFrom.value) {
    return `From ${dateFrom.value}`
  } else if (dateTo.value) {
    return `Until ${dateTo.value}`
  }
  return ''
}

const handleDateChange = () => {
  console.log('📅 Date filter changed:', { from: dateFrom.value, to: dateTo.value })
  truckStore.setDateFilter(dateFrom.value, dateTo.value)
  applyFilters()
}

const applyFilters = () => {
  console.log('🔍 Applying filters:', {
    shipping: selectedShippingNo.value,
    terminal: selectedTerminal.value,
    prepStatus: selectedPrepStatus.value,
    loadStatus: selectedLoadStatus.value,
    dateFrom: dateFrom.value,
    dateTo: dateTo.value
  })
  
  // Build filter object for API
  const filters = {}
  if (selectedTerminal.value) filters.terminal = selectedTerminal.value
  if (selectedPrepStatus.value) filters.status_preparation = selectedPrepStatus.value
  if (selectedLoadStatus.value) filters.status_loading = selectedLoadStatus.value
  
  // Note: Shipping filter is handled client-side in filteredTrucks computed
  // because the backend might not support it yet
  
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

const clearDateFilter = () => {
  dateFrom.value = null
  dateTo.value = null
  truckStore.setDateFilter(null, null)
  applyFilters()
}

const clearAllFilters = () => {
  console.log('🧹 Clearing all filters')
  dateFrom.value = null
  dateTo.value = null
  selectedShippingNo.value = null
  selectedTerminal.value = null
  selectedPrepStatus.value = null
  selectedLoadStatus.value = null
  search.value = ''
  truckStore.setDateFilter(null, null)
  refreshData()
}

const filterByShipping = (shippingNo) => {
  selectedShippingNo.value = shippingNo
  applyFilters()
}

const filterByTerminal = (terminal) => {
  selectedTerminal.value = terminal
  applyFilters()
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
  if (hasActiveFilters.value) return 'No data found with current filters'
  if (dateFrom.value || dateTo.value) return 'No data found for the selected date range'
  return 'No truck data available'
}

// Format date
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
  } catch (error) {
    return dateString
  }
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
  const dataToExport = filteredTrucks.value
  const csvContent = [
    headers.filter(h => h.key !== 'actions').map(h => h.title).join(','),
    ...dataToExport.map(truck => 
      headers.filter(h => h.key !== 'actions').map(h => {
        if (h.key === 'created_at') {
          return formatDateTime(truck[h.key])
        }
        return truck[h.key] || ''
      }).join(',')
    )
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  
  // Build filename based on filters
  let filename = 'truck_data'
  if (selectedShippingNo.value) filename += `_${selectedShippingNo.value}`
  if (selectedTerminal.value) filename += `_terminal${selectedTerminal.value}`
  if (dateFrom.value && dateTo.value) {
    filename += `_${dateFrom.value}_to_${dateTo.value}`
  } else {
    filename += `_${new Date().toISOString().split('T')[0]}`
  }
  filename += '.csv'
  
  saveAs(blob, filename)
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
  
  // Set default date filter to today
  const today = new Date().toISOString().split('T')[0]
  dateFrom.value = today
  dateTo.value = today
  
  console.log('📅 Setting default filter to today:', today)
  
  // Set date filter in store
  truckStore.setDateFilter(today, today)
  
  // Connect WebSocket first
  truckStore.connectWebSocket()
  
  // Initial data load with today's filter
  await refreshData()
  
  console.log('✅ Dashboard initialization complete with today\'s data')
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

.cursor-pointer {
  cursor: pointer;
}

.gap-2 > * {
  margin-right: 8px;
  margin-bottom: 4px;
}
</style>