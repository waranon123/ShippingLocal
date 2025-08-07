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
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTruckStore } from '@/stores/trucks'
import { useSnackbarStore } from '@/stores/snackbar'
import ExcelImport from '@/components/ExcelImport.vue'
import axios from 'axios'
import { saveAs } from 'file-saver'
import DateFilter from '@/components/DateFilter.vue'

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
    const response = await axios.get('/api/trucks/template', {
      responseType: 'blob'
    })
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    saveAs(blob, 'truck_import_template.xlsx')
    snackbarStore.success('Template downloaded successfully')
  } catch (error) {
    console.error('Failed to download template:', error)
    snackbarStore.error('Failed to download template')
  }
}

const exportToExcel = async () => {
  try {
    const params = new URLSearchParams()
    if (filterTerminal.value) params.append('terminal', filterTerminal.value)
    if (filterPrepStatus.value) params.append('status_preparation', filterPrepStatus.value)
    if (filterLoadStatus.value) params.append('status_loading', filterLoadStatus.value)
    if (dateFrom.value) params.append('date_from', dateFrom.value)
    if (dateTo.value) params.append('date_to', dateTo.value)

    const response = await axios.get(`/api/trucks/export?${params}`, {
      responseType: 'blob'
    })

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const filename = `trucks_export_${new Date().toISOString().split('T')[0]}.xlsx`
    saveAs(blob, filename)
    snackbarStore.success('Data exported successfully')
  } catch (error) {
    console.error('Failed to export data:', error)
    snackbarStore.error('Failed to export data')
  }
}

const handleImported = (count) => {
  applyFilters()
  selected.value = []
  snackbarStore.success(`${count} trucks imported successfully`)
}

const bulkUpdateStatus = () => {
  if (selected.value.length === 0) return
  bulkDialog.value = true
}

const confirmBulkUpdate = async () => {
  try {
    const updatePromises = selected.value.map(truck =>
      truckStore.updateStatus(truck.id, bulkStatusType.value, bulkStatusValue.value)
    )
    await Promise.all(updatePromises)
    snackbarStore.success(`${selected.value.length} trucks updated successfully`)
    bulkDialog.value = false
    selected.value = []
    await applyFilters()
  } catch (error) {
    console.error('Failed to bulk update:', error)
    snackbarStore.error('Failed to bulk update')
  }
}

const bulkDelete = async () => {
  if (!confirm(`Are you sure you want to delete ${selected.value.length} trucks?`)) {
    return
  }

  try {
    const deletePromises = selected.value.map(truck =>
      truckStore.deleteTruck(truck.id)
    )
    await Promise.all(deletePromises)
    snackbarStore.success(`${selected.value.length} trucks deleted successfully`)
    selected.value = []
    await applyFilters()
  } catch (error) {
    console.error('Failed to bulk delete:', error)
    snackbarStore.error('Failed to bulk delete')
  }
}

onMounted(() => {
  truckStore.fetchTrucks()
  truckStore.connectWebSocket()
})
</script>

<style scoped>
.v-data-table ::v-deep .v-data-table__wrapper {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}
</style>