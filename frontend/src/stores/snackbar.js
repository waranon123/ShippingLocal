import { defineStore } from 'pinia'

export const useSnackbarStore = defineStore('snackbar', {
  state: () => ({
    visible: false,
    message: '',
    color: 'info',
    timeout: 3000,
    multiLine: false
  }),

  actions: {
    show(message, color = 'info', options = {}) {
      this.message = message
      this.color = color
      this.timeout = options.timeout || 3000
      this.multiLine = options.multiLine || false
      this.visible = true
    },

    hide() {
      this.visible = false
    },

    success(message, options = {}) {
      this.show(message, 'success', options)
    },

    error(message, options = {}) {
      this.show(message, 'error', { timeout: 5000, ...options })
    },

    warning(message, options = {}) {
      this.show(message, 'warning', options)
    },

    info(message, options = {}) {
      this.show(message, 'info', options)
    }
  }
})