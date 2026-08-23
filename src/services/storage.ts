import { openDB } from 'idb'
import type { DataFile, LeaveConfig, LeaveRecord } from '../types'

const DB_NAME = 'leave-ledger-v2'
const STORE_NAME = 'app'
const DATA_KEY = 'leave-data'
const CONFIG_KEY = 'leave-config'
const DIRECTORY_KEY = 'directory-handle'

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
  },
})

async function readJsonFromHandle<T>(directory: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try {
    const handle = await directory.getFileHandle(name)
    const file = await handle.getFile()
    return JSON.parse((await file.text()).replace(/^\uFEFF/, '')) as T
  } catch {
    return null
  }
}

async function writeJsonToHandle(directory: FileSystemDirectoryHandle, name: string, value: unknown) {
  const handle = await directory.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(`${JSON.stringify(value, null, 2)}\n`)
  await writable.close()
}

export async function loadCachedData(): Promise<DataFile | null> {
  return (await (await dbPromise).get(STORE_NAME, DATA_KEY)) ?? null
}

export async function loadCachedConfig(): Promise<LeaveConfig | null> {
  return (await (await dbPromise).get(STORE_NAME, CONFIG_KEY)) ?? null
}

export async function saveCachedData(records: LeaveRecord[]): Promise<DataFile> {
  const payload: DataFile = { version: 1, records: toPlainJson(records), updatedAt: new Date().toISOString() }
  await (await dbPromise).put(STORE_NAME, payload, DATA_KEY)
  return payload
}

export async function saveCachedConfig(config: LeaveConfig): Promise<void> {
  await (await dbPromise).put(STORE_NAME, toPlainJson(config), CONFIG_KEY)
}

export async function loadStaticJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function loadStaticText(path: string): Promise<string | null> {
  try {
    const response = await fetch(path, { cache: 'no-store' })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

export async function getPersistedDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = (await (await dbPromise).get(STORE_NAME, DIRECTORY_KEY)) as FileSystemDirectoryHandle | undefined
    if (!handle) return null
    const permission = await handle.queryPermission({ mode: 'readwrite' })
    return permission === 'granted' ? handle : null
  } catch {
    return null
  }
}

export async function connectDataDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error('当前浏览器不支持直接连接文件夹')
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await (await dbPromise).put(STORE_NAME, handle, DIRECTORY_KEY)
  return handle
}

export async function loadDirectoryFiles(directory: FileSystemDirectoryHandle): Promise<{
  data: DataFile | null
  config: LeaveConfig | null
}> {
  const [data, config] = await Promise.all([
    readJsonFromHandle<DataFile>(directory, 'leave-records.json'),
    readJsonFromHandle<LeaveConfig>(directory, 'leave-config.json'),
  ])
  return { data, config }
}

export async function saveDirectoryFiles(
  directory: FileSystemDirectoryHandle,
  data: DataFile,
  config: LeaveConfig,
): Promise<void> {
  await Promise.all([
    writeJsonToHandle(directory, 'leave-records.json', data),
    writeJsonToHandle(directory, 'leave-config.json', config),
  ])
}

export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
