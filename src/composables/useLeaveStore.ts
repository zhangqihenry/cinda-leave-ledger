import { computed, reactive, readonly } from 'vue'
import { createDefaultConfig } from '../constants/leaveTypes'
import { FALLBACK_HOLIDAYS } from '../constants/holidays'
import { parseOaCsv } from '../services/csv'
import { loadHongKongHolidays } from '../services/holidays'
import { recordsOverlap } from '../services/date'
import { downloadJson } from '../services/storage'
import { loadServerState, resetServerStateRevision, saveServerState } from '../services/server'
import { isTauriRuntime, loadTauriFiles, saveTauriFiles } from '../services/tauri'
import type {
  DataFile,
  ImportPreview,
  LeaveConfig,
  LeaveRecord,
  ToastMessage,
} from '../types'

const state = reactive({
  ready: false,
  records: [] as LeaveRecord[],
  config: createDefaultConfig(),
  holidays: [] as Array<{ date: string; name: string }>,
  holidayLive: false,
  firstRun: false,
  storageMode: '服务器账户' as '服务器账户' | '桌面数据文件夹',
  directoryName: '',
  toasts: [] as ToastMessage[],
})

let desktopMode = false
let toastCounter = 0

function normalizeAllowance(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function normalizeAllowances(values: Record<string, number | null>): Record<string, number | null> {
  return Object.fromEntries(Object.entries(values).map(([year, value]) => [year, normalizeAllowance(value)]))
}

function normalizeConfig(config: LeaveConfig | null | undefined): LeaveConfig {
  const defaults = createDefaultConfig()
  if (!config) return defaults
  const leaveColors = { ...defaults.leaveColors, ...config.leaveColors }
  if (leaveColors['年假'].toUpperCase() === '#7A1F3D') leaveColors['年假'] = defaults.leaveColors['年假']
  return {
    ...defaults,
    ...config,
    theme: { ...defaults.theme, ...config.theme },
    leaveColors,
    holidayColor: config.holidayColor ?? defaults.holidayColor,
    annualAllowance: normalizeAllowances({ ...defaults.annualAllowance, ...config.annualAllowance }),
    specialAllowance: normalizeAllowances({ ...defaults.specialAllowance, ...(config.specialAllowance ?? {}) }),
  }
}

function applyTheme(config: LeaveConfig) {
  const root = document.documentElement
  root.style.setProperty('--theme-primary', config.theme.primary)
  root.style.setProperty('--theme-accent', config.theme.accent)
  root.style.setProperty('--page-bg', config.theme.background)
  root.style.setProperty('--surface', config.theme.surface)
  root.style.setProperty('--ink', config.theme.ink)
  root.style.setProperty('--muted', config.theme.muted)
}

function showToast(text: string, type: ToastMessage['type'] = 'success') {
  const id = ++toastCounter
  state.toasts.push({ id, type, text })
  window.setTimeout(() => {
    const index = state.toasts.findIndex((item) => item.id === id)
    if (index >= 0) state.toasts.splice(index, 1)
  }, 3600)
}

function reconcileCancellationLinks(records: LeaveRecord[]) {
  records
    .filter((record) => record.leaveType === '取消休假' && !record.linkedRecordId)
    .forEach((cancellation) => {
      const candidates = records.filter(
        (record) =>
          record.leaveType !== '取消休假' &&
          record.registrationDate <= cancellation.registrationDate &&
          recordsOverlap(record, cancellation),
      )
      if (candidates.length === 1) cancellation.linkedRecordId = candidates[0].id
    })
}

async function persist(silent = true) {
  state.config.updatedAt = new Date().toISOString()
  const data: DataFile = {
    version: 1,
    records: JSON.parse(JSON.stringify(state.records)),
    updatedAt: new Date().toISOString(),
  }
  if (desktopMode) {
    await saveTauriFiles(data, state.config)
  } else {
    await saveServerState(data, state.config)
  }
  if (!silent) showToast(desktopMode ? '数据文件已更新' : '更改已保存到服务器')
}

async function initialize() {
  if (state.ready) return
  desktopMode = isTauriRuntime()
  const defaultConfig = createDefaultConfig()
  const holidayPromise = loadHongKongHolidays()
  const [desktopFiles, serverFiles] = await Promise.all([
    desktopMode ? loadTauriFiles() : Promise.resolve(null),
    desktopMode ? Promise.resolve(null) : loadServerState(),
  ])

  if (desktopMode) {
    state.storageMode = '桌面数据文件夹'
    state.directoryName = desktopFiles?.directory ?? 'EXE 同目录下的 Cinda Leave Ledger Data'
  } else {
    state.storageMode = '服务器账户'
    state.directoryName = ''
  }

  const loadedConfig = desktopMode ? desktopFiles?.config ?? defaultConfig : serverFiles?.config ?? defaultConfig
  state.config = normalizeConfig(loadedConfig)
  state.holidays = [...FALLBACK_HOLIDAYS]
  state.holidayLive = false

  const selectedData = desktopMode ? desktopFiles?.data : serverFiles?.data
  if (selectedData?.records) {
    state.records = selectedData.records
    state.firstRun = desktopMode ? desktopFiles?.firstRun ?? false : !(serverFiles?.exists ?? false)
  } else {
    state.records = []
    state.firstRun = desktopMode ? desktopFiles?.firstRun ?? true : !(serverFiles?.exists ?? false)
  }
  reconcileCancellationLinks(state.records)
  applyTheme(state.config)
  state.ready = true
  void holidayPromise.then((holidayResult) => {
    state.holidays = holidayResult.holidays
    state.holidayLive = holidayResult.live
  })
}

async function addRecord(record: LeaveRecord) {
  state.records.push(record)
  reconcileCancellationLinks(state.records)
  await persist()
  showToast('请假记录已新增')
}

async function deleteRecord(id: string) {
  const index = state.records.findIndex((record) => record.id === id)
  if (index < 0) return
  state.records.splice(index, 1)
  await persist()
  showToast('记录已删除', 'info')
}

function buildImportPreview(content: string): ImportPreview {
  return parseOaCsv(content, state.records)
}

async function commitImport(preview: ImportPreview) {
  const incoming = [
    ...preview.ready,
    ...preview.conflicts.filter((item) => item.resolution === 'incoming').map((item) => item.incoming),
  ]
  const replacedIds = new Set(
    preview.conflicts
      .filter((item) => item.resolution === 'incoming')
      .flatMap((item) => item.existing.map((record) => record.id)),
  )
  state.records = [...state.records.filter((record) => !replacedIds.has(record.id)), ...incoming]
  reconcileCancellationLinks(state.records)
  await persist()
  showToast(`已导入 ${incoming.length} 条审批通过的记录`)
}

async function completeFirstRunSetup(
  annualAllowance: number | null,
  specialAllowance: number | null,
  preview: ImportPreview | null,
) {
  const year = String(new Date().getFullYear())
  state.config.annualAllowance[year] = normalizeAllowance(annualAllowance)
  state.config.specialAllowance[year] = normalizeAllowance(specialAllowance)
  if (preview) {
    const incoming = [
      ...preview.ready,
      ...preview.conflicts.filter((item) => item.resolution === 'incoming').map((item) => item.incoming),
    ]
    const replacedIds = new Set(
      preview.conflicts
        .filter((item) => item.resolution === 'incoming')
        .flatMap((item) => item.existing.map((record) => record.id)),
    )
    state.records = [...state.records.filter((record) => !replacedIds.has(record.id)), ...incoming]
    reconcileCancellationLinks(state.records)
  }
  state.firstRun = false
  applyTheme(state.config)
  await persist()
  showToast(preview ? '初始设置和 OA 记录已保存' : '初始设置已保存')
}

async function saveConfig(config: LeaveConfig) {
  state.config = normalizeConfig(JSON.parse(JSON.stringify(config)))
  applyTheme(state.config)
  await persist()
  showToast('设置已保存')
}

async function completeFirstRun() {
  state.firstRun = false
  await persist()
}

function resetSession() {
  state.ready = false
  state.records = []
  state.config = createDefaultConfig()
  state.holidays = []
  state.holidayLive = false
  state.firstRun = false
  state.storageMode = '服务器账户'
  state.directoryName = ''
  resetServerStateRevision()
  applyTheme(state.config)
}

function exportData() {
  downloadJson(
    { version: 1, records: state.records, updatedAt: new Date().toISOString() } satisfies DataFile,
    'leave-records.json',
  )
}

function exportConfig() {
  downloadJson(state.config, 'leave-config.json')
}

const years = computed(() => {
  const values = new Set<number>([new Date().getFullYear()])
  state.records.forEach((record) => {
    const start = Number(record.startDate.slice(0, 4))
    const end = Number(record.endDate.slice(0, 4))
    if (start) values.add(start)
    if (end) values.add(end)
  })
  return [...values].sort((a, b) => b - a)
})

export function useLeaveStore() {
  return {
    state: readonly(state),
    years,
    initialize,
    addRecord,
    deleteRecord,
    buildImportPreview,
    commitImport,
    saveConfig,
    completeFirstRun,
    completeFirstRunSetup,
    resetSession,
    exportData,
    exportConfig,
    showToast,
  }
}
