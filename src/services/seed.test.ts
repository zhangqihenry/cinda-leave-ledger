import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FALLBACK_HOLIDAYS } from '../constants/holidays'
import { getEffectiveSegments } from './date'
import type { DataFile } from '../types'

const data = JSON.parse(fs.readFileSync('public/leave-records.json', 'utf8')) as DataFile

describe('附件初始数据', () => {
  it('只保留 35 条审批通过并流转结束的记录', () => {
    expect(data.records).toHaveLength(35)
    expect(data.records.every((record) => record.status === '流转结束')).toBe(true)
    expect(data.records.some((record) => record.documentNo === '2026-AL0782')).toBe(false)
  })

  it('2026 年年假核算为 14 天', () => {
    const records = data.records.filter((record) => record.startDate.startsWith('2026'))
    const segments = getEffectiveSegments(records, FALLBACK_HOLIDAYS)
    const annualDays = segments.filter((segment) => segment.record.leaveType === '年假').length / 2
    expect(annualDays).toBe(14)
  })
})
