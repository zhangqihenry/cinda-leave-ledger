import { describe, expect, it } from 'vitest'
import { parseOaCsv } from './csv'

const header = '序号,文号,标题,办理状态,登记日期,姓名,部门,员工类型,请假类型,开始日期,开始时段,结束日期,结束时段,请假天数,请假说明,当前办理人,审批记录'

describe('OA CSV 导入', () => {
  it('仅接收流转结束且审批通过的记录', () => {
    const content = [
      header,
      '1,2026-AL1,年假,流转结束,2026-01-01,测试,部门,普通员工,年假,2026-01-02,上午,2026-01-02,下午,1,,,审批人 | 同意',
      '2,2026-AL2,病假,正在流转,2026-01-01,测试,部门,普通员工,病假,2026-01-05,上午,2026-01-05,下午,1,,,审批人 | 同意',
      '3,2026-AL3,特别假,流转结束,2026-01-01,测试,部门,普通员工,特别假,2026-01-06,上午,2026-01-06,下午,1,,,审批人 | 不同意',
      '4,2026-AL4,年假,流转结束,2026-01-01,测试,部门,普通员工,年假,2026-01-07,上午,2026-01-07,下午,1,,,初审 | 退回；复核 | 同意',
    ].join('\n')
    const preview = parseOaCsv(content, [])
    expect(preview.ready.map((item) => item.documentNo)).toEqual(['2026-AL1', '2026-AL4'])
    expect(preview.skipped.map((item) => item.reason)).toEqual(['未完成审批', '审批未通过'])
  })

  it('同时检查文号与日期时段冲突', () => {
    const first = parseOaCsv(`${header}\n1,2026-AL1,年假,流转结束,2026-01-01,测试,部门,普通员工,年假,2026-01-02,上午,2026-01-02,下午,1,,,同意`, []).ready[0]
    const next = parseOaCsv(`${header}\n2,2026-AL1,病假,流转结束,2026-01-01,测试,部门,普通员工,病假,2026-01-02,下午,2026-01-02,下午,0.5,,,同意`, [first])
    expect(next.conflicts).toHaveLength(1)
    expect(next.conflicts[0].reasons).toEqual(['文号重复', '请假日期或时段重叠'])
  })
})
