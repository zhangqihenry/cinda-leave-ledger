import fs from 'node:fs'
import Papa from 'papaparse'

const input = process.argv[2] ?? 'public/leave-records.csv'
const output = process.argv[3] ?? 'public/leave-records.json'
const negative = /不同意|驳回|拒绝|退回|撤回|作废|未通过|不批准/
const positive = /同意|批准|通过|通過|已核[对對]|确认|確認|完成/

function approved(trail = '') {
  return trail.split(/[；;]/).reduce((decision, step) => {
    if (negative.test(step)) return false
    if (positive.test(step)) return true
    return decision
  }, null) === true
}

function leaveType(raw) {
  if (raw.includes('取消休假')) return '取消休假'
  if (raw.includes('生日假')) return '生日假'
  if (raw.includes('侍产假') || raw.includes('陪产假')) return '侍产假'
  for (const value of ['产假', '丧假', '病假', '婚假', '特别假', '无薪假', '补假', '年假']) {
    if (raw.includes(value)) return value
  }
  return '其他'
}

const content = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '')
const rows = Papa.parse(content, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
}).data

const records = rows
  .filter((row) => row['办理状态']?.trim() === '流转结束')
  .filter((row) => approved(row['审批记录']))
  .map((row) => {
    const documentNo = row['文号']?.trim() ?? ''
    const rawType = row['请假类型']?.trim() ?? ''
    return {
      id: documentNo ? `oa-${documentNo}` : `oa-${crypto.randomUUID()}`,
      documentNo,
      title: row['标题']?.trim() ?? '',
      status: row['办理状态']?.trim() ?? '',
      registrationDate: row['登记日期']?.trim() ?? '',
      name: row['姓名']?.trim() ?? '',
      department: row['部门']?.trim() ?? '',
      employeeType: row['员工类型']?.trim() ?? '',
      leaveType: leaveType(rawType),
      leaveTypeRaw: rawType,
      startDate: row['开始日期']?.trim() ?? '',
      startPeriod: row['开始时段']?.includes('下') ? '下午' : '上午',
      endDate: row['结束日期']?.trim() ?? '',
      endPeriod: row['结束时段']?.includes('下') ? '下午' : '上午',
      oaDays: Number.parseFloat(row['请假天数']) || 0,
      reason: row['请假说明']?.trim() ?? '',
      currentHandler: row['当前办理人']?.trim() ?? '',
      approvalTrail: row['审批记录']?.trim() ?? '',
      source: 'OA导入',
      importedAt: new Date().toISOString(),
    }
  })

fs.writeFileSync(output, `${JSON.stringify({ version: 1, records, updatedAt: new Date().toISOString() }, null, 2)}\n`)
console.log(`已写入 ${records.length} 条审批通过记录：${output}`)
