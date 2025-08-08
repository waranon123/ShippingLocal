// frontend/src/services/api.js - Centralized API Service
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
console.log('🔧 API Service - Base URL:', API_BASE_URL)

// Create main API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - always add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url, token ? 'with auth' : 'no auth')
    return config
  },
  (error) => {
    console.error('📤 Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('📥 API Error:', {
      status: error.response?.status,
      url: error.response?.config?.url,
      detail: error.response?.data?.detail,
      message: error.message
    })
    
    // Handle auth errors
    if (error.response?.status === 401) {
      console.warn('🔐 Authentication failed - redirecting to login')
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('user')
      
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

// API methods
export const apiService = {
  // Auth endpoints
  auth: {
    login: (credentials) => api.post('/api/auth/login', credentials),
    guestLogin: () => api.post('/api/auth/guest-login'),
    register: (userData) => api.post('/api/auth/register', userData)
  },
  
  // Truck endpoints
  trucks: {
    getAll: (params) => api.get('/api/trucks', { params }),
    getById: (id) => api.get(`/api/trucks/${id}`),
    create: (data) => api.post('/api/trucks', data),
    update: (id, data) => api.put(`/api/trucks/${id}`, data),
    delete: (id) => api.delete(`/api/trucks/${id}`),
    updateStatus: (id, statusType, status) => 
      api.patch(`/api/trucks/${id}/status?status_type=${statusType}&status=${status}`),
    
    // File operations
    downloadTemplate: () => api.get('/api/trucks/template', { 
      responseType: 'blob',
      headers: { 'Accept': 'text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    }),
    
    exportExcel: (params) => api.get('/api/trucks/export', { 
      params,
      responseType: 'blob',
      headers: { 'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    }),
    
    importPreview: (formData) => api.post('/api/trucks/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    
    importConfirm: (sessionData) => api.post('/api/trucks/import/confirm', sessionData)
  },
  
  // Stats endpoints
  stats: {
    get: (params) => api.get('/api/stats', { params })
  },
  
  // User management
  users: {
    getAll: () => api.get('/api/users'),
    delete: (id) => api.delete(`/api/users/${id}`)
  },
  
  // Health check
  health: () => api.get('/health')
}

// Export the axios instance for direct use if needed
export { api }
export default apiService