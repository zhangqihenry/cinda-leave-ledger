<script setup lang="ts">
import { useLeaveStore } from '../composables/useLeaveStore'

const { state } = useLeaveStore()
</script>

<template>
  <div class="toast-stack" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="toast in state.toasts" :key="toast.id" class="toast-message" :class="`is-${toast.type}`">
        {{ toast.text }}
      </div>
    </TransitionGroup>
  </div>
</template>
