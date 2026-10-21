import { Card, Donut } from '@/components/ui'
import { requestMetrics } from '@/domain/rules'
import type { AuditRequest } from '@/domain/types'

/** 자료 요청 현황 분석: 진행률, 30일 내 마감, 지연 분포, 제출 품질 지표 */
export function RequestAnalytics({ requests, today }: { requests: AuditRequest[]; today: string }) {
  const m = requestMetrics(requests, today)
  const maxDue = Math.max(1, ...m.comingDue.map((d) => d.count))
  const maxLate = Math.max(1, ...m.overdue.map((d) => d.count))
  const pct = (n: number) => (m.total ? Math.round((n / m.total) * 100) : 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="요약">
        <div className="flex items-center gap-8">
          <Donut
            size={168}
            stroke={20}
            parts={[
              { value: m.accepted, color: '#22a35a' },
              { value: m.submitted, color: '#3b82f6' },
              { value: m.outstanding, color: '#e5e7eb' },
            ]}
            center={
              <>
                <span className="text-3xl font-light text-ink">{m.total}</span>
                <span className="text-xs text-muted">전체</span>
              </>
            }
          />
          <ul className="space-y-3 text-[13px]">
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-done" /> 승인 {pct(m.accepted)}% <span className="text-muted">{m.accepted}/{m.total}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand" /> 제출·검토 {pct(m.submitted)}% <span className="text-muted">{m.submitted}/{m.total}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300" /> 미제출 {pct(m.outstanding)}% <span className="text-muted">{m.outstanding}/{m.total}</span>
            </li>
          </ul>
        </div>
      </Card>

      <Card title={<span>마감 예정 <span className="text-xs font-normal text-muted">(앞으로 30일)</span></span>}>
        <div className="flex h-[150px] items-end gap-[3px] border-b border-line">
          {m.comingDue.map((d) => (
            <div key={d.date} title={`${d.date} · ${d.count}건`} className="flex flex-1 flex-col items-center justify-end">
              {d.count > 0 && <span className="mb-0.5 text-[10px] text-muted">{d.count}</span>}
              <div className="w-full rounded-t-sm bg-[#2b9d9a]" style={{ height: `${(d.count / maxDue) * 120}px`, opacity: d.count ? 1 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-faint">
          <span>{m.comingDue[0]?.date.slice(5)}</span>
          <span>{m.comingDue[14]?.date.slice(5)}</span>
          <span>{m.comingDue[29]?.date.slice(5)}</span>
        </div>
      </Card>

      <Card title="기한 경과">
        <p className="mb-3 text-center text-[13px] text-ink-2">
          미제출 {m.outstanding}건 중 <b className="font-semibold text-danger">{m.overdueCount}건</b> 기한 경과
        </p>
        <div className="flex h-[130px] items-end gap-3 border-b border-line">
          {m.overdue.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center justify-end">
              {d.count > 0 && <span className="mb-0.5 text-[11px] text-muted">{d.count}</span>}
              <div className="w-full rounded-t-sm bg-[#c0392b]" style={{ height: `${(d.count / maxLate) * 105}px`, opacity: d.count ? 0.55 + (0.45 * d.count) / maxLate : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-3 text-[11px] text-muted">
          {m.overdue.map((d) => (
            <span key={d.label} className="flex-1 text-center">
              {d.label}
            </span>
          ))}
        </div>
      </Card>

      <Card title="지표">
        <ul className="divide-y divide-line-2">
          {[
            [`${m.avgDaysOverdue}일`, '평균 지연 일수', `기한 경과 ${m.overdueCount}건 기준`],
            [`${m.onTimePct}%`, '기한 내 제출', `제출된 ${m.submittedEver}건 기준`],
            [`${m.returnedPct}%`, '반려 경험', '한 번 이상 반려된 비율'],
            [`${m.returnedMultiplePct}%`, '반복 반려', '두 번 이상 반려된 비율'],
          ].map(([v, label, sub]) => (
            <li key={label} className="flex items-baseline gap-4 py-2.5">
              <span className="tabular w-20 text-right text-2xl font-light text-ink">{v}</span>
              <span className="text-[13px] text-ink-2">
                {label} <span className="text-xs text-muted">· {sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
