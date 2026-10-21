import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Sparkles, FileSpreadsheet, Check, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Button, Card, DemoNote, KrTag, Th, Td } from '@/components/ui'
import { useEngagement, useFsLines } from '@/data/hooks'
import type { FSLine } from '@/domain/types'
import { cx, num } from '@/lib/format'

/** FS 금액 단위: 천원. 엔게이지먼트 중요성은 원 단위로 저장되어 있다. */
const UNIT = 1000
const PERF_RATIO = 0.75 // 수행중요성 = 전체 중요성의 75% (시연 가정)

const ratio = (a?: number, b?: number) => (a !== undefined && b ? (a / b) * 100 : undefined)

function RatioCard({ title, cur, prior, desc, goodUp }: { title: string; cur?: number; prior?: number; desc: string; goodUp: boolean }) {
  const diff = cur !== undefined && prior !== undefined ? cur - prior : undefined
  const better = diff !== undefined && (goodUp ? diff >= 0 : diff <= 0)
  return (
    <section className="rounded-lg border border-line bg-white px-5 py-4">
      <h3 className="text-[15px] font-medium text-ink">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tabular text-[28px] font-light text-ink">{cur?.toFixed(1) ?? '-'}%</span>
        {diff !== undefined && (
          <span className={cx('inline-flex items-center text-xs font-medium', better ? 'text-done' : 'text-danger')}>
            {diff >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(diff).toFixed(1)}%p
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        전기 {prior?.toFixed(1) ?? '-'}% · {desc}
      </p>
    </section>
  )
}

const aiComments = [
  {
    title: '매출 감소와 매출총이익률 하락',
    text: '매출액이 전기 대비 약 16.8% 감소했고 매출총이익률은 18.2%에서 15.9%로 2.3%p 하락했습니다. 매출원가 감소폭이 매출 감소폭보다 작아 고정비 부담이 커졌을 가능성이 있습니다. 주요 거래처별 매출 추이와 원가 구성 변동에 대해 경영진 질문을 권장합니다.',
    ref: 'P-24 계획단계 분석적 검토',
  },
  {
    title: '매출 감소 대비 매출채권 증가',
    text: '매출이 줄었는데 매출채권은 19.4% 증가했습니다. 회전기간이 길어졌으므로 기말 cut-off 오류, 회수 지연 채권, 대손충당금 과소 계상 위험을 검토하십시오. E-22, E-23 절차의 표본 범위 확대를 고려할 수 있습니다.',
    ref: 'E-20 매출채권',
  },
  {
    title: '장기차입금 증가와 유형자산 취득',
    text: '장기차입금이 12억원 증가했고 유형자산도 약 16억원 증가했습니다. 설비 투자 자금 조달로 보이며, 차입 약정서의 재무약정(covenant) 준수 여부와 담보 제공 자산 공시를 확인하십시오.',
    ref: 'E-41 취득·처분 증빙 검토',
  },
]

export function InsightsPage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const lines = useFsLines(id)
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({})
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  const materiality = e?.materiality ? e.materiality / UNIT : undefined // 천원
  const perf = materiality ? materiality * PERF_RATIO : undefined
  const by = (lid: string) => lines.find((l) => l.id === lid)

  const rows = lines
    .filter((l): l is FSLine & { current: number; prior: number } => l.kind === 'line' && l.current !== undefined && l.prior !== undefined)
    .map((l) => {
      const change = l.current - l.prior
      const rate = l.prior ? (change / Math.abs(l.prior)) * 100 : 0
      const overPerf = perf !== undefined && Math.abs(change) > perf
      const overRate = Math.abs(rate) > 20
      return { ...l, change, rate, overPerf, overRate, flagged: overPerf || overRate }
    })
  const flaggedCount = rows.filter((r) => r.flagged).length
  const shown = onlyFlagged ? rows.filter((r) => r.flagged) : rows
  const top = [...rows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8)
  const maxAbs = Math.max(1, ...top.map((t) => Math.abs(t.change)))

  const gp = ratio(by('is-gp')?.current, by('is-rev')?.current)
  const gpP = ratio(by('is-gp')?.prior, by('is-rev')?.prior)
  const debt = ratio(by('bs-l-t')?.current, by('bs-eq-t')?.current)
  const debtP = ratio(by('bs-l-t')?.prior, by('bs-eq-t')?.prior)
  const cur = ratio(by('bs-ca-t')?.current, by('bs-cl-t')?.current)
  const curP = ratio(by('bs-ca-t')?.prior, by('bs-cl-t')?.prior)

  if (!e) return null

  return (
    <div className="min-h-full bg-canvas px-6 py-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-normal text-ink">인사이트</h1>
          <p className="mt-0.5 text-sm text-muted">당기 9월말 시산 vs 전기 감사 확정 금액 · 단위 천원</p>
        </div>
        <div className="text-right text-xs text-muted">
          전체 중요성 <span className="tabular font-medium text-ink-2">{num(materiality)}</span> · 수행중요성{' '}
          <span className="tabular font-medium text-ink-2">{num(perf)}</span>
          <span className="text-faint"> (75% 가정)</span>
        </div>
      </div>

      {/* 재무비율 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RatioCard title="매출총이익률" cur={gp} prior={gpP} desc="매출총이익 ÷ 매출액" goodUp />
        <RatioCard title="부채비율" cur={debt} prior={debtP} desc="부채 총계 ÷ 자본 총계" goodUp={false} />
        <RatioCard title="유동비율" cur={cur} prior={curP} desc="유동자산 ÷ 유동부채" goodUp />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* 계정 증감 분석 */}
          <section className="rounded-lg border border-line bg-white">
            <header className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-[15px] font-medium text-ink">
                계정 증감 분석 <span className="text-muted">({rows.length})</span>
              </h3>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={onlyFlagged} onChange={(ev) => setOnlyFlagged(ev.target.checked)} />
                검토 대상만 ({flaggedCount})
              </label>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>계정</Th>
                    <Th className="text-right">당기</Th>
                    <Th className="text-right">전기</Th>
                    <Th className="text-right">증감</Th>
                    <Th className="text-right">증감률</Th>
                    <Th>판단</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className={cx(r.flagged && 'bg-[#fffbf2]')}>
                      <Td>
                        <span className="text-ink">{r.label}</span>
                        <span className="ml-1.5 text-[11px] text-faint">{r.statement === 'BS' ? '재무상태표' : '손익계산서'}</span>
                      </Td>
                      <Td className="tabular text-right">{num(r.current)}</Td>
                      <Td className="tabular text-right text-muted">{num(r.prior)}</Td>
                      <Td className={cx('tabular text-right', r.change < 0 ? 'text-danger' : 'text-ink')}>
                        {r.change > 0 ? '+' : ''}
                        {num(r.change)}
                      </Td>
                      <Td className={cx('tabular text-right', r.overRate && 'font-semibold text-[#b7791f]')}>
                        {r.rate > 0 ? '+' : ''}
                        {r.rate.toFixed(1)}%
                      </Td>
                      <Td>
                        {r.flagged ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[#b7791f]">
                            <AlertTriangle size={13} />
                            {[r.overPerf && '수행중요성 초과', r.overRate && '20% 초과'].filter(Boolean).join(' · ')}
                          </span>
                        ) : (
                          <span className="text-xs text-faint">—</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 상위 증감 막대 */}
          <Card title="증감 상위 계정">
            <div className="space-y-2.5">
              {top.map((t) => {
                const w = (Math.abs(t.change) / maxAbs) * 50
                return (
                  <div key={t.id} className="flex items-center gap-3 text-[13px]">
                    <span className="w-32 shrink-0 truncate text-ink-2">{t.label}</span>
                    <div className="relative h-5 flex-1">
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-line" />
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-sm"
                        style={{
                          width: `${w}%`,
                          left: t.change >= 0 ? '50%' : `${50 - w}%`,
                          background: t.change >= 0 ? '#3b82f6' : '#f87171',
                        }}
                      />
                    </div>
                    <span className={cx('tabular w-24 shrink-0 text-right', t.change < 0 ? 'text-danger' : 'text-ink-2')}>
                      {t.change > 0 ? '+' : ''}
                      {num(t.change)}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[11px] text-faint">가운데 선 기준 오른쪽 증가 · 왼쪽 감소 (천원)</p>
          </Card>
        </div>

        <div className="space-y-4">
          {/* AI 도우미 */}
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkles size={16} className="text-violet" /> AI 도우미
              </span>
            }
          >
            <div className="space-y-3">
              {aiComments.map((c, i) => (
                <div key={i} className={cx('rounded-md border p-3', confirmed[i] ? 'border-[#86efac] bg-done-soft' : 'border-line')}>
                  <p className="text-[13px] font-medium text-ink">{c.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{c.text}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted">관련 조서 · {c.ref}</span>
                    {confirmed[i] ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-done">
                        <Check size={13} /> 감사인 확인
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => setConfirmed((s) => ({ ...s, [i]: true }))}>
                        확인
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <DemoNote>미리 준비한 분석 문구입니다. 실제 버전은 LLM이 증감 데이터로 분석 초안을 작성하고, 감사인이 확인·수정한 내용만 조서에 남깁니다.</DemoNote>
            </div>
          </Card>

          {/* Alphalyzer JET */}
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                Alphalyzer JET 결과 <KrTag />
              </span>
            }
          >
            <div className="flex items-center gap-2 text-xs text-muted">
              <FileSpreadsheet size={14} className="text-done" /> Alphalyzer_JET_결과_2026_1-9월.xlsx
            </div>
            <ul className="mt-3 divide-y divide-line-2">
              {[
                ['주말·공휴일 전기', 23],
                ['끝자리 000 금액', 41],
                ['수기 전표', 12],
              ].map(([l, v]) => (
                <li key={l} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="text-ink-2">{l}</span>
                  <span className="tabular font-medium text-ink">{v}건</span>
                </li>
              ))}
            </ul>
            <Link to={`/engagements/${id}/sheets?node=n-E-70`} className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
              E-70 분개 테스트 조서로 이동
            </Link>
            <div className="mt-3">
              <DemoNote>건수는 시연용 고정값입니다. 실제 버전은 Alphalyzer 결과 파일을 가져와 항목별 전표를 조서에 연결합니다.</DemoNote>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
