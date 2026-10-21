import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import { Avatar, Button, Card, DemoNote, KrTag, LevelBadge, Modal, Td, Th } from '@/components/ui'
import { api } from '@/data/api'
import { useClients, useEngagements, useFirm, useFirmInspection, useIndependence, useToday, useUsers } from '@/data/hooks'
import { scoreFindings } from '@/domain/rules'
import type { FirmKind, User } from '@/domain/types'
import { cx, date } from '@/lib/format'

export function QualityPage() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <div className="flex items-center justify-between bg-white px-6 py-5">
        <h1 className="flex items-center gap-2 text-[26px] font-normal text-ink">
          품질관리 <KrTag />
        </h1>
      </div>
      <div className="grid gap-5 border-t border-line px-6 py-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <InspectionSummary />
          <IndependenceTable />
        </div>
        <div className="space-y-5">
          <FirmKindCard />
          <IsqmTimeline />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- (1) 감리 모의고사

function InspectionSummary() {
  const findings = useFirmInspection()
  const engagements = useEngagements()
  const clients = useClients()
  const score = scoreFindings(findings)
  const engName = (id?: string) => {
    const e = engagements.find((x) => x.id === id)
    return e ? `${clients.find((c) => c.id === e.clientId)?.name ?? ''} ${e.name}` : ''
  }

  const byCategory = useMemo(() => {
    const m = new Map<string, ReturnType<typeof scoreFindings>>()
    for (const cat of new Set(findings.map((f) => f.category))) m.set(cat, scoreFindings(findings.filter((f) => f.category === cat)))
    return [...m.entries()].sort((a, b) => b[1].fail - a[1].fail || b[1].warn - a[1].warn)
  }, [findings])
  const fails = findings.filter((f) => f.level === 'fail')
  const engCount = new Set(findings.map((f) => f.engagementId)).size

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          감리 모의고사 요약 <KrTag />
        </span>
      }
    >
      <p className="mb-4 text-xs text-muted">
        대기 중인 업무를 제외한 {engCount}개 감사 업무를 금감원·한공회 감리 지적 상위 항목 기준으로 점검한 결과입니다.
      </p>
      <div className="mb-5 grid grid-cols-3 gap-3">
        {(
          [
            ['지적 예상', score.fail, 'text-danger'],
            ['주의', score.warn, 'text-[#b7791f]'],
            ['충족', score.pass, 'text-done'],
          ] as const
        ).map(([label, n, cls]) => (
          <div key={label} className="rounded-md border border-line-2 px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className={cx('tabular mt-1 text-2xl font-medium', cls)}>{n}</p>
          </div>
        ))}
      </div>

      <table className="mb-5 w-full">
        <thead>
          <tr>
            <Th className="pl-0">항목 분류</Th>
            <Th className="text-right">지적 예상</Th>
            <Th className="text-right">주의</Th>
            <Th className="text-right">충족</Th>
            <Th className="w-[200px]">분포</Th>
          </tr>
        </thead>
        <tbody>
          {byCategory.map(([cat, s]) => {
            const t = s.fail + s.warn + s.pass || 1
            return (
              <tr key={cat}>
                <Td className="pl-0 font-medium text-ink">{cat}</Td>
                <Td className={cx('tabular text-right', s.fail > 0 && 'font-semibold text-danger')}>{s.fail}</Td>
                <Td className="tabular text-right">{s.warn}</Td>
                <Td className="tabular text-right">{s.pass}</Td>
                <Td>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-line-2">
                    <div style={{ width: `${(s.fail / t) * 100}%`, background: '#dc2626' }} />
                    <div style={{ width: `${(s.warn / t) * 100}%`, background: '#f5a524' }} />
                    <div style={{ width: `${(s.pass / t) * 100}%`, background: '#22a35a' }} />
                  </div>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h4 className="mb-2 text-[13px] font-medium text-ink">지적 예상 항목 ({fails.length})</h4>
      {fails.length ? (
        <ul className="divide-y divide-line-2 rounded-md border border-line-2">
          {fails.map((f, i) => (
            <li key={`${f.engagementId}-${f.ruleId}-${i}`}>
              <Link to={f.link ?? `/engagements/${f.engagementId}/inspection`} className="flex items-start gap-3 px-4 py-3 hover:bg-canvas">
                <LevelBadge level={f.level} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">
                    {f.title} <span className="font-normal text-muted">· {engName(f.engagementId)}</span>
                  </span>
                  <span className="block text-xs text-ink-2">{f.detail}</span>
                  <span className="block text-xs text-muted">근거: {f.basis}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{f.category}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">지적 예상 항목이 없습니다.</p>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- (2) 독립성 확인서

function IndependenceTable() {
  const users = useUsers().filter((u) => u.role !== 'client')
  const records = useIndependence()
  const today = useToday()
  const year = Number(today.slice(0, 4))
  const [signing, setSigning] = useState<User>()
  const done = users.filter((u) => records.some((r) => r.userId === u.id && r.year === year && r.signed)).length

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {year}년 독립성 확인서 <KrTag />
        </span>
      }
      action={
        <span className="text-xs text-muted">
          제출 {done} / {users.length}
        </span>
      }
    >
      <p className="mb-2 text-xs text-muted">개정 품질관리기준서 1 문단 34: 독립성 요구사항 준수를 구성원으로부터 연 1회 이상 서면으로 확인받아야 합니다.</p>
      <table className="w-full">
        <thead>
          <tr>
            <Th className="pl-0">구성원</Th>
            <Th>직책</Th>
            <Th>상태</Th>
            <Th>제출일</Th>
            <Th className="text-right" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const r = records.find((x) => x.userId === u.id && x.year === year)
            const signed = !!r?.signed
            return (
              <tr key={u.id}>
                <Td className="pl-0">
                  <Avatar user={u} withName />
                </Td>
                <Td>{u.title}</Td>
                <Td>
                  <span
                    className={cx(
                      'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium',
                      signed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                    )}
                  >
                    {signed ? '서명 완료' : '미제출'}
                  </span>
                </Td>
                <Td className="tabular">{date(r?.submittedAt) || '—'}</Td>
                <Td className="text-right">
                  {!signed && (
                    <Button size="sm" icon={<PenLine size={13} />} onClick={() => setSigning(u)}>
                      전자서명 제출
                    </Button>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {signing && <SignModal user={signing} year={year} onClose={() => setSigning(undefined)} />}
    </Card>
  )
}

function SignModal({ user, year, onClose }: { user: User; year: number; onClose: () => void }) {
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 600))
    await api.submitIndependence(user.id, year)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`${year}년 독립성 확인서 · ${user.name}`}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!agree || busy} onClick={submit}>
            {busy ? '서명 중…' : '전자서명 후 제출'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[13px] text-ink-2">
        <p>본인은 {year}년 동안 다음 사항을 확인합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>감사 대상 회사 및 그 관계회사의 주식·출자지분을 보유하지 않습니다.</li>
          <li>감사 대상 회사와 채권·채무 관계, 고용·겸직 관계가 없습니다.</li>
          <li>공인회계사법 제21조 및 윤리기준의 독립성 요구사항을 준수합니다.</li>
        </ul>
        <label className="flex items-center gap-2 rounded-md border border-line px-3 py-2.5">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          위 내용을 확인했으며 예외 사항이 없습니다.
        </label>
        <DemoNote>실제 버전에서는 공동인증서·간편인증으로 전자서명하고, 서명본 PDF를 품질관리 문서로 보존합니다.</DemoNote>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- (3) 개정 품질관리기준서 1

function IsqmTimeline() {
  const today = useToday()
  const items = [
    { date: '2026-07-31', title: '금융위원회 승인', body: '개정 품질관리기준서 1(ISQM 1 도입) 확정' },
    { date: '2027-12-31', title: '등록법인 설계·실행 기한', body: '품질관리시스템을 설계하고 실행해야 하는 시점' },
    { date: '2029-12-31', title: '그 외 회계법인·감사반 설계·실행 기한', body: '중소 법인과 감사반에 적용' },
    { date: '설계·실행 후 1년 이내', title: '최초 평가', body: '품질관리시스템이 목적을 달성하는지 평가' },
  ]
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          개정 품질관리기준서 1 시행 일정 <KrTag />
        </span>
      }
    >
      <ol className="relative mt-2 space-y-4 border-l border-line pl-5">
        {items.map((it) => {
          const past = /^\d{4}-/.test(it.date) && it.date <= today
          return (
            <li key={it.title} className="relative">
              <span className={cx('absolute top-1 -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-white', past ? 'bg-done' : 'bg-brand')} />
              <p className="tabular text-xs text-muted">{it.date}</p>
              <p className="text-[13px] font-medium text-ink">{it.title}</p>
              <p className="text-xs text-ink-2">{it.body}</p>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-[11px] text-muted">출처: 한공회 개정 개요 문단 46, 금융위 승인 2026-07-31</p>
    </Card>
  )
}

// ---------------------------------------------------------------- (4) 법인 형태

function FirmKindCard() {
  const firm = useFirm()
  const options: { kind: FirmKind; label: string; desc: string }[] = [
    { kind: 'firm', label: '회계법인', desc: '법인 단위 품질관리시스템, 심리 조직 운영' },
    { kind: 'audit_team', label: '감사반', desc: '3인 이상 공동감사, 상호검토 필수' },
  ]
  return (
    <Card title="법인 형태">
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.kind}
            onClick={() => api.setFirmKind(o.kind)}
            className={cx(
              'rounded-md border px-3 py-2.5 text-left',
              firm.kind === o.kind ? 'border-brand bg-brand-soft' : 'border-line hover:bg-canvas',
            )}
          >
            <span className={cx('block text-[13px] font-medium', firm.kind === o.kind ? 'text-brand-dark' : 'text-ink')}>{o.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{o.desc}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-2">
        감사반으로 설정하면 감리 모의고사에 <b className="font-medium">3인 이상 공동감사</b>와 <b className="font-medium">업무의 공정한 배분</b>{' '}
        규칙이 추가됩니다(한공회 감사반 감리 필수 점검 항목). 회계법인으로 바꾸면 이 두 항목이 빠지고 점검 결과가 즉시 다시 계산됩니다.
      </p>
    </Card>
  )
}
