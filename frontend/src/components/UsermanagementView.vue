<!-- frontend/src/views/UserManagementView.vue -->
<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <span class="text-h5">User Management</span>
            <v-spacer></v-spacer>
            <v-btn color="primary" @click="showAddUser = true" prepend-icon="mdi-plus">
              Add New User
            </v-btn>
          </v-card-title>

          <v-card-text>
            <!-- Users Table -->
            <v-data-table
              :headers="headers"
              :items="users"
              :loading="loading"
              class="elevation-1"
              :items-per-page="10"
            >
              <template v-slot:item.role="{ item }">
                <v-chip
                  :color="getRoleColor(item.role)"
                  text-color="white"
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
                  size="small"
                  color="error"
                  variant="outlined"
                  @click="deleteUser(item)"
                  :disabled="item.username === 'admin'"
                >
                  Delete
                </v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add User Dialog -->
    <v-dialog v-model="showAddUser" max-width="500px">
      <v-card>
        <v-card-title>Add New User</v-card-title>
        <v-card-text>
          <v-form ref="form" v-model="valid">
            <v-text-field
              v-model="newUser.username"
              label="Username"
              :rules="[v => !!v || 'Username is required']"
              required
            ></v-text-field>
            
            <v-text-field
              v-model="newUser.password"
              label="Password"
              type="password"
              :rules="[v => !!v || 'Password is required', v => v.length >= 6 || 'Password must be at least 6 characters']"
              required
            ></v-text-field>
            
            <v-select
              v-model="newUser.role"
              label="Role"
              :items="roleOptions"
              :rules="[v => !!v || 'Role is required']"
              required
            ></v-select>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeAddUser">Cancel</v-btn>
          <v-btn color="primary" @click="addUser" :disabled="!valid" :loading="adding">Add User</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

const authStore = useAuthStore()

// Data
const users = ref([])
const loading = ref(false)
const showAddUser = ref(false)
const adding = ref(false)
const valid = ref(false)
const form = ref(null)

const newUser = ref({
  username: '',
  password: '',
  role: 'user'
})

const snackbar = ref({
  show: false,
  message: '',
  color: 'info'
})

const headers = [
  { title: 'Username', key: 'username' },
  { title: 'Role', key: 'role' },
  { title: 'Created', key: 'created_at' },
  { title: 'Actions', key: 'actions', sortable: false }
]

const roleOptions = [
  { title: 'Viewer', value: 'viewer' },
  { title: 'User', value: 'user' },
  { title: 'Admin', value: 'admin' }
]

// Methods
const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/users')
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

  adding.value = true
  try {
    const response = await authStore.registerUser(
      newUser.value.username,
      newUser.value.password,
      newUser.value.role
    )
    
    if (response.success) {
      showSnackbar('User added successfully', 'success')
      closeAddUser()
      await fetchUsers()
    } else {
      showSnackbar(response.error || 'Failed to add user', 'error')
    }
  } catch (error) {
    console.error('Failed to add user:', error)
    showSnackbar('Failed to add user', 'error')
  } finally {
    adding.value = false
  }
}

const deleteUser = async (user) => {
  if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
    return
  }
  
  try {
    await axios.delete(`/api/users/${user.id}`)
    showSnackbar('User deleted successfully', 'success')
    await fetchUsers()
  } catch (error) {
    console.error('Failed to delete user:', error)
    showSnackbar('Failed to delete user', 'error')
  }
}

const closeAddUser = () => {
  showAddUser.value = false
  newUser.value = {
    username: '',
    password: '',
    role: 'user'
  }
  if (form.value) {
    form.value.reset()
  }
}

const showSnackbar = (message, color = 'info') => {
  snackbar.value = {
    show: true,
    message,
    color
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
  try {
    return new Date(dateString).toLocaleDateString()
  } catch (error) {
    return dateString
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.v-card {
  transition: all 0.3s ease;
}

.v-data-table {
  background: transparent;
}
</style>