<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ToastStack from './components/ToastStack.vue'
import WelcomeDialog from './components/WelcomeDialog.vue'
import { useLeaveStore } from './composables/useLeaveStore'
import { useRouter } from 'vue-router'

const { state, initialize, completeFirstRun, connectDirectory } = useLeaveStore()
const router = useRouter()
onMounted(initialize)

async function startEmpty() { await completeFirstRun() }
async function startImport() { await completeFirstRun(); await router.push('/add') }
async function startFolder() { await connectDirectory(); await completeFirstRun() }
async function startSettings() { await completeFirstRun(); await router.push('/settings') }
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main v-if="state.ready"><RouterView /></main>
    <main v-else class="loading-state" aria-live="polite"><span></span><p>正在整理休假记录</p></main>
    <footer class="app-footer"><p>信达国际人力资源部倾情开发 ｜ Developed by Human Resources Department with Love❤️</p></footer>
    <ToastStack />
    <WelcomeDialog
      v-if="state.ready && state.firstRun"
      :desktop-mode="state.storageMode === '桌面数据文件夹'"
      @empty="startEmpty"
      @import="startImport"
      @folder="startFolder"
      @settings="startSettings"
    />
  </div>
</template>
