import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Check, CircleAlert, Download, FileSpreadsheet, Landmark, Link2, Play, Receipt, RotateCcw, Send, ShoppingCart, Upload, X as XIcon } from 'lucide-react'
import { Button, Card, DemoNote, KrTag, Modal, Td, Textarea, Th } from '@/components/ui'
import { api } from '@/data/api'
import { useClient, useEngagement, useTieoutDispositions, useTieoutRun, useUsers, useWorkflow } from '@/data/hooks'
import {
  loadSampleDataset,
  parseFiles,
  SAMPLE_CLIENT_ID,
  SAMPLE_FILES,
  sampleUrl,
  setTieoutData,
  toDataset,
  useTieoutData,
  type AsisComparison,
  type TieoutDataset,
} from '@/data/tieoutData'
import { runTieout, type TieoutException, type TieoutResult } from '@/domain/tieout/engine'
import { runPurchaseTieout, type PurchaseResult } from '@/domain/tieout/purchase'
import { kindLabel, requiredKinds, type ParsedFile } from '@/domain/tieout/parsers'
import type { TieoutDisposition } from '@/domain/types'
import { cx, num, wonShort } from '@/lib/format'

// 전수대사: 매출(원장 × 홈택스 × 은행 입금)과 매입(원장 × 홈택스 매입 × 은행 출금).
// 자료(엑셀 업로드 또는 시연 자료) → 실행 → 발견 → 회사 확인 요청·판단 기록 → 조서 근거.

const STAGES = ['엑셀 읽기·형식 판별', '원장 ↔ 세금계산서 대사', '입금·출금 ↔ 채권·채무 매칭', '예외 분류·부가세 차이 분해']

export function TieoutPage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const client = useClient(e?.clientId)
  const run = useTieoutRun(id)
  const data = useTieoutData((s) => (id ? s[id] : undefined))
  const [stage, setStage] = useState<number | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const isSampleClient = e?.clientId === SAMPLE_CLIENT_ID

  // 시연 자료로 실행했던 업무는 새로고침 후 자료를 다시 불러온다(업로드 자료는 다시 올려야 함)
  useEffect(() => {
    // source가 없는 예전 기록은 시연 자료로 실행된 것이다
    if (id && run && run.source !== 'upload' && !data && !restoring && !loadError) {
      setRestoring(true)
      loadSampleDataset()
        .then((d) => setTieoutData(id, d))
        .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)))
        .finally(() => setRestoring(false))
    }
  }, [id, run, data, restoring, loadError])

  const sales = useMemo(() => (run && data ? runTieout(data.input) : null), [run, data])
  const purchase = useMemo(() => (run && data?.purchase ? runPurchaseTieout(data.purchase) : null), [run, data])

  if (!e) return null

  const start = async (d: TieoutDataset) => {
    setTieoutData(e.id, d)
    for (let k = 0; k < STAGES.length; k++) {
      setStage(k)
      await new Promise((r) => setTimeout(r, 500))
    }
    const t0 = performance.now()
    const rs = runTieout(d.input)
    const rp = d.purchase ? runPurchaseTieout(d.purchase) : null
    const ms = Math.max(1, Math.round(performance.now() - t0))
    await api.recordTieoutRun({
      engagementId: e.id,
      dataset: `${d.input.company} ${d.input.fiscalYear} 기말 자료 (${d.source === 'sample' ? '시연 자료' : `업로드 ${d.files.length}개 파일`})`,
      source: d.source,
      fiscalYear: d.input.fiscalYear,
      ms,
      exceptionCount: rs.exceptions.length + (rp?.exceptions.length ?? 0),
    })
    setStage(null)
  }

  const replay = data && e.fiscalYear !== data.input.fiscalYear

  return (
    <div className="min-h-full bg-canvas pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-white px-6 py-5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-normal text-ink">
            전수대사 <KrTag />
          </h1>
          <p className="mt-1 text-[13px] text-muted">회사 원장 × 홈택스 전자세금계산서 × 은행 거래내역 — 표본이 아니라 전 거래를 세 방향으로 맞춥니다. 장부는 고치지 않습니다.</p>
          {replay && data && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-800">
              {data.input.fiscalYear} 기말 자료로 실행했습니다. 발견 사항은 올해({e.fiscalYear}) 감사의 요청·판단으로 이어집니다.
            </p>
          )}
        </div>
        {run && sales && data && <ResultActions engagementId={e.id} company={data.input.company} fy={data.input.fiscalYear} onReset={() => setTieoutData(e.id, undefined)} />}
      </div>

      {stage !== null && data ? (
        <Running stage={stage} data={data} />
      ) : run && !data ? (
        run.source === 'upload' ? (
          <div className="px-6 pt-8">
            <p className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              {run.ranAt.slice(0, 10)}에 업로드 자료로 실행한 기록이 있습니다. 업로드 자료는 이 브라우저 메모리에만 있어 새로고침하면 사라집니다. 다시 올려 주세요.
            </p>
            <Sources onRun={start} locked={!!e.archivedDate} sample={isSampleClient} />
          </div>
        ) : loadError ? (
          <div className="px-6 py-10">
            <p className="mb-3 text-[13px] text-danger">시연 자료를 불러오지 못했습니다: {loadError}</p>
            <Button icon={<RotateCcw size={15} />} onClick={() => setLoadError(null)}>
              다시 시도
            </Button>
          </div>
        ) : (
          <p className="px-6 py-10 text-muted">자료를 다시 불러오는 중…</p>
        )
      ) : !run || !sales || !data ? (
        <Sources onRun={start} locked={!!e.archivedDate} sample={isSampleClient} companyName={client?.name} />
      ) : (
        <Results engagementId={e.id} data={data} sales={sales} purchase={purchase} ms={run.ms} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 자료: 엑셀 올리기 또는 시연 자료

function Sources({ onRun, locked, sample, companyName }: { onRun: (d: TieoutDataset) => void; locked: boolean; sample: boolean; companyName?: string }) {
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const { dataset, missing } = useMemo(() => (files.length ? toDataset(files, 'upload') : { dataset: null, missing: requiredKinds }), [files])

  const add = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    const parsed = await parseFiles([...list].filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name)))
    setFiles((prev) => [...prev.filter((p) => !parsed.some((x) => x.fileName === p.fileName)), ...parsed])
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-6 pt-8">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <BookOpen size={20} />, t: '회사 원장', d: '더존 분개장 내보내기 (당기 + 기말 후 2개월)' },
          { icon: <Receipt size={20} />, t: '홈택스 전자세금계산서', d: '매출·매입 목록조회 엑셀 내려받기' },
          { icon: <Landmark size={20} />, t: '은행 거래내역', d: '보통예금 거래내역 엑셀 (기말 후 2개월 포함)' },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-brand">
              {x.icon}
              <span className="text-[15px] font-semibold text-ink">{x.t}</span>
            </div>
            <p className="text-xs text-muted">{x.d}</p>
          </div>
        ))}
      </div>

      <section
        onDragOver={(ev) => {
          ev.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(ev) => {
          ev.preventDefault()
          setDrag(false)
          add(ev.dataTransfer.files)
        }}
        className={cx('rounded-xl border-2 border-dashed bg-white p-6 text-center transition-colors', drag ? 'border-brand bg-brand-soft' : 'border-line')}
      >
        <Upload size={28} className="mx-auto text-muted" />
        <p className="mt-2 text-[15px] text-ink">회사가 준 엑셀 파일을 끌어다 놓으세요</p>
        <p className="text-xs text-muted">파일 이름은 상관없습니다. 내용(제목·머리글)으로 종류를 알아봅니다. 파일은 이 브라우저 안에서만 읽고 서버로 보내지 않습니다.</p>
        <input ref={input} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={(ev) => add(ev.target.files)} />
        <Button className="mt-3" icon={<FileSpreadsheet size={15} />} onClick={() => input.current?.click()}>
          파일 선택
        </Button>
        {busy && <p className="mt-2 text-xs text-brand">읽는 중…</p>}

        {files.length > 0 && (
          <div className="mt-5 text-left">
            <table className="w-full">
              <thead>
                <tr>
                  <Th className="pl-0">파일</Th>
                  <Th>알아본 종류</Th>
                  <Th className="text-right">행</Th>
                  <Th>메모</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.fileName}>
                    <Td className="pl-0">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet size={14} className="text-[#217346]" /> {f.fileName}
                      </span>
                    </Td>
                    <Td className={f.kind === 'unknown' ? 'text-muted' : 'text-ink'}>{f.kind === 'unknown' ? '대사에 쓰지 않는 자료' : kindLabel[f.kind]}</Td>
                    <Td className="tabular text-right">{f.count ? num(f.count) : ''}</Td>
                    <Td className="text-xs text-amber-700">{f.kind === 'unknown' ? '' : f.warnings.join(' ')}</Td>
                    <Td className="text-right">
                      <button aria-label="빼기" onClick={() => setFiles(files.filter((x) => x !== f))} className="text-faint hover:text-ink-2">
                        <XIcon size={14} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px]">
                {missing.length ? (
                  <span className="text-danger">아직 필요한 자료: {missing.map((k) => kindLabel[k]).join(', ')}</span>
                ) : (
                  <span className="text-done">
                    매출 대사 준비됨{dataset?.purchase ? ' · 매입 대사 준비됨' : ' · 매입 목록이 없어 매입 대사는 건너뜀'}
                  </span>
                )}
              </p>
              <Button variant="primary" icon={<Play size={16} />} disabled={!dataset || locked} onClick={() => dataset && onRun(dataset)}>
                올린 자료로 대사 실행
              </Button>
            </div>
          </div>
        )}
      </section>

      {sample ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
          <div>
            <p className="text-[15px] font-medium text-ink">시연 자료로 바로 실행</p>
            <p className="text-[13px] text-muted">
              {companyName ?? '샘플제조㈜'} 2025년 기말 가상 자료 엑셀 {SAMPLE_FILES.length}개 (매출·매입 이상거래가 심어져 있음). 같은 파일을 내려받아 위에 올려 볼 수도 있습니다.
            </p>
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer text-brand">샘플 엑셀 내려받기</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {SAMPLE_FILES.map((f) => (
                  <li key={f}>
                    <a href={sampleUrl(f)} download className="inline-flex items-center gap-1 hover:text-brand">
                      <Download size={12} /> {f}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
          <Button variant="primary" className="h-11 px-6" icon={<Play size={17} />} disabled={busy || locked} onClick={async () => {
            setBusy(true)
            const d = await loadSampleDataset()
            setBusy(false)
            onRun(d)
          }}>
            시연 자료로 전수대사 실행
          </Button>
        </section>
      ) : (
        <DemoNote>시연 자료는 샘플제조㈜ 업무에만 있습니다. 이 업무는 회사가 준 엑셀을 위에 올려 실행하세요.</DemoNote>
      )}
      {locked && <p className="text-center text-xs text-danger">조서가 잠긴 업무입니다. 진행 중인 감사에서 실행하세요.</p>}
    </div>
  )
}

function Running({ stage, data }: { stage: number; data: TieoutDataset }) {
  const fy = String(data.input.fiscalYear)
  const nSales = data.input.journal.filter((r) => r.acct === '108' && r.dr && r.date.startsWith(fy)).length
  return (
    <div className="mx-auto max-w-[620px] px-6 pt-16">
      <div className="rounded-xl border border-line bg-white p-8">
        <p className="mb-6 text-center text-lg text-ink">
          매출 {num(nSales)}건 × 세금계산서 {num(data.input.invoices.length + (data.purchase?.invoices.length ?? 0))}건 × 은행 {num(data.input.bank.length)}건 대사 중…
        </p>
        <ol className="space-y-3">
          {STAGES.map((s, k) => (
            <li key={s} className={cx('flex items-center gap-3 text-sm', k > stage && 'text-faint')}>
              <span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-xs', k < stage ? 'bg-done text-white' : k === stage ? 'animate-pulse bg-brand text-white' : 'bg-line text-muted')}>
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

function ResultActions({ engagementId, company, fy, onReset }: { engagementId: string; company: string; fy: number; onReset: () => void }) {
  const nodes = useWorkflow(engagementId)
  const e61 = nodes.find((n) => n.code === 'E-61')
  const linked = !!e61?.evidence.some((x) => x.locator.startsWith('KT-05'))
  return (
    <div className="flex items-center gap-2">
      <Button icon={<RotateCcw size={15} />} onClick={onReset}>
        자료 다시 올리기
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

function Results({ engagementId, data, sales, purchase, ms }: { engagementId: string; data: TieoutDataset; sales: TieoutResult; purchase: PurchaseResult | null; ms: number }) {
  const [side, setSide] = useState<'sales' | 'purchase'>('sales')
  return (
    <div className="space-y-5 px-6 pt-5">
      <div className="inline-flex rounded-lg border border-line bg-white p-1">
        {(
          [
            ['sales', '매출', <Receipt key="s" size={15} />, sales.exceptions.length],
            ['purchase', '매입 · 미기록 부채', <ShoppingCart key="p" size={15} />, purchase?.exceptions.length],
          ] as const
        ).map(([k, l, icon, n]) => (
          <button
            key={k}
            disabled={k === 'purchase' && !purchase}
            onClick={() => setSide(k)}
            className={cx('flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] disabled:opacity-40', side === k ? 'bg-ink font-medium text-white' : 'text-ink-2 hover:bg-canvas')}
          >
            {icon} {l}
            {n !== undefined && <span className={cx('rounded-full px-1.5 text-[11px]', side === k ? 'bg-white/20' : 'bg-red-50 text-red-700')}>{n}</span>}
          </button>
        ))}
      </div>
      {side === 'sales' ? <SalesResults engagementId={engagementId} asis={data.asis} result={sales} ms={ms} /> : purchase && <PurchaseResults engagementId={engagementId} result={purchase} truth={data.purchaseTruth} />}
    </div>
  )
}

function SalesResults({ engagementId, asis, result: r, ms }: { engagementId: string; asis?: AsisComparison; result: TieoutResult; ms: number }) {
  const [tab, setTab] = useState<Tab>('exceptions')
  const dispositions = useTieoutDispositions(engagementId)
  const s = r.summary
  const vatDiff = r.vat.ledger.reduce((a, b) => a + b, 0) - r.vat.return.reduce((a, b) => a + b, 0)
  const done = dispositions.filter((d) => d.status === 'concluded' && d.exNo.startsWith('EX')).length
  const tabs: [Tab, string][] = [
    ['exceptions', `검토 필요 (${r.exceptions.length})`],
    ['vat', '부가세 대사'],
    ['customers', '거래처별 채권'],
    ['cutoff', `기간귀속 (${r.cutoff.length})`],
    ['rows', `전 건 대사표 (${s.ledgerSales})`],
    ['deposits', `입금 매칭 (${s.deposits})`],
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="매출 전 건 대사" value={`${num(s.ledgerSales)}건`} sub={`${wonShort(s.ledgerAmount)} · ${ms}ms`} />
        <Metric label="3방향 일치 (원장·세금계산서·입금)" value={`${num(s.matchedPaid)}건`} sub={`${((s.matchedPaid / s.ledgerSales) * 100).toFixed(1)}% · ${wonShort(s.matchedPaidAmount)}`} />
        <Metric label="검토 필요" value={`${r.exceptions.length}건`} sub={`판단 기록 ${done}/${r.exceptions.length}`} tone="danger" />
        <Metric label="부가세 신고 vs 장부 차이" value={wonShort(vatDiff)} sub={r.vat.unexplained === 0 ? '원인 100% 분해 · 미설명 0원' : `미설명 ${num(r.vat.unexplained)}원`} tone="done" />
      </div>

      {asis && <AsisCompare asis={asis} />}

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

function AsisCompare({ asis: a }: { asis: AsisComparison }) {
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


// ---------------------------------------------------------------- 매입 · 미기록 부채

type PTab = 'exceptions' | 'subsequent' | 'suppliers' | 'vat' | 'rows'

function PurchaseResults({ engagementId, result: r, truth }: { engagementId: string; result: PurchaseResult; truth?: import('@/data/tieoutData').PurchaseTruth }) {
  const [tab, setTab] = useState<PTab>('exceptions')
  const dispositions = useTieoutDispositions(engagementId)
  const s = r.summary
  const hidden = r.exceptions.filter((x) => x.kind.includes('미기록') || x.kind.startsWith('기간귀속') || x.kind.startsWith('세금계산서O'))
  const hiddenAmt = hidden.reduce((a, x) => a + Math.abs(x.amount), 0)
  const done = dispositions.filter((d) => d.status === 'concluded' && d.exNo.startsWith('PX')).length
  const flagged = r.subsequent.filter((x) => x.verdict === '당기 귀속 · 장부 미계상' || x.verdict === '대응 매입 없음')
  const tabs: [PTab, string][] = [
    ['exceptions', `검토 필요 (${r.exceptions.length})`],
    ['subsequent', `후속기간 지급 검토 (${r.subsequent.length})`],
    ['suppliers', '공급자별 미지급금'],
    ['vat', '매입 공급가액 대사'],
    ['rows', `전 건 대사표 (${s.ledgerPurchases})`],
  ]
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="매입 전 건 대사" value={`${num(s.ledgerPurchases)}건`} sub={`${wonShort(s.ledgerAmount)} · 세금계산서 ${num(s.invoices)}건`} />
        <Metric label="장부·세금계산서 일치" value={`${num(s.matched)}건`} sub={`${((s.matched / s.ledgerPurchases) * 100).toFixed(1)}% · ${wonShort(s.matchedAmount)}`} />
        <Metric label="숨은 부채 의심 (장부에 없는 매입)" value={wonShort(hiddenAmt)} sub={`${hidden.length}건 · 감리 지적 '부외부채 테스트 미흡' 대응`} tone="danger" />
        <Metric label="검토 필요" value={`${r.exceptions.length}건`} sub={`판단 기록 ${done}/${r.exceptions.length} · 매입 차이 미설명 ${num(r.vat.unexplained)}원`} />
      </div>

      {truth && (
        <Card title={<span className="flex items-center gap-2">심어 둔 매입 이상거래 {truth.anomalies.length}건 <span className="text-xs font-normal text-muted">시연 자료 정답지 기준</span></span>}>
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
            {truth.anomalies.map((t) => (
              <div key={t.id} className="flex items-start gap-2 text-[13px]">
                <Check size={15} className="mt-0.5 shrink-0 text-done" />
                <span>
                  <b className="font-medium text-ink">{t.type}</b> <span className="text-muted">· {num(t.amount)}원</span>
                  <span className="block text-xs text-muted">{t.desc}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            지금 방식(미기록부채 검토)은 후속기간 지급 일부를 표본으로 봅니다. 국세청에 있는데 장부와 지급이 모두 없는 매입(예: 3,740만 원)은 지급 기록에서 출발하는 방식으로는 찾을 수 없습니다. 실제 자료에서의 성능은 파일럿에서 측정합니다.
          </p>
        </Card>
      )}

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
          {tab === 'subsequent' && (
            <>
              <p className="mb-3 text-[13px] text-ink-2">
                기말 후 2개월 동안 공급자에게 나간 지급 <b className="font-medium">{r.subsequent.length}건 전부</b>를 장부 매입·세금계산서와 대조했습니다.{' '}
                {flagged.length ? <span className="text-danger">당기 귀속인데 장부에 없는 건 {flagged.length}건</span> : '모두 설명됨'}
              </p>
              <table className="w-full">
                <thead>
                  <tr>
                    <Th className="pl-0">지급일</Th>
                    <Th>지급처</Th>
                    <Th className="text-right">금액</Th>
                    <Th>장부 매입일</Th>
                    <Th>세금계산서 작성일</Th>
                    <Th>판정</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.subsequent.map((x) => (
                    <tr key={x.ref} className={x.verdict === '당기 귀속 · 장부 미계상' || x.verdict === '대응 매입 없음' ? 'bg-danger-soft' : ''}>
                      <Td className="tabular pl-0">{x.date}</Td>
                      <Td>{x.supplier}</Td>
                      <Td className="tabular text-right">{num(x.amount)}</Td>
                      <Td className="tabular">{x.ledgerDate ?? '—'}</Td>
                      <Td className="tabular">{x.invDate ?? '—'}</Td>
                      <Td className={x.verdict.includes('미계상') || x.verdict.includes('없음') ? 'font-semibold text-danger' : x.verdict === '당기 부채로 계상됨' ? 'text-done' : 'text-muted'}>{x.verdict}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {tab === 'suppliers' && (
            <>
              <p className="mb-3 text-[13px] text-ink-2">장부(외상매입금 당기 증감) vs 증빙(세금계산서 − 은행 출금). 차이는 검토 필요 항목으로 모두 설명됩니다. 채무 조회서 회신 차이 설명에 씁니다.</p>
              <table className="w-full">
                <thead>
                  <tr>
                    <Th className="pl-0">공급자</Th>
                    <Th className="text-right">장부</Th>
                    <Th className="text-right">증빙 기준</Th>
                    <Th className="text-right">차이</Th>
                    <Th>관련 No</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.perSupplier.map((p) => (
                    <tr key={p.name} className={p.diff ? 'bg-amber-50/50' : ''}>
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
          )}
          {tab === 'vat' && (
            <table className="w-full">
              <thead>
                <tr>
                  <Th className="pl-0">매입 공급가액</Th>
                  {Q.map((q) => (
                    <Th key={q} className="text-right">
                      {q}
                    </Th>
                  ))}
                  <Th className="text-right">계</Th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['홈택스 매입 세금계산서', r.vat.hometax],
                    ['장부 매입 (외상매입금 ÷ 1.1)', r.vat.ledger],
                    ['차이 (장부 − 홈택스)', r.vat.ledger.map((g, k) => g - r.vat.hometax[k])],
                  ] as [string, number[]][]
                ).map(([l, v], k) => (
                  <tr key={l} className={k === 2 ? 'bg-canvas font-semibold' : ''}>
                    <Td className="pl-0">{l}</Td>
                    {v.map((n, i) => (
                      <Td key={i} className="tabular text-right">
                        {num(n)}
                      </Td>
                    ))}
                    <Td className="tabular text-right">{num(v.reduce((a, b) => a + b, 0))}</Td>
                  </tr>
                ))}
                {r.vat.items.map((i) => (
                  <tr key={i.no}>
                    <Td className="pl-0 text-muted" colSpan={5}>
                      <span className="mr-2 font-mono text-xs">{i.no}</span>
                      {i.label}
                    </Td>
                    <Td className="tabular text-right">{num(i.total)}</Td>
                  </tr>
                ))}
                <tr className={r.vat.unexplained === 0 ? 'bg-done-soft' : 'bg-danger-soft'}>
                  <Td className="pl-0 font-semibold" colSpan={5}>
                    미설명 차이
                  </Td>
                  <Td className="tabular text-right font-semibold">{num(r.vat.unexplained)}</Td>
                </tr>
              </tbody>
            </table>
          )}
          {tab === 'rows' && (
            <Paged
              items={r.rows}
              head={
                <tr>
                  <Th className="pl-0">원장 ID</Th>
                  <Th>전표일</Th>
                  <Th>공급자</Th>
                  <Th className="text-right">장부 금액</Th>
                  <Th>세금계산서</Th>
                  <Th>지급</Th>
                  <Th>대사</Th>
                  <Th>Tick</Th>
                </tr>
              }
              render={(x) => (
                <tr key={x.id} className={x.ok ? '' : 'bg-danger-soft/60'}>
                  <Td className="pl-0 font-mono text-xs">{x.id}</Td>
                  <Td className="tabular">{x.date}</Td>
                  <Td>{x.supplier}</Td>
                  <Td className="tabular text-right">{num(x.amount)}</Td>
                  <Td className="text-xs">{x.invDate ? `${x.invDate} · ${num(x.invAmount ?? 0)}` : '—'}</Td>
                  <Td className="tabular text-xs">{x.paid || '미지급'}</Td>
                  <Td className="text-xs">{x.rule}</Td>
                  <Td className="text-done">{x.ok ? '√√√' : ''}</Td>
                </tr>
              )}
            />
          )}
        </div>
      </section>
    </div>
  )
}
