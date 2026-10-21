import { useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight, Link2, Plus, Check, X, BookOpen, Target, FileText, MessageSquareText } from 'lucide-react'
import { Avatar, Button, DemoNote, EmptyState, Field, Input, KrTag, Modal, Select, Textarea, Th, Td } from '@/components/ui'
import { api } from '@/data/api'
import { useClient, useCurrentUser, useDocuments, useEngagement, useReviewNotes, useUsers, useWorkflow } from '@/data/hooks'
import { folderCount, nodeState } from '@/domain/rules'
import type { Engagement, SignOff, User, WorkflowNode } from '@/domain/types'
import { cx, dateTime } from '@/lib/format'
import { StateIcon, WorkflowTree, stateLabel, useTree } from './sheets/WorkflowTree'

const roleText: Record<SignOff['role'], string> = { preparer: '작성자', reviewer: '검토자', eqr: '심리' }

export function SheetsPage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const client = useClient(e?.clientId)
  const nodes = useWorkflow(id)
  const tree = useTree(nodes)
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('node') ?? tree.children.get('')?.[0]?.id
  const selected = selectedId ? tree.byId.get(selectedId) : undefined

  const select = (nid: string) =>
    setParams(
      (p) => {
        p.set('node', nid)
        return p
      },
      { replace: true },
    )

  if (!e) return null

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[400px] shrink-0 flex-col border-r border-line bg-[#fafafa]">
        <div className="px-5 pt-5 pb-4">
          <p className="text-xs text-muted">{client?.name}</p>
          <h1 className="text-[20px] font-normal text-ink">{e.name} · 조서</h1>
        </div>
        <WorkflowTree nodes={nodes} selectedId={selectedId} onSelect={select} />
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto">
        {!selected ? (
          <EmptyState title="왼쪽에서 조서를 선택하세요" />
        ) : (
          <>
            <nav className="flex flex-wrap items-center gap-1 border-b border-line-2 px-8 py-3 text-xs text-muted">
              <span>{e.name}</span>
              {tree.ancestors(selected.id).map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1">
                  <ChevronRight size={12} />
                  <button onClick={() => select(a.id)} className="hover:text-brand hover:underline">
                    {a.parentId ? `${a.code} ${a.title}` : a.title}
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 text-ink-2">
                <ChevronRight size={12} />
                {selected.parentId ? `${selected.code} ${selected.title}` : selected.title}
              </span>
            </nav>
            {selected.type === 'folder' ? (
              <FolderSummary folder={selected} tree={tree} onSelect={select} />
            ) : (
              <NodeDetail key={selected.id} node={selected} engagement={e} />
            )}
          </>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- 폴더 요약

function FolderSummary({ folder, tree, onSelect }: { folder: WorkflowNode; tree: ReturnType<typeof useTree>; onSelect: (id: string) => void }) {
  const users = useUsers()
  const kids = tree.children.get(folder.id) ?? []
  const [done, total] = folderCount(folder.id, tree.unique)
  return (
    <div className="px-8 py-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[24px] font-normal text-ink">
          {folder.parentId && <span className="mr-2 text-muted">{folder.code}</span>}
          {folder.title} <span className="text-muted">({kids.length})</span>
        </h2>
        <span className="text-sm text-muted">
          검토 완료 <span className="tabular font-medium text-ink">{done}</span> / {total}
        </span>
      </div>
      <table className="mt-5 w-full">
        <thead>
          <tr>
            <Th>코드</Th>
            <Th>제목</Th>
            <Th>기준서</Th>
            <Th>담당</Th>
            <Th>상태</Th>
          </tr>
        </thead>
        <tbody>
          {kids.map((k) => {
            const [d, t] = k.type === 'folder' ? folderCount(k.id, tree.unique) : [0, 0]
            return (
              <tr key={k.id} onClick={() => onSelect(k.id)} className="cursor-pointer hover:bg-canvas">
                <Td className="tabular text-muted">{k.code}</Td>
                <Td className="text-ink">{k.title}</Td>
                <Td className="text-muted">{k.kicpaRef ?? '—'}</Td>
                <Td>{k.type === 'folder' ? <span className="text-faint">—</span> : <Avatar user={users.find((u) => u.id === k.assigneeId)} withName />}</Td>
                <Td>
                  {k.type === 'folder' ? (
                    <span className="tabular text-xs text-muted">
                      {d}/{t} 검토 완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <StateIcon node={k} size={14} /> {stateLabel[nodeState(k)]}
                    </span>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- 조서 상세

function SignOffButton({ node, role, users }: { node: WorkflowNode; role: SignOff['role']; users: User[] }) {
  const s = node.signOffs.find((x) => x.role === role)
  const u = users.find((x) => x.id === s?.userId)
  if (!s)
    return (
      <Button size="sm" variant={role === 'eqr' ? 'secondary' : 'primary'} onClick={() => api.signOff(node.id, role)} icon={<Plus size={13} />}>
        {roleText[role]} 서명
      </Button>
    )
  return (
    <div className="group flex items-center gap-2 rounded-md border border-[#86efac] bg-done-soft py-1 pr-1.5 pl-2">
      <Avatar user={u} size={22} />
      <div className="leading-tight">
        <div className="text-[11px] font-medium text-done">{roleText[role]} 서명</div>
        <div className="text-[11px] text-muted">
          {u?.name} · {dateTime(s.at)}
        </div>
      </div>
      <button onClick={() => api.removeSignOff(node.id, role)} title="서명 취소" className="rounded p-0.5 text-faint hover:bg-white hover:text-danger">
        <X size={13} />
      </button>
    </div>
  )
}

function NodeDetail({ node, engagement }: { node: WorkflowNode; engagement: Engagement }) {
  const users = useUsers()
  const me = useCurrentUser()
  const docs = useDocuments(engagement.id)
  const notes = useReviewNotes(engagement.id).filter((n) => n.nodeId === node.id)
  const [conclusion, setConclusion] = useState(node.conclusion ?? '')
  const [checked, setChecked] = useState<Set<number>>(() => new Set(nodeState(node) !== 'todo' ? (node.steps ?? []).map((_, i) => i) : []))
  const [evOpen, setEvOpen] = useState(false)
  const [evDoc, setEvDoc] = useState('')
  const [evLoc, setEvLoc] = useState('')
  const team = [...new Set([engagement.leadId, ...engagement.teamIds])]
  const [noteText, setNoteText] = useState('')
  const [noteTo, setNoteTo] = useState(node.assigneeId ?? team[0])

  const assignee = users.find((u) => u.id === node.assigneeId)
  const showEqr = !!engagement.eqrId && node.code === 'C-20'
  const openNotes = notes.filter((n) => n.status === 'open')

  const addEvidence = async () => {
    if (!evDoc) return
    await api.addEvidence(node.id, evDoc, evLoc.trim() || '전체')
    setEvOpen(false)
    setEvDoc('')
    setEvLoc('')
  }

  const addNote = async () => {
    if (!noteText.trim() || !noteTo) return
    await api.addReviewNote(node.id, noteText.trim(), noteTo)
    setNoteText('')
  }

  return (
    <div className="px-8 py-6">
      {/* 제목·서명 바 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted">
            <StateIcon node={node} size={15} />
            <span className="tabular">{node.code}</span>
            <span>·</span>
            <span>{stateLabel[nodeState(node)]}</span>
            {node.type === 'form' && <span className="rounded bg-canvas px-1.5 text-[11px]">서식</span>}
          </div>
          <h2 className="mt-1 text-[24px] font-normal text-ink">{node.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-ink-2">
            {node.kicpaRef && (
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={14} className="text-muted" /> {node.kicpaRef}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted">담당</span> <Avatar user={assignee} size={22} withName />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SignOffButton node={node} role="preparer" users={users} />
          <SignOffButton node={node} role="reviewer" users={users} />
          {showEqr && <SignOffButton node={node} role="eqr" users={users} />}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* 목적 */}
          <Block icon={<Target size={15} />} title="목적">
            <p className="text-[13px] leading-relaxed text-ink-2">{node.objective ?? '—'}</p>
          </Block>

          {/* 절차 */}
          {node.steps && node.steps.length > 0 && (
            <Block icon={<FileText size={15} />} title={`수행 절차 (${checked.size}/${node.steps.length})`}>
              <ul className="space-y-1">
                {node.steps.map((s, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-canvas">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked.has(i)}
                        onChange={() =>
                          setChecked((c) => {
                            const n = new Set(c)
                            if (n.has(i)) n.delete(i)
                            else n.add(i)
                            return n
                          })
                        }
                      />
                      <span className={cx(checked.has(i) && 'text-muted line-through')}>
                        {i + 1}. {s}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {/* 근거 잇기 */}
          <Block
            icon={<Link2 size={15} />}
            title={
              <span className="inline-flex items-center gap-2">
                근거 잇기 <KrTag />
              </span>
            }
            action={
              <Button size="sm" icon={<Plus size={13} />} onClick={() => setEvOpen(true)}>
                근거 연결
              </Button>
            }
          >
            {node.evidence.length === 0 ? (
              <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">
                연결된 근거 문서가 없습니다. 감리에서 가장 많이 지적되는 항목입니다.
              </p>
            ) : (
              <ul className="divide-y divide-line-2 rounded-md border border-line">
                {node.evidence.map((ev, i) => {
                  const d = docs.find((x) => x.id === ev.documentId)
                  return (
                    <li key={i} className="flex items-center gap-2.5 px-3 py-2.5 text-[13px]">
                      <Link2 size={14} className="shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate text-brand">{d?.name ?? ev.documentId}</span>
                      <span className="shrink-0 rounded bg-canvas px-2 py-0.5 text-[11px] text-ink-2">{ev.locator}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Block>

          {/* 결론 */}
          <Block icon={<Check size={15} />} title="결론">
            <Textarea
              rows={4}
              value={conclusion}
              placeholder="수행한 절차와 결과를 바탕으로 결론을 기술하세요."
              onChange={(ev) => setConclusion(ev.target.value)}
              onBlur={() => conclusion !== (node.conclusion ?? '') && api.updateConclusion(node.id, conclusion)}
            />
            <p className="mt-1 text-[11px] text-faint">입력란을 벗어나면 자동 저장됩니다.</p>
          </Block>
        </div>

        {/* 리뷰 노트 */}
        <div>
          <Block icon={<MessageSquareText size={15} />} title={`리뷰 노트 (${openNotes.length} 미해결)`}>
            <ul className="space-y-2.5">
              {notes.map((n) => {
                const author = users.find((u) => u.id === n.authorId)
                const to = users.find((u) => u.id === n.assigneeId)
                return (
                  <li key={n.id} className={cx('rounded-md border p-3', n.status === 'open' ? 'border-[#fde68a] bg-[#fffbeb]' : 'border-line bg-canvas')}>
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <Avatar user={author} size={18} />
                      <span className="text-ink-2">{author?.name}</span>
                      <ChevronRight size={11} />
                      <span>{to?.name}</span>
                      <span className="ml-auto">{n.createdAt}</span>
                    </div>
                    <p className={cx('mt-1.5 text-[13px]', n.status === 'resolved' ? 'text-muted' : 'text-ink')}>{n.text}</p>
                    <div className="mt-2 flex justify-end">
                      {n.status === 'open' ? (
                        <Button size="sm" icon={<Check size={13} />} onClick={() => api.resolveReviewNote(n.id)}>
                          해결
                        </Button>
                      ) : (
                        <span className="text-[11px] font-medium text-done">해결됨 · {n.resolvedAt}</span>
                      )}
                    </div>
                  </li>
                )
              })}
              {notes.length === 0 && <li className="py-3 text-center text-[13px] text-muted">리뷰 노트가 없습니다.</li>}
            </ul>
            <div className="mt-4 space-y-2 border-t border-line-2 pt-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar user={me} size={20} /> {me?.name}(으)로 작성
              </div>
              <Textarea rows={3} value={noteText} onChange={(ev) => setNoteText(ev.target.value)} placeholder="검토 의견을 남기세요." />
              <div className="flex items-center gap-2">
                <Select value={noteTo} onChange={(ev) => setNoteTo(ev.target.value)} className="flex-1" label="담당자">
                  {team.map((uid) => (
                    <option key={uid} value={uid}>
                      {users.find((u) => u.id === uid)?.name}
                    </option>
                  ))}
                </Select>
                <Button variant="primary" onClick={addNote} disabled={!noteText.trim()}>
                  노트 추가
                </Button>
              </div>
            </div>
          </Block>
        </div>
      </div>

      <Modal
        open={evOpen}
        onClose={() => setEvOpen(false)}
        title="근거 잇기"
        footer={
          <>
            <Button onClick={() => setEvOpen(false)}>취소</Button>
            <Button variant="primary" onClick={addEvidence} disabled={!evDoc}>
              연결
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="문서">
            <Select value={evDoc} onChange={(ev) => setEvDoc(ev.target.value)}>
              <option value="">문서를 선택하세요</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  [{d.folder}] {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="위치" hint="문서 안에서 근거가 있는 곳을 정확히 적으면 검토자·감리가 바로 찾아갈 수 있습니다.">
            <Input value={evLoc} onChange={(ev) => setEvLoc(ev.target.value)} placeholder="예: p.3 · 행 12, 시트 원장!B1532" />
          </Field>
          <DemoNote>실제 버전은 문서 뷰어에서 셀·페이지 영역을 드래그해 위치를 자동으로 잇습니다.</DemoNote>
        </div>
      </Modal>
    </div>
  )
}

function Block({ icon, title, action, children }: { icon: ReactNode; title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-[14px] font-medium text-ink">
          <span className="text-muted">{icon}</span>
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  )
}
