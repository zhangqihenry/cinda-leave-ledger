<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LEAVE_TYPES } from '../constants/leaveTypes'
import { useLeaveStore } from '../composables/useLeaveStore'
import { getEffectiveSegments } from '../services/date'
import type { LeaveType } from '../types'

const { state, years } = useLeaveStore()
const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)

watch(years, (values) => {
  if (!values.includes(selectedYear.value) && values.length) selectedYear.value = values[0]
}, { immediate: true })

const yearRecords = computed(() => state.records.filter((record) => record.startDate.startsWith(String(selectedYear.value)) || record.endDate.startsWith(String(selectedYear.value))))
const totals = computed(() => {
  const segments = getEffectiveSegments([...yearRecords.value], [...state.holidays]).filter((segment) => segment.date.startsWith(String(selectedYear.value)))
  const result = Object.fromEntries(LEAVE_TYPES.map((type) => [type, 0])) as Record<LeaveType, number>
  segments.forEach((segment) => { result[segment.record.leaveType] += 0.5 })
  return result
})
const annualAllowance = computed(() => state.config.annualAllowance[String(selectedYear.value)] ?? null)
const showAnnualSetup = computed(() => selectedYear.value === currentYear && annualAllowance.value === null)
const annualUsed = computed(() => totals.value['年假'])
const annualRemaining = computed(() => annualAllowance.value === null ? null : annualAllowance.value - annualUsed.value)
const specialAllowance = computed(() => state.config.specialAllowance[String(selectedYear.value)] ?? null)
const showSpecialSetup = computed(() => selectedYear.value === currentYear && specialAllowance.value === null)
const specialUsed = computed(() => totals.value['特别假'])
const specialRemaining = computed(() => specialAllowance.value === null ? null : specialAllowance.value - specialUsed.value)
const birthdayUsed = computed(() => totals.value['生日假'])
const birthdayRemaining = computed(() => 1 - birthdayUsed.value)
const otherTotals = computed(() => LEAVE_TYPES.filter((type) => !['年假', '特别假', '生日假'].includes(type) && totals.value[type] > 0))
</script>

<template>
  <div class="page home-page">
    <section class="page-intro home-intro">
      <div><p class="eyebrow">ANNUAL OVERVIEW / 年度总览</p><h1>休假，一目了然。</h1><p class="intro-copy">按香港工作日核算，上午与下午分别记录。</p></div>
      <label class="year-picker"><span>查看年度</span><select v-model.number="selectedYear" aria-label="查看年度"><option v-for="year in years" :key="year" :value="year">{{ year }}</option></select></label>
    </section>
    <section class="leave-family" :class="{ 'has-setup-prompt': showAnnualSetup || showSpecialSetup }" aria-label="年度假期组合">
      <article class="family-card family-annual">
        <div class="family-kicker"><span>01</span><strong>年假</strong></div>
        <div class="family-balance"><strong :class="{ negative: annualRemaining !== null && annualRemaining < 0 }">{{ annualRemaining ?? '—' }}</strong><span>{{ annualRemaining === null ? '待设置' : '天剩余' }}</span></div>
        <dl><div><dt>年度额度</dt><dd>{{ annualAllowance === null ? '待设置' : `${annualAllowance} 天` }}</dd></div><div><dt>已经使用</dt><dd>{{ annualUsed }} 天</dd></div></dl>
        <RouterLink v-if="showAnnualSetup" class="family-setup-link" to="/settings">请到设置页面添加年假额度 ↗</RouterLink>
      </article>
      <article class="family-card family-special">
        <div class="family-kicker"><span>02</span><strong>特别假</strong></div>
        <div class="family-balance"><strong :class="{ negative: specialRemaining !== null && specialRemaining < 0 }">{{ specialRemaining ?? '—' }}</strong><span>{{ specialRemaining === null ? '待设置' : '天剩余' }}</span></div>
        <dl><div><dt>年度额度</dt><dd>{{ specialAllowance === null ? '待设置' : `${specialAllowance} 天` }}</dd></div><div><dt>已经使用</dt><dd>{{ specialUsed }} 天</dd></div></dl>
        <RouterLink v-if="showSpecialSetup" class="family-setup-link" to="/settings">请到设置页面添加特别假额度 ↗</RouterLink>
      </article>
      <article class="family-card family-birthday">
        <div class="family-kicker"><span>03</span><strong>生日假</strong></div>
        <div class="family-balance"><strong :class="{ negative: birthdayRemaining < 0 }">{{ birthdayRemaining }}</strong><span>天剩余</span></div>
        <dl><div><dt>年度额度</dt><dd>1 天</dd></div><div><dt>已经使用</dt><dd>{{ birthdayUsed }} 天</dd></div></dl>
      </article>
    </section>
    <section class="other-stats" aria-label="其他假期统计">
      <div class="section-label"><span>其他假期</span><small>OTHER LEAVE</small></div>
      <div v-if="otherTotals.length" class="other-stat-grid">
        <div v-for="type in otherTotals" :key="type" class="other-stat"><span class="color-line" :style="{ background: state.config.leaveColors[type] }"></span><strong>{{ totals[type] }}</strong><span>{{ type }} / 天</span></div>
      </div>
      <p v-else class="empty-inline">本年度暂无其他假期记录</p>
    </section>
  </div>
</template>
