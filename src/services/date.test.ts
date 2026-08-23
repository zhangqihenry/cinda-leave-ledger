import { describe, expect, it } from 'vitest'
import { calculateRecord, getEffectiveSegments } from './date'
import type { LeaveRecord } from '../types'

function record(overrides: Partial<LeaveRecord> = {}): LeaveRecord {
  return {
    id: 'one', documentNo: '2026-AL0001', title: '', status: '流转结束', registrationDate: '2026-01-01',
    name: '', department: '', employeeType: '', leaveType: '年假', leaveTypeRaw: '年假',
    startDate: '2026-04-03', startPeriod: '下午', endDate: '2026-04-07', endPeriod: '下午',
    oaDays: 1, reason: '', currentHandler: '', approvalTrail: '同意', source: 'OA导入', importedAt: '',
    ...overrides,
  }
}

describe('工作日核算', () => {
  it('按半天拆分并扣除周末及公众假期', () => {
    const result = calculateRecord(record(), [{ date: '2026-04-06', name: '清明节翌日' }])
    expect(result.days).toBe(1.5)
    expect(result.excludedDates.map((item) => item.date)).toEqual(['2026-04-04', '2026-04-05', '2026-04-06'])
  })

  it('取消休假只冲销匹配的半天', () => {
    const leave = record({ startDate: '2026-08-20', endDate: '2026-08-20', startPeriod: '上午', endPeriod: '下午' })
    const cancel = record({ id: 'cancel', documentNo: '2026-AL0002', leaveType: '取消休假', leaveTypeRaw: '取消休假', startDate: '2026-08-20', endDate: '2026-08-20', startPeriod: '下午', endPeriod: '下午', linkedRecordId: 'one' })
    const segments = getEffectiveSegments([leave, cancel], [])
    expect(segments).toHaveLength(1)
    expect(segments[0].period).toBe('上午')
  })
})
