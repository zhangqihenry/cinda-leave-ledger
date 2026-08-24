import { apiRequest } from './api'
import type { DataFile, LeaveConfig, ServerStateSnapshot } from '../types'

let revision = 0

export async function loadServerState(): Promise<ServerStateSnapshot> {
  const snapshot = await apiRequest<ServerStateSnapshot>('/api/state')
  revision = snapshot.revision
  return snapshot
}

export async function saveServerState(data: DataFile, config: LeaveConfig): Promise<void> {
  const result = await apiRequest<{ revision: number; updatedAt: string }>('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ data, config, revision }),
  })
  revision = result.revision
}

export function resetServerStateRevision() {
  revision = 0
}
