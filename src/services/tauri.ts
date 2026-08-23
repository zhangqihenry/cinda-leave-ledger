import { invoke, isTauri } from '@tauri-apps/api/core'
import type { DataFile, LeaveConfig } from '../types'

export interface DesktopFileSnapshot {
  data: DataFile | null
  config: LeaveConfig | null
  directory: string
}

export function isTauriRuntime(): boolean {
  return isTauri()
}

export async function loadTauriFiles(): Promise<DesktopFileSnapshot | null> {
  if (!isTauriRuntime()) return null
  try {
    return await invoke<DesktopFileSnapshot>('load_app_files')
  } catch (error) {
    console.error('无法读取 Tauri 本地数据文件', error)
    return null
  }
}

export async function saveTauriFiles(data: DataFile, config: LeaveConfig): Promise<void> {
  if (!isTauriRuntime()) return
  await invoke('save_app_files', { data, config })
}
