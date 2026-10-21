import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, CircleAlert, FileSpreadsheet, Landmark, Link2, Play, Receipt, RotateCcw, Send } from 'lucide-react'
import { Button, Card, DemoNote, EmptyState, KrTag, Modal, Td, Textarea, Th } from '@/components/ui'
import { api } from '@/data/api'
import { useClient, useEngagement, useTieoutDispositions, useTieoutRun, useUsers, useWorkflow } from '@/data/hooks'
import { loadSampleDataset, SAMPLE_CLIENT_ID, type SampleDataset } from '@/data/tieoutData'
import { runTieout, type TieoutException, type TieoutResult } from '@/domain/tieout/engine'
import type { TieoutDisposition } from '@/domain/types'
import { cx, num, wonShort } from '@/lib/format'

// 매출 전수대사: 원장 × 홈택스 전자세금계산서 × 은행 입금. 자료 → 실행 → 발견 → 요청·판단 → 조서 근거.

const STAGES = ['자료 읽기·정규화', '원장 ↔ 세금계산서 대사', '입금 ↔ 채권 매칭', '예외 분류·부가세 차이 분해']

export function TieoutPage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const client = useClient(e?.clientId)
  const run = useTieoutRun(id)
  const [data, setData] = useState<SampleDataset | null>(null)
  const [stage, setStage] = useState<number | null>(null)

  const supported = e?.clientId === SAMPLE_CLIENT_ID
  useEffect(() => {
    if (supported) loadSampleDataset().then(setData)
  }, [supported])

  const result = useMemo(() => (run && data ? runTieout(data.input) : null), [run, data])

  if (!e) return null
  if (!supported) {
    return (
      <div className="px-6 py-10">
        <EmptyState title="아직 전수대사 자료가 없습니다.">
          <p>고객 포털에서 원장(분개장)·홈택스 매출 전자세금계산서 목록·은행 거래내역 엑셀을 받으면 실행할 수 있습니다.</p>
          <p className="mt-2">시연 자료는 샘플제조㈜ 감사 업무에만 들어 있습니다.</p>
        </EmptyState>
      </div>
    )
  }

  const start = async () => {
    if (!data) return
    for (let k = 0; k < STAGES.length; k++) {
      setStage(k)
      await new Promise((r) => setTimeout(r, 550))
    }
    const t0 = performance.now()
    const res = runTieout(data.input)
    const ms = Math.max(1, Math.round(performance.now() - t0))
    await api.recordTieoutRun({ engagementId: e.id, dataset: `${client?.name} ${data.input.fiscalYear} 기말 자료`, fiscalYear: data.input.fiscalYear, ms, exceptionCount: res.exceptions.length })
    setStage(null)
  }

  const replay = e.fiscalYear !== data?.input.fiscalYear

  return (
    <div className="min-h-full bg-canvas pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-white px-6 py-5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-normal text-ink">
            매출 전수대사 <KrTag />
          </h1>
          <p className="mt-1 text-[13px] text-muted">원장 × 홈택스 전자세금계산서 × 은행 입금 — 표본이 아니라 전 거래를 세 방향으로 맞춥니다. 장부는 고치지 않습니다.</p>
          {replay && data && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
              전기({data.input.fiscalYear}) 기말 자료로 미리 실행합니다. 올해 기말 자료가 들어오면 같은 방식으로 실행됩니다. 발견 사항은 올해 감사의 요청·판단으로 이어집니다.
            </p>
          )}
        </div>
        {run && result && <ResultActions engagementId={e.id} company={data!.input.company} fy={data!.input.fiscalYear} onRerun={start} />}
      </div>

      {!data ? (
        <p className="px-6 py-10 text-muted">자료를 불러오는 중…</p>
      ) : stage !== null ? (
        <Running stage={stage} data={data} />
      ) : !run || !result ? (
        <BeforeRun data={data} onRun={start} locked={!!e.archivedDate} />
      ) : (
        <Results engagementId={e.id} data={data} result={result} ms={run.ms} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 실행 전: 자료 3종

function sourceStats(data: SampleDataset) {
  const i = data.input
  const fy = String(i.fiscalYear)
  const sales = i.journal.filter((r) => r.acct === '108' && r.dr && r.date.startsWith(fy))
  const inv = i.invoices.filter((x) => x.wdate.startsWith(fy))
  const deps = i.bank.filter((b) => b.in)
  return [
    { icon: <BookOpen size={20} />, title: '회사 원장', sub: '분개장 (더존 형식)', n: sales.length, unit: '건 매출 전표', amt: sales.reduce((a, r) => a + r.dr, 0), files: i.files[0].names },
    { icon: <Receipt size={20} />, title: '홈택스 전자세금계산서', sub: '매출 목록조회 내려받기', n: inv.length, unit: '건 발행', amt: inv.reduce((a, x) => a + x.total, 0), files: i.files[1].names },
    { icon: <Landmark size={20} />, title: '은행 거래내역', sub: 'KB국민 보통예금 (기말 후 2개월 포함)', n: deps.length, unit: '건 입금', amt: deps.reduce((a, b) => a + b.in, 0), files: i.files[2].names },
  ]
}

function BeforeRun({ data, onRun, locked }: { data: SampleDataset; onRun: () => void; locked: boolean }) {
  const c = data.asis.coverage
  return (
    <div className="mx-auto max-w-[1100px] px-6 pt-8">
      <div className="grid gap-4 md:grid-cols-3">
        {sourceStats(data).map((s) => (
          <section key={s.title} className="rounded-xl border border-line bg-white p-5">
            <div className="mb-3 flex items-center gap-2 text-brand">
              {s.icon}
              <span className="text-[15px] font-semibold text-ink">{s.title}</span>
            </div>
            <p className="text-xs text-muted">{s.sub}</p>
            <p className="mt-3 text-2xl font-light text-ink tabular">
              {num(s.n)}
              <span className="ml-1 text-sm text-muted">{s.unit}</span>
            </p>
            <p className="text-[13px] text-ink-2">{wonShort(s.amt)}</p>
            <ul className="mt-3 space-y-1 border-t border-line-2 pt-3">
              {s.files.map((f) => (
                <li key={f} className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <FileSpreadsheet size={13} className="shrink-0 text-[#217346]" /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-done">
              <Check size={12} /> 고객 포털로 제출됨
            </p>
          </section>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button variant="primary" className="h-12 px-8 text-base" icon={<Play size={18} />} onClick={onRun} disabled={locked}>
          전 거래 3방향 대사 실행
        </Button>
        {locked && <p className="text-xs text-danger">조서가 잠긴 업무입니다. 진행 중인 감사에서 실행하세요.</p>}
        <p className="text-[13px] text-muted">
          지금 방식: 매출 {num(c.pop_n)}건 중 표본 <b className="font-medium text-ink">{c.asis_vouch_n}건</b>({Math.round((c.asis_vouch_amt / c.pop_amt) * 100)}%)만 증빙 대조
        </p>
      </div>
    </div>
  )
}

function Running({ stage, data }: { stage: number; data: SampleDataset }) {
  const stats = sourceStats(data)
  return (
    <div className="mx-auto max-w-[620px] px-6 pt-16">
      <div className="rounded-xl border border-line bg-white p-8">
        <p className="mb-6 text-center text-lg text-ink">
          {num(stats[0].n)}건 × {num(stats[1].n)}건 × {num(stats[2].n)}건 대사 중…
        </p>
        <ol className="space-y-3">
          {STAGES.map((s, k) => (
            <li key={s} className={cx('flex items-center gap-3 text-sm', k > stage && 'text-faint')}>
              <span
                className={cx(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  k < stage ? 'bg-done text-white' : k === stage ? 'animate-pulse bg-brand text-white' : 'bg-line text-muted',
                )}
              >
                {k < stage ? <Check size={13} /> : k + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 결과

function ResultActions({ engagementId, company, fy, onRerun }: { engagementId: string; company: string; fy: number; onRerun: () => void }) {
  const nodes = useWorkflow(engagementId)
  const e61 = nodes.find((n) => n.code === 'E-61')
  const linked = !!e61?.evidence.some((x) => x.locator.startsWith('KT-05'))
  return (
    <div className="flex items-center gap-2">
      <Button icon={<RotateCcw size={15} />} onClick={onRerun}>
        다시 실행
      </Button>
      {linked && e61 ? (
        <Link to={`/engagements/${engagementId}/sheets?node=${e61.id}`}>
          <Button icon={<Link2 size={15} />}>매출 조서 보기</Button>
        </Link>
      ) : (
        <Button variant="primary" icon={<Link2 size={15} />} onClick={() => api.linkTieoutToWorkpaper(engagementId, `K-Tieout_전수대사_결과_${company}_${fy}.xlsx`)}>
          조서에 근거로 연결
        </Button>
      )}
    </div>
  )
}

type Tab = 'exceptions' | 'vat' | 'customers' | 'cutoff' | 'rows' | 'deposits'

function Results({ engagementId, data, result: r, ms }: { engagementId: string; data: SampleDataset; result: TieoutResult; ms: number }) {
  const [tab, setTab] = useState<Tab>('exceptions')
  const dispositions = useTieoutDispositions(engagementId)
  const s = r.summary
  const vatDiff = r.vat.ledger.reduce((a, b) => a + b, 0) - r.vat.return.reduce((a, b) => a + b, 0)
  const done = dispositions.filter((d) => d.status === 'concluded').length
  const tabs: [Tab, string][] = [
    ['exceptions', `검토 필요 (${r.exceptions.length})`],
    ['vat', '부가세 대사'],
    ['customers', '거래처별 채권'],
    ['cutoff', `기간귀속 (${r.cutoff.length})`],
    ['rows', `전 건 대사표 (${s.ledgerSales})`],
    ['deposits', `입금 매칭 (${s.deposits})`],
  ]

  return (
    <div className="space-y-5 px-6 pt-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="전 건 대사" value={`${num(s.ledgerSales)}건`} sub={`${wonShort(s.ledgerAmount)} · ${ms}ms`} />
        <Metric label="3방향 일치 (원장·세금계산서·입금)" value={`${num(s.matchedPaid)}건`} sub={`${((s.matchedPaid / s.ledgerSales) * 100).toFixed(1)}% · ${wonShort(s.matchedPaidAmount)}`} />
        <Metric label="검토 필요" value={`${r.exceptions.length}건`} sub={`판단 기록 ${done}/${r.exceptions.length}`} tone="danger" />
        <Metric label="부가세 신고 vs 장부 차이" value={wonShort(vatDiff)} sub={r.vat.unexplained === 0 ? '원인 100% 분해 · 미설명 0원' : `미설명 ${num(r.vat.unexplained)}원`} tone="done" />
      </div>

      <AsisCompare data={data} />

      <section className="rounded-lg border border-line bg-white">
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('h-11 shrink-0 border-b-2 px-3 text-[13px]', tab === k ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted hover:text-ink-2')}>
              {l}
            </button>
          ))}
        </nav>
        <div className="p-4">
          {tab === 'exceptions' && <ExceptionsTable engagementId={engagementId} items={r.exceptions} dispositions={dispositions} />}
          {tab === 'vat' && <VatTable r={r} />}
          {tab === 'customers' && <CustomersTable r={r} />}
          {tab === 'cutoff' && <CutoffTable r={r} />}
          {tab === 'rows' && <RowsTable r={r} />}
          {tab === 'deposits' && <DepositsTable r={r} />}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'danger' | 'done' }) {
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx('mt-1 text-[28px] font-light tabular', tone === 'danger' ? 'text-danger' : tone === 'done' ? 'text-done' : 'text-ink')}>{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  )
}

function AsisCompare({ data }: { data: SampleDataset }) {
  const a = data.asis
  const found = (v: string) => v === '발견'
  const asisFound = a.anomalies.filter((x) => found(x.asis)).length
  const c = a.coverage
  const pctVouch = Math.round((c.asis_vouch_amt / c.pop_amt) * 100)
  return (
    <Card title={<span className="flex items-center gap-2">표본 방식이었다면? <span className="text-xs font-normal text-muted">시연 자료에 심어 둔 이상거래 {a.anomalies.length}건 기준</span></span>}>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 flex justify-between text-[13px] text-ink-2">
              <span>지금 방식 (표본 {c.asis_vouch_n}건)</span>
              <b className="font-semibold text-ink">{asisFound}건 발견</b>
            </p>
            <div className="flex h-3 overflow-hidden rounded-full bg-line">
              <div className="bg-amber-400" style={{ width: `${(asisFound / a.anomalies.length) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">증빙 대조 범위: 매출 금액의 {pctVouch}%</p>
          </div>
          <div>
            <p className="mb-1.5 flex justify-between text-[13px] text-ink-2">
              <span>전수대사</span>
              <b className="font-semibold text-done">{a.anomalies.length}건 발견</b>
            </p>
            <div className="h-3 rounded-full bg-done" />
            <p className="mt-1 text-xs text-muted">대조 범위: 매출 전 건 100% · 오탐 0건</p>
          </div>
          <DemoNote>엔진은 이 가상 자료로 조정됐습니다. 실제 회사 자료에서의 성능은 파일럿에서 측정합니다.</DemoNote>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">심어 둔 이상거래</th>
              <th className="pb-2 font-medium">금액</th>
              <th className="pb-2 font-medium">표본 방식</th>
              <th className="pb-2 font-medium">전수대사</th>
            </tr>
          </thead>
          <tbody>
            {a.anomalies.map((x) => (
              <tr key={x.id} className="border-t border-line-2" title={x.asis_why}>
                <td className="py-1.5 pr-3">
                  <span className="text-ink">{x.type}</span>
                  <span className="block text-xs text-muted">{x.desc}</span>
                </td>
                <td className="tabular py-1.5 pr-3 whitespace-nowrap">{num(x.amount)}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  <span className={cx('rounded px-1.5 py-0.5 text-xs', found(x.asis) ? 'bg-green-50 text-green-700' : x.asis === '미발견' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{x.asis}</span>
                </td>
                <td className="py-1.5 whitespace-nowrap">
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">발견 {x.tobe_no}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const riskCls: Record<string, string> = {
  '매우 높음': 'bg-red-600 text-white',
  높음: 'bg-red-50 text-red-700',
  중간: 'bg-amber-50 text-amber-700',
}

const judgmentTemplate = (x: TieoutException) =>
  x.kind.startsWith('기간귀속')
    ? '출고증·인수증 확인 결과 실제 인도일 ____ → 귀속연도 ____. 수정 필요 금액 ____원 (회사 수정 여부: ____)'
    : x.kind.includes('입금')
      ? '입금자와 매출처 관계 확인: ____ (특수관계 여부 ____). 실재성에 대한 결론: ____'
      : x.kind === '장기 미회수'
        ? '회수 가능성 검토: ____. 대손충당금 적정성 결론: ____'
        : '회사 소명·증빙 확인 결과: ____. 왜곡표시 금액 ____원, 수정 필요 여부: ____'

function ExceptionsTable({ engagementId, items, dispositions }: { engagementId: string; items: TieoutException[]; dispositions: TieoutDisposition[] }) {
  const users = useUsers()
  const [judge, setJudge] = useState<TieoutException | null>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState<string | null>(items[0]?.no ?? null)
  const disp = (no: string) => dispositions.find((d) => d.exNo === no)

  return (
    <>
      <table className="w-full">
        <thead>
          <tr>
            <Th className="pl-0">No</Th>
            <Th>유형</Th>
            <Th>경영진 주장</Th>
            <Th>위험</Th>
            <Th>거래처</Th>
            <Th className="text-right">금액(원)</Th>
            <Th>처리</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {items.map((x) => {
            const d = disp(x.no)
            const expanded = open === x.no
            return [
              <tr key={x.no} onClick={() => setOpen(expanded ? null : x.no)} className="cursor-pointer hover:bg-canvas">
                <Td className="pl-0 font-mono text-xs">{x.no}</Td>
                <Td className="font-medium text-ink">{x.kind}</Td>
                <Td>{x.assertion}</Td>
                <Td>
                  <span className={cx('rounded px-1.5 py-0.5 text-xs', riskCls[x.risk])}>{x.risk}</span>
                </Td>
                <Td>{x.custName}</Td>
                <Td className="tabular text-right">{num(x.amount)}</Td>
                <Td>
                  {d?.status === 'concluded' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-done">
                      <Check size={13} /> 판단 기록
                    </span>
                  ) : d?.status === 'requested' ? (
                    <span className="text-xs text-brand">회사 확인 중</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-danger">
                      <CircleAlert size={13} /> 미처리
                    </span>
                  )}
                </Td>
                <Td className="text-right text-xs text-muted">{expanded ? '접기' : '자세히'}</Td>
              </tr>,
              expanded && (
                <tr key={x.no + '-d'}>
                  <td colSpan={8} className="border-t border-line-2 bg-canvas px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                      <div className="space-y-2 text-[13px]">
                        <p className="text-ink">{x.detail}</p>
                        <p className="text-ink-2">
                          <b className="font-medium">권고 확인 절차</b> · {x.action}
                        </p>
                        <p className="flex flex-wrap gap-x-4 text-xs text-muted">
                          {x.ledger && <span>원장 {x.ledger}</span>}
                          {x.appr && <span>세금계산서 {x.appr}</span>}
                          {x.deposit && <span>입금 {x.deposit}</span>}
                        </p>
                        {d?.judgment && (
                          <p className="rounded-md bg-white px-3 py-2 text-ink-2">
                            <span className="text-xs text-muted">
                              {users.find((u) => u.id === d.by)?.name} · {d.at.slice(0, 10)} 판단
                            </span>
                            <br />
                            {d.judgment}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {d?.status !== 'concluded' && (
                          <>
                            <Button
                              icon={<Send size={14} />}
                              disabled={d?.status === 'requested'}
                              onClick={() =>
                                api.requestFromException(engagementId, x.no, `[${x.no}] ${x.kind} · ${x.custName || '거래처 미상'}`, `${x.detail}\n\n확인 요청: ${x.action}`)
                              }
                            >
                              {d?.status === 'requested' ? '회사에 확인 요청함' : '회사에 확인 요청 (고객 포털)'}
                            </Button>
                            <Button
                              variant="primary"
                              icon={<Check size={14} />}
                              onClick={() => {
                                setJudge(x)
                                setText(judgmentTemplate(x))
                              }}
                            >
                              판단 기록
                            </Button>
                          </>
                        )}
                        {d?.requestId && (
                          <Link to={`/engagements/${engagementId}/requests`} className="inline-flex items-center gap-1 text-xs text-brand">
                            자료 요청 보기 <ArrowRight size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
      <Modal
        open={!!judge}
        onClose={() => setJudge(null)}
        title={judge ? `${judge.no} 판단 기록` : ''}
        footer={
          <>
            <Button onClick={() => setJudge(null)}>취소</Button>
            <Button
              variant="primary"
              disabled={!text.trim() || text.includes('____')}
              onClick={async () => {
                if (judge) await api.concludeException(engagementId, judge.no, text.trim())
                setJudge(null)
              }}
            >
              기록
            </Button>
          </>
        }
      >
        {judge && (
          <div className="space-y-3 text-[13px]">
            <p className="text-ink-2">{judge.detail}</p>
            <Textarea rows={5} value={text} onChange={(ev) => setText(ev.target.value)} />
            <p className="text-xs text-muted">밑줄(____)을 모두 채워야 저장됩니다. 판단의 주체는 회계사이며, 기록은 활동 이력과 감리 모의고사에 반영됩니다.</p>
          </div>
        )}
      </Modal>
    </>
  )
}

const Q = ['1/4분기', '2/4분기', '3/4분기', '4/4분기']

function VatTable({ r }: { r: TieoutResult }) {
  const lines: [string, number[]][] = [
    ['부가세 신고 (과세 세금계산서)', r.vat.return],
    ['홈택스 발급분 (작성일 기준)', r.vat.hometax],
    ['손익계산서 매출 (원장 404)', r.vat.ledger],
    ['차이 (원장 − 신고)', r.vat.ledger.map((g, k) => g - r.vat.return[k])],
  ]
  const explained = [0, 1, 2, 3].map((k) => r.vat.items.reduce((a, i) => a + i.quarters[k], 0))
  const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  return (
    <div className="space-y-6">
      <p className="text-[13px] text-ink-2">
        지금 방식은 분기 합계 차이만 확인하고 원인은 회사 소명에 의존합니다. 전수대사는 차이를 건별로 분해해 검토 필요 항목과 연결합니다. <span className="text-xs text-muted">(한공회 부가세대사표 4000P-2 형식)</span>
      </p>
      <table className="w-full">
        <thead>
          <tr>
            <Th className="pl-0">공급가액</Th>
            {Q.map((q) => (
              <Th key={q} className="text-right">
                {q}
              </Th>
            ))}
            <Th className="text-right">계</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map(([l, v], k) => (
            <tr key={l} className={k === 3 ? 'bg-canvas font-semibold' : ''}>
              <Td className="pl-0">{l}</Td>
              {v.map((n, i) => (
                <Td key={i} className="tabular text-right">
                  {num(n)}
                </Td>
              ))}
              <Td className="tabular text-right">{num(total(v))}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">차이 원인 분해</h3>
        <table className="w-full">
          <tbody>
            {r.vat.items.map((i) => (
              <tr key={i.no}>
                <Td className="pl-0">
                  <span className="mr-2 font-mono text-xs text-muted">{i.no}</span>
                  {i.label}
                </Td>
                {i.quarters.map((n, k) => (
                  <Td key={k} className="tabular text-right text-muted">
                    {n ? num(n) : ''}
                  </Td>
                ))}
                <Td className="tabular text-right">{num(i.total)}</Td>
              </tr>
            ))}
            <tr className="bg-canvas font-semibold">
              <Td className="pl-0">설명된 차이 합계</Td>
              {explained.map((n, k) => (
                <Td key={k} className="tabular text-right">
                  {num(n)}
                </Td>
              ))}
              <Td className="tabular text-right">{num(total(explained))}</Td>
            </tr>
            <tr className={r.vat.unexplained === 0 ? 'bg-done-soft' : 'bg-danger-soft'}>
              <Td className="pl-0 font-semibold">미설명 차이</Td>
              <Td colSpan={4} />
              <Td className="tabular text-right font-semibold">{num(r.vat.unexplained)}</Td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CustomersTable({ r }: { r: TieoutResult }) {
  const rows = [...r.perCustomer].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  return (
    <>
      <p className="mb-3 text-[13px] text-ink-2">증빙 기준 잔액 = 전기이월 + 세금계산서(수정 반영) − 기말까지 입금. 채권 조회서 회신 차이의 원인 설명에 바로 씁니다. (4000C-2 형식)</p>
      <table className="w-full">
        <thead>
          <tr>
            <Th className="pl-0">거래처</Th>
            <Th className="text-right">장부 잔액</Th>
            <Th className="text-right">증빙 기준 잔액</Th>
            <Th className="text-right">차이</Th>
            <Th>관련 No</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.cust} className={p.diff ? 'bg-amber-50/50' : ''}>
              <Td className="pl-0">{p.name}</Td>
              <Td className="tabular text-right">{num(p.ledger)}</Td>
              <Td className="tabular text-right">{num(p.evidence)}</Td>
              <Td className={cx('tabular text-right', p.diff !== 0 && 'font-semibold text-danger')}>{num(p.diff)}</Td>
              <Td className="text-xs">{p.reasons.join(', ')}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function CutoffTable({ r }: { r: TieoutResult }) {
  return (
    <>
      <p className="mb-3 text-[13px] text-ink-2">결산일 전후 한 달의 원장 매출 전 건을 세금계산서 작성일과 대조했습니다. (지금 방식은 표본 17건 수준, 4000P-5 형식)</p>
      <table className="w-full">
        <thead>
          <tr>
            <Th className="pl-0">전표일</Th>
            <Th>거래처</Th>
            <Th>내역</Th>
            <Th className="text-right">금액</Th>
            <Th>세금계산서 작성일</Th>
            <Th>회계기간</Th>
          </tr>
        </thead>
        <tbody>
          {r.cutoff.map((c, k) => (
            <tr key={k} className={c.ok ? '' : 'bg-danger-soft'}>
              <Td className="tabular pl-0">{c.date}</Td>
              <Td>{c.custName}</Td>
              <Td className="max-w-[260px] truncate">{c.memo}</Td>
              <Td className="tabular text-right">{num(c.amount)}</Td>
              <Td className="tabular">{c.invDate}</Td>
              <Td className={c.ok ? 'text-done' : 'font-semibold text-danger'}>{c.ok ? '일치' : '불일치'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Paged<T>({ items, render, head }: { items: T[]; render: (x: T) => ReactNode; head: ReactNode }) {
  const [page, setPage] = useState(0)
  const size = 50
  const pages = Math.ceil(items.length / size)
  return (
    <>
      <table className="w-full">
        <thead>{head}</thead>
        <tbody>{items.slice(page * size, page * size + size).map(render)}</tbody>
      </table>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
        <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
          이전
        </Button>
        {page + 1} / {pages}
        <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
          다음
        </Button>
      </div>
    </>
  )
}

function RowsTable({ r }: { r: TieoutResult }) {
  const [onlyFlag, setOnlyFlag] = useState(false)
  const rows = onlyFlag ? r.rows.filter((x) => !x.ok) : r.rows
  return (
    <>
      <label className="mb-3 flex items-center gap-2 text-[13px] text-ink-2">
        <input type="checkbox" checked={onlyFlag} onChange={(e) => setOnlyFlag(e.target.checked)} /> 3방향 일치하지 않는 건만 ({r.rows.filter((x) => !x.ok).length})
      </label>
      <Paged
        items={rows}
        head={
          <tr>
            <Th className="pl-0">원장 ID</Th>
            <Th>전표일</Th>
            <Th>거래처</Th>
            <Th className="text-right">원장 금액</Th>
            <Th>세금계산서</Th>
            <Th>입금</Th>
            <Th>대사 규칙</Th>
            <Th>Tick</Th>
          </tr>
        }
        render={(x) => (
          <tr key={x.ledgerId} className={x.ok ? '' : 'bg-danger-soft/60'}>
            <Td className="pl-0 font-mono text-xs">{x.ledgerId}</Td>
            <Td className="tabular">{x.date}</Td>
            <Td>{x.custName}</Td>
            <Td className="tabular text-right">{num(x.amount)}</Td>
            <Td className="text-xs">{x.invDate ? `${x.invDate} · ${num(x.invAmount ?? 0)}` : '—'}</Td>
            <Td className="text-xs">{x.payment || '—'}</Td>
            <Td className="text-xs">{x.rule}</Td>
            <Td className="text-done">{x.ok ? '√√√' : ''}</Td>
          </tr>
        )}
      />
    </>
  )
}

function DepositsTable({ r }: { r: TieoutResult }) {
  const flag = (rule: string) => ['제3자 입금 의심', '미확인 입금', '미배정(거래처 확인됨)'].includes(rule)
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(r.rules)
          .filter(([k]) => k.startsWith('입금'))
          .map(([k, v]) => (
            <span key={k} className="rounded-full bg-canvas px-2.5 py-1 text-xs text-ink-2">
              {k.replace('입금-채권: ', '')} <b className="font-semibold">{v}</b>
            </span>
          ))}
      </div>
      <Paged
        items={r.depositRows}
        head={
          <tr>
            <Th className="pl-0">입금 ID</Th>
            <Th>거래일시</Th>
            <Th>기재내용</Th>
            <Th className="text-right">금액</Th>
            <Th>식별 거래처</Th>
            <Th>매칭 규칙</Th>
          </tr>
        }
        render={(d) => (
          <tr key={d.id} className={flag(d.rule) ? 'bg-danger-soft/60' : ''}>
            <Td className="pl-0 font-mono text-xs">{d.id}</Td>
            <Td className="tabular text-xs">{d.dt}</Td>
            <Td>{d.memo}</Td>
            <Td className="tabular text-right">{num(d.amount)}</Td>
            <Td>{d.custName || '—'}</Td>
            <Td className="text-xs">{d.rule}</Td>
          </tr>
        )}
      />
    </>
  )
}

