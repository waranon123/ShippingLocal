// src/components/StatusChip.vue
<template>
  <v-chip
    :color="chipColor"
    :prepend-icon="chipIcon"
    @click="$emit('click')"
    class="cursor-pointer"
    label
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
      return 'onprocess'
    case 'Delay':
      return 'delay'
    case 'Finished':
      return 'finished'
    default:
      return 'grey'
  }
})

const chipIcon = computed(() => {
  switch (props.status) {
    case 'On Process':
      return 'mdi-progress-clock'
    case 'Delay':
      return 'mdi-alert'
    case 'Finished':
      return 'mdi-check-circle'
    default:
      return ''
  }
})
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>