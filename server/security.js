import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(crypto.scrypt)
const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64

export function validateEmployeeId(username) {
  return /^800\d{3}$/.test(String(username || ''))
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url')
  const key = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${Buffer.from(key).toString('base64url')}`
}

export async function verifyPassword(password, storedHash) {
  try {
    const [algorithm, rawN, rawR, rawP, salt, encodedKey] = String(storedHash).split('$')
    if (algorithm !== 'scrypt' || !salt || !encodedKey) return false
    const expected = Buffer.from(encodedKey, 'base64url')
    const actual = await scryptAsync(password, salt, expected.length, {
      N: Number(rawN),
      r: Number(rawR),
      p: Number(rawP),
      maxmem: 64 * 1024 * 1024,
    })
    const actualBuffer = Buffer.from(actual)
    return actualBuffer.length === expected.length && crypto.timingSafeEqual(actualBuffer, expected)
  } catch {
    return false
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
