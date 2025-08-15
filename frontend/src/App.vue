<!-- frontend/src/App.vue - Fixed Guest Session Handler -->
<template>
  <v-app>
    <!-- Navigation Drawer -->
    <v-navigation-drawer v-if="showNavigation" v-model="drawer" app>
      <v-list nav>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          value="dashboard"
          :to="{ name: 'dashboard' }"
        ></v-list-item>
        
        <v-list-item
          v-if="canManage"
          prepend-icon="mdi-truck"
          title="Management"
          value="management"
          :to="{ name: 'management' }"
        ></v-list-item>
        
        <v-list-item
          v-if="isAdmin"
          prepend-icon="mdi-account-group"
          title="User Management"
          value="users"
          :to="{ name: 'users' }"
        ></v-list-item>
        
        <v-list-item
          prepend-icon="mdi-chart-box"
          title="Statistics"
          value="statistics"
          :to="{ name: 'statistics' }"
        ></v-list-item>
        
        <v-list-item
          prepend-icon="mdi-television"
          title="TV View"
          value="tv"
          :to="{ name: 'tv' }"
        ></v-list-item>
      </v-list>
      
      <template v-slot:append>
        <v-divider></v-divider>
        <v-list>
          <v-list-item v-if="isGuest" class="text-caption">
            <v-list-item-title>Guest Mode</v-list-item-title>
            <v-list-item-subtitle>View Only</v-list-item-subtitle>
          </v-list-item>
          <v-list-item
            prepend-icon="mdi-logout"
            title="Logout"
            @click="logout"
          ></v-list-item>
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- App Bar -->
    <v-app-bar v-if="showNavigation" app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>Truck Management System</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-chip v-if="user" color="white" text-color="primary">
        {{ user.username }} ({{ user.role }})
      </v-chip>
      <v-chip v-if="isGuest" color="warning" class="ml-2">
        <v-icon start size="small">mdi-eye</v-icon>
        Guest
      </v-chip>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const drawer = ref(true)

const showNavigation = computed(() => {
  return authStore.isAuthenticated && route.name !== 'login'
})

const user = computed(() => authStore.user)
const isGuest = computed(() => authStore.isGuest)
const canManage = computed(() => authStore.hasRole('user'))
const isAdmin = computed(() => authStore.hasRole('admin'))

const logout = () => {
  authStore.logout()
  router.push('/login')
}

// Set up visibility change handler for guest session
const handleVisibilityChange = () => {
  if (!document.hidden && authStore.isGuest && authStore.isAuthenticated) {
    // Page is visible again, keep session alive
    authStore.keepAlive()
  }
}

// Set up activity tracking for guest users
const handleUserActivity = () => {
  if (authStore.isGuest && authStore.isAuthenticated) {
    // Update last activity time (handled internally by store)
    authStore.keepAlive()
  }
}

// Prevent session timeout warning for guest users
let sessionCheckInterval = null

const startSessionCheck = () => {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval)
  }
  
  // Check session every 10 minutes
  sessionCheckInterval = setInterval(() => {
    if (authStore.isGuest && authStore.isAuthenticated) {
      // For guest users, silently refresh token if needed
      authStore.testAuth().then(valid => {
        if (!valid) {
          console.log('🔄 Guest session expired, attempting refresh...')
          authStore.refreshGuestToken()
        }
      })
    }
  }, 10 * 60 * 1000) // 10 minutes
}

onMounted(() => {
  // Set base URL
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
  axios.defaults.baseURL = API_BASE_URL
  
  // Request interceptor
  axios.interceptors.request.use(
    (config) => {
      if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`
      }
      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor with better guest handling
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        // Check if guest user
        if (authStore.isGuest) {
          console.log('🔄 Guest token expired, refreshing...')
          const refreshed = await authStore.refreshGuestToken()
          
          if (refreshed) {
            // Retry original request with new token
            const originalRequest = error.config
            originalRequest.headers.Authorization = `Bearer ${authStore.token}`
            return axios(originalRequest)
          }
        } else {
          // Regular user - logout
          authStore.logout()
          router.push('/login')
        }
      }
      return Promise.reject(error)
    }
  )
  
  // Initialize auth
  if (authStore.token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`
    authStore.initAuth()
  }
  
  // Set up session check for guest users
  if (authStore.isGuest) {
    startSessionCheck()
  }
  
  // Add event listeners for guest session management
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  // Track user activity (for guest session keep-alive)
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart']
  let lastActivity = Date.now()
  
  const throttledActivityHandler = () => {
    const now = Date.now()
    // Only trigger if more than 1 minute since last activity
    if (now - lastActivity > 60000) {
      lastActivity = now
      handleUserActivity()
    }
  }
  
  activityEvents.forEach(event => {
    document.addEventListener(event, throttledActivityHandler, { passive: true })
  })
  
  // Store cleanup function
  window.appCleanup = () => {
    activityEvents.forEach(event => {
      document.removeEventListener(event, throttledActivityHandler)
    })
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
})

onUnmounted(() => {
  // Clean up event listeners
  if (window.appCleanup) {
    window.appCleanup()
    delete window.appCleanup
  }
  
  // Clear session check interval
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval)
  }
  
  // Stop token refresh if running
  if (authStore.isGuest) {
    authStore.stopTokenRefresh()
  }
})
</script>

<style>
/* Global Styles */
.v-application {
  font-family: 'Roboto', sans-serif;
}

.v-toolbar-title {
  font-weight: 600;
}

.v-chip {
  font-weight: 500;
}

/* Status Color Classes - Global Definition */
.status-on-process {
  background-color: #FFC107 !important;  /* Yellow */
  color: #000000 !important;
}

.status-delay {
  background-color: #F44336 !important;  /* Red */
  color: #FFFFFF !important;
}

.status-finished {
  background-color: #4CAF50 !important;  /* Green */
  color: #FFFFFF !important;
}

/* Chip overrides for status colors */
.v-chip.bg-yellow-darken-1,
.v-chip[class*="yellow"] {
  background-color: #FFC107 !important;
  color: #000000 !important;
}

.v-chip.bg-red,
.v-chip[class*="red"]:not([class*="outlined"]) {
  background-color: #F44336 !important;
  color: #FFFFFF !important;
}

.v-chip.bg-green,
.v-chip[class*="green"]:not([class*="outlined"]) {
  background-color: #4CAF50 !important;
  color: #FFFFFF !important;
}
</style>