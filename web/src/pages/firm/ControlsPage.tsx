import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { DemoNote, EmptyState, Input, KrTag, Select, Td, Th } from '@/components/ui'
import { useControls } from '@/data/hooks'
import type { ControlTemplate, Phase } from '@/domain/types'
import { cx } from '@/lib/format'

const phaseLabel: Record<Phase, string> = { planning: '계획', execution: '실행', concluding: '완료' }
const phaseCls: Record<Phase, string> = {
  planning: 'bg-blue-50 text-blue-700',
  execution: 'bg-amber-50 text-amber-700',
  concluding: 'bg-green-50 text-green-700',
}

export function ControlsPage() {
  const controls = useControls()
  const [q, setQ] = useState('')
  const [phase, setPhase] = useState<Phase | ''>('')
  const [selected, setSelected] = useState<string>()

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase()
    return controls.filter(
      (c) =>
        (!phase || c.phase === phase) &&
        (!k || [c.code, c.title, c.area, c.description, c.kicpaRef ?? ''].some((s) => s.toLowerCase().includes(k))),
    )
  }, [controls, q, phase])
  const sel = controls.find((c) => c.id === selected)

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-5">
        <h1 className="text-[26px] font-normal text-ink">절차 라이브러리 ({rows.length})</h1>
      </div>

      <div className="flex min-h-0 flex-1 border-t border-line">
        <aside className="w-[260px] shrink-0 space-y-4 border-r border-line px-5 py-5">
          <p className="text-[11px] font-semibold tracking-wider text-muted">FILTERS</p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="코드·절차명·기준서 검색" className="pl-8" />
          </div>
          <Select label="단계" value={phase} onChange={(e) => setPhase(e.target.value as Phase | '')}>
            <option value="">전체</option>
            {(Object.keys(phaseLabel) as Phase[]).map((p) => (
              <option key={p} value={p}>
                {phaseLabel[p]}
              </option>
            ))}
          </Select>
          <div className="rounded-md bg-canvas p-3 text-xs leading-relaxed text-muted">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-ink-2">
              한공회 감사조서 서식 매핑 <KrTag />
            </span>
            각 절차는 감사기준서 및 한국공인회계사회 표준 감사조서 서식 번호와 연결되어, 새 감사 업무 생성 시 동일한 구조로 복사됩니다.
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>코드</Th>
                <Th>절차명</Th>
                <Th>단계</Th>
                <Th>
                  <span className="inline-flex items-center gap-1.5">
                    기준서 <KrTag />
                  </span>
                </Th>
                <Th className="text-right">사용 업무 수</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c.id === selected ? undefined : c.id)}
                  className={cx('cursor-pointer hover:bg-canvas', c.id === selected && 'bg-brand-soft hover:bg-brand-soft')}
                >
                  <Td className="tabular font-medium text-ink">{c.code}</Td>
                  <Td>{c.title}</Td>
                  <Td>
                    <span className={cx('inline-flex h-6 items-center rounded px-2 text-xs font-medium', phaseCls[c.phase])}>{c.area}</span>
                  </Td>
                  <Td className="text-muted">{c.kicpaRef ?? '—'}</Td>
                  <Td className="tabular text-right">{c.usedIn}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <EmptyState title="검색 결과가 없습니다." />}
        </div>

        {sel && <ControlDetail c={sel} onClose={() => setSelected(undefined)} />}
      </div>
    </div>
  )
}

function ControlDetail({ c, onClose }: { c: ControlTemplate; onClose: () => void }) {
  return (
    <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-white">
      <header className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <p className="tabular text-xs text-muted">{c.code}</p>
          <h2 className="mt-0.5 text-[17px] font-medium text-ink">{c.title}</h2>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas" aria-label="닫기">
          <X size={18} />
        </button>
      </header>
      <dl className="space-y-4 px-5 py-4 text-[13px]">
        <div>
          <dt className="text-xs text-muted">단계 · 영역</dt>
          <dd className="mt-0.5 text-ink-2">
            {phaseLabel[c.phase]} · {c.area}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            기준서 · 한공회 서식 <KrTag />
          </dt>
          <dd className="mt-0.5 text-ink-2">{c.kicpaRef ?? '매핑 없음'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">목적</dt>
          <dd className="mt-0.5 leading-relaxed text-ink-2">{c.description || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">사용 중인 감사 업무</dt>
          <dd className="mt-0.5 text-ink-2">{c.usedIn}건</dd>
        </div>
      </dl>
      <div className="px-5 pb-5">
        <DemoNote>실제 버전에서는 이 절차를 편집하면 버전이 기록되고, 진행 중인 업무에 변경분을 반영할지 선택할 수 있습니다.</DemoNote>
      </div>
    </aside>
  )
}
