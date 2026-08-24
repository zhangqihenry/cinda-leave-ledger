<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ToastStack from './components/ToastStack.vue'
import WelcomeDialog from './components/WelcomeDialog.vue'
import { useAuthStore } from './composables/useAuthStore'
import { useLeaveStore } from './composables/useLeaveStore'
import AuthView from './views/AuthView.vue'
import AdminView from './views/AdminView.vue'

const auth = useAuthStore()
const leave = useLeaveStore()
const loadError = ref('')

async function startLeaveSession() {
  loadError.value = ''
  leave.resetSession()
  try {
    await leave.initialize()
  } catch (error) {
    loadError.value = (error as Error).message || '无法读取账户数据。'
  }
}

async function handleLogout() {
  try {
    await auth.logout()
  } finally {
    leave.resetSession()
  }
}

watch(
  () => {
    if (!auth.state.ready) return ''
    if (auth.state.desktopMode) return 'desktop'
    if (auth.state.user?.role === 'user') return `user:${auth.state.user.username}`
    return ''
  },
  async (sessionKey, previousSessionKey) => {
    if (sessionKey) {
      await startLeaveSession()
    } else if (previousSessionKey) {
      leave.resetSession()
    }
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    await auth.initialize()
  } catch (error) {
    loadError.value = (error as Error).message || '应用初始化失败。'
  }
})
</script>

<template>
  <main v-if="!auth.state.ready" class="standalone-loading loading-state" aria-live="polite"><span></span><p>正在启动休假账本</p></main>
  <AuthView v-else-if="!auth.state.desktopMode && !auth.state.user" />
  <AdminView v-else-if="auth.state.user?.role === 'admin'" @logout="handleLogout" />
  <div v-else class="app-shell">
    <AppHeader :desktop-mode="auth.state.desktopMode" :username="auth.state.user?.username" @logout="handleLogout" />
    <main v-if="leave.state.ready"><RouterView /></main>
    <main v-else-if="loadError" class="loading-state load-error" aria-live="polite"><p>{{ loadError }}</p><button class="button secondary" type="button" @click="startLeaveSession">重新读取</button></main>
    <main v-else class="loading-state" aria-live="polite"><span></span><p>正在整理休假记录</p></main>
    <footer class="app-footer"><p>信达国际人力资源部倾情开发 ｜ Developed by Human Resources Department with Love❤️</p></footer>
    <ToastStack />
    <WelcomeDialog
      v-if="leave.state.ready && leave.state.firstRun"
      :desktop-mode="auth.state.desktopMode"
    />
  </div>
</template>
