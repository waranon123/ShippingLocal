<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" md="6" lg="3">
        <v-card class="elevation-2 rounded-lg pa-4">
          <v-card-text class="text-center">
            <div class="text-h2 font-weight-bold primary--text">{{ stats.total_trucks || 0 }}</div>
            <div class="text-h6 mt-2">Total Trucks</div>
          </v-card-text>
        </v-card>
      </v-col>

        <v-col cols="12" md="6" lg="3">
        <v-card class="elevation-2 rounded-lg pa-4">
          <v-card-text class="text-center">
            <div class="text-h2 font-weight-bold" style="color: #FFC107;">{{ stats.preparation_stats['On Process'] || 0 }}</div>
            <div class="text-h6 mt-2">Preparation In Progress</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6" lg="3">
        <v-card class="elevation-2 rounded-lg pa-4">
          <v-card-text class="text-center">
            <div class="text-h2 font-weight-bold text-red">{{ stats.preparation_stats['Delay'] || 0 }}</div>
            <div class="text-h6 mt-2">Preparation Delayed</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6" lg="3">
        <v-card class="elevation-2 rounded-lg pa-4">
          <v-card-text class="text-center">
            <div class="text-h2 font-weight-bold green--text">{{ stats.preparation_stats['Finished'] || 0 }}</div>
            <div class="text-h6 mt-2">Preparation Finished</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <v-card class="elevation-2 rounded-lg">
          <v-card-title class="text-h5 font-weight-bold">Preparation Status Distribution</v-card-title>
          <DateFilter v-model:from-date="dateFrom" v-model:to-date="dateTo" @change="handleDateChange" />
          <v-card-text>
            <canvas ref="prepChart" height="300"></canvas>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="elevation-2 rounded-lg">
          <v-card-title class="text-h5 font-weight-bold">Loading Status Distribution</v-card-title>
          <v-card-text>
            <canvas ref="loadChart" height="300"></canvas>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12">
        <v-card class="elevation-2 rounded-lg">
          <v-card-title class="text-h5 font-weight-bold">Trucks by Terminal</v-card-title>
          <v-card-text>
            <canvas ref="terminalChart" height="300"></canvas>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="truckStore.loading" class="mt-4">
      <v-col>
        <v-progress-linear indeterminate color="primary"></v-progress-linear>
      </v-col>
    </v-row>
    <v-row v-if="truckStore.error" class="mt-4">
      <v-col>
        <v-alert type="error">{{ truckStore.error }}</v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTruckStore } from '@/stores/trucks'
import { Chart } from 'chart.js/auto'
import DateFilter from '@/components/DateFilter.vue'

const truckStore = useTruckStore()
const prepChart = ref(null)
const loadChart = ref(null)
const terminalChart = ref(null)
const dateFrom = ref(truckStore.dateFilter.fromDate)
const dateTo = ref(truckStore.dateFilter.toDate)

const stats = computed(() => truckStore.stats)

let prepChartInstance = null
let loadChartInstance = null
let terminalChartInstance = null

const updateCharts = () => {
  if (!prepChart.value || !loadChart.value || !terminalChart.value) return

  // Preparation Status Chart
  if (prepChartInstance) prepChartInstance.destroy()
  prepChartInstance = new Chart(prepChart.value, {
    type: 'doughnut',
    data: {
      labels: ['On Process', 'Delay', 'Finished'],
      datasets: [{
        data: [
          stats.value.preparation_stats['On Process'] || 0,
          stats.value.preparation_stats['Delay'] || 0,
          stats.value.preparation_stats['Finished'] || 0
        ],
        backgroundColor: ['#2196F3', '#FF9800', '#4CAF50'],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: true }
      }
    }
  })

  // Loading Status Chart
  if (loadChartInstance) loadChartInstance.destroy()
  loadChartInstance = new Chart(loadChart.value, {
    type: 'doughnut',
    data: {
      labels: ['On Process', 'Delay', 'Finished'],
      datasets: [{
        data: [
          stats.value.loading_stats['On Process'] || 0,
          stats.value.loading_stats['Delay'] || 0,
          stats.value.loading_stats['Finished'] || 0
        ],
        backgroundColor: ['#2196F3', '#FF9800', '#4CAF50'],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: true }
      }
    }
  })

  // Terminal Chart
  if (terminalChartInstance) terminalChartInstance.destroy()
  terminalChartInstance = new Chart(terminalChart.value, {
    type: 'bar',
    data: {
      labels: Object.keys(stats.value.terminal_stats),
      datasets: [{
        label: 'Number of Trucks',
        data: Object.values(stats.value.terminal_stats),
        backgroundColor: '#1976D2',
        borderColor: '#1565C0',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      }
    }
  })
}

const handleDateChange = () => {
  truckStore.setDateFilter(dateFrom.value, dateTo.value)
  truckStore.fetchStats()
}

onMounted(() => {
  truckStore.connectWebSocket()
  truckStore.fetchStats().then(() => updateCharts())
  setInterval(() => truckStore.fetchStats().then(() => updateCharts()), 30000)
})

onUnmounted(() => {
  truckStore.disconnectWebSocket()
  if (prepChartInstance) prepChartInstance.destroy()
  if (loadChartInstance) loadChartInstance.destroy()
  if (terminalChartInstance) terminalChartInstance.destroy()
})
</script>

<style scoped>
.v-card {
  transition: transform 0.2s;
}
.v-card:hover {
  transform: translateY(-4px);
}
.text-h6 {
  font-weight: 500;
  color: #424242;
}
canvas {
  max-height: 300px;
}
</style>