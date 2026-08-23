import type { CalculationResult, DayPeriod, DaySegment, Holiday, LeaveRecord } from '../types'

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

export function addDays(value: string, amount: number): string {
  const date = fromDateKey(value)
  date.setDate(date.getDate() + amount)
  return toDateKey(date)
}

export function formatChineseDate(value: string): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  return `${year}年${month}月${day}日`
}

export function formatMonthDay(value: string): string {
  if (!value) return '—'
  const [, month, day] = value.split('-').map(Number)
  return `${month}月${day}日`
}

export function dateRange(start: string, end: string): string[] {
  if (!start || !end || start > end) return []
  const values: string[] = []
  let cursor = start
  let guard = 0
  while (cursor <= end && guard < 3700) {
    values.push(cursor)
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return values
}

export function isWeekend(dateKey: string): boolean {
  const day = fromDateKey(dateKey).getDay()
  return day === 0 || day === 6
}

export function rawSegments(record: LeaveRecord): DaySegment[] {
  const days = dateRange(record.startDate, record.endDate)
  const segments: DaySegment[] = []
  days.forEach((date, index) => {
    const first = index === 0
    const last = index === days.length - 1
    const periods: DayPeriod[] = ['上午', '下午']
    periods.forEach((period) => {
      if (first && record.startPeriod === '下午' && period === '上午') return
      if (last && record.endPeriod === '上午' && period === '下午') return
      segments.push({ date, period, record })
    })
  })
  return segments
}

export function calculateRecord(record: LeaveRecord, holidays: Holiday[]): CalculationResult {
  const holidayMap = new Map(holidays.map((item) => [item.date, item.name]))
  const excludedDates: CalculationResult['excludedDates'] = []
  const segments = rawSegments(record).filter((segment) => {
    if (isWeekend(segment.date)) {
      if (!excludedDates.some((item) => item.date === segment.date)) {
        excludedDates.push({ date: segment.date, reason: '周末' })
      }
      return false
    }
    const holiday = holidayMap.get(segment.date)
    if (holiday) {
      if (!excludedDates.some((item) => item.date === segment.date)) {
        excludedDates.push({ date: segment.date, reason: holiday })
      }
      return false
    }
    return true
  })
  return { days: segments.length / 2, excludedDates, segments }
}

export function getEffectiveSegments(records: LeaveRecord[], holidays: Holiday[]): DaySegment[] {
  const leaveSegments = records
    .filter((record) => record.leaveType !== '取消休假')
    .flatMap((record) => calculateRecord(record, holidays).segments)

  const cancellations = records
    .filter((record) => record.leaveType === '取消休假')
    .flatMap((record) => calculateRecord(record, holidays).segments)

  return leaveSegments.filter((segment) => {
    return !cancellations.some((cancel) => {
      const sameSlot = cancel.date === segment.date && cancel.period === segment.period
      const linked = Boolean(cancel.record.linkedRecordId) && cancel.record.linkedRecordId === segment.record.id
      return sameSlot && linked
    })
  })
}

export function recordsOverlap(left: LeaveRecord, right: LeaveRecord): boolean {
  const rightSlots = new Set(rawSegments(right).map((item) => `${item.date}-${item.period}`))
  return rawSegments(left).some((item) => rightSlots.has(`${item.date}-${item.period}`))
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function mondayFirstDayIndex(year: number, month: number): number {
  const day = new Date(year, month - 1, 1, 12).getDay()
  return day === 0 ? 6 : day - 1
}
