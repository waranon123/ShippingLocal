<template>
  <v-dialog v-model="dialog" max-width="800px">
    <template v-slot:activator="{ props }">
      <v-btn
        color="success"
        v-bind="props"
        prepend-icon="mdi-file-excel"
      >
        Import Excel
      </v-btn>
    </template>

    <v-card>
      <v-card-title>
        <span class="text-h5">Import Trucks from Excel</span>
      </v-card-title>

      <v-card-text>
        <v-stepper v-model="step">
          <v-stepper-header>
            <v-stepper-item
              :complete="step > 1"
              step="1"
              value="1"
            >
              Upload File
            </v-stepper-item>

            <v-divider></v-divider>

            <v-stepper-item
              :complete="step > 2"
              step="2"
              value="2"
            >
              Preview Data
            </v-stepper-item>

            <v-divider></v-divider>

            <v-stepper-item
              step="3"
              value="3"
            >
              Import Results
            </v-stepper-item>
          </v-stepper-header>

          <v-stepper-window>
            <!-- Step 1: Upload -->
            <v-stepper-window-item value="1">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-file-input
                      v-model="file"
                      accept=".xlsx,.xls"
                      label="Select Excel file"
                      prepend-icon="mdi-file-excel"
                      show-size
                      :rules="fileRules"
                      @change="handleFileSelect"
                    ></v-file-input>
                  </v-col>
                </v-row>
                
                <v-alert type="info" class="mt-4">
                  <div class="d-flex align-center justify-space-between">
                    <span>Need a template?</span>
                    <v-btn size="small" color="primary" @click="downloadTemplate">
                      Download Template
                    </v-btn>
                  </div>
                </v-alert>

                <v-divider class="my-4"></v-divider>

                <div class="text-subtitle-1 mb-2">Required Columns:</div>
                <v-chip-group>
                  <v-chip v-for="col in requiredColumns" :key="col" size="small" label>
                    {{ col }}
                  </v-chip>
                </v-chip-group>

                <div class="text-subtitle-1 mb-2 mt-4">Optional Columns:</div>
                <v-chip-group>
                  <v-chip v-for="col in optionalColumns" :key="col" size="small" label variant="outlined">
                    {{ col }}
                  </v-chip>
                </v-chip-group>
              </v-container>

              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                <v-btn
                  color="primary"
                  @click="uploadFile"
                  :disabled="!file"
                  :loading="uploading"
                >
                  Upload & Preview
                </v-btn>
              </v-card-actions>
            </v-stepper-window-item>

            <!-- Step 2: Preview -->
            <v-stepper-window-item value="2">
              <v-container>
                <v-alert v-if="preview.errors.length > 0" type="warning" class="mb-4">
                  <div class="text-subtitle-1 mb-2">Found {{ preview.errors.length }} errors:</div>
                  <ul>
                    <li v-for="(error, index) in preview.errors.slice(0, 5)" :key="index">
                      {{ error }}
                    </li>
                  </ul>
                  <span v-if="preview.errors.length > 5">
                    ... and {{ preview.errors.length - 5 }} more errors
                  </span>
                </v-alert>

                <div class="text-h6 mb-2">
                  Preview ({{ preview.preview.length }} of {{ preview.total_rows }} rows)
                </div>

                <v-data-table
                  :headers="previewHeaders"
                  :items="preview.preview"
                  density="compact"
                  :items-per-page="5"
                  class="elevation-1"
                >
                  <template v-slot:item.status_preparation="{ item }">
                    <v-chip
                      size="x-small"
                      :color="getStatusColor(item.status_preparation)"
                      dark
                    >
                      {{ item.status_preparation }}
                    </v-chip>
                  </template>
                  <template v-slot:item.status_loading="{ item }">
                    <v-chip
                      size="x-small"
                      :color="getStatusColor(item.status_loading)"
                      dark
                    >
                      {{ item.status_loading }}
                    </v-chip>
                  </template>
                </v-data-table>

                <v-alert type="info" class="mt-4">
                  <strong>{{ preview.total_rows }}</strong> trucks will be imported.
                  <span v-if="preview.errors.length > 0">
                    ({{ preview.errors.length }} rows have errors and will be skipped)
                  </span>
                </v-alert>
              </v-container>

              <v-card-actions>
                <v-btn variant="text" @click="step = '1'">Back</v-btn>
                <v-spacer></v-spacer>
                <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                <v-btn
                  color="success"
                  @click="confirmImport"
                  :loading="importing"
                >
                  Confirm Import
                </v-btn>
              </v-card-actions>
            </v-stepper-window-item>

            <!-- Step 3: Results -->
            <v-stepper-window-item value="3">
              <v-container>
                <v-alert
                  :type="importResult.success ? 'success' : 'error'"
                  prominent
                >
                  <div class="text-h6">
                    {{ importResult.success ? 'Import Successful!' : 'Import Failed' }}
                  </div>
                  <div class="mt-2">
                    {{ importResult.message }}
                  </div>
                </v-alert>

                <v-table v-if="importResult.imported > 0" class="mt-4">
                  <tbody>
                    <tr>
                      <td>Successfully Imported</td>
                      <td class="text-right">
                        <strong class="text-green">{{ importResult.imported }}</strong>
                      </td>
                    </tr>
                    <tr v-if="importResult.failed > 0">
                      <td>Failed</td>
                      <td class="text-right">
                        <strong class="text-red">{{ importResult.failed }}</strong>
                      </td>
                    </tr>
                  </tbody>
                </v-table>

                <div v-if="importResult.failed_details && importResult.failed_details.length > 0" class="mt-4">
                  <div class="text-subtitle-1 mb-2">Failed imports:</div>
                  <v-list density="compact">
                    <v-list-item
                      v-for="(fail, index) in importResult.failed_details"
                      :key="index"
                    >
                      <v-list-item-title>
                        Row {{ fail.row }}: {{ fail.shipping_no }}
                      </v-list-item-title>
                      <v-list-item-subtitle>
                        {{ fail.error }}
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </div>
              </v-container>

              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  color="primary"
                  @click="closeAndRefresh"
                >
                  Close
                </v-btn>
              </v-card-actions>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useSnackbarStore } from '@/stores/snackbar'

const emit = defineEmits(['imported'])
const snackbar = useSnackbarStore()

// Dialog and stepper state
const dialog = ref(false)
const step = ref('1')
const file = ref(null)
const uploading = ref(false)
const importing = ref(false)

// Column definitions - Updated for Shipping No.
const requiredColumns = ['Terminal', 'Shipping No', 'Dock Code', 'Route']
const optionalColumns = ['Prep Start', 'Prep End', 'Load Start', 'Load End', 'Status Prep', 'Status Load']

// Validation rules
const fileRules = [
  v => !!v || 'File is required',
  v => !v || v.size < 10000000 || 'File size should be less than 10 MB'
]

// Preview data
const preview = ref({
  session_id: null,
  preview: [],
  total_rows: 0,
  errors: [],
  columns_found: []
})

// Import result
const importResult = ref({
  success: false,
  message: '',
  imported: 0,
  failed: 0,
  failed_details: []
})

// Table headers for preview - Updated for Shipping No.
const previewHeaders = [
  { title: 'Terminal', key: 'terminal' },
  { title: 'Shipping No', key: 'shipping_no' },
  { title: 'Dock Code', key: 'dock_code' },
  { title: 'Route', key: 'truck_route' },
  { title: 'Prep Status', key: 'status_preparation' },
  { title: 'Load Status', key: 'status_loading' }
]

// Helper functions
const getStatusColor = (status) => {
  switch (status) {
    case 'On Process': return 'blue'
    case 'Delay': return 'orange'
    case 'Finished': return 'green'
    default: return 'grey'
  }
}

const handleFileSelect = (file) => {
  if (file) {
    step.value = '1'
    preview.value = {
      session_id: null,
      preview: [],
      total_rows: 0,
      errors: [],
      columns_found: []
    }
  }
}

const downloadTemplate = async () => {
  try {
    const response = await axios.get('/api/trucks/template', {
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'truck_import_template.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    snackbar.success('Template downloaded successfully')
  } catch (error) {
    console.error('Download template error:', error)
    snackbar.error('Failed to download template')
  }
}

const uploadFile = async () => {
  if (!file.value) return
  
  uploading.value = true
  const formData = new FormData()
  formData.append('file', file.value)
  
  try {
    const response = await axios.post('/api/trucks/import/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    preview.value = response.data
    step.value = '2'
    snackbar.success('File uploaded successfully')
  } catch (error) {
    console.error('Upload error:', error)
    snackbar.error(error.response?.data?.detail || 'Failed to upload file')
  } finally {
    uploading.value = false
  }
}

const confirmImport = async () => {
  if (!preview.value.session_id) return
  
  importing.value = true
  
  try {
    const response = await axios.post('/api/trucks/import/confirm', {
      session_id: preview.value.session_id
    })
    
    importResult.value = response.data
    step.value = '3'
    
    // Emit event to refresh truck list
    emit('imported', response.data.imported)
    
    if (response.data.success) {
      snackbar.success(`Successfully imported ${response.data.imported} trucks`)
    }
  } catch (error) {
    console.error('Import error:', error)
    importResult.value = {
      success: false,
      message: error.response?.data?.detail || 'Import failed',
      imported: 0,
      failed: 0,
      failed_details: []
    }
    step.value = '3'
    snackbar.error('Import failed')
  } finally {
    importing.value = false
  }
}

const closeAndRefresh = () => {
  dialog.value = false
  // Reset state
  setTimeout(() => {
    step.value = '1'
    file.value = null
    preview.value = {
      session_id: null,
      preview: [],
      total_rows: 0,
      errors: [],
      columns_found: []
    }
    importResult.value = {
      success: false,
      message: '',
      imported: 0,
      failed: 0,
      failed_details: []
    }
  }, 300)
}
</script>