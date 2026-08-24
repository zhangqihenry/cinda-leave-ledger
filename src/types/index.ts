export type DayPeriod = '上午' | '下午'

export type LeaveType =
  | '年假'
  | '产假'
  | '丧假'
  | '病假'
  | '婚假'
  | '特别假'
  | '生日假'
  | '侍产假'
  | '无薪假'
  | '补假'
  | '其他'
  | '取消休假'

export type RecordSource = 'OA导入' | '手动录入'

export interface LeaveRecord {
  id: string
  documentNo: string
  title: string
  status: string
  registrationDate: string
  name: string
  department: string
  employeeType: string
  leaveType: LeaveType
  leaveTypeRaw: string
  startDate: string
  startPeriod: DayPeriod
  endDate: string
  endPeriod: DayPeriod
  oaDays: number
  reason: string
  currentHandler: string
  approvalTrail: string
  source: RecordSource
  importedAt: string
  linkedRecordId?: string
}

export interface Holiday {
  date: string
  name: string
}

export interface ThemePalette {
  id: 'cicc' | 'cinda' | 'morandi' | 'wechat' | 'claude' | 'custom'
  name: string
  primary: string
  accent: string
  background: string
  surface: string
  ink: string
  muted: string
}

export interface LeaveConfig {
  version: 1
  theme: ThemePalette
  leaveColors: Record<LeaveType, string>
  holidayColor: string
  annualAllowance: Record<string, number | null>
  specialAllowance: Record<string, number | null>
  holidaySourceUrl: string
  updatedAt: string
}

export interface DataFile {
  version: 1
  records: LeaveRecord[]
  updatedAt: string
}

export type AccountRole = 'user' | 'admin'

export interface AccountUser {
  username: string
  role: AccountRole
  passwordChangeRecommended: boolean
}

export interface ManagedUser {
  username: string
  passwordChangeRecommended: boolean
  createdAt: string
  updatedAt: string
}

export interface ServerStateSnapshot {
  exists: boolean
  data: DataFile | null
  config: LeaveConfig | null
  revision: number
  updatedAt: string | null
}

export type ImportSkipReason = '未完成审批' | '审批未通过' | '格式有误'

export interface SkippedImportRow {
  rowNumber: number
  documentNo: string
  reason: ImportSkipReason
}

export interface ImportConflict {
  id: string
  incoming: LeaveRecord
  existing: LeaveRecord[]
  reasons: string[]
  resolution: 'existing' | 'incoming'
}

export interface ImportPreview {
  ready: LeaveRecord[]
  conflicts: ImportConflict[]
  skipped: SkippedImportRow[]
  totalRows: number
}

export interface DaySegment {
  date: string
  period: DayPeriod
  record: LeaveRecord
}

export interface CalculationResult {
  days: number
  excludedDates: Array<{ date: string; reason: string }>
  segments: DaySegment[]
}

export interface ToastMessage {
  id: number
  type: 'success' | 'warning' | 'error' | 'info'
  text: string
}

declare global {
  interface FileSystemHandle {
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  }

  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
  }
}
