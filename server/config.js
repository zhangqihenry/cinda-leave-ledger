import path from 'node:path'

function numberValue(value, fallback, name) {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`)
  return parsed
}

function booleanValue(value, fallback) {
  if (value === undefined || value === '') return fallback
  if (['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())) return true
  if (['0', 'false', 'no', 'off'].includes(String(value).toLowerCase())) return false
  throw new Error(`Invalid boolean value: ${value}`)
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development'
  const adminPassword = env.ADMIN_PASSWORD || 'Admin1234'
  const resetPassword = env.RESET_PASSWORD || 'Abcd1234!'
  if (adminPassword.length < 8) throw new Error('ADMIN_PASSWORD must contain at least 8 characters')
  if (resetPassword.length < 8) throw new Error('RESET_PASSWORD must contain at least 8 characters')
  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: numberValue(env.PORT, 3000, 'PORT'),
    dataDir: path.resolve(env.DATA_DIR || './data'),
    sessionTtlMs: numberValue(env.SESSION_TTL_HOURS, 168, 'SESSION_TTL_HOURS') * 60 * 60 * 1000,
    cookieSecure: booleanValue(env.COOKIE_SECURE, false),
    trustProxy: booleanValue(env.TRUST_PROXY, false),
    adminUsername: env.ADMIN_USERNAME || 'admin',
    adminPassword,
    resetPassword,
    rateLimitEnabled: booleanValue(env.RATE_LIMIT_ENABLED, true),
  })
}
