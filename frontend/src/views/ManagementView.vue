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
                <v-alert type="info" prominent border="start" class="mb-0">
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center">
                      <v-icon class="mr-2">mdi-check-circle</v-icon>
                      <span class="text-h6">{{ selected.length }} trucks selected</span>
                    </div>
                    <div class="d-flex gap-2">
                      <v-btn color="primary" variant="elevated" @click="bulkUpdateStatus" prepend-icon="mdi-update"
                        size="small" :disabled="!canBulkUpdate">
                        Update Status
                      </v-btn>
                      <v-btn v-if="isAdmin" color="error" variant="elevated" @click="bulkDelete"
                        prepend-icon="mdi-delete" size="small" :disabled="!canBulkDelete">
                        Delete Selected
                      </v-btn>
                      <v-btn color="secondary" variant="outlined" @click="selected = []" prepend-icon="mdi-close"
                        size="small">
                        Clear Selection
                      </v-btn>
                    </div>
                  </div>

                  <!-- แสดงรายการ trucks ที่เลือกแบบย่อ -->
                  <div class="mt-3" v-if="selected.length <= 5">
                    <div class="text-caption mb-1">Selected trucks:</div>
                    <div class="d-flex flex-wrap gap-1">
                      <v-chip v-for="truck in selected" :key="truck.id" size="small" color="primary" variant="outlined"
                        closable @click:close="selected = selected.filter(t => t.id !== truck.id)">
                        {{ truck.shipping_no }}
                      </v-chip>
                    </div>
                  </div>

                  <!-- ถ้าเลือกมากกว่า 5 แสดงแค่จำนวน -->
                  <div class="mt-3" v-else>
                    <div class="text-caption">
                      Selected: {{ selectedTruckSummary }}
                    </div>
                  </div>
                </v-alert>
              </v-col>
            </v-row>
          </v-card-text>

          <!-- Data Table -->
          <v-data-table v-model="selected" :headers="headers" :items="trucks" :loading="loading"
            :search="search" show-select class="elevation-1" :items-per-page="15" item-value="id" return-object
            :item-key="(item) => item.id">
            <template v-slot:top>
              <v-text-field v-model="search" label="Search" prepend-inner-icon="mdi-magnify" single-line hide-details
                class="mx-4" clearable></v-text-field>
            </template>

            <template v-slot:item.status_preparation="{ item }">
              <v-select :model-value="item.status_preparation" :items="statusOptions"
                @update:modelValue="(val) => quickUpdateStatus(item.id, 'preparation', val)" density="compact"
                hide-details :disabled="!authStore.hasRole('user')"></v-select>
            </template>

            <template v-slot:item.status_loading="{ item }">
              <v-select :model-value="item.status_loading" :items="statusOptions"
                @update:modelValue="(val) => quickUpdateStatus(item.id, 'loading', val)" density="compact" hide-details
                :disabled="!authStore.hasRole('user')"></v-select>
            </template>

            <template v-slot:item.actions="{ item }">
              <v-icon size="small" class="mr-2" @click="editItem(item)" :disabled="!authStore.hasRole('user')">
                mdi-pencil
              </v-icon>
              <v-icon size="small" @click="deleteItem(item)" v-if="isAdmin" color="error">
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
          <v-btn color="blue-darken-1" variant="text" @click="save" :disabled="!valid"
            :loading="saveLoading">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <v-dialog v-model="deleteDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Confirm Delete</v-card-title>
        <v-card-text>
          <div class="text-body-1 mb-2">Are you sure you want to delete this truck record?</div>
          <v-alert type="warning" dense v-if="itemToDelete">
            <strong>{{ itemToDelete.shipping_no }}</strong> - {{ itemToDelete.terminal }} ({{ itemToDelete.dock_code }})
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="confirmDelete" :loading="deleteLoading">Delete</v-btn>
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
                <v-select v-model="bulkStatusType" :items="bulkStatusTypes" label="Status Type"></v-select>
              </v-col>
              <v-col cols="12">
                <v-select v-model="bulkStatusValue" :items="statusOptions" label="New Status"></v-select>
              </v-col>
              <v-alert type="info" density="compact" class="mt-2">
                This will update {{ selected.length }} selected trucks.
              </v-alert>
            </v-row>
          </v-container>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="bulkDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="text" @click="confirmBulkUpdate" :loading="bulkUpdateLoading">Update</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk Delete Confirmation Dialog -->
    <v-dialog v-model="bulkDeleteDialog" max-width="600px">
      <v-card>
        <v-card-title class="text-h5 text-red d-flex align-center">
          <v-icon color="red" class="mr-2">mdi-delete-alert</v-icon>
          Confirm Bulk Delete
        </v-card-title>
        <v-card-text>
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-alert type="error" prominent border="start">
                  <div class="text-h6 mb-2">⚠️ Warning: This action cannot be undone!</div>
                  <div class="text-body-1">
                    You are about to permanently delete <strong>{{ selected.length }}</strong> selected trucks:
                  </div>
                </v-alert>
              </v-col>

              <!-- แสดงรายการ trucks ที่จะลบ -->
              <v-col cols="12">
                <div class="text-subtitle-1 mb-2">Trucks to be deleted:</div>
                <v-list density="compact" max-height="200" style="overflow-y: auto;" class="border rounded">
                  <v-list-item v-for="truck in selected.slice(0, 10)" :key="truck.id" class="text-body-2">
                    <template v-slot:prepend>
                      <v-icon color="red" size="small">mdi-truck</v-icon>
                    </template>
                    <v-list-item-title>
                      {{ truck.shipping_no }} - {{ truck.terminal }} ({{ truck.dock_code }})
                    </v-list-item-title>
                  </v-list-item>

                  <v-list-item v-if="selected.length > 10" class="text-caption text-grey">
                    <v-list-item-title>
                      ... and {{ selected.length - 10 }} more trucks
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-col>

              <!-- Confirmation checkbox -->
              <v-col cols="12" class="mt-2">
                <v-checkbox v-model="confirmDeleteCheck" color="red" hide-details>
                  <template v-slot:label>
                    <span class="text-body-2">
                      I understand that this action will permanently delete the selected trucks and cannot be undone.
                    </span>
                  </template>
                </v-checkbox>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeBulkDeleteDialog" :disabled="bulkDeleteLoading">
            Cancel
          </v-btn>
          <v-btn color="red" variant="elevated" @click="confirmBulkDelete"
            :disabled="!confirmDeleteCheck || bulkDeleteLoading" :loading="bulkDeleteLoading">
            <v-icon class="mr-2">mdi-delete</v-icon>
            Delete {{ selected.length }} Trucks
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbarStore.visible" :color="snackbarStore.color" :timeout="snackbarStore.timeout"
      :multi-line="snackbarStore.multiLine">
      {{ snackbarStore.message }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbarStore.hide()">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue'
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
const bulkDeleteDialog = ref(false)
const valid = ref(false)
const form = ref(null)
const editedIndex = ref(-1)
const itemToDelete = ref(null)
const selected = ref([])
const search = ref('')

// Loading states
const saveLoading = ref(false)
const deleteLoading = ref(false)
const bulkUpdateLoading = ref(false)
const bulkDeleteLoading = ref(false)

// Filter states
const filterTerminal = ref(null)
const filterPrepStatus = ref(null)
const filterLoadStatus = ref(null)
const dateFrom = ref(null)
const dateTo = ref(null)

// Bulk operation states
const bulkStatusType = ref('preparation')
const bulkStatusValue = ref('On Process')
const confirmDeleteCheck = ref(false)

const editedItem = ref({
  terminal: '',
  shipping_no: '',
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
  shipping_no: '',
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

const bulkStatusTypes = [
  { title: 'Preparation Status', value: 'preparation' },
  { title: 'Loading Status', value: 'loading' }
]

const headers = [
  { title: 'Terminal', key: 'terminal' },
  { title: 'Shipping No.', key: 'shipping_no' },
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

const canBulkDelete = computed(() => {
  return isAdmin.value && selected.value.length > 0
})

const canBulkUpdate = computed(() => {
  return authStore.hasRole('user') && selected.value.length > 0
})

const selectedTruckSummary = computed(() => {
  if (selected.value.length <= 3) {
    return selected.value.map(t => t.shipping_no).join(', ')
  }
  return `${selected.value.slice(0, 3).map(t => t.shipping_no).join(', ')} and ${selected.value.length - 3} more`
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
  deleteLoading.value = true
  try {
    await truckStore.deleteTruck(itemToDelete.value.id)
    snackbarStore.success('Truck deleted successfully')
    deleteDialog.value = false
    itemToDelete.value = null
  } catch (error) {
    console.error('Failed to delete truck:', error)
    snackbarStore.error('Failed to delete truck')
  } finally {
    deleteLoading.value = false
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

  saveLoading.value = true
  try {
    if (editedIndex.value > -1) {
      await truckStore.updateTruck(trucks.value[editedIndex.value].id, editedItem.value)
      snackbarStore.success('Truck updated successfully')
    } else {
      await truckStore.createTruck(editedItem.value)
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
  } finally {
    saveLoading.value = false
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

// Bulk Operations
const bulkUpdateStatus = () => {
  if (selected.value.length === 0) {
    snackbarStore.warning('Please select trucks to update')
    return
  }
  bulkDialog.value = true
}

const confirmBulkDelete = async () => {
  if (!confirmDeleteCheck.value) {
    snackbarStore.warning('Please confirm the deletion')
    return
  }

  bulkDeleteLoading.value = true

  try {
    // ✅ FIX: ตรวจสอบและทำความสะอาด truck IDs
    console.log('🔍 Debug selected trucks:', selected.value)

    const validTruckIds = []
    const invalidTrucks = []

    selected.value.forEach((truck, index) => {
      console.log(`Truck ${index + 1}:`, truck)

      if (truck && truck.id && typeof truck.id === 'string' && truck.id.trim() !== '') {
        validTruckIds.push(truck.id.trim())
        console.log(`✅ Valid ID: ${truck.id}`)
      } else {
        console.warn(`❌ Invalid truck at index ${index}:`, truck)
        invalidTrucks.push({
          index,
          truck,
          reason: !truck ? 'Truck is null/undefined' :
            !truck.id ? 'Missing ID' :
              typeof truck.id !== 'string' ? 'ID is not string' :
                'ID is empty string'
        })
      }
    })

    console.log('📊 Validation results:', {
      total: selected.value.length,
      valid: validTruckIds.length,
      invalid: invalidTrucks.length,
      validIds: validTruckIds,
      invalidTrucks
    })

    if (validTruckIds.length === 0) {
      snackbarStore.error('No valid trucks found for deletion. Please refresh and try again.')
      return
    }

    if (invalidTrucks.length > 0) {
      console.warn('⚠️ Some trucks have invalid IDs and will be skipped:', invalidTrucks)
      snackbarStore.warning(`${invalidTrucks.length} trucks have invalid IDs and will be skipped`)
    }

    // Proceed with valid IDs only
    const result = await truckStore.bulkDeleteTrucks(validTruckIds)

    if (result.success > 0) {
      snackbarStore.success(`Successfully deleted ${result.success} trucks`)
    }

    if (result.errors > 0) {
      snackbarStore.error(`Failed to delete ${result.errors} trucks`)
      console.error('Bulk delete errors:', result.errorDetails)
    }

    if (invalidTrucks.length > 0) {
      snackbarStore.info(`${invalidTrucks.length} trucks were skipped due to invalid data`)
    }

    // รีเซ็ตทุกอย่าง
    selected.value = []
    closeBulkDeleteDialog()

    // รีเฟรชข้อมูล
    await truckStore.fetchTrucks()

  } catch (error) {
    console.error('Bulk delete failed:', error)
    snackbarStore.error(`Bulk delete operation failed: ${error.message}`)
  } finally {
    bulkDeleteLoading.value = false
  }
}

// 2. เพิ่ม function สำหรับ debug selection
const debugSelection = () => {
  console.log('🔍 Debug Selection Data:')
  console.log('Selected count:', selected.value.length)

  selected.value.forEach((truck, index) => {
    console.log(`\n--- Truck ${index + 1} ---`)
    console.log('Full object:', truck)
    console.log('ID:', truck?.id)
    console.log('ID type:', typeof truck?.id)
    console.log('Shipping No:', truck?.shipping_no)
    console.log('Terminal:', truck?.terminal)

    if (!truck?.id) {
      console.warn('❌ Missing ID!')
    } else if (typeof truck.id !== 'string') {
      console.warn('❌ ID is not string:', typeof truck.id)
    } else if (truck.id.trim() === '') {
      console.warn('❌ ID is empty string!')
    } else {
      console.log('✅ ID looks valid')
    }
  })

  return {
    total: selected.value.length,
    validIds: selected.value.filter(t => t?.id && typeof t.id === 'string' && t.id.trim() !== '').length,
    invalidIds: selected.value.filter(t => !t?.id || typeof t.id !== 'string' || t.id.trim() === '').length
  }
}


const bulkDelete = () => {
  if (selected.value.length === 0) {
    snackbarStore.warning('Please select trucks to delete')
    return
  }
  bulkDeleteDialog.value = true
}


const closeBulkDeleteDialog = () => {
  bulkDeleteDialog.value = false
  confirmDeleteCheck.value = false
}

// Excel Functions
const downloadTemplate = async () => {
  try {
    console.log('🔄 Downloading template...')

    if (!authStore.isAuthenticated || !authStore.token) {
      snackbarStore.error('Please login first')
      return
    }

    const authTest = await authStore.testAuth()
    if (!authTest) {
      snackbarStore.error('Authentication expired. Please login again.')
      authStore.logout()
      return
    }

    const config = {
      responseType: 'blob',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }

    const response = await $http.get('/api/trucks/template', config)

    const contentType = response.headers['content-type'] || 'text/csv'
    const filename = 'truck_monthly_template.csv'
    const blob = new Blob([response.data], { type: contentType })
    saveAs(blob, filename)

    snackbarStore.success(`✅ Template downloaded: ${filename}`)

  } catch (error) {
    console.error('❌ Template download failed:', error)

    let errorMessage = 'Failed to download template'

    if (error.response?.status === 401) {
      errorMessage = '🔐 Authentication failed. Please login again.'
      authStore.logout()
    } else if (error.response?.status === 404) {
      errorMessage = '📁 Template endpoint not found. Trying alternative...'
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

    const response = await $http.get('/api/trucks/export', {
      params,
      responseType: 'blob',
      headers: { 'Authorization': `Bearer ${authStore.token}` }
    })

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

const handleImported = (importedCount) => {
  console.log('📁 Import completed:', importedCount, 'records imported')
  snackbarStore.success(`Successfully imported ${importedCount} records`)

  // รีเฟรชข้อมูลหลังจาก import
  setTimeout(() => {
    truckStore.fetchTrucks()
    truckStore.fetchStats()
  }, 1000)
}

// Lifecycle hooks
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

  // Add debug functions to window
  window.debugAuth = async () => {
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
  }

  window.downloadTemplateAlt = downloadTemplateAlternative
  console.log('🔧 Debug functions: debugAuth(), downloadTemplateAlt()')
})

onUnmounted(() => {
  truckStore.disconnectWebSocket()

  // Clear any debug functions
  if (window.debugAuth) delete window.debugAuth
  if (window.downloadTemplateAlt) delete window.downloadTemplateAlt
})

// Watch for changes
watch(() => truckStore.error, (newError) => {
  if (newError) {
    console.error('🚨 Truck store error:', newError)
  }
})

watch(() => trucks.value.length, (newLength, oldLength) => {
  if (oldLength !== undefined && newLength !== oldLength) {
    console.log('📊 Trucks count changed:', oldLength, '->', newLength)
  }
})
</script>

<style scoped>
.v-card {
  transition: all 0.3s ease;
}

.v-data-table {
  background: transparent;
}

.text-red {
  color: rgb(244, 67, 54) !important;
}

.gap-2>* {
  margin-right: 8px;
}

.gap-2>*:last-child {
  margin-right: 0;
}

.border {
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.rounded {
  border-radius: 4px;
}
</style>