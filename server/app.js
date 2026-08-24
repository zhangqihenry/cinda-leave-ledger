import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { AppDatabase } from './database.js'
import { hashPassword, randomToken, tokenHash, validateEmployeeId, validatePassword, verifyPassword } from './security.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendDirectory = path.resolve(currentDirectory, '..', 'dist')
const SESSION_COOKIE = 'leave_ledger_session'
const HOLIDAY_URL = 'https://www.1823.gov.hk/common/ical/sc.json'

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=')
    if (index < 0) return [part, '']
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
  }))
}

function publicUser(user) {
  return {
    username: user.username,
    role: user.role,
    passwordChangeRecommended: user.passwordChangeRecommended,
  }
}

function validateStatePayload(body) {
  if (!body || !body.data || body.data.version !== 1 || !Array.isArray(body.data.records)) {
    throw new HttpError(400, 'INVALID_DATA', '请假记录数据格式有误。')
  }
  if (body.data.records.length > 20_000) {
    throw new HttpError(400, 'TOO_MANY_RECORDS', '请假记录数量超过上限。')
  }
  if (!body.config || body.config.version !== 1 || typeof body.config.theme !== 'object') {
    throw new HttpError(400, 'INVALID_CONFIG', '设置数据格式有误。')
  }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    throw new HttpError(400, 'INVALID_REVISION', '数据版本无效。')
  }
}

function normalizeOfficialHolidays(payload) {
  const events = payload?.vcalendar?.[0]?.vevent
  if (!Array.isArray(events)) throw new Error('Unexpected holiday response')
  return events.map((event) => {
    const value = event.dtstart?.[0] || ''
    return {
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      name: String(event.summary || ''),
    }
  }).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.name)
}

export async function createApp(config, options = {}) {
  const db = options.db || new AppDatabase(config.dataDir)
  const fetchImpl = options.fetchImpl || fetch
  const existingAdmin = db.getUserByUsername(config.adminUsername)
  if (!existingAdmin) {
    db.createUser({
      username: config.adminUsername,
      passwordHash: await hashPassword(config.adminPassword),
      role: 'admin',
      passwordChangeRecommended: true,
    })
  }
  const dummyPasswordHash = await hashPassword(randomToken())
  db.deleteExpiredSessions()

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "connect-src": ["'self'"],
        "upgrade-insecure-requests": null,
      },
    },
  }))
  app.use(express.json({ limit: '2mb' }))
  app.use(['/api/auth', '/api/admin', '/api/state'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !config.rateLimitEnabled,
  })

  function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.cookieSecure,
      path: '/',
      maxAge: config.sessionTtlMs,
    })
  }

  function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/' })
  }

  function createSession(res, user) {
    const token = randomToken()
    const csrfToken = randomToken()
    db.createSession({
      tokenHash: tokenHash(token),
      userId: user.id,
      csrfToken,
      expiresAt: new Date(Date.now() + config.sessionTtlMs).toISOString(),
    })
    setSessionCookie(res, token)
    return { user: publicUser(user), csrfToken }
  }

  function readSession(req) {
    const token = parseCookies(req.get('cookie'))[SESSION_COOKIE]
    if (!token) return null
    return db.getSession(tokenHash(token))
  }

  function requireAuth(req, _res, next) {
    const session = readSession(req)
    if (!session) return next(new HttpError(401, 'AUTH_REQUIRED', '请先登录。'))
    req.auth = session
    next()
  }

  function requireRole(role) {
    return (req, _res, next) => {
      if (req.auth?.user.role !== role) return next(new HttpError(403, 'FORBIDDEN', '当前账户无权执行此操作。'))
      next()
    }
  }

  function verifyCsrf(req, _res, next) {
    if (req.get('x-csrf-token') !== req.auth?.csrfToken) {
      return next(new HttpError(403, 'INVALID_CSRF', '请求校验失败，请刷新后重试。'))
    }
    next()
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

  app.get('/api/auth/session', (req, res) => {
    const session = readSession(req)
    if (!session) return res.json({ user: null, csrfToken: null })
    res.json({ user: publicUser(session.user), csrfToken: session.csrfToken })
  })

  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    if (!validateEmployeeId(username)) throw new HttpError(400, 'INVALID_USERNAME', '工号必须是 800 开头的六位数字。')
    if (!validatePassword(password)) throw new HttpError(400, 'INVALID_PASSWORD', '密码需为 8 至 128 个字符。')
    if (db.getUserByUsername(username)) throw new HttpError(409, 'USERNAME_EXISTS', '该工号已注册。')
    let user
    try {
      user = db.createUser({ username, passwordHash: await hashPassword(password) })
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) {
        throw new HttpError(409, 'USERNAME_EXISTS', '该工号已注册。')
      }
      throw error
    }
    res.status(201).json(createSession(res, user))
  })

  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    const user = db.getUserByUsername(username)
    const passwordValid = await verifyPassword(password, user?.passwordHash || dummyPasswordHash)
    if (!user || !passwordValid) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', '用户名或密码错误。')
    }
    res.json(createSession(res, user))
  })

  app.post('/api/auth/logout', requireAuth, verifyCsrf, (req, res) => {
    db.deleteSession(req.auth.tokenHash)
    clearSessionCookie(res)
    res.status(204).end()
  })

  app.post('/api/auth/password', requireAuth, verifyCsrf, async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '')
    const newPassword = String(req.body?.newPassword || '')
    if (!(await verifyPassword(currentPassword, req.auth.user.passwordHash))) {
      throw new HttpError(400, 'CURRENT_PASSWORD_INVALID', '当前密码错误。')
    }
    if (!validatePassword(newPassword)) throw new HttpError(400, 'INVALID_PASSWORD', '新密码需为 8 至 128 个字符。')
    const user = db.updatePassword(req.auth.user.id, await hashPassword(newPassword), false)
    db.deleteOtherSessions(user.id, req.auth.tokenHash)
    res.json({ user: publicUser(user) })
  })

  app.get('/api/admin/users', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ users: db.listUsers().map((user) => ({
      username: user.username,
      passwordChangeRecommended: user.passwordChangeRecommended,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })) })
  })

  app.post('/api/admin/users/:username/reset-password', requireAuth, requireRole('admin'), verifyCsrf, async (req, res) => {
    const user = db.getUserByUsername(req.params.username)
    if (!user || user.role !== 'user') throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在。')
    db.updatePassword(user.id, await hashPassword(config.resetPassword), true)
    db.deleteOtherSessions(user.id)
    res.json({ username: user.username, temporaryPassword: config.resetPassword })
  })

  app.get('/api/state', requireAuth, requireRole('user'), (req, res) => {
    res.json(db.getUserState(req.auth.user.id))
  })

  app.put('/api/state', requireAuth, requireRole('user'), verifyCsrf, (req, res) => {
    validateStatePayload(req.body)
    const result = db.saveUserState(req.auth.user.id, req.body.data, req.body.config, req.body.revision)
    if (!result) throw new HttpError(409, 'REVISION_CONFLICT', '数据已在其他页面或设备上更新，请刷新后重试。')
    res.json(result)
  })

  let holidayCache = null
  app.get('/api/holidays', async (_req, res) => {
    if (holidayCache && holidayCache.expiresAt > Date.now()) {
      res.set('Cache-Control', 'public, max-age=3600')
      return res.json({ holidays: holidayCache.holidays })
    }
    const response = await fetchImpl(HOLIDAY_URL, { signal: AbortSignal.timeout(8_000) })
    if (!response.ok) throw new HttpError(502, 'HOLIDAY_SOURCE_UNAVAILABLE', '无法读取香港公众假期数据。')
    const holidays = normalizeOfficialHolidays(await response.json())
    holidayCache = { holidays, expiresAt: Date.now() + 12 * 60 * 60 * 1000 }
    res.set('Cache-Control', 'public, max-age=3600')
    res.json({ holidays })
  })

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', '接口不存在。')))

  if (fs.existsSync(frontendDirectory)) {
    app.use(express.static(frontendDirectory, { index: false, maxAge: config.isProduction ? '1y' : 0, immutable: config.isProduction }))
    app.use((req, res, next) => {
      if (!['GET', 'HEAD'].includes(req.method)) return next()
      res.set('Cache-Control', 'no-cache')
      res.sendFile(path.join(frontendDirectory, 'index.html'))
    })
  }

  app.use((error, _req, res, _next) => {
    const status = Number(error.status) || 500
    if (status >= 500) console.error(error)
    res.status(status).json({
      error: status >= 500 ? '服务器暂时无法处理请求。' : error.message,
      code: error.code || 'INTERNAL_ERROR',
    })
  })

  return { app, db }
}
