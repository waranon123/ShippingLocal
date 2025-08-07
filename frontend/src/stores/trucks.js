import { defineStore } from 'pinia'
import axios from 'axios'

// Add ngrok bypass headers
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'
axios.defaults.headers.common['User-Agent'] = 'TruckManagementSystem/1.0'

export const useTruckStore = defineStore('trucks', {
  state: () => ({
    trucks: [],
    stats: {
      total_trucks: 0,
      preparation_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
      loading_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
      terminal_stats: {}
    },
    loading: false,
    error: null,
    websocket: null,
    dateFilter: {
      fromDate: null,
      toDate: null
    }
  }),

  actions: {
    async fetchTrucks(filters = {}) {
      this.loading = true
      this.error = null
      
      try {
        const allFilters = {
          ...filters,
          date_from: this.dateFilter.fromDate,
          date_to: this.dateFilter.toDate
        }

        Object.keys(allFilters).forEach(key => {
          if (allFilters[key] === undefined || allFilters[key] === null) {
            delete allFilters[key]
          }
        })

        const params = new URLSearchParams(allFilters)
        console.log('🚚 Fetching trucks with params:', params.toString())
        
        const response = await axios.get(`/api/trucks?${params}`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TruckManagementSystem/1.0',
            'Accept': 'application/json'
          }
        })
        
        console.log('📦 Raw response data:', response.data)
        
        // Validate response is array
        if (Array.isArray(response.data)) {
          this.trucks = response.data
          console.log('✅ Trucks loaded successfully:', this.trucks.length, 'items')
        } else if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          throw new Error('Received HTML instead of JSON - Ngrok browser warning detected')
        } else {
          console.warn('⚠️ Unexpected response format:', typeof response.data, response.data)
          this.trucks = []
        }
        
      } catch (error) {
        console.error('❌ Failed to fetch trucks:', error)
        this.error = error.message || 'Failed to fetch trucks'
        this.trucks = []
        
        // Show user-friendly error for ngrok issues
        if (error.message.includes('Ngrok') || error.message.includes('HTML')) {
          this.error = 'API not accessible - check backend URL and ngrok tunnel'
        }
      } finally {
        this.loading = false
      }
    },

    setDateFilter(fromDate, toDate) {
      this.dateFilter.fromDate = fromDate
      this.dateFilter.toDate = toDate
    },

    async fetchStats(filters = {}) {
      try {
        const allFilters = {
          ...filters,
          date_from: this.dateFilter.fromDate,
          date_to: this.dateFilter.toDate
        }

        Object.keys(allFilters).forEach(key => {
          if (allFilters[key] === undefined || allFilters[key] === null) {
            delete allFilters[key]
          }
        })

        const params = new URLSearchParams(allFilters)
        const response = await axios.get(`/api/stats?${params}`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TruckManagementSystem/1.0',
            'Accept': 'application/json'
          }
        })
        
        if (typeof response.data === 'object' && !Array.isArray(response.data)) {
          this.stats = response.data
        } else {
          console.warn('⚠️ Unexpected stats response:', response.data)
          this.stats = {
            total_trucks: 0,
            preparation_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
            loading_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
            terminal_stats: {}
          }
        }
        
        return this.stats
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        this.stats = {
          total_trucks: 0,
          preparation_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
          loading_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
          terminal_stats: {}
        }
        return this.stats
      }
    },

    async createTruck(truckData) {
      try {
        const response = await axios.post('/api/trucks', truckData, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TruckManagementSystem/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        return response.data
      } catch (error) {
        throw error
      }
    },

    async updateTruck(id, truckData) {
      try {
        const response = await axios.put(`/api/trucks/${id}`, truckData, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TruckManagementSystem/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        return response.data
      } catch (error) {
        throw error
      }
    },

    async deleteTruck(id) {
      try {
        await axios.delete(`/api/trucks/${id}`, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TruckManagementSystem/1.0'
          }
        })
      } catch (error) {
        throw error
      }
    },

    async updateStatus(id, statusType, status) {
      try {
        const response = await axios.patch(`/api/trucks/${id}/status`, null, {
          params: { status_type: statusType, status },
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'TruckManagementSystem/1.0',
            'Accept': 'application/json'
          }
        })
        return response.data
      } catch (error) {
        throw error
      }
    },

    connectWebSocket() {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`
      
      console.log('🔌 Connecting WebSocket to:', wsUrl)
      this.websocket = new WebSocket(wsUrl)

      this.websocket.onmessage = async (event) => {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'truck_created':
            // Check if truck already exists to prevent duplicates
            const existingIndex = this.trucks.findIndex(t => t.id === message.data.id)
            if (existingIndex === -1 && this.isWithinDateFilter(message.data.created_at)) {
              this.trucks.unshift(message.data) // Add to beginning of array
              await this.fetchStats() // Refresh stats on truck creation
            }
            break
          case 'truck_updated':
          case 'status_updated':
            const updateIndex = this.trucks.findIndex(t => t.id === message.data.id)
            if (updateIndex !== -1) {
              this.trucks[updateIndex] = message.data
              await this.fetchStats() // Refresh stats on update
            }
            break
          case 'truck_deleted':
            this.trucks = this.trucks.filter(t => t.id !== message.data.id)
            await this.fetchStats() // Refresh stats on deletion
            break
        }
      }

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
      this.websocket.onopen = () => {
        console.log('✅ WebSocket connected')
      }
      
      this.websocket.onclose = () => {
        console.log('🔌 WebSocket disconnected')
      }
    },

    disconnectWebSocket() {
      if (this.websocket) {
        this.websocket.close()
        this.websocket = null
      }
    },

    isWithinDateFilter(dateString) {
      if (!this.dateFilter.fromDate && !this.dateFilter.toDate) return true

      const date = new Date(dateString)
      const dateOnly = date.toISOString().split('T')[0]

      if (this.dateFilter.fromDate && dateOnly < this.dateFilter.fromDate) return false
      if (this.dateFilter.toDate && dateOnly > this.dateFilter.toDate) return false

      return true
    }
  }
})