// frontend/src/components/DateFilter.vue - Fixed date filter component

<template>
  <v-row align="center" class="mb-4">
    <v-col cols="12" md="5">
      <v-text-field
        v-model="fromDateInput"
        label="From Date"
        type="date"
        prepend-icon="mdi-calendar"
        clearable
        @click:clear="clearFromDate"
        @update:model-value="updateFromDate"
        :max="toDateInput"
        variant="outlined"
        density="comfortable"
      ></v-text-field>
    </v-col>

    <v-col cols="12" md="5">
      <v-text-field
        v-model="toDateInput"
        label="To Date"
        type="date"
        prepend-icon="mdi-calendar"
        clearable
        @click:clear="clearToDate"
        @update:model-value="updateToDate"
        :min="fromDateInput"
        variant="outlined"
        density="comfortable"
      ></v-text-field>
    </v-col>

    <v-col cols="12" md="2">
      <v-btn-group density="comfortable" variant="outlined">
        <v-tooltip text="Today">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" @click="setToday" :disabled="loading">
              <v-icon>mdi-calendar-today</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        
        <v-tooltip text="This Week">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" @click="setThisWeek" :disabled="loading">
              <v-icon>mdi-calendar-week</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        
        <v-tooltip text="This Month">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" @click="setThisMonth" :disabled="loading">
              <v-icon>mdi-calendar-month</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-btn-group>
    </v-col>
  </v-row>

  <!-- Debug Info (can be removed in production) -->
  <v-row v-if="showDebugInfo">
    <v-col cols="12">
      <v-alert type="info" density="compact" variant="outlined">
        <div class="text-caption">
          <strong>Date Filter Debug:</strong><br>
          From: {{ fromDateInput || 'null' }} | To: {{ toDateInput || 'null' }}<br>
          Emitted: from={{ fromDate }} | to={{ toDate }}
        </div>
      </v-alert>
    </v-col>
  </v-row>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

// Props and emits
const emit = defineEmits(['update:fromDate', 'update:toDate', 'change'])

const props = defineProps({
  fromDate: String,
  toDate: String,
  loading: Boolean,
  showDebugInfo: {
    type: Boolean,
    default: false
  }
})

// Local reactive state
const fromDateInput = ref(props.fromDate)
const toDateInput = ref(props.toDate)

// Helper function to format date for input (YYYY-MM-DD)
const formatDateForInput = (date) => {
  if (!date) return ''
  if (date instanceof Date) {
    return date.toISOString().split('T')[0]
  }
  if (typeof date === 'string') {
    // Handle different date string formats
    const parsedDate = new Date(date)
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0]
    }
  }
  return date
}

// Helper function to validate date format
const isValidDate = (dateString) => {
  if (!dateString) return true
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0]
}

// Update methods
const updateFromDate = (value) => {
  console.log('📅 From date input changed:', value)
  fromDateInput.value = value
  
  if (value && !isValidDate(value)) {
    console.warn('⚠️ Invalid from date format:', value)
    return
  }
  
  emit('update:fromDate', value || null)
  emitChange()
}

const updateToDate = (value) => {
  console.log('📅 To date input changed:', value)
  toDateInput.value = value
  
  if (value && !isValidDate(value)) {
    console.warn('⚠️ Invalid to date format:', value)
    return
  }
  
  emit('update:toDate', value || null)
  emitChange()
}

// Clear functions
const clearFromDate = () => {
  console.log('🧹 Clearing from date')
  fromDateInput.value = null
  emit('update:fromDate', null)
  emitChange()
}

const clearToDate = () => {
  console.log('🧹 Clearing to date')
  toDateInput.value = null
  emit('update:toDate', null)
  emitChange()
}

// Quick date setters
const setToday = () => {
  const today = new Date().toISOString().split('T')[0]
  console.log('📅 Setting today:', today)
  
  fromDateInput.value = today
  toDateInput.value = today
  
  emit('update:fromDate', today)
  emit('update:toDate', today)
  emitChange()
}

const setThisWeek = () => {
  const today = new Date()
  const monday = new Date(today)
  const dayOfWeek = today.getDay()
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Handle Sunday as day 0
  monday.setDate(today.getDate() - daysToSubtract)
  
  const mondayStr = monday.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  
  console.log('📅 Setting this week:', mondayStr, 'to', todayStr)
  
  fromDateInput.value = mondayStr
  toDateInput.value = todayStr
  
  emit('update:fromDate', mondayStr)
  emit('update:toDate', todayStr)
  emitChange()
}

const setThisMonth = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const firstDayStr = firstDay.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  
  console.log('📅 Setting this month:', firstDayStr, 'to', todayStr)
  
  fromDateInput.value = firstDayStr
  toDateInput.value = todayStr
  
  emit('update:fromDate', firstDayStr)
  emit('update:toDate', todayStr)
  emitChange()
}

// Emit change event with delay to avoid too many API calls
let changeTimeout = null
const emitChange = () => {
  if (changeTimeout) {
    clearTimeout(changeTimeout)
  }
  
  changeTimeout = setTimeout(() => {
    console.log('📅 Emitting change event:', {
      from: fromDateInput.value,
      to: toDateInput.value
    })
    emit('change', {
      from: fromDateInput.value,
      to: toDateInput.value
    })
  }, 300) // 300ms delay to avoid too many API calls while typing
}

// Computed properties for parent access
const fromDate = computed(() => fromDateInput.value)
const toDate = computed(() => toDateInput.value)

// Watch for prop changes from parent
watch(() => props.fromDate, (newVal) => {
  if (newVal !== fromDateInput.value) {
    console.log('📅 From date prop changed:', newVal)
    fromDateInput.value = formatDateForInput(newVal)
  }
})

watch(() => props.toDate, (newVal) => {
  if (newVal !== toDateInput.value) {
    console.log('📅 To date prop changed:', newVal)
    toDateInput.value = formatDateForInput(newVal)
  }
})

// Initialize on mount
onMounted(() => {
  console.log('📅 DateFilter mounted with props:', {
    fromDate: props.fromDate,
    toDate: props.toDate
  })
  
  // Format initial values
  if (props.fromDate) {
    fromDateInput.value = formatDateForInput(props.fromDate)
  }
  if (props.toDate) {
    toDateInput.value = formatDateForInput(props.toDate)
  }
})

// Expose methods for parent component
defineExpose({
  clearFilters: () => {
    clearFromDate()
    clearToDate()
  },
  setDateRange: (from, to) => {
    fromDateInput.value = formatDateForInput(from)
    toDateInput.value = formatDateForInput(to)
    emit('update:fromDate', from)
    emit('update:toDate', to)
    emitChange()
  }
})
</script>

<style scoped>
.v-btn-group .v-btn {
  min-width: 44px;
}

.text-caption {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
}

.v-alert {
  margin-top: 8px;
}
</style>