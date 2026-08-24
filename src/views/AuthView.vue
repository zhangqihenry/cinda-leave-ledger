<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '../composables/useAuthStore'

const emit = defineEmits<{ authenticated: [] }>()
const { login, register } = useAuthStore()
const mode = ref<'login' | 'register'>('login')
const busy = ref(false)
const error = ref('')
const form = reactive({ username: '', password: '', confirmPassword: '' })
const title = computed(() => mode.value === 'login' ? '登录休假账本' : '注册员工账户')

function switchMode(next: 'login' | 'register') {
  mode.value = next
  error.value = ''
  form.password = ''
  form.confirmPassword = ''
}

async function submit() {
  error.value = ''
  const username = form.username.trim()
  if (mode.value === 'register' && !/^800\d{3}$/.test(username)) {
    error.value = '工号必须是 800 开头的六位数字。'
    return
  }
  if (form.password.length < 8) {
    error.value = '密码至少需要 8 个字符。'
    return
  }
  if (mode.value === 'register' && form.password !== form.confirmPassword) {
    error.value = '两次输入的密码不一致。'
    return
  }
  busy.value = true
  try {
    if (mode.value === 'login') await login(username, form.password)
    else await register(username, form.password)
    emit('authenticated')
  } catch (reason) {
    error.value = (reason as Error).message || '操作失败，请稍后重试。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-brand-panel">
      <div class="auth-brand-mark"><span></span></div>
      <p class="eyebrow">LEAVE LEDGER / HK</p>
      <h1>休假，<br />一目了然。</h1>
      <p>个人假期记录、年度余额与 OA 增量导入工具。</p>
    </section>
    <section class="auth-form-panel">
      <div class="auth-form-wrap">
        <span class="auth-index">{{ mode === 'login' ? '01 / SIGN IN' : '02 / REGISTER' }}</span>
        <h2>{{ title }}</h2>
        <p>{{ mode === 'login' ? '员工请使用工号登录，管理员使用管理员账号登录。' : '工号须为 800 开头的六位数字。' }}</p>
        <form class="auth-form" @submit.prevent="submit">
          <label><span>{{ mode === 'register' ? '工号' : '用户名' }}</span><input v-model="form.username" :inputmode="mode === 'register' ? 'numeric' : 'text'" autocomplete="username" :placeholder="mode === 'register' ? '例如 800809' : '工号或管理员账号'" required /></label>
          <label><span>密码</span><input v-model="form.password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" placeholder="至少 8 个字符" required /></label>
          <label v-if="mode === 'register'"><span>确认密码</span><input v-model="form.confirmPassword" type="password" autocomplete="new-password" placeholder="再次输入密码" required /></label>
          <p v-if="error" class="form-alert error">{{ error }}</p>
          <button class="button primary auth-submit" type="submit" :disabled="busy">{{ busy ? '正在处理' : mode === 'login' ? '登录' : '注册并登录' }}</button>
        </form>
        <button v-if="mode === 'login'" class="auth-switch" type="button" @click="switchMode('register')">首次使用？注册员工账户</button>
        <button v-else class="auth-switch" type="button" @click="switchMode('login')">已有账户？返回登录</button>
      </div>
    </section>
  </main>
</template>
