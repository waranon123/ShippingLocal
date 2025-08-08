// frontend/src/stores/auth.js - Streamlined & Fixed
import { defineStore } from 'pinia'
import axios from 'axios'

// Get API base URL with proper fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
console.log('🔗 Auth Store - API Base URL:', API_BASE_URL)

// Create dedicated auth axios instance
const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add request interceptor to always include token
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('📤 Auth Request:', config.method?.toUpperCase(), config.url, 'with token')
    } else {
      console.log('📤 Auth Request:', config.method?.toUpperCase(), config.url, 'no token')
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Add response interceptor
authApi.interceptors.response.use(
  (response) => {
    console.log('📥 Auth Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('📥 Auth Error:', error.response?.status, error.response?.config?.url)
    
    if (error.response?.status === 401) {
      console.warn('🔐 Token expired/invalid - clearing auth')
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('user')
    }
    
    return Promise.reject(error)
  }
)

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    role: localStorage.getItem('role') || null,
    loading: false
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.role === 'admin',
    isUser: (state) => ['admin', 'user'].includes(state.role),
    isViewer: (state) => ['admin', 'user', 'viewer'].includes(state.role),
    hasRole: (state) => (requiredRole) => {
      if (!state.role) return false
      const roleHierarchy = { viewer: 0, user: 1, admin: 2 }
      return roleHierarchy[state.role] >= roleHierarchy[requiredRole]
    }
  },
  
  actions: {
    setAuth(data) {
      console.log('🔐 Setting auth data:', { role: data.role, hasToken: !!data.access_token })
      
      this.token = data.access_token
      this.role = data.role
      this.user = {
        username: data.username || this.role || 'User',
        role: data.role
      }
      
      // Store in localStorage
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('user', JSON.stringify(this.user))
      
      // Set default header for all axios requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
    },
    
    clearAuth() {
      console.log('🔓 Clearing auth')
      
      this.token = null
      this.role = null
      this.user = null
      
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('user')
      
      delete axios.defaults.headers.common['Authorization']
    },
    
    async login(username, password) {
      this.loading = true
      
      try {
        console.log('🔑 Login attempt:', username)
        
        // Try JSON login first
        const response = await authApi.post('/api/auth/login', {
          username,
          password
        })
        
        console.log('✅ Login successful:', response.data)
        
        this.setAuth({
          access_token: response.data.access_token,
          role: response.data.role,
          username
        })
        
        return { success: true, data: response.data }
        
      } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message)
        
        // Try form data as fallback
        if (error.response?.status === 400 || error.response?.status === 422) {
          try {
            console.log('🔄 Retrying with form data...')
            
            const formData = new FormData()
            formData.append('username', username)
            formData.append('password', password)
            
            const retryResponse = await authApi.post('/api/auth/login', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
            
            console.log('✅ Login successful (form data):', retryResponse.data)
            
            this.setAuth({
              access_token: retryResponse.data.access_token,
              role: retryResponse.data.role,
              username
            })
            
            return { success: true, data: retryResponse.data }
            
          } catch (formError) {
            console.error('❌ Form data login also failed:', formError)
          }
        }
        
        return { 
          success: false, 
          error: error.response?.data?.detail || 'Login failed' 
        }
      } finally {
        this.loading = false
      }
    },
    
    async guestLogin() {
      this.loading = true
      
      try {
        console.log('👤 Guest login attempt')
        
        const response = await authApi.post('/api/auth/guest-login')
        
        console.log('✅ Guest login successful:', response.data)
        
        this.setAuth({
          access_token: response.data.access_token,
          role: response.data.role,
          username: 'guest_viewer'
        })
        
        return { success: true, data: response.data }
        
      } catch (error) {
        console.error('❌ Guest login failed:', error)
        return { 
          success: false, 
          error: error.response?.data?.detail || 'Guest login failed' 
        }
      } finally {
        this.loading = false
      }
    },
    
    logout() {
      console.log('🚪 Logout')
      this.clearAuth()
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    },
    
    // Initialize auth from localStorage
    initAuth() {
      if (this.token) {
        console.log('🔄 Initializing auth from localStorage')
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        return true
      }
      return false
    },
    
    // Test if current token is valid
    async testAuth() {
      if (!this.token) return false
      
      try {
        console.log('🧪 Testing auth token...')
        await authApi.get('/health')
        console.log('✅ Token is valid')
        return true
      } catch (error) {
        console.log('❌ Token test failed:', error.response?.status)
        if (error.response?.status === 401) {
          this.clearAuth()
        }
        return false
      }
    }
  }
})

// Export the auth api instance for other stores to use
export { authApi }