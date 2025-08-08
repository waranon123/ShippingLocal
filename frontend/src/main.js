// frontend/src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import api from './plugins/axios' // Import configured axios

const app = createApp(App)

// Make axios available globally
app.config.globalProperties.$http = api
app.provide('$http', api)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')