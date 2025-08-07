<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <span class="text-h5">User Management</span>
            <v-spacer></v-spacer>
            <v-btn color="primary" @click="showAddDialog = true" prepend-icon="mdi-account-plus">
              Add New User
            </v-btn>
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="users"
            :loading="loading"
            class="elevation-1"
          >
            <template v-slot:item.role="{ item }">
              <v-chip
                :color="getRoleColor(item.role)"
                dark
                small
              >
                {{ item.role }}
              </v-chip>
            </template>

            <template v-slot:item.created_at="{ item }">
              {{ formatDate(item.created_at) }}
            </template>

            <template v-slot:item.actions="{ item }">
              <v-btn
                icon
                size="small"
                color="error"
                @click="confirmDelete(item)"
                :disabled="item.username === user?.username"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add User Dialog -->
    <v-dialog v-model="showAddDialog" max-width="500px">
      <v-card>
        <v-card-title>Add New User</v-card-title>
        <v-card-text>
          <v-form ref="form" v-model="valid">
            <v-text-field
              v-model="newUser.username"
              label="Username"
              :rules="usernameRules"
              required
            ></v-text-field>
            <v-text-field
              v-model="newUser.password"
              label="Password"
              type="password"
              :rules="passwordRules"
              required
            ></v-text-field>
            <v-select
              v-model="newUser.role"
              label="Role"
              :items="roleOptions"
              required
            ></v-select>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeAddDialog">Cancel</v-btn>
          <v-btn color="primary" @click="addUser" :loading="addLoading" :disabled="!valid">Add User</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400px">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete user "{{ userToDelete?.username }}"?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteUser" :loading="deleteLoading">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

const authStore = useAuthStore()

// Data
const users = ref([])
const loading = ref(false)
const showAddDialog = ref(false)
const showDeleteDialog = ref(false)
const addLoading = ref(false)
const deleteLoading = ref(false)
const valid = ref(false)
const form = ref(null)
const userToDelete = ref(null)

const newUser = ref({
  username: '',
  password: '',
  role: 'user'
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// Table headers
const headers = [
  { title: 'Username', key: 'username' },
  { title: 'Role', key: 'role' },
  { title: 'Created Date', key: 'created_at' },
  { title: 'Actions', key: 'actions', sortable: false }
]

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

// Computed
const user = computed(() => authStore.user)

// Methods
const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/users', {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'TruckManagementSystem/1.0'
      }
    })
    users.value = response.data
  } catch (error) {
    console.error('Failed to fetch users:', error)
    showSnackbar('Failed to fetch users', 'error')
  } finally {
    loading.value = false
  }
}

const addUser = async () => {
  if (!form.value) return
  
  const { valid } = await form.value.validate()
  if (!valid) return
  
  addLoading.value = true
  try {
    const response = await axios.post('/api/auth/register', {
      username: newUser.value.username,
      password: newUser.value.password,
      role: newUser.value.role
    }, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'TruckManagementSystem/1.0',
        'Content-Type': 'application/json'
      }
    })
    
    showSnackbar(`User "${newUser.value.username}" created successfully`, 'success')
    closeAddDialog()
    await fetchUsers()
    
  } catch (error) {
    console.error('Failed to add user:', error)
    const message = error.response?.data?.detail || 'Failed to add user'
    showSnackbar(message, 'error')
  } finally {
    addLoading.value = false
  }
}

const confirmDelete = (user) => {
  userToDelete.value = user
  showDeleteDialog.value = true
}

const deleteUser = async () => {
  if (!userToDelete.value) return
  
  deleteLoading.value = true
  try {
    await axios.delete(`/api/users/${userToDelete.value.id}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'TruckManagementSystem/1.0'
      }
    })
    
    showSnackbar(`User "${userToDelete.value.username}" deleted successfully`, 'success')
    showDeleteDialog.value = false
    userToDelete.value = null
    await fetchUsers()
    
  } catch (error) {
    console.error('Failed to delete user:', error)
    const message = error.response?.data?.detail || 'Failed to delete user'
    showSnackbar(message, 'error')
  } finally {
    deleteLoading.value = false
  }
}

const closeAddDialog = () => {
  showAddDialog.value = false
  newUser.value = {
    username: '',
    password: '',
    role: 'user'
  }
}

const getRoleColor = (role) => {
  switch (role) {
    case 'admin': return 'red'
    case 'user': return 'blue'
    case 'viewer': return 'green'
    default: return 'grey'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const showSnackbar = (message, color = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.v-chip {
  font-weight: 600;
}
</style>