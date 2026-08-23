import Papa from 'papaparse'
import { normalizeLeaveType } from '../constants/leaveTypes'
import { rawSegments, recordsOverlap } from './date'
import type {
  DayPeriod,
  ImportConflict,
  ImportPreview,
  LeaveRecord,
  SkippedImportRow,
} from '../types'

type CsvRow = Record<string, string>

const NEGATIVE_APPROVAL = /不同意|驳回|拒绝|退回|撤回|作废|未通过|不批准/
const POSITIVE_APPROVAL = /同意|批准|通过|通過|已核[对對]|确认|確認|完成/

function makeId(prefix = 'record'): string {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

function normalizePeriod(value: string): DayPeriod {
  return value.trim().includes('下') ? '下午' : '上午'
}

function value(row: CsvRow, key: string): string {
  const direct = row[key]
  if (direct !== undefined) return String(direct).trim()
  const matched = Object.keys(row).find((candidate) => candidate.replace(/^\uFEFF/, '') === key)
  return matched ? String(row[matched] ?? '').trim() : ''
}

function parseNumber(input: string): number {
  const parsed = Number.parseFloat(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function toRecord(row: CsvRow): LeaveRecord | null {
  const startDate = value(row, '开始日期')
  const endDate = value(row, '结束日期')
  const rawType = value(row, '请假类型')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !rawType) {
    return null
  }
  const documentNo = value(row, '文号')
  return {
    id: documentNo ? `oa-${documentNo}` : makeId('oa'),
    documentNo,
    title: value(row, '标题'),
    status: value(row, '办理状态'),
    registrationDate: value(row, '登记日期'),
    name: value(row, '姓名'),
    department: value(row, '部门'),
    employeeType: value(row, '员工类型'),
    leaveType: normalizeLeaveType(rawType),
    leaveTypeRaw: rawType,
    startDate,
    startPeriod: normalizePeriod(value(row, '开始时段')),
    endDate,
    endPeriod: normalizePeriod(value(row, '结束时段')),
    oaDays: parseNumber(value(row, '请假天数')),
    reason: value(row, '请假说明'),
    currentHandler: value(row, '当前办理人'),
    approvalTrail: value(row, '审批记录'),
    source: 'OA导入',
    importedAt: new Date().toISOString(),
  }
}

function skippedReason(row: CsvRow): SkippedImportRow['reason'] | null {
  const status = value(row, '办理状态')
  const approval = value(row, '审批记录')
  if (status !== '流转结束') return '未完成审批'
  const lastDecision = approval.split(/[；;]/).reduce<'approved' | 'rejected' | null>((decision, step) => {
    if (NEGATIVE_APPROVAL.test(step)) return 'rejected'
    if (POSITIVE_APPROVAL.test(step)) return 'approved'
    return decision
  }, null)
  if (lastDecision !== 'approved') return '审批未通过'
  return null
}

function findConflicts(incoming: LeaveRecord, records: LeaveRecord[]): { records: LeaveRecord[]; reasons: string[] } {
  const matches = records.filter((existing) => {
    const sameDocument = Boolean(incoming.documentNo && existing.documentNo === incoming.documentNo)
    const sameSlot = incoming.leaveType !== '取消休假' && existing.leaveType !== '取消休假' && recordsOverlap(incoming, existing)
    return sameDocument || sameSlot
  })
  const reasons: string[] = []
  if (matches.some((item) => incoming.documentNo && item.documentNo === incoming.documentNo)) reasons.push('文号重复')
  if (matches.some((item) => recordsOverlap(incoming, item))) reasons.push('请假日期或时段重叠')
  return { records: matches, reasons }
}

export function parseOaCsv(content: string, existingRecords: LeaveRecord[]): ImportPreview {
  const parsed = Papa.parse<CsvRow>(content.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  })

  const ready: LeaveRecord[] = []
  const conflicts: ImportConflict[] = []
  const skipped: SkippedImportRow[] = []

  parsed.data.forEach((row, index) => {
    const reason = skippedReason(row)
    if (reason) {
      skipped.push({ rowNumber: index + 2, documentNo: value(row, '文号'), reason })
      return
    }
    const record = toRecord(row)
    if (!record) {
      skipped.push({ rowNumber: index + 2, documentNo: value(row, '文号'), reason: '格式有误' })
      return
    }
    const match = findConflicts(record, [...existingRecords, ...ready])
    if (match.records.length) {
      conflicts.push({
        id: makeId('conflict'),
        incoming: record,
        existing: match.records,
        reasons: match.reasons,
        resolution: 'existing',
      })
    } else {
      ready.push(record)
    }
  })

  return { ready, conflicts, skipped, totalRows: parsed.data.length }
}

export function hasSameRawSlot(left: LeaveRecord, right: LeaveRecord): boolean {
  const slots = new Set(rawSegments(right).map((segment) => `${segment.date}-${segment.period}`))
  return rawSegments(left).some((segment) => slots.has(`${segment.date}-${segment.period}`))
}
