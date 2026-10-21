import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Folder,
  GripVertical,
  Link2,
  Palette,
  Wand2,
} from 'lucide-react'
import { Button, DemoNote, KrTag, Modal } from '@/components/ui'
import { useEngagement, useFsLines, useWorkflow } from '@/data/hooks'
import { folderCount, nodeState } from '@/domain/rules'
import type { FSLine, WorkflowNode } from '@/domain/types'
import { cx, num } from '@/lib/format'

type Stmt = 'BS' | 'IS'

interface FootIssue {
  label: string
  column: '당기' | '전기'
  expected: number
  actual: number
}

/** 합계 검증: 소계가 구성 계정의 합과 같은지, 자산 총계 = 부채 총계 + 자본 총계 인지 */
function footing(lines: FSLine[], stmt: Stmt): FootIssue[] {
  const issues: FootIssue[] = []
  const cols: { key: 'current' | 'prior'; name: '당기' | '전기' }[] = [
    { key: 'current', name: '당기' },
    { key: 'prior', name: '전기' },
  ]
  for (const { key, name } of cols) {
    if (stmt === 'BS') {
      const stack: { level: number; sum: number }[] = []
      for (const l of lines) {
        if (l.kind === 'header') {
          stack.push({ level: l.level, sum: 0 })
        } else if (l.kind === 'line') {
          for (const g of stack) g.sum += l[key] ?? 0
        } else {
          while (stack.length && stack[stack.length - 1].level > l.level) stack.pop()
          const g = stack.pop()
          if (g && l[key] !== undefined && g.sum !== l[key]) {
            issues.push({ label: l.label, column: name, expected: g.sum, actual: l[key]! })
          }
        }
      }
      const find = (id: string) => lines.find((l) => l.id === id)?.[key] ?? 0
      const a = find('bs-a-t')
      const le = find('bs-l-t') + find('bs-eq-t')
      if (a !== le) issues.push({ label: '자산 총계 = 부채 총계 + 자본 총계', column: name, expected: le, actual: a })
    } else {
      // 손익계산서: 첫 계정은 가산, 이후 계정은 차감, 합계 행에서 누계를 대조
      let running: number | null = null
      for (const l of lines) {
        const v = l[key]
        if (v === undefined) continue
        if (l.kind === 'line') running = running === null ? v : running - v
        else if (l.kind === 'total') {
          if (running !== null && running !== v) issues.push({ label: l.label, column: name, expected: running, actual: v })
          running = v
        }
      }
    }
  }
  return issues
}

/** 접힌 헤더 아래 행인지 판단 */
function visibleRows(lines: FSLine[], collapsed: Set<string>) {
  const out: FSLine[] = []
  let hideUntilLevel: number | null = null
  for (const l of lines) {
    if (hideUntilLevel !== null) {
      const closes = (l.kind === 'total' || l.kind === 'header') && l.level <= hideUntilLevel
      if (!closes) continue
      hideUntilLevel = null
    }
    out.push(l)
    if (l.kind === 'header' && collapsed.has(l.id)) hideUntilLevel = l.level
  }
  return out
}

function WorkflowSummary({ nodes, engId, title }: { nodes: WorkflowNode[]; engId: string; title: string }) {
  const roots = nodes.filter((n) => !n.parentId && n.type === 'folder').sort((a, b) => a.order - b.order)
  return (
    <aside className="w-[380px] shrink-0 overflow-y-auto border-r border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">워크플로</p>
        <h2 className="mt-1 text-[15px] font-medium text-ink">{title}</h2>
      </div>
      <ul className="py-2">
        {roots.map((r) => {
          const [d, t] = folderCount(r.id, nodes)
          const kids = nodes.filter((n) => n.parentId === r.id).sort((a, b) => a.order - b.order)
          return (
            <li key={r.id}>
              <div className="flex h-10 items-center gap-2 px-5 text-[13px] font-medium text-ink">
                <ChevronDown size={14} className="text-muted" />
                <Folder size={15} className="text-muted" />
                <span className="flex-1 truncate">
                  {r.title}
                </span>
                <span className={cx('tabular text-xs', d === t && t > 0 ? 'text-done' : 'text-muted')}>
                  {d}/{t}
                </span>
              </div>
              <ul>
                {kids.map((k) => {
                  const [kd, kt] = k.type === 'folder' ? folderCount(k.id, nodes) : [nodeState(k) === 'reviewed' ? 1 : 0, 1]
                  return (
                    <li key={k.id}>
                      <Link
                        to={`/engagements/${engId}/sheets?node=${k.id}`}
                        className="flex h-9 items-center gap-2 pr-5 pl-12 text-[13px] text-ink-2 hover:bg-canvas"
                      >
                        {k.type === 'folder' ? <Folder size={14} className="text-faint" /> : <FileText size={14} className="text-faint" />}
                        <span className="flex-1 truncate">
                          <span className="mr-1.5 text-muted">{k.code}</span>
                          {k.title}
                        </span>
                        <span className={cx('tabular text-xs', kd === kt && kt > 0 ? 'text-done' : 'text-faint')}>
                          {kd}/{kt}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

export function ReportingPage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const allLines = useFsLines(id)
  const nodes = useWorkflow(id)
  const [stmt, setStmt] = useState<Stmt>('BS')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const [linkLine, setLinkLine] = useState<FSLine | null>(null)
  const [issuesOpen, setIssuesOpen] = useState(false)

  const lines = useMemo(() => allLines.filter((l) => l.statement === stmt), [allLines, stmt])
  const issues = useMemo(() => footing(lines, stmt), [lines, stmt])
  const rows = visibleRows(lines, collapsed).filter((l) => showHidden || !hidden.has(l.id))
  const dartMismatch = lines.filter((l) => l.dartPrior !== undefined && l.prior !== undefined && l.dartPrior !== l.prior).length
  const year = e?.fiscalYear ?? 2026

  const toggle = (set: Set<string>, key: string) => {
    const n = new Set(set)
    if (n.has(key)) n.delete(key)
    else n.add(key)
    return n
  }

  if (!e) return null

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <WorkflowSummary nodes={nodes} engId={e.id} title={e.name} />

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-5">
          <h1 className="text-[26px] font-normal text-ink">재무제표</h1>
          <div className="flex items-center gap-2">
            <Button icon={<Wand2 size={15} />} onClick={() => setGenOpen(true)}>
              생성
            </Button>
            <Button icon={<Palette size={15} />} onClick={() => setStyleOpen(true)}>
              스타일 관리
            </Button>
            <Button icon={showHidden ? <EyeOff size={15} /> : <Eye size={15} />} onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? '숨긴 항목 가리기' : '숨긴 항목 보기'}
              {hidden.size > 0 && <span className="text-muted">({hidden.size})</span>}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-line px-6">
          {(['BS', 'IS'] as Stmt[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStmt(s)
                setSelected(new Set())
              }}
              className={cx(
                '-mb-px h-10 border-b-2 px-3 text-sm',
                stmt === s ? 'border-brand font-medium text-ink' : 'border-transparent text-muted hover:text-ink-2',
              )}
            >
              {s === 'BS' ? '재무상태표' : '손익계산서'}
            </button>
          ))}
          <div className="flex-1" />
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={<EyeOff size={13} />}
              onClick={() => {
                setHidden((h) => new Set([...h, ...selected]))
                setSelected(new Set())
              }}
            >
              선택 {selected.size}개 숨기기
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
          {issues.length === 0 ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-done-soft px-3 text-[13px] text-done">
              <CheckCircle2 size={15} /> 합계 검증: 이상 없음
            </span>
          ) : (
            <button
              onClick={() => setIssuesOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger-soft px-3 text-[13px] text-danger hover:underline"
            >
              <AlertTriangle size={15} /> 합계 검증: 불일치 {issues.length}건
            </button>
          )}
          {dartMismatch > 0 && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger-soft px-3 text-[13px] text-danger">
              <AlertTriangle size={15} /> 전기 공시 금액 불일치 {dartMismatch}건
            </span>
          )}
          <span className="ml-auto text-xs text-muted">단위: 천원</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-8">
          <table className="mt-2 w-full min-w-[860px] border-collapse">
            <thead>
              <tr>
                <th className="h-11 w-10" />
                <th className="h-11 px-2 text-left text-[13px] font-medium text-ink-2">계정과목</th>
                <th className="h-11 w-8" />
                <th className="h-11 w-32 px-3 text-left text-[13px] font-medium text-ink-2">연결 조서</th>
                <th className="h-11 w-36 px-3 text-right text-[13px] font-medium text-ink-2">{year}</th>
                <th className="h-11 w-36 px-3 text-right text-[13px] font-medium text-ink-2">전기</th>
                <th className="h-11 w-44 px-3 text-right text-[13px] font-medium text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    DART 전기 공시 <KrTag />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const isTotal = l.kind === 'total'
                const isHeader = l.kind === 'header'
                const mismatch = l.dartPrior !== undefined && l.prior !== undefined && l.dartPrior !== l.prior
                const isHidden = hidden.has(l.id)
                const indent = isHeader ? l.level * 16 : l.kind === 'line' ? 40 : l.level * 16 + 20
                return (
                  <tr
                    key={l.id}
                    className={cx(
                      'group h-12 border-t border-line-2 text-[13px]',
                      isTotal && 'bg-canvas/60 font-semibold text-ink',
                      isHidden && 'opacity-45',
                    )}
                  >
                    <td className="px-2 text-center">
                      {!isTotal && (
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-brand"
                          checked={selected.has(l.id)}
                          onChange={() => setSelected((s) => toggle(s, l.id))}
                        />
                      )}
                    </td>
                    <td className="px-2">
                      <div className="flex items-center gap-1" style={{ paddingLeft: indent }}>
                        {isHeader && (
                          <button
                            onClick={() => setCollapsed((c) => toggle(c, l.id))}
                            className="-ml-5 rounded p-0.5 text-muted hover:bg-canvas"
                            aria-label="접기/펼치기"
                          >
                            {collapsed.has(l.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                        <span className={cx(isHeader && 'font-medium text-ink', !isHeader && !isTotal && 'text-ink-2')}>{l.label}</span>
                        {isHidden && (
                          <button
                            className="ml-2 text-xs font-normal text-brand hover:underline"
                            onClick={() => setHidden((h) => toggle(h, l.id))}
                          >
                            다시 표시
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-faint">
                      <GripVertical size={14} className="cursor-grab opacity-0 group-hover:opacity-100" />
                    </td>
                    <td className="px-3">
                      {l.linkedNodeIds.length > 0 ? (
                        <button
                          onClick={() => setLinkLine(l)}
                          className="inline-flex items-center gap-1 font-normal text-brand hover:underline"
                        >
                          <Link2 size={13} /> {l.linkedNodeIds.length}개 조서
                        </button>
                      ) : (
                        !isHeader && <span className="font-normal text-faint">—</span>
                      )}
                    </td>
                    <td className="tabular px-3 text-right">{num(l.current)}</td>
                    <td className="tabular px-3 text-right">{num(l.prior)}</td>
                    <td className="tabular px-3 text-right">
                      {l.dartPrior !== undefined &&
                        (mismatch ? (
                          <span
                            title={`전기 감사보고서 공시 금액과 불일치 (차이 ${num((l.prior ?? 0) - l.dartPrior)})`}
                            className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-danger"
                          >
                            <AlertTriangle size={12} />
                            {num(l.dartPrior)}
                          </span>
                        ) : (
                          <span className="text-muted">{num(l.dartPrior)}</span>
                        ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted">
            DART 전기 공시: 전기 감사보고서(전자공시)의 금액과 회사가 제시한 전기 금액을 대조합니다. 불일치는 전기오류수정·재분류 여부를 확인해야 합니다.
          </p>
        </div>
      </section>

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="주석 초안 생성" footer={<Button variant="primary" onClick={() => setGenOpen(false)}>확인</Button>}>
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            연결된 조서의 결론·근거 문서를 바탕으로 계정별 주석 초안을 만들어, 회사가 제출한 재무제표·주석과 대조하는 데 씁니다.
          </p>
          <p className="rounded-md border border-line px-3 py-2 text-xs text-muted">
            재무제표 작성 책임은 회사에 있습니다(외부감사법 제6조). 감사인이 재무제표를 대신 작성하면 독립성 위반이므로, 이 기능은 감사인의
            비교·검증용 초안만 만듭니다.
          </p>
          <DemoNote>실제 버전은 연결 조서({allLines.reduce((a, l) => a + l.linkedNodeIds.length, 0)}건)를 읽어 주석 초안을 작성하고, 회사 제출본과의 차이를 표시합니다.</DemoNote>
        </div>
      </Modal>

      <Modal open={styleOpen} onClose={() => setStyleOpen(false)} title="스타일 관리" footer={<Button onClick={() => setStyleOpen(false)}>닫기</Button>}>
        <DemoNote>실제 버전은 계정 표시 순서·들여쓰기·합계 행 서식·금액 단위(원/천원/백만원)를 설정합니다.</DemoNote>
      </Modal>

      <Modal open={issuesOpen} onClose={() => setIssuesOpen(false)} title="합계 검증 불일치">
        <ul className="divide-y divide-line-2 text-[13px]">
          {issues.map((i, k) => (
            <li key={k} className="flex items-center justify-between py-2.5">
              <span>
                {i.label} <span className="text-muted">· {i.column}</span>
              </span>
              <span className="tabular text-danger">
                표시 {num(i.actual)} / 계산 {num(i.expected)}
              </span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={!!linkLine} onClose={() => setLinkLine(null)} title={`연결 조서 · ${linkLine?.label ?? ''}`}>
        <ul className="divide-y divide-line-2">
          {linkLine?.linkedNodeIds.map((nid) => {
            const n = nodes.find((x) => x.id === nid)
            const st = n ? nodeState(n) : 'todo'
            return (
              <li key={nid}>
                <Link
                  to={`/engagements/${e.id}/sheets?node=${nid}`}
                  className="flex h-11 items-center gap-2 rounded px-1 text-[13px] text-ink-2 hover:bg-canvas"
                >
                  <FileText size={14} className="text-faint" />
                  <span className="w-14 text-muted">{n?.code ?? nid}</span>
                  <span className="flex-1 truncate text-brand">{n?.title ?? '조서'}</span>
                  <span className={cx('text-xs', st === 'reviewed' ? 'text-done' : st === 'prepared' ? 'text-[#b7791f]' : 'text-muted')}>
                    {st === 'reviewed' ? '검토 완료' : st === 'prepared' ? '작성됨' : '미작성'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Modal>
    </div>
  )
}
