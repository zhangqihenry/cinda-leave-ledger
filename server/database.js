import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

function now() {
  return new Date().toISOString()
}

function mapUser(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    passwordChangeRecommended: Boolean(row.password_change_recommended),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AppDatabase {
  constructor(dataDir, filename = 'leave-ledger.sqlite') {
    fs.mkdirSync(dataDir, { recursive: true })
    this.path = path.join(dataDir, filename)
    this.db = new DatabaseSync(this.path)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
        password_change_recommended INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_states (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data_json TEXT NOT NULL,
        config_json TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
    `)
  }

  close() {
    this.db.close()
  }

  getUserByUsername(username) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE username = ?').get(username))
  }

  getUserById(id) {
    return mapUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id))
  }

  createUser({ username, passwordHash, role = 'user', passwordChangeRecommended = false }) {
    const timestamp = now()
    const result = this.db.prepare(`
      INSERT INTO users (username, password_hash, role, password_change_recommended, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, passwordHash, role, passwordChangeRecommended ? 1 : 0, timestamp, timestamp)
    return this.getUserById(Number(result.lastInsertRowid))
  }

  listUsers() {
    return this.db.prepare(`
      SELECT id, username, role, password_change_recommended, created_at, updated_at
      FROM users WHERE role = 'user' ORDER BY username ASC
    `).all().map(mapUser)
  }

  updatePassword(userId, passwordHash, passwordChangeRecommended = false) {
    this.db.prepare(`
      UPDATE users SET password_hash = ?, password_change_recommended = ?, updated_at = ? WHERE id = ?
    `).run(passwordHash, passwordChangeRecommended ? 1 : 0, now(), userId)
    return this.getUserById(userId)
  }

  createSession({ tokenHash, userId, csrfToken, expiresAt }) {
    this.db.prepare(`
      INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(tokenHash, userId, csrfToken, now(), expiresAt)
  }

  getSession(tokenHashValue) {
    const row = this.db.prepare(`
      SELECT s.token_hash, s.csrf_token, s.expires_at,
             u.id, u.username, u.password_hash, u.role, u.password_change_recommended,
             u.created_at, u.updated_at
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(tokenHashValue, now())
    if (!row) return null
    return { tokenHash: row.token_hash, csrfToken: row.csrf_token, expiresAt: row.expires_at, user: mapUser(row) }
  }

  deleteSession(tokenHashValue) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHashValue)
  }

  deleteOtherSessions(userId, retainedTokenHash = '') {
    if (retainedTokenHash) {
      this.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(userId, retainedTokenHash)
      return
    }
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  }

  deleteExpiredSessions() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now())
  }

  getUserState(userId) {
    const row = this.db.prepare('SELECT * FROM user_states WHERE user_id = ?').get(userId)
    if (!row) return { exists: false, data: null, config: null, revision: 0, updatedAt: null }
    return {
      exists: true,
      data: JSON.parse(row.data_json),
      config: JSON.parse(row.config_json),
      revision: Number(row.revision),
      updatedAt: row.updated_at,
    }
  }

  saveUserState(userId, data, config, expectedRevision) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.db.prepare('SELECT revision FROM user_states WHERE user_id = ?').get(userId)
      const currentRevision = current ? Number(current.revision) : 0
      if (currentRevision !== expectedRevision) {
        this.db.exec('ROLLBACK')
        return null
      }
      const nextRevision = currentRevision + 1
      const timestamp = now()
      if (current) {
        this.db.prepare(`
          UPDATE user_states SET data_json = ?, config_json = ?, revision = ?, updated_at = ? WHERE user_id = ?
        `).run(JSON.stringify(data), JSON.stringify(config), nextRevision, timestamp, userId)
      } else {
        this.db.prepare(`
          INSERT INTO user_states (user_id, data_json, config_json, revision, updated_at) VALUES (?, ?, ?, ?, ?)
        `).run(userId, JSON.stringify(data), JSON.stringify(config), nextRevision, timestamp)
      }
      this.db.exec('COMMIT')
      return { revision: nextRevision, updatedAt: timestamp }
    } catch (error) {
      if (this.db.isOpen) this.db.exec('ROLLBACK')
      throw error
    }
  }
}
