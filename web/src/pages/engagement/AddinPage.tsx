import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FileSpreadsheet, Link2, CheckCircle2, Circle, Clock, X, Minus, Square } from 'lucide-react'
import { Avatar, Button, DemoNote, KrTag } from '@/components/ui'
import { api } from '@/data/api'
import { useConfirmations, useDocuments, useReviewNotes, useUsers, useWorkflow } from '@/data/hooks'
import { nodeState } from '@/domain/rules'
import { cx, num } from '@/lib/format'

// 엑셀 애드인 미리보기: 엑셀 조서(E-21 채권 조회 대사표) 옆에 auditLab 작업창이 뜨는 모습을 흉내 낸다.
// 실제 구현은 Office.js 작업창 + 로컬 처리 엔진(README 확장 경로 6번).

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const HEAD = ['거래처', '채널', '장부금액', '회신금액', '차이', '상태', '틱마크']
const tickLegend: [string, string][] = [
  ['ⓒ', '조회서 회신과 일치'],
  ['ⓐ', '대체절차로 확인'],
  ['ⓧ', '차이 — 조사 필요'],
  ['ⓝ', '미회신 — 대체절차 필요'],
]

export function AddinPage() {
  const { id } = useParams()
  const confirmations = useConfirmations(id).filter((c) => c.type === 'receivable')
  const documents = useDocuments(id)
  const workflow = useWorkflow(id)
  const users = useUsers()
  const node = workflow.find((n) => n.code === 'E-21')
  const notes = useReviewNotes(id).filter((n) => n.nodeId === node?.id && n.status === 'open')
  const [sel, setSel] = useState<{ r: number; c: number }>({ r: 0, c: 3 })

  const rows = useMemo(
    () =>
      confirmations.map((c) => {
        const diff = c.confirmedAmount === undefined ? undefined : c.ledgerAmount - c.confirmedAmount
        const tick = c.status === 'replied' ? 'ⓒ' : c.alternativeProcedure ? 'ⓐ' : c.status === 'exception' ? 'ⓧ' : 'ⓝ'
        return {
          c,
          cells: [
            c.counterparty,
            c.channel === 'nice' ? 'NICE' : c.channel === 'kftc' ? '결제원' : '우편',
            num(c.ledgerAmount),
            c.confirmedAmount === undefined ? '' : num(c.confirmedAmount),
            diff === undefined ? '' : num(diff),
            { replied: '회신', exception: '차이', no_reply: '미회신', sent: '발송', draft: '작성' }[c.status],
            tick,
          ],
        }
      }),
    [confirmations],
  )
  const total = confirmations.reduce((a, c) => a + c.ledgerAmount, 0)
  const row = rows[sel.r]
  const evidenceDoc = documents.find((d) => d.id === row?.c.documentId)
  const cellRef = `${COLS[sel.c]}${sel.r + 4}`
  const state = node ? nodeState(node) : 'todo'
  const preparer = node?.signOffs.find((s) => s.role === 'preparer')
  const reviewer = node?.signOffs.find((s) => s.role === 'reviewer')

  return (
    <div className="flex h-full flex-col bg-canvas p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] text-ink">
            엑셀 애드인 미리보기 <KrTag />
          </h1>
          <p className="text-[13px] text-muted">회계사가 쓰던 엑셀 조서 그대로, 오른쪽 작업창에서 근거·서명·리뷰를 처리합니다.</p>
        </div>
        <DemoNote>실제 엑셀이 아닌 화면 흉내입니다. 셀을 눌러 보세요.</DemoNote>
      </div>

      <div className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-lg border border-[#c8c8c8] bg-white shadow-sm">
        {/* 제목 표시줄 */}
        <div className="flex h-9 items-center bg-[#217346] px-3 text-[12px] text-white">
          <FileSpreadsheet size={15} className="mr-2" />
          <span className="flex-1 text-center">E-21_채권조회_대사표_2026.xlsx — Excel</span>
          <span className="flex gap-3 opacity-80">
            <Minus size={14} />
            <Square size={12} />
            <X size={14} />
          </span>
        </div>
        {/* 리본 */}
        <div className="flex items-end gap-5 border-b border-[#d4d4d4] bg-[#f3f3f3] px-4 pt-1.5 text-[12px] text-[#444]">
          {['파일', '홈', '삽입', '페이지 레이아웃', '수식', '데이터', '검토', '보기'].map((t) => (
            <span key={t} className="pb-1.5">
              {t}
            </span>
          ))}
          <span className="border-b-2 border-[#217346] pb-1 font-semibold text-[#217346]">auditLab</span>
        </div>
        <div className="flex h-11 items-center gap-2 border-b border-[#d4d4d4] bg-[#f8f8f8] px-3 text-[11px] text-[#444]">
          {['근거 연결', '틱마크', '작성 서명', '검토 요청', '조서 동기화'].map((t) => (
            <span key={t} className="rounded border border-transparent px-2 py-1 hover:border-[#c8c8c8] hover:bg-white">
              {t}
            </span>
          ))}
        </div>
        {/* 수식 입력줄 */}
        <div className="flex h-7 items-center border-b border-[#d4d4d4] text-[12px]">
          <span className="w-16 border-r border-[#d4d4d4] px-2 text-center">{cellRef}</span>
          <span className="px-2 italic text-[#888]">fx</span>
          <span className="px-1">{row ? String(row.cells[sel.c]) : ''}</span>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* 시트 */}
          <div className="min-w-0 flex-1 overflow-auto">
            <table className="border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="w-10 border border-[#d4d4d4] bg-[#f3f3f3]" />
                  {COLS.map((c, i) => (
                    <th key={c} className={cx('h-6 border border-[#d4d4d4] bg-[#f3f3f3] font-normal text-[#555]', i === sel.c && 'bg-[#d3e7dc]')} style={{ minWidth: i === 0 ? 150 : 104 }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#d4d4d4] bg-[#f3f3f3] text-center text-[#555]">1</td>
                  <td colSpan={7} className="h-7 border border-[#e3e3e3] px-2 font-semibold">
                    샘플제조㈜ · E-21 매출채권 조회 대사표 (기준일 2026-09-30, 단위: 원)
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#d4d4d4] bg-[#f3f3f3] text-center text-[#555]">2</td>
                  <td colSpan={7} className="h-6 border border-[#e3e3e3] px-2 text-[#666]">
                    작성: {users.find((u) => u.id === preparer?.userId)?.name ?? '—'} / 검토: {users.find((u) => u.id === reviewer?.userId)?.name ?? '—'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#d4d4d4] bg-[#f3f3f3] text-center text-[#555]">3</td>
                  {HEAD.map((h) => (
                    <td key={h} className="h-7 border border-[#e3e3e3] bg-[#eef5f0] px-2 font-semibold">
                      {h}
                    </td>
                  ))}
                </tr>
                {rows.map((r, ri) => (
                  <tr key={r.c.id}>
                    <td className={cx('border border-[#d4d4d4] bg-[#f3f3f3] text-center text-[#555]', ri === sel.r && 'bg-[#d3e7dc]')}>{ri + 4}</td>
                    {r.cells.map((v, ci) => (
                      <td
                        key={ci}
                        onClick={() => setSel({ r: ri, c: ci })}
                        className={cx(
                          'h-7 cursor-cell border border-[#e3e3e3] px-2',
                          ci >= 2 && ci <= 4 && 'tabular text-right',
                          ci === 4 && v && v !== '0' && 'text-danger',
                          ci === 6 && 'text-center text-[14px]',
                          ci === 6 && (v === 'ⓒ' || v === 'ⓐ') && 'text-done',
                          ci === 6 && (v === 'ⓧ' || v === 'ⓝ') && 'text-danger',
                          sel.r === ri && sel.c === ci && 'outline-2 -outline-offset-2 outline-[#217346]',
                        )}
                      >
                        {String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="border border-[#d4d4d4] bg-[#f3f3f3] text-center text-[#555]">{rows.length + 4}</td>
                  <td className="h-7 border border-[#e3e3e3] px-2 font-semibold">합계</td>
                  <td className="border border-[#e3e3e3]" />
                  <td className="tabular border border-[#e3e3e3] px-2 text-right font-semibold">{num(total)}</td>
                  <td colSpan={4} className="border border-[#e3e3e3]" />
                </tr>
                {Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td className="border border-[#d4d4d4] bg-[#f3f3f3] text-center text-[#555]">{rows.length + 5 + i}</td>
                    {COLS.map((c) => (
                      <td key={c} className="h-7 border border-[#eee]" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 작업창 */}
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-[#d4d4d4] bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-leaf text-[10px] font-bold text-white">A</span>
                auditLab
              </span>
              <X size={14} className="text-faint" />
            </div>
            <div className="flex-1 space-y-5 overflow-auto px-4 py-4 text-[13px]">
              <section>
                <p className="text-[11px] font-semibold tracking-wider text-muted">선택한 셀</p>
                <p className="mt-1 font-medium text-ink">
                  {cellRef} · {row?.c.counterparty} · {HEAD[sel.c]}
                </p>
                <p className="tabular text-lg text-ink">{row ? String(row.cells[sel.c]) || '—' : '—'}</p>
              </section>

              <section>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted">
                  근거 <KrTag />
                </p>
                {evidenceDoc ? (
                  <div className="rounded-md border border-line px-3 py-2">
                    <p className="flex items-center gap-1.5 text-brand">
                      <Link2 size={13} /> {evidenceDoc.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">위치: 회신 리포트 행 {sel.r + 2} · {row?.c.counterparty}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted">연결된 근거가 없습니다.</p>
                )}
                {row?.c.alternativeProcedure && <p className="mt-2 rounded-md bg-done-soft px-3 py-2 text-xs text-ink-2">대체절차: {row.c.alternativeProcedure}</p>}
                {(row?.c.status === 'no_reply' || row?.c.status === 'exception') && !row.c.alternativeProcedure && (
                  <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
                    {row.c.status === 'no_reply' ? '미회신' : '차이'} — 대체절차 기록이 필요합니다.{' '}
                    <Link to={`/engagements/${id}/confirmations`} className="underline">
                      기록하기
                    </Link>
                  </p>
                )}
              </section>

              <section>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted">틱마크 범례</p>
                <ul className="space-y-1 text-xs text-ink-2">
                  {tickLegend.map(([k, v]) => (
                    <li key={k} className="flex gap-2">
                      <span className="w-4 text-center">{k}</span>
                      {v}
                    </li>
                  ))}
                </ul>
              </section>

              {node && (
                <section>
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted">조서 서명 · {node.code}</p>
                  <div className="space-y-2">
                    {[
                      ['작성', preparer, 'preparer'] as const,
                      ['검토', reviewer, 'reviewer'] as const,
                    ].map(([label, s, role]) => (
                      <div key={role} className="flex items-center justify-between rounded-md border border-line px-3 py-2">
                        <span className="flex items-center gap-2">
                          {s ? <CheckCircle2 size={15} className="text-done" /> : state === 'prepared' && role === 'reviewer' ? <Clock size={15} className="text-pending" /> : <Circle size={15} className="text-faint" />}
                          {label}
                        </span>
                        {s ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted">
                            <Avatar user={users.find((u) => u.id === s.userId)} size={18} /> {s.at.slice(0, 10)}
                          </span>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => api.signOff(node.id, role)}>
                            서명
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted">미해결 리뷰 노트 ({notes.length})</p>
                {notes.map((n) => (
                  <div key={n.id} className="mb-2 rounded-md bg-pending-soft px-3 py-2 text-xs text-ink-2">
                    {n.text}
                  </div>
                ))}
                {node && (
                  <Link to={`/engagements/${id}/sheets?node=${node.id}`} className="text-xs text-brand">
                    웹에서 조서 열기 →
                  </Link>
                )}
              </section>
            </div>
            <p className="border-t border-line px-4 py-2 text-[11px] text-faint">로컬 처리 · 고객 자료는 PC 밖으로 나가지 않음 (설계 방향)</p>
          </aside>
        </div>
        {/* 시트 탭 */}
        <div className="flex h-7 items-center gap-1 border-t border-[#d4d4d4] bg-[#f3f3f3] px-2 text-[12px]">
          <span className="border-b-2 border-[#217346] bg-white px-3 font-medium text-[#217346]">대사표</span>
          <span className="px-3 text-[#666]">회신 원본</span>
          <span className="px-3 text-[#666]">대체절차</span>
        </div>
      </div>
    </div>
  )
}
