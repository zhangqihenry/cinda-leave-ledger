<script setup lang="ts">
import { ref } from 'vue'
import ConflictDialog from './ConflictDialog.vue'
import { useLeaveStore } from '../composables/useLeaveStore'
import type { ImportPreview } from '../types'

withDefaults(defineProps<{ desktopMode?: boolean }>(), { desktopMode: false })
const { buildImportPreview, completeFirstRun, completeFirstRunSetup } = useLeaveStore()
const currentYear = new Date().getFullYear()
const annualAllowance = ref<number | null>(null)
const specialAllowance = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const preview = ref<ImportPreview | null>(null)
const conflictOpen = ref(false)
const busy = ref(false)
const error = ref('')

async function readFile(file?: File) {
  error.value = ''
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.csv')) {
    error.value = '请选择 OA 导出的 CSV 文件。'
    return
  }
  fileName.value = file.name
  preview.value = buildImportPreview(await file.text())
}

async function finish() {
  busy.value = true
  error.value = ''
  try {
    await completeFirstRunSetup(annualAllowance.value, specialAllowance.value, preview.value)
  } catch (reason) {
    error.value = (reason as Error).message || '无法保存初始设置。'
  } finally {
    busy.value = false
  }
}

async function submit() {
  if (preview.value?.conflicts.length) {
    conflictOpen.value = true
    return
  }
  await finish()
}

async function confirmConflicts() {
  conflictOpen.value = false
  await finish()
}

async function skip() {
  busy.value = true
  try {
    await completeFirstRun()
  } catch (reason) {
    error.value = (reason as Error).message || '无法完成初始设置。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop">
    <section class="welcome-dialog welcome-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <span class="welcome-index">00 / FIRST USE</span>
      <h2 id="welcome-title">开始建立你的休假账本</h2>
      <p>{{ desktopMode ? '设置当年假期额度，并可直接导入 OA 记录。完成后数据会保存到 EXE 同目录的数据文件夹。' : '设置当年假期额度，并可直接导入 OA 记录。数据只会保存在当前登录账户中。' }}</p>
      <form class="welcome-setup-form" @submit.prevent="submit">
        <div class="welcome-allowances">
          <label><span>{{ currentYear }} 年年假额度</span><div><input v-model.number="annualAllowance" type="number" min="0" step="0.5" placeholder="待设置" /><small>天</small></div></label>
          <label><span>{{ currentYear }} 年特别假额度</span><div><input v-model.number="specialAllowance" type="number" min="0" step="0.5" placeholder="待设置" /><small>天</small></div></label>
        </div>
        <div class="welcome-import">
          <div><span>OA 记录 <small>可选</small></span><p>选择 OA 导出的 CSV，系统会筛选已审批且流转结束的记录。</p></div>
          <button class="button secondary" type="button" @click="fileInput?.click()">{{ fileName || '选择 CSV 文件' }}</button>
          <input ref="fileInput" class="visually-hidden" type="file" accept=".csv,text/csv" @change="readFile(($event.target as HTMLInputElement).files?.[0])" />
        </div>
        <div v-if="preview" class="welcome-preview"><span>读取 {{ preview.totalRows }} 条</span><span>可导入 {{ preview.ready.length }} 条</span><span>冲突 {{ preview.conflicts.length }} 条</span><span>跳过 {{ preview.skipped.length }} 条</span></div>
        <p v-if="error" class="form-alert error">{{ error }}</p>
        <footer class="welcome-actions"><button class="button secondary" type="button" :disabled="busy" @click="skip">暂时跳过</button><button class="button primary" type="submit" :disabled="busy">{{ busy ? '正在保存' : '保存并开始使用' }}</button></footer>
      </form>
    </section>
    <ConflictDialog v-if="conflictOpen && preview" :preview="preview" @close="conflictOpen = false" @confirm="confirmConflicts" />
  </div>
</template>
