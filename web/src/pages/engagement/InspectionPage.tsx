import { useState } from 'react'
import { ActivityLog } from '@/components/ActivityLog'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, FileDown, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button, DemoNote, KrTag, LevelBadge, Modal } from '@/components/ui'
import { useEngagement, useInspection, useToday } from '@/data/hooks'
import { scoreFindings } from '@/domain/rules'
import type { CheckLevel, InspectionFinding } from '@/domain/types'
import { cx } from '@/lib/format'

const order: Record<CheckLevel, number> = { fail: 0, warn: 1, pass: 2 }
const levelColor: Record<CheckLevel, string> = { fail: '#dc2626', warn: '#f5a524', pass: '#22a35a' }

function ScoreStat({ level, value, label }: { level: CheckLevel; value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-[40px] leading-none font-semibold" style={{ color: value ? levelColor[level] : '#9ca3af' }}>
        {value}
      </span>
      <span className="mt-2 text-sm text-ink-2">{label}</span>
    </div>
  )
}

export function InspectionPage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const today = useToday()
  const findings = useInspection(id)
  const score = scoreFindings(findings)
  const [exportOpen, setExportOpen] = useState(false)

  const groups = new Map<string, InspectionFinding[]>()
  for (const f of findings) groups.set(f.category, [...(groups.get(f.category) ?? []), f])
  const sortedGroups = [...groups.entries()]
    .map(([cat, items]) => [cat, [...items].sort((a, b) => order[a.level] - order[b.level])] as const)
    .sort((a, b) => order[a[1][0].level] - order[b[1][0].level] || b[1].filter((x) => x.level === 'fail').length - a[1].filter((x) => x.level === 'fail').length)

  const total = findings.length || 1
  const verdict = score.fail ? '지적 예상 항목이 있습니다' : score.warn ? '주의 항목을 정리하면 됩니다' : '주요 점검 항목을 모두 충족합니다'

  if (!e) return null

  return (
    <div className="min-h-full bg-canvas">
      <div className="flex items-center justify-between bg-white px-6 py-5">
        <h1 className="flex items-center gap-2 text-[26px] font-normal text-ink">
          감리 모의고사 <span className="text-muted">({findings.length})</span> <KrTag />
        </h1>
        <Button icon={<FileDown size={15} />} onClick={() => setExportOpen(true)}>
          보고서 내보내기
        </Button>
      </div>

      <div className="space-y-5 px-6 pt-4 pb-10">
        <section className="rounded-lg border border-line bg-white p-6">
          <div className="flex flex-wrap items-start gap-10">
            <div className="flex items-center gap-4">
              <span
                className={cx('flex h-14 w-14 items-center justify-center rounded-full', score.fail ? 'bg-danger-soft text-danger' : 'bg-done-soft text-done')}
              >
                {score.fail ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}
              </span>
              <div>
                <p className="text-xs text-muted">
                  {e.name} · 기준일 {today}
                </p>
                <p className="mt-1 text-xl font-medium text-ink">{verdict}</p>
              </div>
            </div>
            <div className="ml-auto flex gap-10">
              <ScoreStat level="fail" value={score.fail} label="지적 예상" />
              <ScoreStat level="warn" value={score.warn} label="주의" />
              <ScoreStat level="pass" value={score.pass} label="충족" />
            </div>
          </div>

          <div className="mt-6 flex h-2.5 w-full gap-1 overflow-hidden rounded-full">
            {(['fail', 'warn', 'pass'] as CheckLevel[]).map((l) =>
              score[l] ? <div key={l} className="h-full rounded-full" style={{ width: `${(score[l] / total) * 100}%`, background: levelColor[l] }} /> : null,
            )}
          </div>

          <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-muted">
            금감원·한공회 감리에서 자주 지적되는 상위 항목(독립성 확인, 감사시간 입력·승인, 조서 검토 서명, 외부조회 대체절차, 심리, 조서 취합 기한 등)을
            규칙으로 만들어 이 업무의 기록 상태를 점검합니다. 감사인의 판단을 대신하지 않으며, <span className="text-ink-2">기록 누락</span>을 미리 찾아내는
            용도입니다.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {sortedGroups.map(([cat, items]) => {
            const s = scoreFindings(items)
            return (
              <section key={cat} className="rounded-lg border border-line bg-white">
                <header className="flex items-center justify-between px-5 pt-4 pb-2">
                  <h3 className="text-[15px] font-medium text-ink">{cat}</h3>
                  <span className="flex gap-2 text-xs">
                    {s.fail > 0 && <span className="text-danger">지적 {s.fail}</span>}
                    {s.warn > 0 && <span className="text-[#b7791f]">주의 {s.warn}</span>}
                    {s.pass > 0 && <span className="text-done">충족 {s.pass}</span>}
                  </span>
                </header>
                <ul>
                  {items.map((f) => (
                    <li
                      key={f.ruleId}
                      className="flex items-start gap-4 border-t border-line-2 px-5 py-3.5"
                      style={{ boxShadow: `inset 3px 0 0 ${f.level === 'pass' ? 'transparent' : levelColor[f.level]}` }}
                    >
                      <div className="w-[72px] shrink-0 pt-0.5">
                        <LevelBadge level={f.level} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{f.title}</p>
                        <p className={cx('mt-0.5 text-[13px]', f.level === 'pass' ? 'text-muted' : 'text-ink-2')}>{f.detail}</p>
                        <p className="mt-1 text-[11px] text-faint">{f.basis}</p>
                      </div>
                      {f.link && (
                        <Link to={f.link} className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium text-brand hover:underline">
                          바로가기 <ArrowRight size={13} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
        <div className="mt-5">
          <ActivityLog engagementId={id} />
        </div>
      </div>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="감리 대비 자가점검 리포트" footer={<Button variant="primary" onClick={() => setExportOpen(false)}>확인</Button>}>
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            지적 예상 {score.fail}건 · 주의 {score.warn}건 · 충족 {score.pass}건을 항목별 근거와 함께 정리합니다.
          </p>
          <DemoNote>실제 버전은 점검 결과·근거 조서 링크·조치 이력을 담은 PDF 「감리 대비 자가점검 리포트」를 내보냅니다.</DemoNote>
        </div>
      </Modal>
    </div>
  )
}
