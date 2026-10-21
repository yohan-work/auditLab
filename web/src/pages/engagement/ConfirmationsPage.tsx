import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Download, FileSearch } from 'lucide-react'
import { Button, Card, DemoNote, Field, KrTag, Modal, ProgressBar, Td, Textarea, Th } from '@/components/ui'
import { api } from '@/data/api'
import { useConfirmations } from '@/data/hooks'
import type { Confirmation, ConfirmationChannel, ConfirmationStatus, ConfirmationType } from '@/domain/types'
import { cx, num, pct } from '@/lib/format'

const typeLabel: Record<ConfirmationType, string> = { bank: '은행', receivable: '채권', payable: '채무', legal: '법률' }
const channelMap: Record<ConfirmationChannel, { label: string; cls: string }> = {
  kftc: { label: '금융결제원', cls: 'bg-blue-50 text-blue-700' },
  nice: { label: 'NICE', cls: 'bg-violet-50 text-violet-700' },
  mail: { label: '우편', cls: 'bg-gray-100 text-gray-700' },
}
const statusMap: Record<ConfirmationStatus, { label: string; cls: string }> = {
  draft: { label: '작성 중', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: '발송', cls: 'bg-blue-50 text-blue-700' },
  replied: { label: '회신', cls: 'bg-green-50 text-green-700' },
  no_reply: { label: '미회신', cls: 'bg-amber-50 text-amber-700' },
  exception: { label: '차이', cls: 'bg-red-50 text-red-700' },
}

const TEMPLATE: Record<'no_reply' | 'exception', string> = {
  no_reply: '기간 후 입금 확인: 일자 2026-__-__ / 금액 ___원 / 거래내역 위치(통장 거래내역 행 ___)\n관련 증빙: 세금계산서·출고증 대사 결과 ___',
  exception: '차이 원인: ___ (예: 기말 미착 반품, 시점 차이)\n조정 필요 여부: ___ / 차이 금액 ___원\n확인 증빙: ___',
}

const Pill = ({ cls, children }: { cls: string; children: ReactNode }) => (
  <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', cls)}>{children}</span>
)

export function ConfirmationsPage() {
  const { id } = useParams()
  const list = useConfirmations(id)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<ConfirmationChannel | null>(null)
  const [target, setTarget] = useState<Confirmation | null>(null)
  const [text, setText] = useState('')
  const [typeFilter, setTypeFilter] = useState<ConfirmationType | 'all'>('all')

  const importFrom = async (ch: 'kftc' | 'nice') => {
    if (!id) return
    setBusy(ch)
    const n = await api.importConfirmations(id, ch)
    setBusy(null)
    setMsg(
      n > 0
        ? `${ch === 'kftc' ? '금융결제원' : 'NICE'} 회신 ${n}건을 가져왔습니다.`
        : `${ch === 'kftc' ? '금융결제원' : 'NICE'}에서 새로 가져올 회신이 없습니다.`,
    )
  }

  const openAlt = (c: Confirmation) => {
    setTarget(c)
    setText(TEMPLATE[c.status === 'exception' ? 'exception' : 'no_reply'])
  }

  const save = async () => {
    if (!target || !text.trim()) return
    await api.recordAlternativeProcedure(target.id, text.trim())
    setTarget(null)
  }

  const types: ConfirmationType[] = ['bank', 'receivable', 'payable', 'legal']
  const rows = list.filter((c) => typeFilter === 'all' || c.type === typeFilter)
  const pendingAlt = list.filter((c) => (c.status === 'no_reply' || c.status === 'exception') && !c.alternativeProcedure).length

  return (
    <div className="min-h-full bg-canvas">
      <div className="flex items-center justify-between bg-white px-6 py-5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-normal text-ink">
            외부조회 <span className="text-muted">({list.length})</span> <KrTag />
          </h1>
          <p className="mt-1 text-xs text-muted">감사기준서 505 외부조회 · 미회신·차이 건은 대체절차를 문서화해야 합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Download size={15} />} disabled={busy !== null} onClick={() => importFrom('kftc')}>
            금융결제원 회신 가져오기
          </Button>
          <Button icon={<FileSearch size={15} />} disabled={busy !== null} onClick={() => importFrom('nice')}>
            NICE 회신 리포트 가져오기
          </Button>
        </div>
      </div>

      <div className="space-y-4 px-6 pt-4 pb-10">
        {msg && (
          <div className="flex items-center justify-between rounded-md border border-[#86efac] bg-done-soft px-4 py-2.5 text-sm text-done">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} /> {msg}
            </span>
            <button className="text-xs text-muted hover:text-ink-2" onClick={() => setMsg(null)}>
              닫기
            </button>
          </div>
        )}
        <DemoNote>
          실제 버전은 금융결제원 은행조회서 시스템(audit.kftc.or.kr)에서 내려받은 회신 파일과 NICE 채권채무조회 리포트를 파싱해 거래처별 회신금액을 자동 대사합니다.
        </DemoNote>

        <div className="grid grid-cols-4 gap-4">
          {types.map((t) => {
            const g = list.filter((c) => c.type === t)
            const sent = g.filter((c) => c.status !== 'draft').length
            const replied = g.filter((c) => c.status === 'replied' || c.status === 'exception').length
            const noReply = g.filter((c) => c.status === 'no_reply').length
            const exc = g.filter((c) => c.status === 'exception').length
            const rate = pct(replied, sent)
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
                className={cx(
                  'rounded-lg border bg-white p-5 text-left transition-colors',
                  typeFilter === t ? 'border-brand ring-2 ring-brand/15' : 'border-line hover:border-faint',
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-medium text-ink">{typeLabel[t]}조회</span>
                  <span className="text-xs text-muted">{g.length}건</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="tabular text-[28px] font-semibold text-ink">{rate}%</span>
                  <span className="text-xs text-muted">회신율</span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={rate} color="#22a35a" track="#ecfdf3" height={6} />
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] text-muted">
                  {[
                    ['발송', sent, 'text-ink'],
                    ['회신', replied, 'text-done'],
                    ['미회신', noReply, 'text-[#b7791f]'],
                    ['차이', exc, 'text-danger'],
                  ].map(([l, v, c]) => (
                    <div key={l as string}>
                      <dd className={cx('tabular text-[15px] font-semibold', c as string)}>{v}</dd>
                      <dt>{l}</dt>
                    </div>
                  ))}
                </dl>
              </button>
            )
          })}
        </div>

        <Card
          title={
            <span className="flex items-center gap-2">
              조회 내역 {typeFilter !== 'all' && <span className="text-muted">· {typeLabel[typeFilter]}</span>}
              {pendingAlt > 0 && <span className="rounded bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">대체절차 미기록 {pendingAlt}건</span>}
            </span>
          }
          action={
            typeFilter !== 'all' && (
              <button className="text-xs text-brand hover:underline" onClick={() => setTypeFilter('all')}>
                전체 보기
              </button>
            )
          }
        >
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr>
                  <Th>유형</Th>
                  <Th>채널</Th>
                  <Th>거래처</Th>
                  <Th className="text-right">장부금액</Th>
                  <Th className="text-right">회신금액</Th>
                  <Th className="text-right">차이</Th>
                  <Th>상태</Th>
                  <Th>대체절차</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const diff = c.confirmedAmount !== undefined ? c.ledgerAmount - c.confirmedAmount : undefined
                  const needsAlt = (c.status === 'no_reply' || c.status === 'exception') && !c.alternativeProcedure
                  return (
                    <tr key={c.id}>
                      <Td>{typeLabel[c.type]}</Td>
                      <Td>
                        <Pill cls={channelMap[c.channel].cls}>{channelMap[c.channel].label}</Pill>
                      </Td>
                      <Td className="font-medium text-ink">{c.counterparty}</Td>
                      <Td className="tabular text-right">{num(c.ledgerAmount)}원</Td>
                      <Td className="tabular text-right">{c.confirmedAmount !== undefined ? `${num(c.confirmedAmount)}원` : <span className="text-faint">—</span>}</Td>
                      <Td className={cx('tabular text-right', diff ? 'font-medium text-danger' : 'text-muted')}>
                        {diff === undefined ? <span className="text-faint">—</span> : diff === 0 ? '0' : `${num(diff)}원`}
                      </Td>
                      <Td>
                        <Pill cls={statusMap[c.status].cls}>{statusMap[c.status].label}</Pill>
                      </Td>
                      <Td className="max-w-[320px]">
                        {needsAlt ? (
                          <Button size="sm" variant="danger" onClick={() => openAlt(c)}>
                            대체절차 기록
                          </Button>
                        ) : c.alternativeProcedure ? (
                          <span className="line-clamp-2 text-xs text-ink-2" title={c.alternativeProcedure}>
                            {c.alternativeProcedure}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={`대체절차 기록 · ${target?.counterparty ?? ''}`}
        width={560}
        footer={
          <>
            <Button onClick={() => setTarget(null)}>취소</Button>
            <Button variant="primary" onClick={save} disabled={!text.trim()}>
              저장
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-2">
            {target?.status === 'exception'
              ? `회신금액과 장부금액 차이(${num((target?.ledgerAmount ?? 0) - (target?.confirmedAmount ?? 0))}원)의 원인과 확인 절차를 기록합니다.`
              : '회신을 받지 못한 조회서에 대해 수행한 대체적 감사절차를 기록합니다.'}
          </p>
          <Field label="수행한 절차와 결과" hint="감사기준서 505 문단 12: 미회신 시 대체적 감사절차 수행 · 감리에서 대체절차 미흡이 반복 지적됩니다.">
            <Textarea rows={6} value={text} onChange={(ev) => setText(ev.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
