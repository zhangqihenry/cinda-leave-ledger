import { FALLBACK_HOLIDAYS } from '../constants/holidays'
import { OFFICIAL_HOLIDAY_URL } from '../constants/leaveTypes'
import type { Holiday } from '../types'

function normalizeDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}
export async function loadHongKongHolidays(): Promise<{ holidays: Holiday[]; live: boolean }> {
  try {
    const response = await fetch(OFFICIAL_HOLIDAY_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = (await response.text()).replace(/^\uFEFF/, '')
    const payload = JSON.parse(text)
    const events = payload?.vcalendar?.[0]?.vevent
    if (!Array.isArray(events)) throw new Error('Unexpected holiday data')
    const official: Holiday[] = events.map((event: { dtstart: [string]; summary: string }) => ({
      date: normalizeDate(event.dtstart[0]),
      name: event.summary,
    }))
    const merged = new Map(FALLBACK_HOLIDAYS.map((item) => [item.date, item]))
    official.forEach((item) => merged.set(item.date, item))
    return { holidays: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)), live: true }
  } catch {
    return { holidays: [...FALLBACK_HOLIDAYS], live: false }
  }
}
