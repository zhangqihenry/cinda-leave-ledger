<script setup lang="ts">
import MonthCalendar from './MonthCalendar.vue'
import type { Holiday, LeaveRecord, LeaveType } from '../types'

defineProps<{
  year: number
  records: readonly LeaveRecord[]
  holidays: readonly Holiday[]
  visibleTypes: Set<LeaveType>
  leaveColors: Record<LeaveType, string>
  holidayColor: string
  showHolidays: boolean
}>()
</script>

<template>
  <div class="year-calendar">
    <MonthCalendar v-for="month in 12" :key="month" :year="year" :month="month" :records="records" :holidays="holidays" :visible-types="visibleTypes" :leave-colors="leaveColors" :holiday-color="holidayColor" :show-holidays="showHolidays" />
  </div>
</template>
