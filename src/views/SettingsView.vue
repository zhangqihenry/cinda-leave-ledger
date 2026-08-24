<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ALL_RECORD_TYPES, THEMES } from '../constants/leaveTypes'
import { useAuthStore } from '../composables/useAuthStore'
import { useLeaveStore } from '../composables/useLeaveStore'
import type { LeaveConfig, ThemePalette } from '../types'

const { state, saveConfig, exportData, exportConfig } = useLeaveStore()
const auth = useAuthStore()
const draft = reactive<LeaveConfig>(JSON.parse(JSON.stringify(state.config)))
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordStatus = reactive({ error: '', success: '' })
const currentYear = new Date().getFullYear()

watch(() => state.config, (config) => Object.assign(draft, JSON.parse(JSON.stringify(config))), { deep: true })

function selectTheme(theme: ThemePalette) {
  draft.theme = JSON.parse(JSON.stringify(theme))
}

function markCustomTheme() {
  draft.theme.id = 'custom'
  draft.theme.name = '自定义主题'
}

async function submit() {
  await saveConfig(JSON.parse(JSON.stringify(draft)))
}

async function submitPassword() {
  passwordStatus.error = ''
  passwordStatus.success = ''
  if (passwordForm.newPassword.length < 8) {
    passwordStatus.error = '新密码至少需要 8 个字符。'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordStatus.error = '两次输入的新密码不一致。'
    return
  }
  try {
    await auth.changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    Object.assign(passwordForm, { currentPassword: '', newPassword: '', confirmPassword: '' })
    passwordStatus.success = '密码已修改，其他设备上的登录会话已退出。'
  } catch (reason) {
    passwordStatus.error = (reason as Error).message
  }
}
</script>

<template>
  <div class="page settings-page">
    <section class="page-intro"><div><p class="eyebrow">SETTINGS / 设置</p><h1>按你的规则来。</h1><p class="intro-copy">当年额度、颜色和文件保存方式都会随设置一并保存。</p></div><button class="button primary save-top" type="button" @click="submit">保存全部设置</button></section>

    <section class="settings-section">
      <header class="settings-heading"><span>01</span><div><h2>{{ currentYear }} 年假期额度</h2><p>年假额度可包含经审批从上一年带入的天数；特别假不能结转。</p></div></header>
      <div class="allowance-table">
        <div class="allowance-row allowance-head"><span>年度</span><span>年假</span><span>特别假</span></div>
        <div class="allowance-row">
          <strong>{{ currentYear }}</strong>
          <label><input v-model.number="draft.annualAllowance[String(currentYear)]" type="number" min="0" step="0.5" placeholder="待设置" /><span>天</span></label>
          <label><input v-model.number="draft.specialAllowance[String(currentYear)]" type="number" min="0" step="0.5" placeholder="待设置" /><span>天</span></label>
        </div>
      </div>
      <div class="policy-notes"><p><span>年假</span>未休完的余额，经审批后最多可带一半到下一年度；请直接把获批带入天数计入当年额度。</p><p><span>特别假</span>须在年假全部用完后使用，当年未休自动失效。</p><p><span>生日假</span>每年固定 1 天，须在生日当月放取，无需设置额度。</p></div>
    </section>

    <section class="settings-section">
      <header class="settings-heading"><span>02</span><div><h2>网站主题</h2><p>{{ THEMES.length }} 套预设会自动换行排列，未来增加主题时无需改变页面布局。</p></div></header>
      <div class="theme-grid">
        <button
          v-for="(theme, index) in THEMES"
          :key="theme.id"
          class="theme-card"
          :class="{ selected: draft.theme.id === theme.id }"
          :style="{ '--preset-primary': theme.primary, '--preset-accent': theme.accent, '--preset-background': theme.background, '--preset-ink': theme.ink, '--preset-muted': theme.muted }"
          type="button"
          @click="selectTheme(theme)"
        >
          <span class="theme-card-meta"><small>THEME {{ String(index + 1).padStart(2, '0') }}</small><em>{{ draft.theme.id === theme.id ? '当前主题' : '点击应用' }}</em></span>
          <strong>{{ theme.name }}</strong>
          <small class="theme-card-palette">主色 {{ theme.primary }} · 强调 {{ theme.accent }}</small>
        </button>
      </div>
      <div class="theme-editor">
        <header><div><strong>当前主题颜色微调</strong><p>下列六项只对应当前选中的主题，修改任意一项后会保存为自定义主题。</p></div><span>{{ draft.theme.name }}</span></header>
        <div class="custom-theme-grid">
          <label v-for="field in ([['primary','主色'],['accent','强调色'],['background','页面底色'],['surface','卡片底色'],['ink','文字色'],['muted','次要文字']] as const)" :key="field[0]">
            <span>{{ field[1] }}</span><div><input v-model="draft.theme[field[0]]" type="color" @input="markCustomTheme" /><code>{{ draft.theme[field[0]] }}</code></div>
          </label>
        </div>
      </div>
      <p class="source-note">中金、信达预设参考对应机构官网的常用品牌色；微信预设参考 WeUI 官方浅色主题；Claude 预设参考 Claude 官方品牌与界面色彩。色值用于本工具界面，不代表机构视觉规范文件。</p>
    </section>

    <section class="settings-section">
      <header class="settings-heading"><span>03</span><div><h2>假期颜色</h2><p>颜色会同步用于年历、图例和明细标签。</p></div></header>
      <div class="leave-color-grid">
        <label v-for="type in ALL_RECORD_TYPES" :key="type"><input v-model="draft.leaveColors[type]" type="color" /><span><strong>{{ type }}</strong><code>{{ draft.leaveColors[type] }}</code></span></label>
        <label><input v-model="draft.holidayColor" type="color" /><span><strong>香港公众假期</strong><code>{{ draft.holidayColor }}</code></span></label>
      </div>
    </section>

    <section class="settings-section storage-section">
      <header class="settings-heading"><span>04</span><div><h2>数据保存</h2><p>{{ state.storageMode === '服务器账户' ? '请假信息和所有设置都保存在当前服务器账户中。' : '桌面版会在 EXE 同目录的数据文件夹中维护 JSON 文件。' }}</p></div></header>
      <div class="storage-card">
        <div class="storage-status"><span class="connected"></span><div><strong>{{ state.storageMode }}</strong><p>{{ state.directoryName ? `当前文件夹：${state.directoryName}` : `当前账户：${auth.state.user?.username || ''}` }}</p></div></div>
        <div class="storage-actions"><button class="button secondary" type="button" @click="exportData">导出记录 JSON</button><button class="button secondary" type="button" @click="exportConfig">导出设置 JSON</button></div>
      </div>
      <p v-if="state.storageMode === '桌面数据文件夹'" class="browser-note">桌面版会在 EXE 旁自动建立 Cinda Leave Ledger Data 文件夹，并在其中读写 leave-records.json 与 leave-config.json。</p>
      <p v-else class="browser-note">每个员工账户的记录和设置互相隔离；导出功能可用于个人备份。</p>
    </section>

    <section v-if="state.storageMode === '服务器账户'" class="settings-section account-section">
      <header class="settings-heading"><span>05</span><div><h2>修改密码</h2><p>修改后，当前设备保持登录，其他设备上的会话会自动退出。</p></div></header>
      <p v-if="auth.state.user?.passwordChangeRecommended" class="admin-notice">当前密码由管理员重置，建议修改为你自己的密码。本提示不会阻止继续使用。</p>
      <form class="password-form" @submit.prevent="submitPassword">
        <label><span>当前密码</span><input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" required /></label>
        <label><span>新密码</span><input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" placeholder="至少 8 个字符" required /></label>
        <label><span>确认新密码</span><input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" required /></label>
        <button class="button primary" type="submit">修改密码</button>
      </form>
      <p v-if="passwordStatus.error" class="form-alert error">{{ passwordStatus.error }}</p>
      <p v-if="passwordStatus.success" class="admin-message">{{ passwordStatus.success }}</p>
    </section>

    <div class="settings-save"><p>{{ state.storageMode === '服务器账户' ? '更改会保存到当前服务器账户。' : '更改会同步更新桌面数据文件。' }}</p><button class="button primary" type="button" @click="submit">保存全部设置</button></div>
  </div>
</template>
