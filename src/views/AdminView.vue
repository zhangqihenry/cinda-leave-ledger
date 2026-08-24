<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../composables/useAuthStore'
import type { ManagedUser } from '../types'

const emit = defineEmits<{ logout: [] }>()
const { state, listUsers, resetPassword, changePassword } = useAuthStore()
const users = ref<ManagedUser[]>([])
const loading = ref(true)
const message = ref('')
const error = ref('')
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })

async function refreshUsers() {
  loading.value = true
  error.value = ''
  try {
    users.value = await listUsers()
  } catch (reason) {
    error.value = (reason as Error).message
  } finally {
    loading.value = false
  }
}

async function resetUser(username: string) {
  if (!window.confirm(`确认将用户 ${username} 的密码重置为 Abcd1234! ？`)) return
  error.value = ''
  try {
    const result = await resetPassword(username)
    message.value = `用户 ${result.username} 的密码已重置为 ${result.temporaryPassword}`
    await refreshUsers()
  } catch (reason) {
    error.value = (reason as Error).message
  }
}

async function submitPassword() {
  error.value = ''
  message.value = ''
  if (passwordForm.newPassword.length < 8) {
    error.value = '新密码至少需要 8 个字符。'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    error.value = '两次输入的新密码不一致。'
    return
  }
  try {
    await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    message.value = '管理员密码已修改。'
  } catch (reason) {
    error.value = (reason as Error).message
  }
}

onMounted(refreshUsers)
</script>

<template>
  <div class="admin-shell">
    <header class="admin-header">
      <div class="brand"><span class="brand-mark"></span><span class="brand-copy"><strong>休假账本</strong><small>ADMIN CONSOLE</small></span></div>
      <div class="account-actions"><span>管理员 {{ state.user?.username }}</span><button type="button" @click="emit('logout')">退出登录</button></div>
    </header>
    <main class="admin-page">
      <section class="page-intro"><div><p class="eyebrow">USER MANAGEMENT / 用户管理</p><h1>员工账户。</h1><p class="intro-copy">查看已注册工号，或将用户密码重置为统一初始密码。</p></div><button class="button secondary" type="button" @click="refreshUsers">刷新列表</button></section>
      <p v-if="state.user?.passwordChangeRecommended" class="admin-notice">当前仍在使用默认管理员密码，建议在下方修改。本提示不会阻止继续使用。</p>
      <p v-if="message" class="admin-message">{{ message }}</p>
      <p v-if="error" class="form-alert error">{{ error }}</p>
      <section class="admin-section">
        <header><div><span>01</span><h2>已注册用户</h2></div><small>共 {{ users.length }} 个员工账户</small></header>
        <div class="admin-table-wrap">
          <table class="admin-table"><thead><tr><th>工号</th><th>注册时间</th><th>密码状态</th><th>操作</th></tr></thead><tbody>
            <tr v-if="loading"><td colspan="4">正在读取用户列表</td></tr>
            <tr v-else-if="!users.length"><td colspan="4">暂无已注册员工</td></tr>
            <tr v-for="user in users" v-else :key="user.username"><td><strong>{{ user.username }}</strong></td><td>{{ new Date(user.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' }) }}</td><td>{{ user.passwordChangeRecommended ? '已重置，建议用户修改' : '用户自定义密码' }}</td><td><button class="delete-button" type="button" @click="resetUser(user.username)">重置密码</button></td></tr>
          </tbody></table>
        </div>
      </section>
      <section class="admin-section">
        <header><div><span>02</span><h2>修改管理员密码</h2></div></header>
        <form class="password-form" @submit.prevent="submitPassword">
          <label><span>当前密码</span><input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" required /></label>
          <label><span>新密码</span><input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" required /></label>
          <label><span>确认新密码</span><input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" required /></label>
          <button class="button primary" type="submit">修改密码</button>
        </form>
      </section>
    </main>
  </div>
</template>
