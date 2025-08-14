<template>
  <v-chip
    :color="chipColor"
    :prepend-icon="chipIcon"
    @click="$emit('click')"
    class="cursor-pointer font-weight-bold"
    label
    variant="flat"
  >
    {{ status }}
  </v-chip>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    required: true
  }
})

const chipColor = computed(() => {
  switch (props.status) {
    case 'On Process':
      return 'yellow-darken-1'  // Yellow
    case 'Delay':
      return 'red'               // Red
    case 'Finished':
      return 'green'             // Green
    default:
      return 'grey'
  }
})

const chipIcon = computed(() => {
  switch (props.status) {
    case 'On Process':
      return 'mdi-progress-clock'
    case 'Delay':
      return 'mdi-alert-circle'
    case 'Finished':
      return 'mdi-check-circle'
    default:
      return 'mdi-help-circle'
  }
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
  transition: all 0.2s ease;
}

.cursor-pointer:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

/* Custom colors for better visibility */
.v-chip.bg-yellow-darken-1 {
  background-color: #FFC107 !important;
  color: #000000 !important;
}

.v-chip.bg-red {
  background-color: #F44336 !important;
  color: #FFFFFF !important;
}

.v-chip.bg-green {
  background-color: #4CAF50 !important;
  color: #FFFFFF !important;
}
</style>