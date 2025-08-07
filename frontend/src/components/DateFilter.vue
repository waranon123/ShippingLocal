<template>
  <v-row align="center" class="mb-4">
    <v-col cols="12" md="5">
      <v-menu
        v-model="fromDateMenu"
        :close-on-content-click="false"
        transition="scale-transition"
        offset-y
        min-width="auto"
      >
        <template v-slot:activator="{ props }">
          <v-text-field
            v-model="formattedFromDate"
            label="From Date"
            prepend-icon="mdi-calendar"
            readonly
            v-bind="props"
            clearable
            @click:clear="clearFromDate"
          ></v-text-field>
        </template>
        <v-date-picker
          v-model="fromDate"
          @update:model-value="fromDateMenu = false"
        ></v-date-picker>
      </v-menu>
    </v-col>

    <v-col cols="12" md="5">
      <v-menu
        v-model="toDateMenu"
        :close-on-content-click="false"
        transition="scale-transition"
        offset-y
        min-width="auto"
      >
        <template v-slot:activator="{ props }">
          <v-text-field
            v-model="formattedToDate"
            label="To Date"
            prepend-icon="mdi-calendar"
            readonly
            v-bind="props"
            clearable
            @click:clear="clearToDate"
          ></v-text-field>
        </template>
        <v-date-picker
          v-model="toDate"
          @update:model-value="toDateMenu = false"
        ></v-date-picker>
      </v-menu>
    </v-col>

    <v-col cols="12" md="2">
      <v-btn-group density="comfortable" variant="outlined">
        <v-tooltip text="Today">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" @click="setToday">
              <v-icon>mdi-calendar-today</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        
        <v-tooltip text="This Week">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" @click="setThisWeek">
              <v-icon>mdi-calendar-week</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
        
        <v-tooltip text="This Month">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" @click="setThisMonth">
              <v-icon>mdi-calendar-month</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-btn-group>
    </v-col>
  </v-row>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const emit = defineEmits(['update:fromDate', 'update:toDate', 'change'])

const props = defineProps({
  fromDate: String,
  toDate: String
})

const fromDate = ref(props.fromDate)
const toDate = ref(props.toDate)
const fromDateMenu = ref(false)
const toDateMenu = ref(false)

// Format dates for display
const formattedFromDate = computed(() => {
  return fromDate.value ? formatDate(fromDate.value) : ''
})

const formattedToDate = computed(() => {
  return toDate.value ? formatDate(toDate.value) : ''
})

// Helper function to format date
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Clear functions
const clearFromDate = () => {
  fromDate.value = null
  emit('update:fromDate', null)
  emit('change')
}

const clearToDate = () => {
  toDate.value = null
  emit('update:toDate', null)
  emit('change')
}

// Quick date setters
const setToday = () => {
  const today = new Date()
  fromDate.value = today.toISOString().split('T')[0]
  toDate.value = today.toISOString().split('T')[0]
  emit('update:fromDate', fromDate.value)
  emit('update:toDate', toDate.value)
  emit('change')
}

const setThisWeek = () => {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  
  fromDate.value = monday.toISOString().split('T')[0]
  toDate.value = today.toISOString().split('T')[0]
  emit('update:fromDate', fromDate.value)
  emit('update:toDate', toDate.value)
  emit('change')
}

const setThisMonth = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  
  fromDate.value = firstDay.toISOString().split('T')[0]
  toDate.value = today.toISOString().split('T')[0]
  emit('update:fromDate', fromDate.value)
  emit('update:toDate', toDate.value)
  emit('change')
}

// Watch for changes
watch(fromDate, (newVal) => {
  emit('update:fromDate', newVal)
  emit('change')
})

watch(toDate, (newVal) => {
  emit('update:toDate', newVal)
  emit('change')
})

// Watch for prop changes
watch(() => props.fromDate, (newVal) => {
  fromDate.value = newVal
})

watch(() => props.toDate, (newVal) => {
  toDate.value = newVal
})
</script>