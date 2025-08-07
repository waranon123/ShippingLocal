import { defineStore } from 'pinia'
import axios from 'axios'

// Get API base URL with proper fallback and HTTPS handling
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  
  // If running on HTTPS, ensure API URL is also HTTPS
  if (window.location.protocol === 'https:' && envUrl) {
    // Convert HTTP to HTTPS for tunnel services
    if (envUrl.startsWith('http://') && envUrl.includes('.ngrok')) {
      return envUrl.replace('http://', 'https://')
    }
    if (envUrl.startsWith('http://') && envUrl.includes('.loca.lt')) {
      return envUrl.replace('http://', 'https://')
    }
    return envUrl
  }
  
  return envUrl || 'http://localhost:8000'
}

const API_BASE_URL = getApiBaseUrl()
console.log('🔗 API Base URL:', API_BASE_URL)

// Set axios defaults
axios.defaults.baseURL = API_BASE_URL
axios.defaults.timeout = 10000

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log('📤 API Request:', config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => {
    console.error('📤 Request Error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for debugging
axios.interceptors.response.use(
  (response) => {
    console.log('📥 API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('📥 Response Error:', error.response?.status, error.config?.url, error.message)
    return Promise.reject(error)
  }
)

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: null,
    role: localStorage.getItem('role') || null
  }),
  
  getters: {
    isAuthenticated: (state) => !!state.token,
    hasRole: (state) => (requiredRole) => {
      if (!state.role) return false
      const roleHierarchy = { viewer: 0, user: 1, admin: 2 }
      return roleHierarchy[state.role] >= roleHierarchy[requiredRole]
    }
  },
  
  actions: {
    async login(username, password) {
      try {
        console.log('🔑 Attempting login for:', username)
        console.log('🌐 Using API URL:', API_BASE_URL)
        
        const formData = new FormData()
        formData.append('username', username)
        formData.append('password', password)
        
        const response = await axios.post('/api/auth/login', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'ngrok-skip-browser-warning': 'true'
          }
        })
        
        const { access_token, role } = response.data
        
        this.token = access_token
        this.role = role
        localStorage.setItem('token', access_token)
        localStorage.setItem('role', role)
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        await this.fetchUser()
        
        console.log('✅ Login successful')
        return true
      } catch (error) {
        console.error('❌ Login failed:', error)
        console.error('Error details:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        })
        return false
      }
    },
    
    logout() {
      this.token = null
      this.user = null
      this.role = null
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      delete axios.defaults.headers.common['Authorization']
      console.log('🚪 Logged out')
    },
    
    async fetchUser() {
      try {
        const response = await axios.get('/api/auth/me', {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        })
        this.user = response.data
        this.role = response.data.role
        localStorage.setItem('role', response.data.role)
        console.log('✅ User data fetched:', this.user)
      } catch (error) {
        console.log('⚠️ /api/auth/me not available, using fallback')
        // Don't logout if endpoint doesn't exist, create fallback user
        if (this.role) {
          this.user = {
            id: 'fallback',
            username: this.role === 'admin' ? 'Admin' : 'User',
            role: this.role
          }
          console.log('✅ Using fallback user data:', this.user)
        } else if (error.response?.status === 401) {
          console.error('❌ Unauthorized, logging out')
          this.logout()
        }
      }
    },
    
    async guestLogin() {
      try {
        console.log('🔑 Attempting guest login...')
        
        const response = await axios.post('/api/auth/guest-login', {}, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        
        const { access_token, role } = response.data
        
        this.token = access_token
        this.role = role || 'viewer'
        this.user = { id: 'guest', username: 'Guest Viewer', role: 'viewer' }
        
        localStorage.setItem('token', access_token)
        localStorage.setItem('role', this.role)
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        
        console.log('✅ Guest login successful')
        return true
      } catch (error) {
        console.error('❌ Guest login failed:', error)
        return false
      }
    },
    
    async registerUser(username, password, role = 'user') {
      try {
        console.log('👤 Attempting to register user:', username)
        
        const response = await axios.post('/api/auth/register', {
          username,
          password,
          role
        }, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        
        console.log('✅ User registered successfully:', response.data)
        return { success: true, data: response.data }
      } catch (error) {
        console.error('❌ User registration failed:', error)
        return { 
          success: false, 
          error: error.response?.data?.detail || 'Registration failed' 
        }
      }
    },

    // Initialize auth state
    async checkAuth() {
      if (this.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        await this.fetchUser()
        return true
      }
      return false
    }
  }
})