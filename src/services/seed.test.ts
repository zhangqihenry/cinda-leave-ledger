import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultConfig } from '../constants/leaveTypes'
import type { DataFile } from '../types'

const data = JSON.parse(fs.readFileSync('public/leave-records.example.json', 'utf8')) as DataFile

describe('公开示例数据', () => {
  it('不包含个人请假记录', () => {
    expect(data.records).toEqual([])
  })

  it('保留可供初始化读取的数据文件结构', () => {
    expect(data.version).toBe(1)
    expect(typeof data.updatedAt).toBe('string')
  })

  it('新用户默认使用信达主题', () => {
    expect(createDefaultConfig().theme.id).toBe('cinda')
  })
})
