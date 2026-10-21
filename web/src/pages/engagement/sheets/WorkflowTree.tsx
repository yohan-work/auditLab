import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Circle, Clock, CheckCircle2, FileText, ClipboardList, Search } from 'lucide-react'
import { folderCount, nodeState } from '@/domain/rules'
import type { WorkflowNode } from '@/domain/types'
import { cx } from '@/lib/format'

export function StateIcon({ node, size = 16 }: { node: WorkflowNode; size?: number }) {
  const s = nodeState(node)
  if (s === 'reviewed') return <CheckCircle2 size={size} className="shrink-0 text-done" />
  if (s === 'prepared') return <Clock size={size} className="shrink-0 text-pending" />
  return <Circle size={size} className="shrink-0 text-faint" />
}

export const stateLabel = { todo: '미착수', prepared: '작성 완료', reviewed: '검토 완료' } as const

/** id 중복을 제거하고 부모별 자식 목록을 만든다 */
export function useTree(nodes: WorkflowNode[]) {
  return useMemo(() => {
    const seen = new Set<string>()
    const unique = nodes.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    const children = new Map<string, WorkflowNode[]>()
    for (const n of unique) {
      const k = n.parentId ?? ''
      children.set(k, [...(children.get(k) ?? []), n])
    }
    for (const list of children.values()) list.sort((a, b) => a.order - b.order)
    const byId = new Map(unique.map((n) => [n.id, n]))
    const ancestors = (id: string) => {
      const out: WorkflowNode[] = []
      let cur = byId.get(id)
      while (cur?.parentId) {
        cur = byId.get(cur.parentId)
        if (cur) out.unshift(cur)
      }
      return out
    }
    return { unique, children, byId, ancestors }
  }, [nodes])
}

export function WorkflowTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: WorkflowNode[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const { unique, children } = useTree(nodes)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const matches = useMemo(() => {
    if (!query) return null
    const hit = new Set<string>()
    const visit = (n: WorkflowNode): boolean => {
      const self = `${n.code} ${n.title}`.toLowerCase().includes(query)
      const kids = (children.get(n.id) ?? []).map(visit).some(Boolean)
      if (self || kids) hit.add(n.id)
      return self || kids
    }
    ;(children.get('') ?? []).forEach(visit)
    return hit
  }, [query, children])

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const render = (n: WorkflowNode, depth: number) => {
    if (matches && !matches.has(n.id)) return null
    const isFolder = n.type === 'folder'
    const open = matches ? true : !collapsed.has(n.id)
    const [done, total] = isFolder ? folderCount(n.id, unique) : [0, 0]
    const active = selectedId === n.id
    return (
      <div key={n.id}>
        <div
          onClick={() => onSelect(n.id)}
          className={cx(
            'group flex h-9 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-[13px]',
            active ? 'bg-brand-soft text-ink' : 'text-ink-2 hover:bg-[#f0f1f3]',
          )}
          style={{ paddingLeft: 6 + depth * 16 }}
        >
          {isFolder ? (
            <button
              onClick={(ev) => {
                ev.stopPropagation()
                toggle(n.id)
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-line"
              aria-label={open ? '접기' : '펼치기'}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          {isFolder ? (
            open ? (
              <FolderOpen size={16} className="shrink-0 text-brand" />
            ) : (
              <Folder size={16} className="shrink-0 fill-brand/15 text-brand" />
            )
          ) : (
            <StateIcon node={n} />
          )}
          {!isFolder && depth > 0 && <span className="tabular shrink-0 text-[11px] text-muted">{n.code}</span>}
          <span className={cx('min-w-0 flex-1 truncate', isFolder && 'font-medium text-ink')}>
            {isFolder && depth > 0 && <span className="tabular mr-1 text-[11px] font-normal text-muted">{n.code}</span>}
            {n.title}
          </span>
          {isFolder ? (
            <span className={cx('tabular shrink-0 text-[11px]', done === total && total > 0 ? 'text-done' : 'text-muted')}>
              {done}/{total}
            </span>
          ) : n.type === 'form' ? (
            <ClipboardList size={13} className="shrink-0 text-faint" />
          ) : (
            <FileText size={13} className="shrink-0 text-faint opacity-0 group-hover:opacity-100" />
          )}
        </div>
        {isFolder && open && (children.get(n.id) ?? []).map((c) => render(c, depth + 1))}
      </div>
    )
  }

  return (
    <>
      <div className="relative px-4 pb-3">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-7 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="워크플로 검색"
          className="h-9 w-full rounded-md border border-line bg-white pr-3 pl-8 text-sm outline-none placeholder:text-faint focus:border-brand"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {(children.get('') ?? []).map((n) => render(n, 0))}
        {matches && matches.size === 0 && <p className="px-4 py-6 text-center text-sm text-muted">검색 결과가 없습니다.</p>}
      </div>
    </>
  )
}
