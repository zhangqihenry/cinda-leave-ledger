export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let csrfToken = ''

export function setCsrfToken(value: string | null | undefined) {
  csrfToken = value || ''
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase()) && csrfToken) {
    headers.set('x-csrf-token', csrfToken)
  }
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; code?: string } | null
    throw new ApiError(response.status, payload?.code || 'REQUEST_FAILED', payload?.error || '请求失败。')
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}
