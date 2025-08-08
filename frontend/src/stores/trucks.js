// frontend/src/stores/trucks.js - Complete version for Cloudflare Workers
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
    dateFilter: {
      fromDate: null,
      toDate: null
    },
    // Polling instead of WebSocket for Workers
    pollingInterval: null,
    isPolling: false,
    lastPollingUpdate: null
  }),

  getters: {
    // Get trucks by status
    trucksByPreparationStatus: (state) => (status) => {
      return state.trucks.filter(truck => truck.status_preparation === status)
    },
    
    trucksByLoadingStatus: (state) => (status) => {
      return state.trucks.filter(truck => truck.status_loading === status)
    },
    
    // Get trucks by terminal
    trucksByTerminal: (state) => (terminal) => {
      return state.trucks.filter(truck => truck.terminal === terminal)
    },
    
    // Get unique terminals
    uniqueTerminals: (state) => {
      return [...new Set(state.trucks.map(truck => truck.terminal))].sort()
    },
    
    // Get filtered trucks count
    filteredTrucksCount: (state) => {
      return state.trucks.length
    },
    
    // Check if data is stale (for polling)
    isDataStale: (state) => {
      if (!state.lastPollingUpdate) return true
      return Date.now() - state.lastPollingUpdate > 60000 // 1 minute
    }
  },

  actions: {
    // Validate truck data
    validateTruck(truck) {
      if (!truck || typeof truck !== 'object') {
        console.warn('⚠️ Invalid truck object:', truck)
        return false
      }
      
      if (!truck.id || typeof truck.id !== 'string') {
        console.warn('⚠️ Truck missing valid ID:', truck)
        return false
      }
      
      // Check required fields
      const requiredFields = ['terminal', 'shipping_no', 'dock_code', 'truck_route']
      for (const field of requiredFields) {
        if (!truck[field]) {
          console.warn(`⚠️ Truck missing required field: ${field}`, truck)
          return false
        }
      }
      
      return true
    },

    // Fetch trucks with filters
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
        console.log('🚚 Fetching trucks from Workers API:', allFilters)
        
        const response = await axios.get(`/api/trucks?${params}`, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 15000 // 15 second timeout
        })
        
        console.log('📦 Workers response:', response.data)
        
        if (Array.isArray(response.data)) {
          // Filter and validate truck data
          const validTrucks = response.data.filter(truck => {
            const isValid = this.validateTruck(truck)
            if (!isValid) {
              console.warn('⚠️ Filtering out invalid truck:', truck)
            }
            return isValid
          })
          
          this.trucks = validTrucks
          this.lastPollingUpdate = Date.now()
          console.log('✅ Trucks loaded from Workers:', this.trucks.length, 'valid items')
          
          // Log sample data for debugging
          if (this.trucks.length > 0) {
            console.log('🔍 Sample truck data:', this.trucks[0])
          }
        } else if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
          throw new Error('Received HTML instead of JSON - Workers API connection issue')
        } else {
          console.warn('⚠️ Unexpected response format from Workers:', typeof response.data, response.data)
          this.trucks = []
        }
        
      } catch (error) {
        console.error('❌ Failed to fetch trucks from Workers:', error)
        console.error('❌ Error details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          params: error.config?.params
        })
        
        this.error = error.message || 'Failed to fetch trucks'
        this.trucks = []
        
        // Enhanced error handling for Workers
        if (error.message.includes('Network Error') || error.code === 'ERR_NETWORK') {
          this.error = 'Cannot connect to Workers API. Please check backend deployment.'
        } else if (error.response?.status === 404) {
          this.error = 'Workers API endpoint not found. Please check backend URL.'
        } else if (error.response?.status === 401) {
          this.error = 'Authentication failed. Please login again.'
        } else if (error.response?.status === 403) {
          this.error = 'Access denied. Insufficient permissions.'
        } else if (error.response?.status >= 500) {
          this.error = 'Workers backend error. Please try again later.'
        } else if (error.code === 'ECONNABORTED') {
          this.error = 'Request timeout. Workers may be cold starting.'
        } else if (error.message.includes('HTML')) {
          this.error = 'Workers API not accessible - check backend URL and configuration'
        }
      } finally {
        this.loading = false
      }
    },

    // Set date filter
    setDateFilter(fromDate, toDate) {
      console.log('📅 Setting date filter for Workers:', { fromDate, toDate })
      this.dateFilter.fromDate = fromDate
      this.dateFilter.toDate = toDate
    },

    // Fetch statistics
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
        console.log('📊 Fetching stats from Workers:', allFilters)
        
        const response = await axios.get(`/api/stats?${params}`, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        })
        
        if (typeof response.data === 'object' && !Array.isArray(response.data)) {
          // Ensure all required properties exist with defaults
          this.stats = {
            total_trucks: response.data.total_trucks || 0,
            preparation_stats: {
              'On Process': 0,
              'Delay': 0,
              'Finished': 0,
              ...response.data.preparation_stats
            },
            loading_stats: {
              'On Process': 0,
              'Delay': 0,
              'Finished': 0,
              ...response.data.loading_stats
            },
            terminal_stats: response.data.terminal_stats || {}
          }
          console.log('📊 Stats updated from Workers:', this.stats)
        } else {
          console.warn('⚠️ Unexpected stats response from Workers:', response.data)
          this.resetStats()
        }
        
        return this.stats
      } catch (error) {
        console.error('❌ Failed to fetch stats from Workers:', error)
        this.resetStats()
        return this.stats
      }
    },

    // Reset stats to default values
    resetStats() {
      this.stats = {
        total_trucks: 0,
        preparation_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
        loading_stats: { 'On Process': 0, Delay: 0, Finished: 0 },
        terminal_stats: {}
      }
    },

    // Create new truck
    async createTruck(truckData) {
      try {
        console.log('🚛 Creating truck in Workers:', truckData)
        
        // Validate required fields client-side
        const requiredFields = ['terminal', 'shipping_no', 'dock_code', 'truck_route']
        for (const field of requiredFields) {
          if (!truckData[field]) {
            throw new Error(`${field} is required`)
          }
        }
        
        const response = await axios.post('/api/trucks', truckData, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        })
        
        console.log('✅ Truck created in Workers:', response.data)
        
        if (this.validateTruck(response.data)) {
          // Add to local state immediately for better UX
          this.trucks.unshift(response.data)
          
          // Refresh stats in background
          this.fetchStats().catch(err => 
            console.warn('Failed to refresh stats after create:', err)
          )
          
          return response.data
        } else {
          throw new Error('Invalid truck data returned from Workers')
        }
      } catch (error) {
        console.error('❌ Failed to create truck in Workers:', error)
        
        // Provide user-friendly error messages
        if (error.response?.status === 400) {
          throw new Error(error.response.data?.detail || 'Invalid truck data')
        } else if (error.response?.status === 401) {
          throw new Error('Authentication required')
        } else if (error.response?.status === 403) {
          throw new Error('Permission denied')
        } else {
          throw new Error(error.message || 'Failed to create truck')
        }
      }
    },

    // Get single truck by ID
    async getTruck(id) {
      try {
        if (!id || typeof id !== 'string') {
          throw new Error('Invalid truck ID provided')
        }
        
        console.log('🔍 Fetching truck by ID from Workers:', id)
        const response = await axios.get(`/api/trucks/${id}`, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        })
        
        if (this.validateTruck(response.data)) {
          return response.data
        } else {
          throw new Error('Invalid truck data returned from Workers')
        }
      } catch (error) {
        console.error('❌ Failed to get truck from Workers:', error)
        
        if (error.response?.status === 404) {
          throw new Error('Truck not found')
        } else {
          throw new Error(error.message || 'Failed to fetch truck')
        }
      }
    },

    // Update truck
    async updateTruck(id, truckData) {
      try {
        if (!id || typeof id !== 'string') {
          throw new Error('Invalid truck ID provided')
        }
        
        console.log('🔄 Updating truck in Workers:', id, truckData)
        const response = await axios.put(`/api/trucks/${id}`, truckData, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 15000
        })
        
        console.log('✅ Truck updated in Workers:', response.data)
        
        if (this.validateTruck(response.data)) {
          // Update local state
          const index = this.trucks.findIndex(t => t.id === id)
          if (index !== -1) {
            this.trucks[index] = response.data
          }
          
          // Refresh stats in background
          this.fetchStats().catch(err => 
            console.warn('Failed to refresh stats after update:', err)
          )
          
          return response.data
        } else {
          throw new Error('Invalid truck data returned from Workers')
        }
      } catch (error) {
        console.error('❌ Failed to update truck in Workers:', error)
        
        if (error.response?.status === 404) {
          throw new Error('Truck not found')
        } else if (error.response?.status === 400) {
          throw new Error(error.response.data?.detail || 'Invalid truck data')
        } else if (error.response?.status === 403) {
          throw new Error('Permission denied')
        } else {
          throw new Error(error.message || 'Failed to update truck')
        }
      }
    },

    // Delete truck
    async deleteTruck(id) {
      try {
        if (!id || typeof id !== 'string') {
          throw new Error('Invalid truck ID provided for deletion')
        }
        
        console.log('🗑️ Deleting truck in Workers:', id)
        await axios.delete(`/api/trucks/${id}`, {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        })
        
        console.log('✅ Truck deleted in Workers:', id)
        
        // Remove from local state
        this.trucks = this.trucks.filter(t => t.id !== id)
        
        // Refresh stats in background
        this.fetchStats().catch(err => 
          console.warn('Failed to refresh stats after delete:', err)
        )
        
      } catch (error) {
        console.error('❌ Failed to delete truck in Workers:', error)
        
        if (error.response?.status === 404) {
          throw new Error('Truck not found - it may have already been deleted')
        } else if (error.response?.status === 403) {
          throw new Error('Permission denied - you cannot delete this truck')
        } else {
          throw new Error(`Delete failed: ${error.message || 'Unknown error'}`)
        }
      }
    },

    // Update truck status
    async updateStatus(id, statusType, status) {
      try {
        if (!id || typeof id !== 'string') {
          throw new Error('Invalid truck ID provided for status update')
        }
        
        if (!['preparation', 'loading'].includes(statusType)) {
          throw new Error('Invalid status type. Must be "preparation" or "loading"')
        }
        
        if (!['On Process', 'Delay', 'Finished'].includes(status)) {
          throw new Error('Invalid status value')
        }
        
        console.log('🔄 Updating status in Workers:', { id, statusType, status })
        const response = await axios.patch(`/api/trucks/${id}/status`, null, {
          params: { status_type: statusType, status },
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        })
        
        console.log('✅ Status updated in Workers:', response.data)
        
        if (this.validateTruck(response.data)) {
          // Update local state
          const index = this.trucks.findIndex(t => t.id === id)
          if (index !== -1) {
            this.trucks[index] = response.data
          }
          
          // Refresh stats in background
          this.fetchStats().catch(err => 
            console.warn('Failed to refresh stats after status update:', err)
          )
          
          return response.data
        } else {
          throw new Error('Invalid truck data returned from Workers')
        }
      } catch (error) {
        console.error('❌ Failed to update status in Workers:', error)
        
        if (error.response?.status === 404) {
          throw new Error('Truck not found for status update')
        } else if (error.response?.status === 403) {
          throw new Error('Permission denied for status update')
        } else {
          throw new Error(`Status update failed: ${error.message || 'Unknown error'}`)
        }
      }
    },

    // Polling instead of WebSocket for Workers
    startPolling(intervalMs = 30000) {
      if (this.isPolling) {
        console.log('📡 Polling already active')
        return
      }
      
      console.log(`🔄 Starting polling for Workers (${intervalMs}ms interval)`)
      this.isPolling = true
      
      this.pollingInterval = setInterval(async () => {
        try {
          console.log('📡 Polling update...')
          await Promise.all([
            this.fetchTrucks(),
            this.fetchStats()
          ])
          console.log('📡 Polling update completed')
        } catch (error) {
          console.error('❌ Polling error:', error)
          // Don't stop polling on error, just log it
        }
      }, intervalMs)
    },

    stopPolling() {
      if (this.pollingInterval) {
        console.log('⏹️ Stopping polling')
        clearInterval(this.pollingInterval)
        this.pollingInterval = null
        this.isPolling = false
      }
    },

    // Compatibility methods for existing components (WebSocket replacement)
    connectWebSocket() {
      console.log('🔌 WebSocket not available in Workers, using polling instead')
      this.startPolling(30000) // Poll every 30 seconds
    },

    disconnectWebSocket() {
      console.log('🔌 Stopping polling (WebSocket compatibility)')
      this.stopPolling()
    },

    // Manual refresh method
    async refreshData() {
      try {
        console.log('🔄 Manual refresh started')
        await Promise.all([
          this.fetchTrucks(),
          this.fetchStats()
        ])
        console.log('🔄 Manual refresh completed')
      } catch (error) {
        console.error('❌ Manual refresh failed:', error)
        throw error
      }
    },

    // Check if truck is within date filter
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

    // Clear all filters
    clearFilters() {
      console.log('🧹 Clearing all filters')
      this.setDateFilter(null, null)
    },

    // Search trucks locally (since we can't do complex queries in Workers easily)
    searchTrucks(searchTerm) {
      if (!searchTerm) return this.trucks
      
      const term = searchTerm.toLowerCase()
      return this.trucks.filter(truck => 
        truck.shipping_no?.toLowerCase().includes(term) ||
        truck.terminal?.toLowerCase().includes(term) ||
        truck.dock_code?.toLowerCase().includes(term) ||
        truck.truck_route?.toLowerCase().includes(term)
      )
    },

    // Debug method to check current state
    debugState() {
      console.log('🔍 Workers store state:', {
        trucksCount: this.trucks.length,
        validTrucks: this.trucks.filter(t => this.validateTruck(t)).length,
        invalidTrucks: this.trucks.filter(t => !this.validateTruck(t)).length,
        loading: this.loading,
        error: this.error,
        dateFilter: this.dateFilter,
        stats: this.stats,
        isPolling: this.isPolling,
        pollingInterval: !!this.pollingInterval,
        lastPollingUpdate: this.lastPollingUpdate ? new Date(this.lastPollingUpdate).toISOString() : null,
        isDataStale: this.isDataStale,
        sampleTruckIds: this.trucks.slice(0, 5).map(t => ({ id: t.id, shipping_no: t.shipping_no }))
      })
      
      // Check for invalid trucks
      const invalidTrucks = this.trucks.filter(t => !this.validateTruck(t))
      if (invalidTrucks.length > 0) {
        console.warn('⚠️ Found invalid trucks:', invalidTrucks)
      }
    },

    // Clean up invalid trucks from state
    cleanupTrucks() {
      const originalCount = this.trucks.length
      this.trucks = this.trucks.filter(truck => this.validateTruck(truck))
      const cleanedCount = this.trucks.length
      
      if (originalCount !== cleanedCount) {
        console.log(`🧹 Cleaned up ${originalCount - cleanedCount} invalid trucks`)
      }
      
      return cleanedCount
    },

    // Reset store to initial state
    resetStore() {
      console.log('🔄 Resetting truck store')
      this.trucks = []
      this.resetStats()
      this.loading = false
      this.error = null
      this.setDateFilter(null, null)
      this.stopPolling()
      this.lastPollingUpdate = null
    },

    // Force refresh (bypass cache, stop/start polling)
    async forceRefresh() {
      console.log('💪 Force refresh initiated')
      
      // Stop polling temporarily
      this.stopPolling()
      
      try {
        // Clear current data
        this.trucks = []
        this.resetStats()
        this.error = null
        
        // Fetch fresh data
        await this.refreshData()
        
        // Restart polling
        this.startPolling()
        
        console.log('💪 Force refresh completed')
      } catch (error) {
        console.error('❌ Force refresh failed:', error)
        
        // Restart polling even if refresh failed
        this.startPolling()
        
        throw error
      }
    },

    // Get truck by shipping number
    getTruckByShippingNo(shippingNo) {
      return this.trucks.find(truck => truck.shipping_no === shippingNo)
    },

    // Get trucks with specific statuses
    getTrucksByStatus(preparationStatus = null, loadingStatus = null) {
      return this.trucks.filter(truck => {
        const prepMatch = !preparationStatus || truck.status_preparation === preparationStatus
        const loadMatch = !loadingStatus || truck.status_loading === loadingStatus
        return prepMatch && loadMatch
      })
    },

    // Bulk update statuses (for selected trucks)
    async bulkUpdateStatus(truckIds, statusType, status) {
      if (!Array.isArray(truckIds) || truckIds.length === 0) {
        throw new Error('No trucks selected for bulk update')
      }

      console.log(`🔄 Bulk updating ${truckIds.length} trucks:`, { statusType, status })
      
      const results = []
      const errors = []

      // Update trucks one by one (Workers doesn't support batch operations easily)
      for (const id of truckIds) {
        try {
          const result = await this.updateStatus(id, statusType, status)
          results.push(result)
        } catch (error) {
          console.error(`❌ Failed to update truck ${id}:`, error)
          errors.push({ id, error: error.message })
        }
      }

      console.log(`✅ Bulk update completed: ${results.length} success, ${errors.length} errors`)
      
      if (errors.length > 0) {
        console.warn('⚠️ Bulk update errors:', errors)
      }

      return {
        success: results.length,
        errors: errors.length,
        results,
        errorDetails: errors
      }
    }
  }
})