import { reactive, readonly } from 'vue'
import { apiRequest, setCsrfToken } from '../services/api'
import { isTauriRuntime } from '../services/tauri'
import type { AccountUser, ManagedUser } from '../types'

interface AuthResponse {
  user: AccountUser
  csrfToken: string
}

const state = reactive({
  ready: false,
  desktopMode: isTauriRuntime(),
  user: null as AccountUser | null,
})

async function initialize() {
  if (state.ready) return
  if (state.desktopMode) {
    state.ready = true
    return
  }
  try {
    const response = await apiRequest<{ user: AccountUser | null; csrfToken: string | null }>('/api/auth/session')
    state.user = response.user
    setCsrfToken(response.csrfToken)
  } finally {
    state.ready = true
  }
}

function acceptAuth(response: AuthResponse) {
  state.user = response.user
  setCsrfToken(response.csrfToken)
  return response.user
}

async function login(username: string, password: string) {
  return acceptAuth(await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }))
}

async function register(username: string, password: string) {
  return acceptAuth(await apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }))
}

async function logout() {
  try {
    if (state.user) await apiRequest<void>('/api/auth/logout', { method: 'POST' })
  } finally {
    state.user = null
    setCsrfToken(null)
  }
}

async function changePassword(currentPassword: string, newPassword: string) {
  const response = await apiRequest<{ user: AccountUser }>('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  state.user = response.user
}

async function listUsers() {
  const response = await apiRequest<{ users: ManagedUser[] }>('/api/admin/users')
  return response.users
}

async function resetPassword(username: string) {
  return await apiRequest<{ username: string; temporaryPassword: string }>(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, {
    method: 'POST',
  })
}

export function useAuthStore() {
  return {
    state: readonly(state),
    initialize,
    login,
    register,
    logout,
    changePassword,
    listUsers,
    resetPassword,
  }
}
