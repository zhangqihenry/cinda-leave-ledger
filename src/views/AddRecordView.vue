<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ConflictDialog from '../components/ConflictDialog.vue'
import { ALL_RECORD_TYPES } from '../constants/leaveTypes'
import { useLeaveStore } from '../composables/useLeaveStore'
import { calculateRecord, recordsOverlap } from '../services/date'
import type { DayPeriod, ImportPreview, LeaveRecord, LeaveType } from '../types'

const { state, addRecord, buildImportPreview, commitImport, showToast } = useLeaveStore()
const today = new Date().toISOString().slice(0, 10)
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const importPreview = ref<ImportPreview | null>(null)
const conflictOpen = ref(false)
const manualError = ref('')
const form = reactive({ documentNo: '', leaveType: '年假' as LeaveType, startDate: today, startPeriod: '上午' as DayPeriod, endDate: today, endPeriod: '下午' as DayPeriod, reason: '', linkedRecordId: '' })

const draftRecord = computed<LeaveRecord>(() => ({
  id: 'draft', documentNo: form.documentNo.trim(), title: '', status: '流转结束', registrationDate: today,
  name: '', department: '', employeeType: '', leaveType: form.leaveType, leaveTypeRaw: form.leaveType,
  startDate: form.startDate, startPeriod: form.startPeriod, endDate: form.endDate, endPeriod: form.endPeriod,
  oaDays: 0, reason: form.reason.trim(), currentHandler: '', approvalTrail: '手动录入 · 已确认',
  source: '手动录入', importedAt: new Date().toISOString(), linkedRecordId: form.linkedRecordId || undefined,
}))
const calculation = computed(() => calculateRecord(draftRecord.value, [...state.holidays]))
const possibleCancellationTargets = computed(() => state.records.filter((record) => record.leaveType !== '取消休假' && recordsOverlap(record, draftRecord.value)))
const manualConflicts = computed(() => state.records.filter((record) => record.leaveType !== '取消休假' && form.leaveType !== '取消休假' && recordsOverlap(record, draftRecord.value)))
const specialWarning = computed(() => {
  if (form.leaveType !== '特别假') return ''
  const year = form.startDate.slice(0, 4)
  const annualUsed = state.records.filter((record) => record.leaveType === '年假' && record.startDate.startsWith(year)).reduce((sum, record) => sum + calculateRecord(record, [...state.holidays]).days, 0)
  const allowance = state.config.annualAllowance[year]
  if (allowance === null || allowance === undefined) return '请先在设置中填写当年的年假额度，以检查特别假使用条件。'
  const remaining = allowance - annualUsed
  return remaining > 0 ? `当年仍有 ${remaining} 天年假，按公司规则暂不应使用特别假。` : ''
})

watch(() => form.startDate, (value) => { if (form.endDate < value) form.endDate = value })
watch([() => form.leaveType, possibleCancellationTargets], () => {
  if (form.leaveType === '取消休假' && possibleCancellationTargets.value.length === 1) form.linkedRecordId = possibleCancellationTargets.value[0].id
})

function resetForm() {
  Object.assign(form, { documentNo: '', leaveType: '年假', startDate: today, startPeriod: '上午', endDate: today, endPeriod: '下午', reason: '', linkedRecordId: '' })
  manualError.value = ''
}

async function submitManual() {
  manualError.value = ''
  if (form.endDate < form.startDate || (form.endDate === form.startDate && form.startPeriod === '下午' && form.endPeriod === '上午')) { manualError.value = '结束时间不能早于开始时间。'; return }
  if (calculation.value.days <= 0) { manualError.value = '所选日期全部是周末或香港公众假期，请检查日期。'; return }
  if (manualConflicts.value.length) { manualError.value = `所选日期及时段与 ${manualConflicts.value.length} 条现有记录重叠，请先处理冲突。`; return }
  if (form.leaveType === '取消休假' && !form.linkedRecordId) { manualError.value = '请选择需要取消的原请假记录。'; return }
  await addRecord({ ...draftRecord.value, id: `manual-${crypto.randomUUID()}`, oaDays: calculation.value.days })
  resetForm()
}

async function readFile(file?: File) {
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.csv')) { showToast('请选择 OA 导出的 CSV 文件', 'error'); return }
  importPreview.value = buildImportPreview(await file.text())
}
function onDrop(event: DragEvent) { isDragging.value = false; readFile(event.dataTransfer?.files[0]) }
async function startImport() {
  if (!importPreview.value) return
  if (importPreview.value.conflicts.length) { conflictOpen.value = true; return }
  await commitImport(importPreview.value); importPreview.value = null
  if (fileInput.value) fileInput.value.value = ''
}
async function confirmConflicts() {
  if (!importPreview.value) return
  await commitImport(importPreview.value); conflictOpen.value = false; importPreview.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="page add-page">
    <section class="page-intro"><div><p class="eyebrow">NEW RECORD / 新增记录</p><h1>记下一次休假。</h1><p class="intro-copy">手动录入单条记录，或增量导入 OA 审批结果。</p></div></section>
    <div class="add-layout">
      <section class="form-panel">
        <header class="panel-header"><span>01</span><div><h2>手动录入</h2><p>最小单位为半天</p></div></header>
        <form class="record-form" @submit.prevent="submitManual">
          <div class="form-grid">
            <label><span>请假类型</span><select v-model="form.leaveType"><option v-for="type in ALL_RECORD_TYPES" :key="type" :value="type">{{ type }}</option></select></label>
            <label><span>OA 文号 <small>可选</small></span><input v-model="form.documentNo" placeholder="例如 2026-AL0782" /></label>
            <label><span>开始日期</span><input v-model="form.startDate" type="date" required /></label>
            <label><span>开始时段</span><select v-model="form.startPeriod"><option>上午</option><option>下午</option></select></label>
            <label><span>结束日期</span><input v-model="form.endDate" type="date" required /></label>
            <label><span>结束时段</span><select v-model="form.endPeriod"><option>上午</option><option>下午</option></select></label>
            <label v-if="form.leaveType === '取消休假'" class="form-full"><span>关联原记录</span><select v-model="form.linkedRecordId" required><option value="">请选择</option><option v-for="record in possibleCancellationTargets" :key="record.id" :value="record.id">{{ record.leaveType }} · {{ record.documentNo || '手动记录' }} · {{ record.startDate }}</option></select></label>
            <label class="form-full"><span>请假说明 <small>可选</small></span><textarea v-model="form.reason" rows="3" placeholder="简要记录请假原因"></textarea></label>
          </div>
          <div class="calculation-strip"><span>系统核算</span><strong>{{ calculation.days }}</strong><em>天</em><small v-if="calculation.excludedDates.length">已扣除 {{ calculation.excludedDates.length }} 个周末或公众假期日期</small></div>
          <p v-if="specialWarning" class="form-alert warning">{{ specialWarning }}</p>
          <p v-if="manualError" class="form-alert error">{{ manualError }}</p>
          <div class="form-actions"><button class="button secondary" type="button" @click="resetForm">清空</button><button class="button primary" type="submit">保存记录</button></div>
        </form>
      </section>
      <section class="import-panel">
        <header class="panel-header"><span>02</span><div><h2>从 OA 导入</h2><p>仅接收审批通过且流转结束的记录</p></div></header>
        <div class="import-rules"><span>导入规则</span><ul><li>“正在流转”的记录会自动跳过</li><li>审批不通过、撤回或作废的记录会自动跳过</li><li>按文号及日期时段进行双重查重</li></ul></div>
        <button class="drop-zone" :class="{ dragging: isDragging }" type="button" @click="fileInput?.click()" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="onDrop">
          <span class="upload-mark">CSV</span><strong>拖放文件到这里</strong><small>或点击选择 OA 导出的 CSV</small>
        </button>
        <input ref="fileInput" class="visually-hidden" type="file" accept=".csv,text/csv" @change="readFile(($event.target as HTMLInputElement).files?.[0])" />
        <div v-if="importPreview" class="import-preview">
          <div class="preview-counts"><div><strong>{{ importPreview.totalRows }}</strong><span>读取</span></div><div><strong>{{ importPreview.ready.length }}</strong><span>可导入</span></div><div class="has-warning"><strong>{{ importPreview.conflicts.length }}</strong><span>冲突</span></div><div><strong>{{ importPreview.skipped.length }}</strong><span>已跳过</span></div></div>
          <div v-if="importPreview.skipped.length" class="skipped-summary"><strong>已跳过的记录</strong><p><span v-for="reason in ['未完成审批', '审批未通过', '格式有误']" :key="reason">{{ reason }} {{ importPreview.skipped.filter(item => item.reason === reason).length }} 条</span></p></div>
          <button class="button primary wide" type="button" :disabled="!importPreview.ready.length && !importPreview.conflicts.length" @click="startImport">{{ importPreview.conflicts.length ? '处理冲突并导入' : '确认导入' }}</button>
        </div>
      </section>
    </div>
    <ConflictDialog v-if="conflictOpen && importPreview" :preview="importPreview" @close="conflictOpen = false" @confirm="confirmConflicts" />
  </div>
</template>
