<script setup lang="ts">
import { computed } from 'vue'
import { daysInMonth, getEffectiveSegments, mondayFirstDayIndex } from '../services/date'
import type { Holiday, LeaveRecord, LeaveType } from '../types'

const props = defineProps<{
  year: number
  month: number
  records: readonly LeaveRecord[]
  holidays: readonly Holiday[]
  visibleTypes: Set<LeaveType>
  leaveColors: Record<LeaveType, string>
  holidayColor: string
  showHolidays: boolean
}>()

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const cells = computed(() => {
  const total = daysInMonth(props.year, props.month)
  const offset = mondayFirstDayIndex(props.year, props.month)
  const effective = getEffectiveSegments([...props.records], [...props.holidays])
  const holidayMap = new Map(props.holidays.map((holiday) => [holiday.date, holiday.name]))
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1
    if (day < 1 || day > total) return null
    const date = `${props.year}-${String(props.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const segments = effective.filter(
      (segment) => segment.date === date && props.visibleTypes.has(segment.record.leaveType),
    )
    return { day, date, segments, holiday: props.showHolidays ? holidayMap.get(date) : undefined }
  })
})

function segmentFor(cell: NonNullable<(typeof cells.value)[number]>, period: '上午' | '下午') {
  return cell.segments.find((segment) => segment.period === period)
}
</script>

<template>
  <section class="month-calendar" :aria-label="`${year}年${month}月`">
    <header><strong>{{ String(month).padStart(2, '0') }}</strong><span>{{ month }}月</span></header>
    <div class="weekday-row" aria-hidden="true">
      <span v-for="day in weekDays" :key="day">{{ day }}</span>
    </div>
    <div class="month-grid">
      <template v-for="(cell, index) in cells" :key="index">
        <div v-if="!cell" class="day-cell is-empty"></div>
        <div
          v-else
          class="day-cell"
          :class="{ 'has-content': cell.segments.length || cell.holiday, 'is-holiday': Boolean(cell.holiday) }"
          :style="cell.holiday ? { '--holiday-color': holidayColor } : undefined"
          :tabindex="cell.segments.length || cell.holiday ? 0 : -1"
        >
          <span class="day-number">{{ cell.day }}</span>
          <div class="day-slots" aria-hidden="true">
            <span v-for="period in (['上午', '下午'] as const)" :key="period" :style="{ background: segmentFor(cell, period) ? leaveColors[segmentFor(cell, period)!.record.leaveType] : 'transparent' }"></span>
          </div>
          <div v-if="cell.segments.length || cell.holiday" class="day-tooltip" role="tooltip">
            <div class="tooltip-date">{{ month }}月{{ cell.day }}日</div>
            <div v-if="cell.holiday" class="tooltip-holiday">香港公众假期 · {{ cell.holiday }}</div>
            <div v-for="segment in cell.segments" :key="`${segment.record.id}-${segment.period}`" class="tooltip-record">
              <span :style="{ background: leaveColors[segment.record.leaveType] }"></span>
              <div>
                <strong>{{ segment.record.leaveType }} · {{ segment.period }}</strong>
                <small>{{ segment.record.documentNo || '手动记录' }}</small>
                <small v-if="segment.record.reason">{{ segment.record.reason }}</small>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
