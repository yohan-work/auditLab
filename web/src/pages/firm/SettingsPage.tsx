import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Avatar, Button, Card, KrTag, Modal, Td, Th } from '@/components/ui'
import { resetDb } from '@/data/store'
import { useCurrentUser, useEngagements, useFirm, useToday, useUsers } from '@/data/hooks'
import type { Role } from '@/domain/types'

const roleLabel: Record<Role, string> = {
  partner: '업무수행이사',
  manager: '책임자',
  senior: '현장책임',
  staff: '담당',
  eqr: '심리(업무품질검토)',
  client: '고객사',
}

export function SettingsPage() {
  const users = useUsers().filter((u) => u.role !== 'client')
  const firm = useFirm()
  const me = useCurrentUser()
  const today = useToday()
  const engagements = useEngagements()
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <div className="bg-white px-6 py-5">
        <h1 className="text-[26px] font-normal text-ink">설정</h1>
      </div>
      <div className="grid gap-5 border-t border-line px-6 py-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Card title={`구성원 (${users.length})`}>
            <table className="w-full">
              <thead>
                <tr>
                  <Th className="pl-0">이름</Th>
                  <Th>직함</Th>
                  <Th>역할</Th>
                  <Th className="text-right">참여 업무</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <Td className="pl-0">
                      <span className="inline-flex items-center gap-2">
                        <Avatar user={u} withName />
                        {u.id === me.id && <span className="rounded bg-brand-soft px-1.5 text-[11px] text-brand-dark">나</span>}
                      </span>
                    </Td>
                    <Td>{u.title}</Td>
                    <Td>{roleLabel[u.role]}</Td>
                    <Td className="tabular text-right">
                      {engagements.filter((e) => e.leadId === u.id || e.teamIds.includes(u.id) || e.eqrId === u.id).length}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="아키텍처">
            <div className="space-y-2 text-[13px] leading-relaxed text-ink-2">
              <p>
                지금 보이는 모든 데이터는 브라우저 메모리의 <b className="font-medium">시연용 목(mock) 데이터</b>입니다(
                <code className="rounded bg-canvas px-1 text-xs">src/data/mock/seed.ts</code>). 새로고침하면 처음 상태로 돌아갑니다.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  화면은 읽기용 훅(<code className="rounded bg-canvas px-1 text-xs">src/data/hooks.ts</code>)과 쓰기용{' '}
                  <code className="rounded bg-canvas px-1 text-xs">api</code>만 사용합니다.
                </li>
                <li>
                  업무 규칙(법정 기한, 진행률, 감리 모의고사)은 순수 함수(
                  <code className="rounded bg-canvas px-1 text-xs">src/domain/rules.ts</code>)라 서버에서도 그대로 재사용할 수 있습니다.
                </li>
                <li>
                  실제 백엔드로 바꿀 교체 지점은 <code className="rounded bg-canvas px-1 text-xs">src/data/api.ts</code>입니다.{' '}
                  <code className="rounded bg-canvas px-1 text-xs">AuditApi</code> 인터페이스를 HTTP 클라이언트로 구현해{' '}
                  <code className="rounded bg-canvas px-1 text-xs">export const api = mockApi</code> 한 줄만 바꾸면 됩니다.
                </li>
              </ul>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="법인 정보">
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">이름</dt>
                <dd className="text-ink">{firm.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">형태</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  {firm.kind === 'audit_team' ? '감사반' : '회계법인'} <KrTag />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">로그인 사용자</dt>
                <dd className="text-ink">
                  {me.name} · {me.title}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">시연 기준일</dt>
                <dd className="tabular text-ink">{today}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">법인 형태는 품질관리 화면에서 바꿀 수 있습니다.</p>
          </Card>

          <Card title="시연 데이터">
            <p className="mb-3 text-[13px] text-ink-2">요청 상태, 서명, 시간 기록 등 지금까지 클릭으로 바꾼 내용을 모두 처음 상태로 되돌립니다.</p>
            <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setConfirm(true)}>
              시연 데이터 초기화
            </Button>
            {done && <p className="mt-2 text-xs text-done">초기화했습니다.</p>}
          </Card>
        </div>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="시연 데이터 초기화"
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>취소</Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDb()
                setConfirm(false)
                setDone(true)
              }}
            >
              초기화
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-2">모든 변경 사항이 사라지고 샘플 데이터로 돌아갑니다. 계속할까요?</p>
      </Modal>
    </div>
  )
}
