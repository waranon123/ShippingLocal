// frontend/src/stores/trucks.js - Fixed unsafe headers

import { defineStore } from 'pinia'
import axios from 'axios'

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

        // Clean undefined/null values
        Object.keys(allFilters).forEach(key => {
          if (allFilters[key] === undefined || allFilters[key] === null || allFilters[key] === '') {
            delete allFilters[key]
          }
        })

        const params = new URLSearchParams(allFilters)
        console.log('🚚 Fetching trucks with filters:', allFilters)
        console.log('📋 URL params:', params.toString())
        
        const response = await axios.get(`/api/trucks?${params}`, {
          headers: {
            'Accept': 'application/json'
          }
        })
        
        console.log('📦 Raw response data:', response.data)
        console.log('📦 Response type:', typeof response.data)
        console.log('📦 Is array:', Array.isArray(response.data))
        
        // Validate response is array
        if (Array.isArray(response.data)) {
          this.trucks = response.data
          console.log('✅ Trucks loaded successfully:', this.trucks.length, 'items')
          
          // Log sample data for debugging
          if (this.trucks.length > 0) {
            console.log('🔍 Sample truck data:', this.trucks[0])
            console.log('🔍 Date format example:', this.trucks[0].created_at)
          }
        } else if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          throw new Error('Received HTML instead of JSON - API connection issue')
        } else {
          console.warn('⚠️ Unexpected response format:', typeof response.data, response.data)
          this.trucks = []
        }
        
      } catch (error) {
        console.error('❌ Failed to fetch trucks:', error)
        console.error('❌ Error details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          params: error.config?.params
        })
        
        this.error = error.message || 'Failed to fetch trucks'
        this.trucks = []
        
        // Show user-friendly error for API issues
        if (error.message.includes('Network Error') || error.code === 'ERR_NETWORK') {
          this.error = 'Cannot connect to server. Please check if backend is running.'
        } else if (error.response?.status === 404) {
          this.error = 'API endpoint not found. Please check backend configuration.'
        } else if (error.message.includes('HTML')) {
          this.error = 'API not accessible - check backend URL and configuration'
        }
      } finally {
        this.loading = false
      }
    },

    setDateFilter(fromDate, toDate) {
      console.log('📅 Setting date filter:', { fromDate, toDate })
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

        // Clean undefined/null values
        Object.keys(allFilters).forEach(key => {
          if (allFilters[key] === undefined || allFilters[key] === null || allFilters[key] === '') {
            delete allFilters[key]
          }
        })

        const params = new URLSearchParams(allFilters)
        console.log('📊 Fetching stats with filters:', allFilters)
        
        const response = await axios.get(`/api/stats?${params}`, {
          headers: {
            'Accept': 'application/json'
          }
        })
        
        if (typeof response.data === 'object' && !Array.isArray(response.data)) {
          this.stats = response.data
          console.log('📊 Stats updated:', this.stats)
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
        console.error('❌ Failed to fetch stats:', error)
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
        console.log('🚛 Creating truck:', truckData)
        const response = await axios.post('/api/trucks', truckData, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        console.log('✅ Truck created:', response.data)
        return response.data
      } catch (error) {
        console.error('❌ Failed to create truck:', error)
        throw error
      }
    },

    async updateTruck(id, truckData) {
      try {
        console.log('🔄 Updating truck:', id, truckData)
        const response = await axios.put(`/api/trucks/${id}`, truckData, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        console.log('✅ Truck updated:', response.data)
        return response.data
      } catch (error) {
        console.error('❌ Failed to update truck:', error)
        throw error
      }
    },

    async deleteTruck(id) {
      try {
        console.log('🗑️ Deleting truck:', id)
        await axios.delete(`/api/trucks/${id}`, {
          headers: {
            'Accept': 'application/json'
          }
        })
        console.log('✅ Truck deleted:', id)
      } catch (error) {
        console.error('❌ Failed to delete truck:', error)
        throw error
      }
    },

    async updateStatus(id, statusType, status) {
      try {
        console.log('🔄 Updating status:', { id, statusType, status })
        const response = await axios.patch(`/api/trucks/${id}/status`, null, {
          params: { status_type: statusType, status },
          headers: {
            'Accept': 'application/json'
          }
        })
        console.log('✅ Status updated:', response.data)
        return response.data
      } catch (error) {
        console.error('❌ Failed to update status:', error)
        throw error
      }
    },

    connectWebSocket() {
      try {
        // Determine WebSocket URL
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        let wsUrl = import.meta.env.VITE_WS_URL
        
        // Fallback WebSocket URL construction
        if (!wsUrl) {
          const apiUrl = import.meta.env.VITE_API_BASE_URL || `${wsProtocol}//${window.location.host}`
          wsUrl = apiUrl.replace(/^https?:/, wsProtocol) + '/ws'
        }
        
        console.log('🔌 Connecting WebSocket to:', wsUrl)
        this.websocket = new WebSocket(wsUrl)

        this.websocket.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data)
            console.log('📨 WebSocket message received:', message)

            switch (message.type) {
              case 'truck_created':
                const existingIndex = this.trucks.findIndex(t => t.id === message.data.id)
                if (existingIndex === -1 && this.isWithinDateFilter(message.data.created_at)) {
                  this.trucks.unshift(message.data)
                  console.log('✅ New truck added to store:', message.data.id)
                  await this.fetchStats()
                }
                break
              case 'truck_updated':
              case 'status_updated':
                const updateIndex = this.trucks.findIndex(t => t.id === message.data.id)
                if (updateIndex !== -1) {
                  this.trucks[updateIndex] = message.data
                  console.log('✅ Truck updated in store:', message.data.id)
                  await this.fetchStats()
                }
                break
              case 'truck_deleted':
                this.trucks = this.trucks.filter(t => t.id !== message.data.id)
                console.log('✅ Truck removed from store:', message.data.id)
                await this.fetchStats()
                break
            }
          } catch (error) {
            console.error('❌ WebSocket message processing error:', error)
          }
        }

        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
        }
        
        this.websocket.onopen = () => {
          console.log('✅ WebSocket connected successfully')
        }
        
        this.websocket.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason)
          // Only attempt to reconnect if it wasn't a normal closure
          if (event.code !== 1000) {
            setTimeout(() => {
              if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
                console.log('🔄 Attempting to reconnect WebSocket...')
                this.connectWebSocket()
              }
            }, 5000) // Increased delay to 5 seconds
          }
        }
      } catch (error) {
        console.error('❌ WebSocket connection error:', error)
      }
    },

    disconnectWebSocket() {
      if (this.websocket) {
        console.log('🔌 Disconnecting WebSocket')
        this.websocket.close(1000, 'User navigated away') // Normal closure
        this.websocket = null
      }
    },

    isWithinDateFilter(dateString) {
      if (!this.dateFilter.fromDate && !this.dateFilter.toDate) return true

      try {
        const date = new Date(dateString)
        const dateOnly = date.toISOString().split('T')[0]

        console.log('📅 Checking date filter:', {
          dateString,
          dateOnly,
          fromDate: this.dateFilter.fromDate,
          toDate: this.dateFilter.toDate
        })

        if (this.dateFilter.fromDate && dateOnly < this.dateFilter.fromDate) {
          console.log('❌ Date before fromDate')
          return false
        }
        if (this.dateFilter.toDate && dateOnly > this.dateFilter.toDate) {
          console.log('❌ Date after toDate')
          return false
        }

        console.log('✅ Date within filter range')
        return true
      } catch (error) {
        console.error('❌ Date filter error:', error)
        return true
      }
    },

    // Debug method to check current state
    debugState() {
      console.log('🔍 Current store state:', {
        trucksCount: this.trucks.length,
        loading: this.loading,
        error: this.error,
        dateFilter: this.dateFilter,
        stats: this.stats,
        websocketState: this.websocket?.readyState
      })
    }
  }
})