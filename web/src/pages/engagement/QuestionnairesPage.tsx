import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { Avatar, Button, DemoNote, EmptyState, Td, Th } from '@/components/ui'
import { api } from '@/data/api'
import { useQuestionnaires, useUsers } from '@/data/hooks'
import type { Questionnaire } from '@/domain/types'
import { cx, date } from '@/lib/format'

const statusMap: Record<Questionnaire['status'], { label: string; cls: string }> = {
  draft: { label: '초안', cls: 'bg-gray-100 text-gray-700' },
  sent: { label: '발송됨', cls: 'bg-blue-50 text-blue-700' },
  answered: { label: '답변 완료', cls: 'bg-green-50 text-green-700' },
}

function QStatus({ status }: { status: Questionnaire['status'] }) {
  const s = statusMap[status]
  return <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', s.cls)}>{s.label}</span>
}

export function QuestionnairesPage() {
  const { id } = useParams()
  const list = useQuestionnaires(id)
  const users = useUsers()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const selected = list.find((q) => q.id === selectedId) ?? list[0]

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="px-6 py-5">
          <h1 className="text-[26px] font-normal text-ink">질문서 ({list.length})</h1>
        </div>
        <div className="px-6 pb-10">
          {list.length === 0 ? (
            <EmptyState title="질문서가 없습니다." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>제목</Th>
                  <Th>수신자</Th>
                  <Th>답변</Th>
                  <Th>상태</Th>
                  <Th>발송일</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((q) => {
                  const answered = q.questions.filter((x) => x.answer).length
                  return (
                    <tr
                      key={q.id}
                      onClick={() => setSelectedId(q.id)}
                      className={cx('cursor-pointer hover:bg-canvas', selected?.id === q.id && 'bg-brand-soft/60')}
                    >
                      <Td className="font-medium text-ink">{q.title}</Td>
                      <Td>
                        <Avatar user={users.find((u) => u.id === q.recipientId)} withName />
                      </Td>
                      <Td className="tabular-nums">
                        {answered}/{q.questions.length}
                      </Td>
                      <Td>
                        <QStatus status={q.status} />
                      </Td>
                      <Td>{q.sentAt ? date(q.sentAt) : <span className="text-faint">—</span>}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <aside className="flex w-[440px] shrink-0 flex-col overflow-auto border-l border-line">
          <header className="border-b border-line px-5 py-4">
            <div className="mb-1">
              <QStatus status={selected.status} />
            </div>
            <h2 className="text-[17px] font-medium text-ink">{selected.title}</h2>
            <p className="mt-1 text-xs text-muted">
              수신: {users.find((u) => u.id === selected.recipientId)?.name ?? '—'}
              {selected.sentAt && ` · 발송 ${date(selected.sentAt)}`}
            </p>
            {selected.status === 'draft' && (
              <Button variant="primary" className="mt-3" icon={<Send size={15} />} onClick={() => api.sendQuestionnaire(selected.id)}>
                고객에게 발송
              </Button>
            )}
          </header>
          <ol className="space-y-4 px-5 py-4">
            {selected.questions.map((x, i) => (
              <li key={x.id}>
                <p className="text-[13px] font-medium text-ink">
                  Q{i + 1}. {x.text}
                </p>
                {x.answer ? (
                  <p className="mt-1.5 rounded-md bg-canvas px-3 py-2 text-[13px] whitespace-pre-wrap text-ink-2">{x.answer}</p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-faint">{selected.status === 'draft' ? '발송 전' : '답변 대기 중'}</p>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-auto px-5 pb-5">
            <DemoNote>
              답변은 고객사 담당자가{' '}
              <Link to={`/portal/${id}`} className="text-brand hover:underline">
                고객 포털
              </Link>
              에서 직접 입력하며, 입력 즉시 이 화면에 반영됩니다.
            </DemoNote>
          </div>
        </aside>
      )}
    </div>
  )
}
