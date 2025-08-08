// frontend/src/plugins/axios.js
import axios from 'axios'

// Get the API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

console.log('🔧 Axios Config - API Base URL:', API_BASE_URL)

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('📤 Request with auth:', config.method?.toUpperCase(), config.url, 'Token:', token.substring(0, 20) + '...')
    } else {
      console.log('📤 Request without auth:', config.method?.toUpperCase(), config.url)
    }
    
    return config
  },
  (error) => {
    console.error('📤 Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('📤 Request with auth:', config.method?.toUpperCase(), config.url, 'Token:', token.substring(0, 20) + '...')
    } else {
      console.log('📤 Request without auth:', config.method?.toUpperCase(), config.url)
    }
    
    return config
  },
  (error) => {
    console.error('📤 Request Error:', error)
    return Promise.reject(error)
  }
)
//Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log('📥 Response Success:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('📥 Response Error:', {
      status: error.response?.status,
      url: error.response?.config?.url,
      message: error.message,
      detail: error.response?.data?.detail
    })
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      console.warn('🔐 Authentication failed - clearing token')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('role')
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        console.log('🔄 Redirecting to login')
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)
// Export both the configured instance and default axios
export { api as default, axios as axiosDefault }
export { API_BASE_URL }