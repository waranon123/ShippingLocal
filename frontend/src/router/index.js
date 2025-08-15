// frontend/src/router/index.js - Fixed Guest Session
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Import views
import LoginView from '@/views/LoginView.vue'
import DashboardView from '@/views/DashboardView.vue'
import TVView from '@/views/TVView.vue'
import StatisticsView from '@/views/StatisticsView.vue'
import ManagementView from '@/views/ManagementView.vue'
import UsermanagementView from '@/components/UsermanagementView.vue'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/tv',
    name: 'tv',
    component: TVView,
    meta: { requiresAuth: true }
  },
  {
    path: '/statistics',
    name: 'statistics',
    component: StatisticsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/management',
    name: 'management',
    component: ManagementView,
    meta: { requiresAuth: true, requiresRole: 'user' }
  },
  {
    path: '/users',
    name: 'users',
    component: UsermanagementView,
    meta: { requiresAuth: true, requiresRole: 'admin' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard with better guest handling
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Initialize auth from localStorage
  authStore.initAuth()
  
  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Check if there's a token that might be expired
    const token = localStorage.getItem('token')
    const isGuest = localStorage.getItem('isGuest') === 'true'
    
    if (token && isGuest) {
      // Try to refresh guest token
      console.log('🔄 Attempting to refresh guest session...')
      const refreshed = await authStore.refreshGuestToken()
      
      if (refreshed) {
        // Successfully refreshed, continue
        next()
        return
      }
    }
    
    // No valid auth, redirect to login
    next('/login')
    return
  }
  
  // Check role requirements
  if (to.meta.requiresRole && !authStore.hasRole(to.meta.requiresRole)) {
    next('/dashboard')
    return
  }
  
  // If already authenticated and trying to access login, redirect to dashboard
  if (to.name === 'login' && authStore.isAuthenticated) {
    next('/dashboard')
    return
  }
  
  // Keep guest session alive
  if (authStore.isGuest && authStore.isAuthenticated) {
    authStore.keepAlive()
  }
  
  next()
})

// Set up periodic keep-alive for guest sessions
let keepAliveInterval = null

router.afterEach((to, from) => {
  const authStore = useAuthStore()
  
  // Clear old interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
  
  // Set up keep-alive for authenticated guest users
  if (authStore.isGuest && authStore.isAuthenticated && to.meta.requiresAuth) {
    // Send keep-alive every 5 minutes
    keepAliveInterval = setInterval(() => {
      if (authStore.isGuest && authStore.isAuthenticated) {
        authStore.keepAlive()
      } else {
        // Clear interval if no longer guest
        clearInterval(keepAliveInterval)
        keepAliveInterval = null
      }
    }, 5 * 60 * 1000) // 5 minutes
  }
})

export default router