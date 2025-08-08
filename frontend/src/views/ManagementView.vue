<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <span class="text-h5">Truck Management</span>
            <v-spacer></v-spacer>
            <v-btn color="info" @click="downloadTemplate" prepend-icon="mdi-download" class="mr-2">
              Template
            </v-btn>
            <ExcelImport @imported="handleImported" class="mr-2" />
            <v-btn color="warning" @click="exportToExcel" prepend-icon="mdi-file-excel" class="mr-2">
              Export Excel
            </v-btn>
            <v-btn color="primary" @click="newItem" prepend-icon="mdi-plus">
              Add New Truck
            </v-btn>
          </v-card-title>

          <DateFilter v-model:from-date="dateFrom" v-model:to-date="dateTo" @change="handleDateChange" />

          <v-card-text>
            <!-- Filters -->
            <v-row>
              <v-col cols="12" md="3">
                <v-select v-model="filterTerminal" :items="terminals" label="Filter by Terminal" clearable
                  @update:modelValue="applyFilters"></v-select>
              </v-col>
              <v-col cols="12" md="3">
                <v-select v-model="filterPrepStatus" :items="statusOptions" label="Filter by Preparation Status"
                  clearable @update:modelValue="applyFilters"></v-select>
              </v-col>
              <v-col cols="12" md="3">
                <v-select v-model="filterLoadStatus" :items="statusOptions" label="Filter by Loading Status" clearable
                  @update:modelValue="applyFilters"></v-select>
              </v-col>
              <v-col cols="12" md="3">
                <v-btn color="secondary" @click="resetFilters" block>
                  Reset Filters
                </v-btn>
              </v-col>
            </v-row>

            <!-- Bulk Actions -->
            <v-row v-if="selected.length > 0" class="mt-2">
              <v-col cols="12">
                <v-alert type="info" dense>
                  <div class="d-flex align-center justify-space-between">
                    <span>{{ selected.length }} trucks selected</span>
                    <div>
                      <v-btn small color="primary" @click="bulkUpdateStatus" class="mr-2">
                        Update Status
                      </v-btn>
                      <v-btn small color="error" @click="bulkDelete" v-if="isAdmin">
                        Delete Selected
                      </v-btn>
                    </div>
                  </div>
                </v-alert>
              </v-col>
            </v-row>
          </v-card-text>

          <!-- Data Table -->
          <v-data-table v-model="selected" :headers="headers" :items="trucks" :loading="loading" :search="search"
            show-select class="elevation-1" :items-per-page="15">
            <template v-slot:top>
              <v-text-field v-model="search" label="Search" prepend-inner-icon="mdi-magnify" single-line hide-details
                class="mx-4"></v-text-field>
            </template>

            <template v-slot:item.status_preparation="{ item }">
              <v-select :model-value="item.status_preparation" :items="statusOptions"
                @update:modelValue="(val) => quickUpdateStatus(item.id, 'preparation', val)" density="compact"
                hide-details></v-select>
            </template>

            <template v-slot:item.status_loading="{ item }">
              <v-select :model-value="item.status_loading" :items="statusOptions"
                @update:modelValue="(val) => quickUpdateStatus(item.id, 'loading', val)" density="compact"
                hide-details></v-select>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-icon size="small" class="mr-2" @click="editItem(item)">
                mdi-pencil
              </v-icon>
              <v-icon size="small" @click="deleteItem(item)" v-if="isAdmin">
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
                  <v-text-field v-model="editedItem.terminal" label="Terminal"
                    :rules="[v => !!v || 'Terminal is required']" required></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.shipping_no" label="Shipping No."
                    :rules="[v => !!v || 'Shipping No. is required']" required></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.dock_code" label="Dock Code"
                    :rules="[v => !!v || 'Dock Code is required']" required></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.truck_route" label="Truck Route"
                    :rules="[v => !!v || 'Truck Route is required']" required></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-divider></v-divider>
                  <div class="text-subtitle-1 mt-2">Preparation Times</div>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.preparation_start" label="Start Time" type="time"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.preparation_end" label="End Time" type="time"></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-divider></v-divider>
                  <div class="text-subtitle-1 mt-2">Loading Times</div>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.loading_start" label="Start Time" type="time"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedItem.loading_end" label="End Time" type="time"></v-text-field>
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

    <!-- Delete Confirmation -->
    <v-dialog v-model="deleteDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Confirm Delete</v-card-title>
        <v-card-text>Are you sure you want to delete this truck record?</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk Status Update Dialog -->
    <v-dialog v-model="bulkDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Bulk Update Status</v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-select v-model="bulkStatusType" :items="['preparation', 'loading']" label="Status Type"></v-select>
              </v-col>
              <v-col cols="12">
                <v-select v-model="bulkStatusValue" :items="statusOptions" label="New Status"></v-select>
              </v-col>
              <v-alert type="warning" dense class="mt-2">
                This will update {{ selected.length }} selected trucks.
              </v-alert>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="bulkDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="text" @click="confirmBulkUpdate">Update</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar จาก Pinia Store -->
    <v-snackbar
      v-model="snackbarStore.visible"
      :color="snackbarStore.color"
      :timeout="snackbarStore.timeout"
      :multi-line="snackbarStore.multiLine"
    >
      {{ snackbarStore.message }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbarStore.hide()">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTruckStore } from '@/stores/trucks'
import { useSnackbarStore } from '@/stores/snackbar'
import ExcelImport from '@/components/ExcelImport.vue'
import { saveAs } from 'file-saver'
import DateFilter from '@/components/DateFilter.vue'
import { apiService } from '@/services/api.js'

const $http = inject('$http')

const authStore = useAuthStore()
const truckStore = useTruckStore()
const snackbarStore = useSnackbarStore()
// Data
const dialog = ref(false)
const deleteDialog = ref(false)
const bulkDialog = ref(false)
const valid = ref(false)
const form = ref(null)
const editedIndex = ref(-1)
const itemToDelete = ref(null)
const selected = ref([])
const search = ref('')

const filterTerminal = ref(null)
const filterPrepStatus = ref(null)
const filterLoadStatus = ref(null)

const bulkStatusType = ref('preparation')
const bulkStatusValue = ref('On Process')
const dateFrom = ref(null)
const dateTo = ref(null)

const editedItem = ref({
  terminal: '',
  shipping_no: '',  // Changed from truck_no
  dock_code: '',
  truck_route: '',
  preparation_start: '',
  preparation_end: '',
  loading_start: '',
  loading_end: '',
  status_preparation: 'On Process',
  status_loading: 'On Process'
})

const defaultItem = {
  terminal: '',
  shipping_no: '',  // Changed from truck_no
  dock_code: '',
  truck_route: '',
  preparation_start: '',
  preparation_end: '',
  loading_start: '',
  loading_end: '',
  status_preparation: 'On Process',
  status_loading: 'On Process'
}

const statusOptions = ['On Process', 'Delay', 'Finished']

const headers = [
  { title: 'Terminal', key: 'terminal' },
  { title: 'Shipping No.', key: 'shipping_no' },  // Changed from Truck No.
  { title: 'Dock Code', key: 'dock_code' },
  { title: 'Truck Route', key: 'truck_route' },
  { title: 'Prep. Start', key: 'preparation_start' },
  { title: 'Prep. End', key: 'preparation_end' },
  { title: 'Loading Start', key: 'loading_start' },
  { title: 'Loading End', key: 'loading_end' },
  { title: 'Prep. Status', key: 'status_preparation', sortable: false },
  { title: 'Loading Status', key: 'status_loading', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Computed
const loading = computed(() => truckStore.loading)
const trucks = computed(() => truckStore.trucks)
const isAdmin = computed(() => authStore.role === 'admin')

const terminals = computed(() => {
  const uniqueTerminals = [...new Set(trucks.value.map(t => t.terminal))]
  return uniqueTerminals.sort()
})

// Methods
const handleDateChange = () => {
  applyFilters()
}

const applyFilters = () => {
  const filters = {}
  if (filterTerminal.value) filters.terminal = filterTerminal.value
  if (filterPrepStatus.value) filters.status_preparation = filterPrepStatus.value
  if (filterLoadStatus.value) filters.status_loading = filterLoadStatus.value
  
  truckStore.setDateFilter(dateFrom.value, dateTo.value)
  truckStore.fetchTrucks(filters)
}

const resetFilters = () => {
  filterTerminal.value = null
  filterPrepStatus.value = null
  filterLoadStatus.value = null
  dateFrom.value = null
  dateTo.value = null
  search.value = ''
  selected.value = []
  truckStore.setDateFilter(null, null)
  truckStore.fetchTrucks()
}

const newItem = () => {
  editedIndex.value = -1
  editedItem.value = Object.assign({}, defaultItem)
  dialog.value = true
}

const editItem = (item) => {
  editedIndex.value = trucks.value.indexOf(item)
  editedItem.value = Object.assign({}, item)
  dialog.value = true
}

const deleteItem = (item) => {
  itemToDelete.value = item
  deleteDialog.value = true
}

const confirmDelete = async () => {
  try {
    await truckStore.deleteTruck(itemToDelete.value.id)
    snackbarStore.success('Truck deleted successfully')
    deleteDialog.value = false
    itemToDelete.value = null
  } catch (error) {
    console.error('Failed to delete truck:', error)
    snackbarStore.error('Failed to delete truck')
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
      snackbarStore.success('Truck updated successfully')
    } else {
      await truckStore.createTruck(editedItem.value)
      // Don't manually refresh here, let WebSocket handle it
      snackbarStore.success('Truck created successfully')
    }
    close()
  } catch (error) {
    console.error('Failed to save truck:', error)
    let errorMessage = 'Failed to save truck'
    if (error.response?.status === 400 && error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    }
    snackbarStore.error(errorMessage)
  }
}

const quickUpdateStatus = async (id, type, status) => {
  try {
    await truckStore.updateStatus(id, type, status)
    snackbarStore.success(`Status updated successfully`)
  } catch (error) {
    console.error('Failed to update status:', error)
    snackbarStore.error('Failed to update status')
  }
}

// Excel Functions
const downloadTemplate = async () => {
  try {
    console.log('🔄 Downloading template...')
    
    // Debug authentication
    console.log('🔐 Auth debug:', { 
      hasToken: !!authStore.token, 
      tokenLength: authStore.token?.length,
      role: authStore.role,
      isAuthenticated: authStore.isAuthenticated,
      tokenPreview: authStore.token?.substring(0, 20) + '...'
    })
    
    if (!authStore.isAuthenticated || !authStore.token) {
      snackbarStore.error('Please login first')
      return
    }

    // Test auth first
    console.log('🧪 Testing auth before download...')
    const authTest = await authStore.testAuth()
    if (!authTest) {
      snackbarStore.error('Authentication expired. Please login again.')
      authStore.logout()
      return
    }
    console.log('✅ Auth test passed')

    // Make request with explicit headers
    const config = {
      responseType: 'blob',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }

    console.log('📡 Making request to /api/trucks/template with config:', {
      hasAuth: !!config.headers.Authorization,
      responseType: config.responseType
    })

    const response = await $http.get('/api/trucks/template', config)
    
    console.log('📥 Template Response:', {
      status: response.status,
      contentType: response.headers['content-type'],
      dataSize: response.data?.size || response.data?.length
    })
    
    // Create and download file
    const contentType = response.headers['content-type'] || 'text/csv'
    const filename = 'truck_monthly_template.csv'
    const blob = new Blob([response.data], { type: contentType })
    saveAs(blob, filename)
    
    snackbarStore.success(`✅ Template downloaded: ${filename}`)
    
  } catch (error) {
    console.error('❌ Template download failed:', error)
    console.error('Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    })
    
    let errorMessage = 'Failed to download template'
    
    if (error.response?.status === 401) {
      errorMessage = '🔐 Authentication failed. Please login again.'
      authStore.logout()
    } else if (error.response?.status === 404) {
      errorMessage = '📁 Template endpoint not found. Trying alternative...'
      // Try alternative endpoint
      try {
        await downloadTemplateAlternative()
        return
      } catch (altError) {
        errorMessage = '📁 Template service unavailable'
      }
    } else if (error.response?.status === 403) {
      errorMessage = '🚫 Insufficient permissions. Need viewer role or higher.'
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = '🌐 Network error. Check backend connection.'
    }
    
    snackbarStore.error(errorMessage)
  }
}
// Alternative: Create template locally if backend fails
const downloadTemplateAlternative = async () => {
  console.log('🔧 Creating template locally...')
  
  const headers = [
    'Month (YYYY-MM)',
    'Terminal',
    'Shipping No',
    'Dock Code',
    'Route',
    'Prep Start',
    'Prep End',
    'Load Start',
    'Load End',
    'Status Prep',
    'Status Load'
  ]
  
  const sampleData = [
    ['2024-01', 'A', 'SHP001', 'DOCK-A1', 'Bangkok-Chonburi', '08:00', '08:30', '09:00', '10:00', 'Finished', 'Finished'],
    ['2024-01', 'B', 'SHP002', 'DOCK-B1', 'Bangkok-Rayong', '09:00', '09:30', '10:00', '', 'Finished', 'On Process'],
    ['2024-02', 'C', 'SHP003', 'DOCK-C1', 'Bangkok-Pattaya', '10:00', '', '', '', 'On Process', 'On Process']
  ]
  
  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => row.map(cell => 
      (cell.toString().includes(',') || cell === '') ? `"${cell}"` : cell
    ).join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  saveAs(blob, 'truck_monthly_template.csv')
  
  snackbarStore.success('✅ Template created locally and downloaded')
}

// Debug function สำหรับทดสอบ
const debugAuth = async () => {
  console.log('🔍 Debug Authentication:')
  console.log('Token:', authStore.token?.substring(0, 50) + '...')
  console.log('Role:', authStore.role)
  console.log('Is Authenticated:', authStore.isAuthenticated)
  
  try {
    const response = await $http.get('/health')
    console.log('✅ Backend Health:', response.data)
  } catch (error) {
    console.error('❌ Backend Health Error:', error.response?.data || error.message)
  }
  
  try {
    const response = await $http.get('/api/trucks/template/test')
    console.log('✅ Test Template Endpoint:', response.status)
  } catch (error) {
    console.error('❌ Test Template Error:', error.response?.data || error.message)
  }
}

// แทนที่ exportToExcel function ใน ManagementView.vue

const exportToExcel = async () => {
  try {
    console.log('🔄 Exporting data...')
    
    if (!authStore.isAuthenticated) {
      snackbarStore.error('Please login first')
      return
    }
    
    const params = {}
    if (filterTerminal.value) params.terminal = filterTerminal.value
    if (filterPrepStatus.value) params.status_preparation = filterPrepStatus.value
    if (filterLoadStatus.value) params.status_loading = filterLoadStatus.value
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value

    // ใช้ endpoint ใหม่ /api/trucks/export
    const response = await $http.get('/api/trucks/export', {
      params,
      responseType: 'blob',
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })
    
    // ตรวจสอบ Content-Type จาก response
    const contentType = response.headers['content-type'] || 'text/csv'
    let filename = `trucks_export_${new Date().toISOString().split('T')[0]}.csv`
    
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
      filename = filename.replace('.csv', '.xlsx')
    }
    
    const blob = new Blob([response.data], { type: contentType })
    saveAs(blob, filename)
    
    snackbarStore.success(`✅ Data exported: ${filename}`)
    
  } catch (error) {
    console.error('❌ Export failed:', error)
    
    let errorMessage = 'Failed to export data'
    
    if (error.response?.status === 401) {
      errorMessage = '🔐 Authentication failed. Please login again.'
      authStore.logout()
    } else if (error.response?.status === 404) {
      errorMessage = '📁 Export endpoint not available'
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail
    }
    
    snackbarStore.error(errorMessage)
  }
}

// Test function to verify auth
const testAuth = async () => {
  try {
    console.log('🧪 Testing authentication...')
    const result = await authStore.testAuth()
    console.log('🧪 Auth test result:', result)
    
    if (result) {
      snackbarStore.success('✅ Authentication is working')
    } else {
      snackbarStore.error('❌ Authentication failed')
    }
  } catch (error) {
    console.error('🧪 Auth test error:', error)
    snackbarStore.error('❌ Auth test failed')
  }
}

// ... (keep all your other existing methods) ...

onMounted(async () => {
  // Initialize auth
  authStore.initAuth()
  
  // Test auth if we have a token
  if (authStore.token) {
    await authStore.testAuth()
  }
  
  // Load data
  truckStore.fetchTrucks()
  truckStore.connectWebSocket()
  
  // Add test function to window for debugging
   window.debugAuth = debugAuth
  window.downloadTemplateAlt = downloadTemplateAlternative
  console.log('🔧 Debug functions: debugAuth(), downloadTemplateAlt()')
})
</script>