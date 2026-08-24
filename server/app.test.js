import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from './app.js'

function testConfig(dataDir) {
  return {
    nodeEnv: 'test',
    isProduction: false,
    port: 0,
    dataDir,
    sessionTtlMs: 60 * 60 * 1000,
    cookieSecure: false,
    trustProxy: false,
    adminUsername: 'admin',
    adminPassword: 'Admin1234',
    resetPassword: 'Abcd1234!',
    rateLimitEnabled: false,
  }
}

async function withApp(run) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leave-ledger-server-'))
  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return { vcalendar: [{ vevent: [{ dtstart: ['20260101'], summary: '元旦' }] }] }
    },
  })
  const instance = await createApp(testConfig(dataDir), { fetchImpl: fakeFetch })
  try {
    await run(instance.app)
  } finally {
    instance.db.close()
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
}

async function register(agent, username, password = 'Personal123!') {
  const response = await agent.post('/api/auth/register').send({ username, password }).expect(201)
  return response.body.csrfToken
}

test('employee registration validates the ID and keeps user states isolated', async () => {
  await withApp(async (app) => {
    await request(app).post('/api/auth/register').send({ username: '700809', password: 'Personal123!' }).expect(400)

    const first = request.agent(app)
    const firstCsrf = await register(first, '800809')
    const emptyState = await first.get('/api/state').expect('cache-control', 'no-store').expect(200)
    assert.equal(emptyState.body.exists, false)

    const data = { version: 1, records: [], updatedAt: new Date().toISOString() }
    const config = { version: 1, theme: { id: 'cinda' } }
    await first.put('/api/state').send({ data, config, revision: 0 }).expect(403)
    const saved = await first.put('/api/state').set('x-csrf-token', firstCsrf).send({ data, config, revision: 0 }).expect(200)
    assert.equal(saved.body.revision, 1)

    const second = request.agent(app)
    await register(second, '800810')
    const secondState = await second.get('/api/state').expect(200)
    assert.equal(secondState.body.exists, false)

    const firstState = await first.get('/api/state').expect(200)
    assert.equal(firstState.body.exists, true)
    assert.equal(firstState.body.revision, 1)
  })
})

test('admin lists users and resets a password to the configured default', async () => {
  await withApp(async (app) => {
    const user = request.agent(app)
    await register(user, '800809')

    const admin = request.agent(app)
    const login = await admin.post('/api/auth/login').send({ username: 'admin', password: 'Admin1234' }).expect(200)
    assert.equal(login.body.user.role, 'admin')
    assert.equal(login.body.user.passwordChangeRecommended, true)

    const list = await admin.get('/api/admin/users').expect(200)
    assert.deepEqual(list.body.users.map((item) => item.username), ['800809'])

    const reset = await admin
      .post('/api/admin/users/800809/reset-password')
      .set('x-csrf-token', login.body.csrfToken)
      .expect(200)
    assert.equal(reset.body.temporaryPassword, 'Abcd1234!')

    await user.get('/api/state').expect(401)
    await request(app).post('/api/auth/login').send({ username: '800809', password: 'Personal123!' }).expect(401)
    const resetLogin = await request(app).post('/api/auth/login').send({ username: '800809', password: 'Abcd1234!' }).expect(200)
    assert.equal(resetLogin.body.user.passwordChangeRecommended, true)
  })
})

test('users can change their password and revision conflicts are rejected', async () => {
  await withApp(async (app) => {
    const user = request.agent(app)
    const csrfToken = await register(user, '800809')
    const changed = await user.post('/api/auth/password').set('x-csrf-token', csrfToken).send({
      currentPassword: 'Personal123!',
      newPassword: 'NewPassword456!',
    }).expect(200)
    assert.equal(changed.body.user.passwordChangeRecommended, false)

    const data = { version: 1, records: [], updatedAt: new Date().toISOString() }
    const config = { version: 1, theme: { id: 'cinda' } }
    await user.put('/api/state').set('x-csrf-token', csrfToken).send({ data, config, revision: 0 }).expect(200)
    await user.put('/api/state').set('x-csrf-token', csrfToken).send({ data, config, revision: 0 }).expect(409)

    await request(app).post('/api/auth/login').send({ username: '800809', password: 'Personal123!' }).expect(401)
    await request(app).post('/api/auth/login').send({ username: '800809', password: 'NewPassword456!' }).expect(200)
  })
})
