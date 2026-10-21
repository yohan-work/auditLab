import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Info, X } from 'lucide-react'
import { Avatar, KrTag, StatusPill, Td, Th } from '@/components/ui'
import { useClients, useEngagements, useUsers } from '@/data/hooks'
import type { Client } from '@/domain/types'
import { cx, wonShort } from '@/lib/format'

/** 외부감사 대상 판단(요약). 실제 판단은 외부감사법 시행령 제5조 원문으로 확인해야 한다. */
function auditScopeHint(c: Client) {
  if (c.listed) return { label: '상장 — 대상', cls: 'bg-blue-50 text-blue-700' }
  if (c.assets >= 500e8) return { label: '자산 500억↑ — 대상', cls: 'bg-blue-50 text-blue-700' }
  if (c.assets >= 120e8) return { label: '자산 120억↑ — 검토 필요', cls: 'bg-amber-50 text-amber-700' }
  return { label: '요건 검토', cls: 'bg-gray-100 text-gray-700' }
}

export function ClientsPage() {
  const clients = useClients()
  const engagements = useEngagements()
  const users = useUsers()
  const [selected, setSelected] = useState<string>()
  const sel = clients.find((c) => c.id === selected)

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-5">
        <h1 className="text-[26px] font-normal text-ink">고객사 ({clients.length})</h1>
      </div>

      <div className="mx-6 mb-4 flex items-start gap-2 rounded-md border border-line bg-canvas px-4 py-3 text-[13px] text-ink-2">
        <Info size={16} className="mt-0.5 shrink-0 text-muted" />
        <div>
          <span className="mr-1.5 inline-flex items-center gap-1.5 font-medium text-ink">
            외부감사 대상 판단 기준 <KrTag />
          </span>
          주권상장법인·상장예정법인, 직전 사업연도 말 자산총액 500억원 이상, 매출액 500억원 이상, 또는 자산 120억원·부채 70억원·매출액
          100억원·종업원 100명 중 2개 이상 해당하는 회사(유한회사는 사원 수 50명 포함 별도 기준).{' '}
          <span className="text-muted">외부감사법 시행령 기준 요약, 원문 확인 필요.</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 border-t border-line">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>고객사</Th>
                <Th>사업자번호</Th>
                <Th>업종</Th>
                <Th>결산월</Th>
                <Th className="text-right">자산총액</Th>
                <Th>외감 대상(참고)</Th>
                <Th className="text-right">감사 업무</Th>
                <Th>담당자</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const n = engagements.filter((e) => e.clientId === c.id).length
                const hint = auditScopeHint(c)
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c.id === selected ? undefined : c.id)}
                    className={cx('cursor-pointer hover:bg-canvas', c.id === selected && 'bg-brand-soft hover:bg-brand-soft')}
                  >
                    <Td className="font-medium text-ink">{c.name}</Td>
                    <Td className="tabular">{c.bizNo}</Td>
                    <Td>{c.industry}</Td>
                    <Td>{Number(c.fiscalYearEnd.slice(0, 2))}월</Td>
                    <Td className="tabular text-right">{wonShort(c.assets)}</Td>
                    <Td>
                      <span className={cx('inline-flex h-6 items-center rounded px-2 text-xs font-medium', hint.cls)}>{hint.label}</span>
                    </Td>
                    <Td className="tabular text-right">{n}</Td>
                    <Td>
                      <Avatar user={users.find((u) => u.id === c.contactUserId)} withName />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {sel && <ClientDrawer client={sel} onClose={() => setSelected(undefined)} />}
      </div>
    </div>
  )
}

function ClientDrawer({ client, onClose }: { client: Client; onClose: () => void }) {
  const engagements = useEngagements().filter((e) => e.clientId === client.id)
  const users = useUsers()
  const contacts = users.filter((u) => u.clientId === client.id)

  return (
    <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-line bg-white">
      <header className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[17px] font-medium text-ink">{client.name}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {client.industry} · {client.bizNo}
          </p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas" aria-label="닫기">
          <X size={18} />
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-[13px]">
        <div>
          <dt className="text-xs text-muted">결산일</dt>
          <dd className="text-ink-2">{client.fiscalYearEnd.replace('-', '월 ')}일</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">직전연도 자산총액</dt>
          <dd className="text-ink-2">{wonShort(client.assets)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">상장 여부</dt>
          <dd className="text-ink-2">{client.listed ? '상장' : '비상장'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">외감 대상(참고)</dt>
          <dd className="text-ink-2">{auditScopeHint(client).label}</dd>
        </div>
      </dl>

      <section className="border-t border-line px-5 py-4">
        <h3 className="mb-2 text-[13px] font-medium text-ink">고객사 담당자</h3>
        {contacts.length ? (
          <ul className="space-y-2">
            {contacts.map((u) => (
              <li key={u.id} className="flex items-center justify-between">
                <Avatar user={u} withName />
                <span className="text-xs text-muted">{u.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">등록된 담당자가 없습니다.</p>
        )}
      </section>

      <section className="border-t border-line px-5 py-4">
        <h3 className="mb-2 text-[13px] font-medium text-ink">감사 업무 ({engagements.length})</h3>
        <ul className="space-y-2">
          {engagements.map((e) => (
            <li key={e.id} className="rounded-md border border-line-2 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <Link to={`/engagements/${e.id}`} className="text-[13px] font-medium text-ink hover:text-brand">
                  {e.name}
                </Link>
                <StatusPill status={e.status} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                <span>
                  {e.type} · FY{e.fiscalYear}
                </span>
                <Avatar user={users.find((u) => u.id === e.leadId)} size={20} />
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <Link to={`/engagements/${e.id}/requests`} className="text-brand hover:underline">
                  자료 요청
                </Link>
                <Link to={`/engagements/${e.id}/sheets`} className="text-brand hover:underline">
                  조서
                </Link>
                <Link to={`/engagements/${e.id}/inspection`} className="text-brand hover:underline">
                  감리 점검
                </Link>
                <Link to={`/portal/${e.id}`} className="ml-auto inline-flex items-center gap-1 text-muted hover:text-ink-2">
                  고객 포털 <ExternalLink size={11} />
                </Link>
              </div>
            </li>
          ))}
          {!engagements.length && <p className="text-xs text-muted">감사 업무가 없습니다.</p>}
        </ul>
      </section>
    </aside>
  )
}
