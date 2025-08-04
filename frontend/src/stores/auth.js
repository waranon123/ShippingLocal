// 1. frontend/src/stores/auth.js (แก้ไข - เพิ่ม API_BASE_URL)
import { defineStore } from 'pinia'
import axios from 'axios'
import API_BASE_URL from '@/config/api'


axios.defaults.baseURL = API_BASE_URL

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
        const formData = new FormData()
        formData.append('username', username)
        formData.append('password', password)
        
        const response = await axios.post('/api/auth/login', formData)
        const { access_token, role } = response.data
        
        this.token = access_token
        this.role = role
        localStorage.setItem('token', access_token)
        localStorage.setItem('role', role)
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        await this.fetchUser()
        
        return true
      } catch (error) {
        console.error('Login failed:', error)
        return false
      }
    },
    
    async fetchUser() {
      try {
        const response = await axios.get('/api/auth/me')
        this.user = response.data
        this.role = response.data.role
        localStorage.setItem('role', response.data.role)
      } catch (error) {
        console.error('Failed to fetch user:', error)
        this.logout() 
      }
    },
    
    logout() {
      this.token = null
      this.user = null
      this.role = null
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      delete axios.defaults.headers.common['Authorization']
    }
  }
})