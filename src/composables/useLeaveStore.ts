import { computed, reactive, readonly } from 'vue'
import { createDefaultConfig } from '../constants/leaveTypes'
import { parseOaCsv } from '../services/csv'
import { loadHongKongHolidays } from '../services/holidays'
import { recordsOverlap } from '../services/date'
import {
  connectDataDirectory,
  downloadJson,
  getPersistedDirectory,
  loadCachedConfig,
  loadCachedData,
  loadDirectoryFiles,
  loadStaticJson,
  loadStaticText,
  saveCachedConfig,
  saveCachedData,
  saveDirectoryFiles,
} from '../services/storage'
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
  storageMode: '浏览器本地存储' as '浏览器本地存储' | '数据文件夹' | '桌面数据文件夹',
  directoryName: '',
  toasts: [] as ToastMessage[],
})

let directoryHandle: FileSystemDirectoryHandle | null = null
let desktopMode = false
let toastCounter = 0

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
    annualAllowance: { ...defaults.annualAllowance, ...config.annualAllowance },
    specialAllowance: { ...defaults.specialAllowance, ...(config.specialAllowance ?? {}) },
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
    await Promise.all([saveCachedData(state.records), saveCachedConfig(state.config)])
    if (directoryHandle) await saveDirectoryFiles(directoryHandle, data, state.config)
  }
  if (!silent) showToast(desktopMode || directoryHandle ? '数据文件已更新' : '更改已保存到当前设备')
}

async function initialize() {
  if (state.ready) return
  desktopMode = isTauriRuntime()
  const defaultConfig = createDefaultConfig()
  const [cachedData, cachedConfig, staticData, staticConfig, staticCsv, desktopFiles, holidayResult] = await Promise.all([
    desktopMode ? Promise.resolve(null) : loadCachedData(),
    desktopMode ? Promise.resolve(null) : loadCachedConfig(),
    desktopMode ? Promise.resolve(null) : loadStaticJson<DataFile>('./leave-records.json'),
    desktopMode ? Promise.resolve(null) : loadStaticJson<LeaveConfig>('./leave-config.json'),
    desktopMode ? Promise.resolve(null) : loadStaticText('./leave-records.csv'),
    desktopMode ? loadTauriFiles() : Promise.resolve(null),
    loadHongKongHolidays(),
  ])

  directoryHandle = desktopMode ? null : await getPersistedDirectory()
  let directoryData: DataFile | null = null
  let directoryConfig: LeaveConfig | null = null
  if (directoryHandle) {
    const files = await loadDirectoryFiles(directoryHandle)
    directoryData = files.data
    directoryConfig = files.config
    state.storageMode = '数据文件夹'
    state.directoryName = directoryHandle.name
  }
  if (desktopMode) {
    state.storageMode = '桌面数据文件夹'
    state.directoryName = desktopFiles?.directory ?? 'EXE 同目录下的 Cinda Leave Ledger Data'
  }

  const loadedConfig = desktopMode
    ? desktopFiles?.config ?? defaultConfig
    : directoryConfig ?? cachedConfig ?? staticConfig ?? defaultConfig
  state.config = normalizeConfig(loadedConfig)
  state.holidays = holidayResult.holidays
  state.holidayLive = holidayResult.live

  const selectedData = desktopMode ? desktopFiles?.data : directoryData ?? cachedData ?? staticData
  if (selectedData?.records) {
    state.records = selectedData.records
    state.firstRun = desktopMode ? desktopFiles?.firstRun ?? false : false
  } else if (staticCsv) {
    const preview = parseOaCsv(staticCsv, [])
    state.records = preview.ready
    state.firstRun = false
  } else {
    state.records = []
    state.firstRun = desktopMode ? desktopFiles?.firstRun ?? true : true
  }
  reconcileCancellationLinks(state.records)
  applyTheme(state.config)
  state.ready = true
  const initialData: DataFile = { version: 1, records: JSON.parse(JSON.stringify(state.records)), updatedAt: new Date().toISOString() }
  if (desktopMode) {
    await Promise.allSettled([saveTauriFiles(initialData, state.config)])
  } else {
    await Promise.allSettled([saveCachedData(state.records), saveCachedConfig(state.config)])
  }
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

async function saveConfig(config: LeaveConfig) {
  state.config = JSON.parse(JSON.stringify(config))
  applyTheme(state.config)
  await persist()
  showToast('设置已保存')
}

async function connectDirectory() {
  try {
    const handle = await connectDataDirectory()
    const existing = await loadDirectoryFiles(handle)
    directoryHandle = handle
    state.storageMode = '数据文件夹'
    state.directoryName = handle.name
    if (existing.data?.records) state.records = existing.data.records
    if (existing.config) state.config = normalizeConfig(existing.config)
    reconcileCancellationLinks(state.records)
    applyTheme(state.config)
    await persist()
    showToast(`已连接“${handle.name}”文件夹`)
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') return
    showToast((error as Error).message || '无法连接数据文件夹', 'error')
  }
}

async function completeFirstRun() {
  state.firstRun = false
  await persist()
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
    connectDirectory,
    completeFirstRun,
    exportData,
    exportConfig,
    showToast,
  }
}
