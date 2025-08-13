<template>
  <v-container fluid fill-height>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>{{ dialogTitle }}</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn v-if="showAddUser" icon @click="toggleMode">
              <v-icon>{{ isAddUserMode ? 'mdi-login' : 'mdi-account-plus' }}</v-icon>
            </v-btn>
          </v-toolbar>
          
          <v-card-text>
            <!-- Login Form -->
            <v-form v-if="!isAddUserMode" @submit.prevent="login" ref="loginForm">
              <v-text-field
                v-model="loginData.username"
                prepend-icon="mdi-account"
                label="Username"
                required
                :rules="[v => !!v || 'Username is required']"
              ></v-text-field>
              <v-text-field
                v-model="loginData.password"
                prepend-icon="mdi-lock"
                label="Password"
                type="password"
                required
                :rules="[v => !!v || 'Password is required']"
              ></v-text-field>
              
              <v-alert v-if="error" type="error" class="mb-3">
                {{ error }}
              </v-alert>
              
              <!-- Demo Credentials -->
              <v-card variant="outlined" class="mb-3 pa-3">
                <v-card-subtitle class="text-caption">Demo Credentials:</v-card-subtitle>
                <div class="text-body-2">
                 
                  <strong>User:</strong> user / user123<br>
                </div>
              </v-card>
            </v-form>

            <!-- Add User Form -->
            <v-form v-else @submit.prevent="addUser" ref="addUserForm">
              <v-text-field
                v-model="newUser.username"
                prepend-icon="mdi-account"
                label="New Username"
                required
                :rules="usernameRules"
              ></v-text-field>
              <v-text-field
                v-model="newUser.password"
                prepend-icon="mdi-lock"
                label="Password"
                type="password"
                required
                :rules="passwordRules"
              ></v-text-field>
              <v-text-field
                v-model="newUser.confirmPassword"
                prepend-icon="mdi-lock-check"
                label="Confirm Password"
                type="password"
                required
                :rules="confirmPasswordRules"
              ></v-text-field>
              <v-select
                v-model="newUser.role"
                prepend-icon="mdi-shield-account"
                label="Role"
                :items="roleOptions"
                required
                :rules="[v => !!v || 'Role is required']"
              ></v-select>
              
              <v-alert v-if="addUserError" type="error" class="mb-3">
                {{ addUserError }}
              </v-alert>
              
              <v-alert v-if="addUserSuccess" type="success" class="mb-3">
                {{ addUserSuccess }}
              </v-alert>
            </v-form>
          </v-card-text>
          
          <v-card-actions>
            <v-spacer></v-spacer>
            
            <!-- Login Mode Actions -->
            <template v-if="!isAddUserMode">
              <v-btn 
                color="info" 
                variant="outlined" 
                @click="guestLogin" 
                :loading="guestLoading"
                prepend-icon="mdi-eye"
              >
                Guest View
              </v-btn>
              
              <v-btn 
                color="primary" 
                @click="login" 
                :loading="loading"
                prepend-icon="mdi-login"
              >
                Login
              </v-btn>
            </template>
            
            <!-- Add User Mode Actions -->
            <template v-else>
              <v-btn 
                color="grey" 
                variant="text" 
                @click="toggleMode"
              >
                Cancel
              </v-btn>
              
              <v-btn 
                color="success" 
                @click="addUser" 
                :loading="addUserLoading"
                prepend-icon="mdi-account-plus"
              >
                Add User
              </v-btn>
            </template>
          </v-card-actions>
          
          <!-- Admin Section -->
          <v-divider v-if="showAddUser"></v-divider>
          <v-card-actions v-if="showAddUser && !isAddUserMode">
            <v-spacer></v-spacer>
            <v-btn 
              color="secondary" 
              variant="text" 
              @click="toggleMode"
              prepend-icon="mdi-account-plus"
              size="small"
            >
              Add New User
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Refs
const loginForm = ref(null)
const addUserForm = ref(null)
const loading = ref(false)
const guestLoading = ref(false)
const addUserLoading = ref(false)
const error = ref('')
const addUserError = ref('')
const addUserSuccess = ref('')
const isAddUserMode = ref(false)

// Login data
const loginData = ref({
  username: '',
  password: ''
})

// New user data
const newUser = ref({
  username: '',
  password: '',
  confirmPassword: '',
  role: 'user'
})

// Role options
const roleOptions = [
  { title: 'Viewer (Read Only)', value: 'viewer' },
  { title: 'User (Can Edit)', value: 'user' },
  { title: 'Admin (Full Access)', value: 'admin' }
]

// Validation rules
const usernameRules = [
  v => !!v || 'Username is required',
  v => (v && v.length >= 3) || 'Username must be at least 3 characters',
  v => /^[a-zA-Z0-9_]+$/.test(v) || 'Username can only contain letters, numbers, and underscores'
]

const passwordRules = [
  v => !!v || 'Password is required',
  v => (v && v.length >= 6) || 'Password must be at least 6 characters'
]

const confirmPasswordRules = [
  v => !!v || 'Please confirm password',
  v => v === newUser.value.password || 'Passwords do not match'
]

// Computed
const dialogTitle = computed(() => {
  return isAddUserMode.value ? 'Add New User' : 'Login to Truck Management System'
})

const showAddUser = computed(() => {
  // Show add user option if user has admin role stored (for returning admins)
  return localStorage.getItem('role') === 'admin'
})

// Methods
const login = async () => {
  if (!loginForm.value) return
  
  const { valid } = await loginForm.value.validate()
  if (!valid) return
  
  loading.value = true
  error.value = ''
  
  try {
    const success = await authStore.login(loginData.value.username, loginData.value.password)
    if (success) {
      router.push('/dashboard')
    } else {
      error.value = 'Invalid username or password'
    }
  } catch (err) {
    console.error('Login error:', err)
    error.value = 'Login failed. Please try again.'
  } finally {
    loading.value = false
  }
}

const guestLogin = async () => {
  guestLoading.value = true
  error.value = ''
  
  try {
    const success = await authStore.guestLogin()
    if (success) {
      router.push('/dashboard')
    } else {
      error.value = 'Guest login failed. Please try again.'
    }
  } catch (err) {
    console.error('Guest login error:', err)
    error.value = 'Guest login failed. Please try again.'
  } finally {
    guestLoading.value = false
  }
}

const addUser = async () => {
  if (!addUserForm.value) return
  
  const { valid } = await addUserForm.value.validate()
  if (!valid) return
  
  addUserLoading.value = true
  addUserError.value = ''
  addUserSuccess.value = ''
  
  try {
    const result = await authStore.registerUser(
      newUser.value.username,
      newUser.value.password,
      newUser.value.role
    )
    
    if (result.success) {
      addUserSuccess.value = result.data?.message || 'User created successfully'
      
      // Reset form
      newUser.value = {
        username: '',
        password: '',
        confirmPassword: '',
        role: 'user'
      }
      
      // Auto switch back to login after 2 seconds
      setTimeout(() => {
        isAddUserMode.value = false
        addUserSuccess.value = ''
      }, 2000)
    } else {
      addUserError.value = result.error
    }
    
  } catch (err) {
    console.error('Add user error:', err)
    addUserError.value = 'Failed to add user'
  } finally {
    addUserLoading.value = false
  }
}

const toggleMode = () => {
  isAddUserMode.value = !isAddUserMode.value
  error.value = ''
  addUserError.value = ''
  addUserSuccess.value = ''
  
  // Reset forms
  if (isAddUserMode.value) {
    newUser.value = {
      username: '',
      password: '',
      confirmPassword: '',
      role: 'user'
    }
  } else {
    loginData.value = {
      username: 'admin',
      password: 'admin123'
    }
  }
}

onMounted(() => {
  // Check if already authenticated
  if (authStore.isAuthenticated) {
    router.push('/dashboard')
  }
})
</script>

<style scoped>
.v-card {
  transition: all 0.3s ease;
}

.v-card:hover {
  transform: translateY(-2px);
}

.text-caption {
  font-weight: 600;
}

.v-btn {
  transition: all 0.2s ease;
}
</style>