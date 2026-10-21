import { useState } from 'react'
import { Button, Field, Input, KrTag, Modal, Select } from '@/components/ui'
import { api } from '@/data/api'
import { useUsers } from '@/data/hooks'
import { legalDeadlines } from '@/domain/rules'
import type { Engagement, EngagementStatus, EngagementType } from '@/domain/types'

const types: EngagementType[] = ['외부감사', '반기검토', '내부회계 감사', '내부회계 검토']
const statuses: [EngagementStatus, string][] = [
  ['pending', '대기'],
  ['in_progress', '진행 중'],
  ['complete', '완료'],
  ['archived', '보관'],
]

/** 감사 업무 설정(헤더 톱니바퀴). 바꾼 값은 법정 기한·감리 모의고사에 바로 반영된다. */
export function EngagementSettingsModal({ engagement, open, onClose }: { engagement: Engagement; open: boolean; onClose: () => void }) {
  const users = useUsers().filter((u) => u.role !== 'client')
  const [draft, setDraft] = useState<Engagement>(engagement)
  const set = <K extends keyof Engagement>(k: K, v: Engagement[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const opt = (v: string) => (v === '' ? undefined : v)

  const save = async () => {
    await api.updateEngagement(engagement.id, draft)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="감사 업무 설정"
      width={720}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="업무명">
          <Input value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="업무 유형">
          <Select value={draft.type} onChange={(e) => set('type', e.target.value as EngagementType)}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="상태">
          <Select value={draft.status} onChange={(e) => set('status', e.target.value as EngagementStatus)}>
            {statuses.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="회계연도">
          <Input type="number" value={draft.fiscalYear} onChange={(e) => set('fiscalYear', Number(e.target.value))} />
        </Field>

        <div className="col-span-2 mt-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted">
          일정 <KrTag />
        </div>
        <Field label="정기주주총회 예정일" hint="법정 기한 계산의 기준일">
          <Input type="date" value={draft.agmDate ?? ''} onChange={(e) => set('agmDate', opt(e.target.value))} />
        </Field>
        <Field label="회사 재무제표 수령일">
          <Input type="date" value={draft.fsReceivedDate ?? ''} onChange={(e) => set('fsReceivedDate', opt(e.target.value))} />
        </Field>
        <Field label="감사보고서일">
          <Input type="date" value={draft.reportDate ?? ''} onChange={(e) => set('reportDate', opt(e.target.value))} />
        </Field>
        <Field label="조서 최종 취합일">
          <Input type="date" value={draft.archivedDate ?? ''} onChange={(e) => set('archivedDate', opt(e.target.value))} />
        </Field>

        <div className="col-span-2 rounded-md bg-canvas px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-ink-2">계산된 법정 기한</p>
          {legalDeadlines(draft).length === 0 ? (
            <p className="text-xs text-muted">정기총회 예정일을 입력하면 계산됩니다.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
              {legalDeadlines(draft).map((d) => (
                <li key={d.key} className="flex justify-between text-xs">
                  <span className="text-muted">{d.label}</span>
                  <span className="tabular text-ink-2">{d.date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-2 mt-2 text-xs font-semibold tracking-wider text-muted">기준값</div>
        <Field label="표준감사시간 (시간)" hint="외부감사법 제16조의2">
          <Input type="number" value={draft.standardHours ?? ''} onChange={(e) => set('standardHours', e.target.value ? Number(e.target.value) : undefined)} />
        </Field>
        <Field label="전체 중요성 (원)">
          <Input type="number" value={draft.materiality ?? ''} onChange={(e) => set('materiality', e.target.value ? Number(e.target.value) : undefined)} />
        </Field>

        <div className="col-span-2 mt-2 text-xs font-semibold tracking-wider text-muted">감사팀</div>
        <Field label="업무수행이사">
          <Select value={draft.leadId} onChange={(e) => set('leadId', e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="업무품질검토자(심리)" hint="품질관리기준서 2 · 업무수행이사와 달라야 함">
          <Select value={draft.eqrId ?? ''} onChange={(e) => set('eqrId', opt(e.target.value))}>
            <option value="">지정 안 함</option>
            {users
              .filter((u) => u.id !== draft.leadId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.title}
                </option>
              ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <p className="mb-1.5 text-xs font-medium text-ink-2">참여 구성원</p>
          <div className="flex flex-wrap gap-2">
            {users
              .filter((u) => u.id !== draft.leadId && u.id !== draft.eqrId)
              .map((u) => {
                const on = draft.teamIds.includes(u.id)
                return (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => set('teamIds', on ? draft.teamIds.filter((x) => x !== u.id) : [...draft.teamIds, u.id])}
                    />
                    {u.name} <span className="text-muted">{u.title}</span>
                  </label>
                )
              })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
