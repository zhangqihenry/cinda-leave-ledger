<script setup lang="ts">
import { computed, ref } from 'vue'
import { ALL_RECORD_TYPES } from '../constants/leaveTypes'
import { useLeaveStore } from '../composables/useLeaveStore'
import { calculateRecord, formatChineseDate, getEffectiveSegments } from '../services/date'
import type { LeaveRecord, LeaveType } from '../types'

type SortKey = 'startDate' | 'leaveType' | 'documentNo' | 'oaDays' | 'calculatedDays' | 'source'

const { state, years, deleteRecord } = useLeaveStore()
const selectedYear = ref(new Date().getFullYear())
const selectedType = ref<'全部' | LeaveType>('全部')
const keyword = ref('')
const sortKey = ref<SortKey>('startDate')
const sortDirection = ref<'asc' | 'desc'>('desc')

function calculatedDays(record: LeaveRecord) {
  const days = calculateRecord(record, [...state.holidays]).days
  return record.leaveType === '取消休假' ? -days : days
}

const rows = computed(() => state.records
  .filter((record) => record.startDate.startsWith(String(selectedYear.value)) || record.endDate.startsWith(String(selectedYear.value)))
  .filter((record) => selectedType.value === '全部' || record.leaveType === selectedType.value)
  .filter((record) => {
    const query = keyword.value.trim().toLowerCase()
    if (!query) return true
    return [record.documentNo, record.reason, record.leaveType, record.title].some((value) => value.toLowerCase().includes(query))
  })
  .sort((left, right) => {
    const leftValue = sortKey.value === 'calculatedDays' ? calculatedDays(left) : left[sortKey.value]
    const rightValue = sortKey.value === 'calculatedDays' ? calculatedDays(right) : right[sortKey.value]
    const result = typeof leftValue === 'number' && typeof rightValue === 'number' ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue), 'zh-CN')
    return sortDirection.value === 'asc' ? result : -result
  }))

const yearCalculatedTotal = computed(() => {
  if (selectedType.value === '取消休假') return rows.value.reduce((sum, record) => sum + calculatedDays(record), 0)
  const cancellations = state.records.filter((record) => record.leaveType === '取消休假' && record.startDate.startsWith(String(selectedYear.value)))
  const source = selectedType.value === '全部' ? rows.value : [...rows.value, ...cancellations]
  return getEffectiveSegments(source, [...state.holidays]).length / 2
})
const discrepancyCount = computed(() => rows.value.filter((record) => record.leaveType !== '取消休假' && Math.abs(record.oaDays - calculatedDays(record)) >= 0.01).length)

function setSort(key: SortKey) {
  if (sortKey.value === key) sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDirection.value = 'asc' }
}

function sortMark(key: SortKey) {
  if (sortKey.value !== key) return '↕'
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

function periodLabel(record: LeaveRecord) {
  if (record.startDate === record.endDate) return record.startPeriod === record.endPeriod ? record.startPeriod : '全天'
  return `${record.startPeriod}起 · ${record.endPeriod}止`
}

function ruleWarning(record: LeaveRecord): string {
  if (record.leaveType === '取消休假' && !record.linkedRecordId) return '未找到可关联的原记录'
  if (record.leaveType === '特别假') {
    const year = record.startDate.slice(0, 4)
    const usedBefore = state.records.filter((item) => item.leaveType === '年假' && item.startDate.startsWith(year) && item.startDate <= record.startDate).reduce((sum, item) => sum + calculateRecord(item, [...state.holidays]).days, 0)
    const allowance = state.config.annualAllowance[year]
    if (allowance === null || allowance === undefined) return '年假额度待设置'
    if (allowance - usedBefore > 0) return '年假尚未用完'
  }
  return ''
}

async function remove(record: LeaveRecord) {
  if (!window.confirm(`确认删除 ${record.documentNo || record.startDate} 这条记录？`)) return
  await deleteRecord(record.id)
}
</script>

<template>
  <div class="page details-page">
    <section class="page-intro"><div><p class="eyebrow">DETAILS / 请假明细</p><h1>每一笔，都有据可查。</h1><p class="intro-copy">列表仅包含审批通过且已完成流转的 OA 记录，以及手动确认的记录。</p></div></section>
    <section class="detail-summary">
      <div><span>当前结果</span><strong>{{ rows.length }}</strong><small>条记录</small></div>
      <div><span>核算合计</span><strong>{{ yearCalculatedTotal }}</strong><small>天</small></div>
      <div><span>OA 与系统差异</span><strong>{{ discrepancyCount }}</strong><small>条需关注</small></div>
    </section>
    <section class="table-tools">
      <label><span>年度</span><select v-model.number="selectedYear"><option v-for="year in years" :key="year" :value="year">{{ year }}</option></select></label>
      <label><span>假期类型</span><select v-model="selectedType"><option>全部</option><option v-for="type in ALL_RECORD_TYPES" :key="type">{{ type }}</option></select></label>
      <label class="search-field"><span>搜索</span><input v-model="keyword" type="search" placeholder="文号、说明或假期类型" /></label>
    </section>
    <div class="table-scroll">
      <table class="records-table">
        <colgroup>
          <col class="date-column" />
          <col class="type-column" />
          <col class="period-column" />
          <col class="document-column" />
          <col class="oa-days-column" />
          <col class="calculated-days-column" />
          <col class="notes-column" />
          <col class="source-column" />
          <col class="action-column" />
        </colgroup>
        <thead><tr>
          <th><button @click="setSort('startDate')">日期 {{ sortMark('startDate') }}</button></th>
          <th><button @click="setSort('leaveType')">类型 {{ sortMark('leaveType') }}</button></th>
          <th>时段</th>
          <th class="document-column"><button @click="setSort('documentNo')">文号 {{ sortMark('documentNo') }}</button></th>
          <th class="numeric-column"><button @click="setSort('oaDays')">OA 天数 {{ sortMark('oaDays') }}</button></th>
          <th class="numeric-column"><button @click="setSort('calculatedDays')">核算天数 {{ sortMark('calculatedDays') }}</button></th>
          <th class="notes-column">说明 / 检查</th>
          <th><button @click="setSort('source')">来源 {{ sortMark('source') }}</button></th>
          <th class="action-column">操作</th>
        </tr></thead>
        <tbody>
          <tr v-for="record in rows" :key="record.id" :class="{ cancellation: record.leaveType === '取消休假' }">
            <td><strong>{{ formatChineseDate(record.startDate) }}</strong><small v-if="record.endDate !== record.startDate">至 {{ formatChineseDate(record.endDate) }}</small></td>
            <td><span class="type-chip"><i :style="{ background: state.config.leaveColors[record.leaveType] }"></i>{{ record.leaveType }}</span></td>
            <td>{{ periodLabel(record) }}</td>
            <td class="document-column"><code>{{ record.documentNo || '—' }}</code></td>
            <td class="numeric-column">{{ record.leaveType === '取消休假' ? `-${record.oaDays}` : record.oaDays }}</td>
            <td class="numeric-column"><strong :class="{ discrepancy: record.leaveType !== '取消休假' && Math.abs(record.oaDays - calculatedDays(record)) >= .01 }">{{ calculatedDays(record) }}</strong></td>
            <td class="notes-column"><span>{{ record.reason || '—' }}</span><small v-if="ruleWarning(record)" class="rule-warning">{{ ruleWarning(record) }}</small></td>
            <td><span class="source-badge">{{ record.source }}</span></td>
            <td class="action-column"><button class="delete-button" type="button" :aria-label="`删除 ${record.documentNo || record.startDate} 记录`" @click="remove(record)">删除</button></td>
          </tr>
          <tr v-if="!rows.length"><td colspan="9" class="empty-table">没有符合当前筛选条件的记录</td></tr>
        </tbody>
      </table>
    </div>
    <p class="table-footnote">核算天数会按半天拆分，并扣除周六、周日及香港公众假期。红色数字表示与 OA 导出的请假天数不一致。</p>
  </div>
</template>
