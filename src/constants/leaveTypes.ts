import type { LeaveConfig, LeaveType, ThemePalette } from '../types'

export const LEAVE_TYPES: LeaveType[] = [
  '年假',
  '产假',
  '丧假',
  '病假',
  '婚假',
  '特别假',
  '生日假',
  '侍产假',
  '无薪假',
  '补假',
  '其他',
]

export const ALL_RECORD_TYPES: LeaveType[] = [...LEAVE_TYPES, '取消休假']

export const DEFAULT_LEAVE_COLORS: Record<LeaveType, string> = {
  年假: '#A4473E',
  产假: '#C0617E',
  丧假: '#4B5563',
  病假: '#D97706',
  婚假: '#D45774',
  特别假: '#7755A6',
  生日假: '#0F8E8E',
  侍产假: '#2F6FAD',
  无薪假: '#718096',
  补假: '#2F855A',
  其他: '#9867A8',
  取消休假: '#B4232C',
}

export const THEMES: ThemePalette[] = [
  {
    id: 'cicc',
    name: '中金 · 绛金',
    primary: '#5B1B35',
    accent: '#B69A68',
    background: '#F4F1EB',
    surface: '#FFFEFC',
    ink: '#171519',
    muted: '#6F686B',
  },
  {
    id: 'cinda',
    name: '信达 · 蓝红',
    primary: '#283597',
    accent: '#DE050E',
    background: '#F1F3F8',
    surface: '#FFFFFF',
    ink: '#16192A',
    muted: '#697086',
  },
  {
    id: 'morandi',
    name: '莫兰迪 · 岩茶',
    primary: '#687D73',
    accent: '#B68478',
    background: '#F0EDE7',
    surface: '#FAF8F4',
    ink: '#252827',
    muted: '#727A76',
  },
  {
    id: 'wechat',
    name: '微信 · 原生绿',
    primary: '#07C160',
    accent: '#576B95',
    background: '#EDEDED',
    surface: '#FFFFFF',
    ink: '#191919',
    muted: '#737373',
  },
  {
    id: 'claude',
    name: 'Claude · 暖陶',
    primary: '#D97757',
    accent: '#6A9BCC',
    background: '#F5F4ED',
    surface: '#FFFFFF',
    ink: '#141413',
    muted: '#73726C',
  },
]

export const OFFICIAL_HOLIDAY_URL = 'https://www.1823.gov.hk/common/ical/sc.json'

export function createDefaultConfig(): LeaveConfig {
  return {
    version: 1,
    theme: { ...THEMES[1] },
    leaveColors: { ...DEFAULT_LEAVE_COLORS },
    holidayColor: '#79A98B',
    annualAllowance: { [String(new Date().getFullYear())]: null },
    specialAllowance: { [String(new Date().getFullYear())]: null },
    holidaySourceUrl: OFFICIAL_HOLIDAY_URL,
    updatedAt: new Date().toISOString(),
  }
}

export function normalizeLeaveType(raw: string): LeaveType {
  const value = raw.trim()
  if (value.includes('取消休假')) return '取消休假'
  if (value.includes('生日假')) return '生日假'
  if (value.includes('侍产假') || value.includes('陪产假')) return '侍产假'
  if (value.includes('产假')) return '产假'
  if (value.includes('丧假')) return '丧假'
  if (value.includes('病假')) return '病假'
  if (value.includes('婚假')) return '婚假'
  if (value.includes('特别假')) return '特别假'
  if (value.includes('无薪假')) return '无薪假'
  if (value.includes('补假')) return '补假'
  if (value.includes('年假')) return '年假'
  return '其他'
}
