import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import { Avatar, Button, Card, DemoNote, Field, Input, KrTag, Modal, ProgressBar, Select, Td, Textarea, Th } from '@/components/ui'
import { api } from '@/data/api'
import { useEngagement, useFirm, useTimeEntries, useToday, useUsers } from '@/data/hooks'
import { hoursByUser } from '@/domain/rules'
import type { Role } from '@/domain/types'
import { cx, pct } from '@/lib/format'

const roleLabel: Record<Role, string> = {
  partner: '업무수행이사',
  manager: '책임 회계사',
  senior: '회계사',
  staff: '수습 회계사',
  eqr: '심리',
  client: '고객사',
}

export function TimePage() {
  const { id } = useParams()
  const e = useEngagement(id)
  const firm = useFirm()
  const users = useUsers()
  const today = useToday()
  const entries = useTimeEntries(id)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending'>('all')
  const [form, setForm] = useState({ userId: '', date: today, hours: '4', memo: '' })

  const byUser = useMemo(() => hoursByUser(entries), [entries])
  const total = entries.reduce((a, t) => a + t.hours, 0)
  const pending = entries.filter((t) => !t.approvedAt)
  const std = e?.standardHours ?? 0
  const people = e ? [...new Set([e.leadId, ...e.teamIds, ...(e.eqrId ? [e.eqrId] : [])])] : []
  const accountants = e ? new Set([e.leadId, ...e.teamIds]).size : 0
  const isTeam = firm.kind === 'audit_team'
  const maxShare = total ? Math.max(...byUser.values()) / total : 0

  const userRows = [...new Set([...people, ...byUser.keys()])]
    .map((uid) => ({ uid, user: users.find((u) => u.id === uid), hours: byUser.get(uid) ?? 0 }))
    .sort((a, b) => b.hours - a.hours)

  const list = [...entries]
    .filter((t) => filter === 'all' || !t.approvedAt)
    .sort((a, b) => b.date.localeCompare(a.date))

  const submit = async () => {
    const h = Number(form.hours)
    if (!id || !form.userId || !h || h <= 0) return
    await api.addTime({ engagementId: id, userId: form.userId, date: form.date, hours: h, memo: form.memo || '감사 업무' })
    setOpen(false)
    setForm({ userId: '', date: today, hours: '4', memo: '' })
  }

  if (!e) return null
  const ratio = pct(total, std)

  return (
    <div className="min-h-full bg-canvas">
      <div className="flex items-center justify-between bg-white px-6 py-5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-normal text-ink">
            감사시간 <span className="text-muted">({entries.length})</span> <KrTag />
          </h1>
          <p className="mt-1 text-xs text-muted">
            외부감사법 제16조의2 표준감사시간 · 한공회 감사반 감리 필수 항목(감사시간 투입·집계)
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => {
            setForm((f) => ({ ...f, userId: f.userId || people[0] || '' }))
            setOpen(true)
          }}
        >
          시간 입력
        </Button>
      </div>

      <div className="space-y-4 px-6 pt-4 pb-10">
        <div className="grid grid-cols-3 gap-4">
          <Card title="총 투입 vs 표준감사시간">
            <div className="flex items-baseline gap-2">
              <span className="tabular text-[28px] font-semibold text-ink">{total}h</span>
              <span className="text-sm text-muted">/ 표준 {std ? `${std}h` : '미설정'}</span>
            </div>
            <div className="mt-3">
              <ProgressBar value={ratio} color={ratio < 60 ? '#f5a524' : '#3b82f6'} track={ratio < 60 ? '#fff8eb' : '#dbeafe'} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {std ? `표준 대비 ${ratio}% 투입` : '표준감사시간이 설정되지 않았습니다.'}
              {std > 0 && ratio < 60 && ' · 진행 중 업무라도 60% 미만이면 감리 대비 사유 기록 권장'}
            </p>
          </Card>
          <Card title="승인 대기">
            <div className="flex items-baseline gap-2">
              <span className={cx('tabular text-[28px] font-semibold', pending.length ? 'text-[#b7791f]' : 'text-done')}>{pending.length}건</span>
              <span className="text-sm text-muted">{pending.reduce((a, t) => a + t.hours, 0)}h</span>
            </div>
            <p className="mt-3 text-xs text-muted">책임 회계사가 승인해야 집계에 확정됩니다. 미승인 기록은 품질관리감리 지적 대상입니다.</p>
            {pending.length > 0 && (
              <button className="mt-2 text-xs text-brand hover:underline" onClick={() => setFilter('pending')}>
                대기 건만 보기
              </button>
            )}
          </Card>
          <Card title="참여 인원">
            <div className="flex items-baseline gap-2">
              <span className="tabular text-[28px] font-semibold text-ink">{accountants}명</span>
              <span className="text-sm text-muted">회계사{e.eqrId ? ' · 심리 1명 별도' : ''}</span>
            </div>
            <div className="mt-3 flex -space-x-1.5">
              {people.map((uid) => (
                <span key={uid} className="rounded-full ring-2 ring-white">
                  <Avatar user={users.find((u) => u.id === uid)} size={26} />
                </span>
              ))}
            </div>
            {isTeam ? (
              <p className={cx('mt-2 text-xs', accountants >= 3 ? 'text-done' : 'text-danger')}>
                감사반 3인 이상 공동감사 요건 {accountants >= 3 ? '충족' : '미충족'}
                {maxShare > 0.7 && <span className="text-[#b7791f]"> · 1인 비중 {Math.round(maxShare * 100)}%</span>}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">회계법인: 3인 요건은 감사반에만 적용됩니다.</p>
            )}
          </Card>
        </div>

        <Card title="인원별 투입">
          <div className="-mx-5">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>담당자</Th>
                  <Th>역할</Th>
                  <Th className="text-right">시간</Th>
                  <Th className="text-right">비중</Th>
                  <Th className="w-[35%]">분포</Th>
                </tr>
              </thead>
              <tbody>
                {userRows.map(({ uid, user, hours }) => {
                  const share = pct(hours, total)
                  const role = user?.id === e.leadId ? '업무수행이사' : user?.id === e.eqrId ? '심리' : user ? roleLabel[user.role] : ''
                  return (
                    <tr key={uid}>
                      <Td>
                        <Avatar user={user} withName />
                      </Td>
                      <Td className="text-muted">{role}</Td>
                      <Td className="tabular text-right">{hours}h</Td>
                      <Td className={cx('tabular text-right', share > 70 && 'font-medium text-[#b7791f]')}>{share}%</Td>
                      <Td>
                        <ProgressBar value={share} color={share > 70 ? '#f5a524' : '#3b82f6'} track="#f0f1f3" height={6} />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="시간 기록"
          action={
            <div className="flex rounded-md border border-line p-0.5 text-xs">
              {(['all', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cx('rounded px-2.5 py-1', filter === f ? 'bg-canvas font-medium text-ink' : 'text-muted')}
                >
                  {f === 'all' ? '전체' : `승인 대기 ${pending.length}`}
                </button>
              ))}
            </div>
          }
        >
          <div className="-mx-5">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>일자</Th>
                  <Th>담당자</Th>
                  <Th className="text-right">시간</Th>
                  <Th>내용</Th>
                  <Th>승인 상태</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const approver = users.find((u) => u.id === t.approvedBy)
                  return (
                    <tr key={t.id}>
                      <Td className="tabular">{t.date}</Td>
                      <Td>
                        <Avatar user={users.find((u) => u.id === t.userId)} withName />
                      </Td>
                      <Td className="tabular text-right">{t.hours}h</Td>
                      <Td>{t.memo}</Td>
                      <Td>
                        {t.approvedAt ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-done">
                            <Check size={14} /> 승인 · {approver?.name ?? ''} {t.approvedAt}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-flex h-6 items-center rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-700">대기</span>
                            <Button size="sm" onClick={() => api.approveTime(t.id)}>
                              승인
                            </Button>
                          </span>
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
        open={open}
        onClose={() => setOpen(false)}
        title="감사시간 입력"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>취소</Button>
            <Button variant="primary" onClick={submit} disabled={!form.userId || !(Number(form.hours) > 0)}>
              저장
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="담당자">
            <Select value={form.userId} onChange={(ev) => setForm({ ...form, userId: ev.target.value })}>
              <option value="">선택</option>
              {people.map((uid) => {
                const u = users.find((x) => x.id === uid)
                return (
                  <option key={uid} value={uid}>
                    {u?.name} · {u?.title}
                  </option>
                )
              })}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="일자">
              <Input type="date" value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} />
            </Field>
            <Field label="시간">
              <Input type="number" min={0.5} step={0.5} value={form.hours} onChange={(ev) => setForm({ ...form, hours: ev.target.value })} />
            </Field>
          </div>
          <Field label="내용">
            <Textarea rows={3} placeholder="예: 매출채권 조회서 회수·대사" value={form.memo} onChange={(ev) => setForm({ ...form, memo: ev.target.value })} />
          </Field>
          <DemoNote>입력된 시간은 승인 전까지 '대기'로 표시되며, 감리 모의고사의 감사시간 항목에 바로 반영됩니다.</DemoNote>
        </div>
      </Modal>
    </div>
  )
}
