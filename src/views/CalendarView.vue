<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import YearCalendar from '../components/YearCalendar.vue'
import { LEAVE_TYPES } from '../constants/leaveTypes'
import { useLeaveStore } from '../composables/useLeaveStore'
import type { LeaveType } from '../types'

const { state, years } = useLeaveStore()
const selectedYear = ref(new Date().getFullYear())
const visibleTypes = ref(new Set<LeaveType>(LEAVE_TYPES))
const showHolidays = ref(true)

watch(years, (values) => {
  if (!values.includes(selectedYear.value) && values.length) selectedYear.value = values[0]
}, { immediate: true })

const yearRecords = computed(() => state.records.filter(
  (record) => record.startDate.startsWith(String(selectedYear.value)) || record.endDate.startsWith(String(selectedYear.value)),
))

function toggleType(type: LeaveType) {
  const next = new Set(visibleTypes.value)
  next.has(type) ? next.delete(type) : next.add(type)
  visibleTypes.value = next
}
</script>

<template>
  <div class="page calendar-page">
    <section class="page-intro calendar-intro">
      <div><p class="eyebrow">YEAR AT A GLANCE / 年度日历</p><h1>一年，尽收眼底。</h1><p class="intro-copy">按月份查看每天上午、下午的请假安排和香港公众假期。</p></div>
      <label class="year-picker"><span>查看年度</span><select v-model.number="selectedYear" aria-label="查看年度"><option v-for="year in years" :key="year" :value="year">{{ year }}</option></select></label>
    </section>

    <section class="calendar-section calendar-page-section">
      <div class="section-heading">
        <div><p class="eyebrow">CALENDAR / 日历</p><h2>{{ selectedYear }} 年</h2></div>
        <div class="data-status"><span :class="{ live: state.holidayLive }"></span>{{ state.holidayLive ? '公众假期已连接 1823 官方数据' : '公众假期使用离线备份' }}</div>
      </div>
      <div class="calendar-filters calendar-filters-above">
        <div class="filter-heading"><strong>显示内容</strong><span>取消勾选后，该类别会从年历中隐藏。</span></div>
        <div class="filter-options">
          <label v-for="type in LEAVE_TYPES" :key="type" class="check-pill"><input type="checkbox" :checked="visibleTypes.has(type)" @change="toggleType(type)" /><span class="check-box"></span><i :style="{ background: state.config.leaveColors[type] }"></i>{{ type }}</label>
          <label class="check-pill holiday-filter" :style="{ '--holiday-filter-color': state.config.holidayColor }"><input v-model="showHolidays" type="checkbox" /><span class="check-box"></span><i></i>香港公众假期</label>
        </div>
      </div>
      <YearCalendar :year="selectedYear" :records="yearRecords" :holidays="state.holidays" :visible-types="visibleTypes" :leave-colors="state.config.leaveColors" :holiday-color="state.config.holidayColor" :show-holidays="showHolidays" />
    </section>
  </div>
</template>
