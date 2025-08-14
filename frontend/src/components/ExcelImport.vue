<!-- 
frontend/src/components/ExcelImport.vue - Updated to reflect new duplicate rules
-->
<template>
  <v-dialog v-model="dialog" max-width="800px">
    <template v-slot:activator="{ props }">
      <v-btn
        color="success"
        v-bind="props"
        prepend-icon="mdi-file-excel"
      >
        Import Excel (Monthly)
      </v-btn>
    </template>

    <v-card>
      <v-card-title>
        <span class="text-h5">Import Monthly Truck Data from Excel</span>
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
              Preview Monthly Data
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
                      label="Select Excel file with monthly data"
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
                      Download Monthly Template
                    </v-btn>
                  </div>
                </v-alert>

                <v-divider class="my-4"></v-divider>

               <!-- ✅ UPDATED: New import rules explanation -->
                <v-alert type="success" class="mb-4">
                  <div class="text-subtitle-1 mb-2">📅 Smart Import Rules:</div>
                  <ul>
                    <li><strong>Duplicates Allowed:</strong> Same dock codes, terminals can exist in different records</li>
                    <li><strong>Update Condition:</strong> Updates ONLY when ALL 5 fields match exactly:
                      <ol class="ml-4 mt-1">
                        <li>Date (same day)</li>
                        <li>Terminal</li>
                        <li>Shipping No</li>
                        <li>Dock Code</li>
                        <li>Truck Route</li>
                      </ol>
                    </li>
                    <li><strong>New Record:</strong> Creates new if ANY field is different</li>
                    <li><strong>Monthly Processing:</strong> Each row creates daily records for the entire month</li>
                    <li><strong>Example:</strong> "2024-01" creates 31 records (Jan 1-31, 2024)</li>
                  </ul>
                </v-alert>

                <!-- ✅ UPDATED: Update conditions explanation -->
                <v-expansion-panels class="mb-4">
                  <v-expansion-panel>
                    <v-expansion-panel-title>
                      <v-icon class="mr-2">mdi-information</v-icon>
                      When will data be updated vs. created new?
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                      <div class="text-body-2">
                        <v-alert type="warning" density="compact" class="mb-3">
                          <strong>Update Conditions (ALL must match):</strong>
                        </v-alert>
                        <ol>
                          <li><strong>Same Date:</strong> Same day of the month</li>
                          <li><strong>Same Terminal:</strong> Exact terminal match</li>
                          <li><strong>Same Shipping No:</strong> Exact shipping number</li>
                          <li><strong>Same Dock Code:</strong> Exact dock code</li>
                          <li><strong>Same Route:</strong> Exact truck route</li>
                        </ol>
                        
                        <v-alert type="success" density="compact" class="mt-3">
                          <strong>If ANY field is different → Creates NEW record</strong>
                        </v-alert>
                        
                        <div class="text-caption mt-2">
                          <strong>Examples:</strong><br>
                          ✅ Update: 2024-01-15, Terminal A, SHP001, DOCK-01, Route ABC → Updates times/status<br>
                          ➕ New: 2024-01-15, Terminal A, SHP001, DOCK-02, Route ABC → Creates new record (different dock)<br>
                          ➕ New: 2024-01-16, Terminal A, SHP001, DOCK-01, Route ABC → Creates new record (different date)
                        </div>
                      </div>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

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

                <v-card class="mb-4" variant="outlined">
                  <v-card-title class="text-h6">Monthly Import Summary</v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols="6">
                        <div class="text-h4 text-primary">{{ preview.total_templates }}</div>
                        <div class="text-body-2">Monthly Templates</div>
                      </v-col>
                      <v-col cols="6">
                        <div class="text-h4 text-success">{{ preview.total_records_to_create }}</div>
                        <div class="text-body-2">Daily Records to Create</div>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>

                <!-- ✅ UPDATED: Show flexible import message -->
                <v-alert type="info" class="mb-4">
                  <v-icon class="mr-2">mdi-check-circle</v-icon>
                  <strong>Flexible Import Ready:</strong> {{ preview.message }}
                </v-alert>

                <div class="text-h6 mb-2">
                  Preview Monthly Templates ({{ preview.preview.length }} shown)
                </div>

                <v-data-table
                  :headers="previewHeaders"
                  :items="preview.preview"
                  density="compact"
                  :items-per-page="5"
                  class="elevation-1"
                >
                  <template v-slot:item.month="{ item }">
                    <v-chip color="primary" size="small">
                      {{ item.year }}-{{ String(item.month).padStart(2, '0') }}
                    </v-chip>
                  </template>
                  
                  <template v-slot:item.preview_days="{ item }">
                    <v-chip color="info" size="small">
                      {{ item.preview_days }} days
                    </v-chip>
                  </template>
                  
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
                  Confirm Flexible Import
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
                    {{ importResult.success ? 'Flexible Monthly Import Successful!' : 'Monthly Import Failed' }}
                  </div>
                  <div class="mt-2">
                    {{ importResult.message }}
                  </div>
                </v-alert>

                <!-- ✅ UPDATED: Enhanced results summary -->
                <v-card v-if="importResult.imported > 0" class="mt-4" variant="outlined">
                  <v-card-title class="text-h6">Import Summary</v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols="4">
                        <div class="text-center">
                          <div class="text-h4 text-success">{{ importResult.imported }}</div>
                          <div class="text-body-2">Total Records</div>
                        </div>
                      </v-col>
                      <v-col cols="4">
                        <div class="text-center">
                          <div class="text-h4 text-info">{{ importResult.updated || 0 }}</div>
                          <div class="text-body-2">Updated</div>
                        </div>
                      </v-col>
                      <v-col cols="4">
                        <div class="text-center">
                          <div class="text-h4 text-primary">{{ importResult.created || (importResult.imported - (importResult.updated || 0)) }}</div>
                          <div class="text-body-2">Created New</div>
                        </div>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>

                <v-table v-if="importResult.imported > 0" class="mt-4">
                  <tbody>
                    <tr>
                      <td><v-icon class="mr-2 text-success">mdi-check-circle</v-icon>Successfully Processed</td>
                      <td class="text-right">
                        <strong class="text-success">{{ importResult.imported }}</strong> daily records
                      </td>
                    </tr>
                    <tr v-if="importResult.failed > 0">
                      <td><v-icon class="mr-2 text-error">mdi-alert-circle</v-icon>Failed Records</td>
                      <td class="text-right">
                        <strong class="text-error">{{ importResult.failed }}</strong> records
                      </td>
                    </tr>
                    <tr>
                      <td><v-icon class="mr-2 text-info">mdi-update</v-icon>Duplicate Handling</td>
                      <td class="text-right">
                        <strong class="text-info">Smart Updates</strong> enabled
                      </td>
                    </tr>
                  </tbody>
                </v-table>

                <!-- ✅ UPDATED: Better error display with context -->
                <div v-if="importResult.failed_details && importResult.failed_details.length > 0" class="mt-4">
                  <div class="text-subtitle-1 mb-2">
                    <v-icon class="mr-1">mdi-alert</v-icon>
                    Failed Import Details:
                  </div>
                  <v-expansion-panels>
                    <v-expansion-panel>
                      <v-expansion-panel-title>
                        View {{ importResult.failed_details.length }} Failed Records
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <v-list density="compact" max-height="300" style="overflow-y: auto">
                          <v-list-item
                            v-for="(fail, index) in importResult.failed_details"
                            :key="index"
                          >
                            <template v-slot:prepend>
                              <v-icon color="error" size="small">mdi-alert-circle</v-icon>
                            </template>
                            <v-list-item-title>
                              Template {{ fail.template }}{{ fail.day ? `, Day ${fail.day}` : '' }}: 
                              <strong>{{ fail.shipping_no }}</strong>
                            </v-list-item-title>
                            <v-list-item-subtitle class="text-error">
                              {{ fail.error }}
                            </v-list-item-subtitle>
                          </v-list-item>
                        </v-list>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
                <!-- ✅ UPDATED: New import rules explanation -->
                <v-alert type="success" class="mb-4">
                  <div class="text-subtitle-1 mb-2">📅 Smart Import Rules:</div>
                  <ul>
                    <li><strong>Duplicates Allowed:</strong> Same dock codes, terminals can exist in different records</li>
                    <li><strong>Update Condition:</strong> Updates ONLY when ALL 5 fields match exactly:
                      <ol class="ml-4 mt-1">
                        <li>Date (same day)</li>
                        <li>Terminal</li>
                        <li>Shipping No</li>
                        <li>Dock Code</li>
                        <li>Truck Route</li>
                      </ol>
                    </li>
                    <li><strong>New Record:</strong> Creates new if ANY field is different</li>
                    <li><strong>Monthly Processing:</strong> Each row creates daily records for the entire month</li>
                    <li><strong>Example:</strong> "2024-01" creates 31 records (Jan 1-31, 2024)</li>
                  </ul>
                </v-alert>
                <!-- ✅ UPDATED: Better troubleshooting tips -->
                <v-alert v-if="importResult.failed > 0" type="warning" class="mt-4">
                  <div class="text-subtitle-1 mb-2">
                    <v-icon class="mr-1">mdi-tools</v-icon>
                    Troubleshooting Tips:
                  </div>
                  <ul class="text-body-2">
                    <li><strong>Required Fields:</strong> Check that Month, Terminal, Shipping No, Dock Code, and Route are filled</li>
                    <li><strong>Date Format:</strong> Use YYYY-MM format for months (e.g., 2024-01, 2024-12)</li>
                    <li><strong>Time Format:</strong> Use HH:MM format for times (e.g., 08:30, 14:15)</li>
                    <li><strong>Status Values:</strong> Only use "On Process", "Delay", or "Finished"</li>
                    <li><strong>Large Files:</strong> Consider splitting very large files into smaller batches</li>
                  </ul>
                </v-alert>
              </v-container>

              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  color="primary"
                  @click="closeAndRefresh"
                >
                  Close & Refresh Data
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

// ✅ UPDATED: Column definitions for flexible import
const requiredColumns = ['Month (YYYY-MM)', 'Terminal', 'Shipping No', 'Dock Code', 'Route']
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
  total_templates: 0,
  total_records_to_create: 0,
  errors: [],
  columns_found: [],
  message: ''
})

// ✅ UPDATED: Import result with more detailed feedback
const importResult = ref({
  success: false,
  message: '',
  imported: 0,
  failed: 0,
  failed_details: [],
  updated: 0,
  created: 0
})

// Table headers for preview - Updated for monthly data
const previewHeaders = [
  { title: 'Month', key: 'month' },
  { title: 'Days', key: 'preview_days' },
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
      total_templates: 0,
      total_records_to_create: 0,
      errors: [],
      columns_found: [],
      message: ''
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
    link.setAttribute('download', 'truck_monthly_import_template.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
    
    snackbar.success('Monthly template downloaded successfully')
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
    snackbar.success('Monthly data file uploaded successfully')
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
      snackbar.success(`Successfully imported ${response.data.imported} daily records with flexible duplicate handling`)
    }
  } catch (error) {
    console.error('Import error:', error)
    importResult.value = {
      success: false,
      message: error.response?.data?.detail || 'Monthly import failed',
      imported: 0,
      failed: 0,
      failed_details: [],
      updated: 0,
      created: 0
    }
    step.value = '3'
    snackbar.error('Monthly import failed')
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
      total_templates: 0,
      total_records_to_create: 0,
      errors: [],
      columns_found: [],
      message: ''
    }
    importResult.value = {
      success: false,
      message: '',
      imported: 0,
      failed: 0,
      failed_details: [],
      updated: 0,
      created: 0
    }
  }, 300)
}
</script>

<style scoped>
.v-stepper {
  box-shadow: none;
}

.v-chip {
  font-weight: 600;
}

.text-h4 {
  font-weight: 700;
}

.v-expansion-panels {
  border-radius: 8px;
}

.v-list-item-subtitle.text-error {
  color: rgb(244, 67, 54) !important;
}

.v-alert ul {
  margin-left: 16px;
}

.v-alert ul li {
  margin-bottom: 4px;
}
</style>