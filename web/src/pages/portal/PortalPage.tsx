import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, FileText, MessageSquare, Upload } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Avatar, Button, DemoNote, Input, ProgressBar, RequestStatusBadge, Textarea } from '@/components/ui'
import { api } from '@/data/api'
import { useClient, useDocuments, useEngagement, useFirm, useQuestionnaires, useRequests, useToday, useUsers } from '@/data/hooks'
import type { AuditRequest, Questionnaire, User } from '@/domain/types'
import { cx, date, dateTime, pct } from '@/lib/format'

const ORDER: Record<AuditRequest['status'], number> = { returned: 0, open: 1, submitted: 2, in_review: 3, accepted: 4 }

export function PortalPage() {
  const { id } = useParams()
  const engagement = useEngagement(id)
  const client = useClient(engagement?.clientId)
  const firm = useFirm()
  const users = useUsers()
  const requests = useRequests(id)
  const questionnaires = useQuestionnaires(id)

  if (!engagement) return <div className="p-10 text-muted">감사 업무를 찾을 수 없습니다.</div>

  const clientUser = users.find((u) => u.role === 'client' && u.clientId === engagement.clientId)
  const accepted = requests.filter((r) => r.status === 'accepted').length
  const todo = requests.filter((r) => r.status === 'open' || r.status === 'returned').length
  const sorted = [...requests].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.dueDate.localeCompare(b.dueDate))
  const sentQs = questionnaires.filter((q) => q.status !== 'draft')

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-[960px] items-center gap-3 px-6">
          <Logo size={26} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-ink">
              {firm.name} · {client?.name ?? '고객사'} 감사 자료 제출
            </p>
            <p className="text-xs text-muted">
              {engagement.name} · {engagement.fiscalYear} 회계연도
            </p>
          </div>
          {clientUser && (
            <span className="hidden items-center gap-2 sm:flex">
              <Avatar user={clientUser} size={28} />
              <span className="text-[13px] leading-tight">
                <span className="block font-medium text-ink">{clientUser.name}</span>
                <span className="block text-xs text-muted">{clientUser.title}</span>
              </span>
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[960px] space-y-6 px-6 py-6">
        <Link to={`/engagements/${engagement.id}/requests`} className="inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
          <ArrowLeft size={14} /> 감사인 화면으로 돌아가기
        </Link>

        <section className="rounded-lg border border-line bg-white px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-[22px] font-normal text-ink">요청 자료 제출 현황</h1>
              <p className="mt-1 text-[13px] text-muted">
                전체 {requests.length}건 중 {accepted}건 승인 · 제출이 필요한 자료 <b className="font-medium text-ink">{todo}건</b>
              </p>
            </div>
            <span className="text-[26px] font-light text-ink tabular-nums">{pct(accepted, requests.length)}%</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={pct(accepted, requests.length)} color="#22a35a" track="#e8f5ee" height={10} />
          </div>
        </section>

        <section className="space-y-3">
          {sorted.map((r) => (
            <RequestCard key={r.id} request={r} clientUser={clientUser} users={users} />
          ))}
        </section>

        {sentQs.length > 0 && (
          <section className="space-y-3">
            <h2 className="pt-2 text-[18px] font-normal text-ink">질문서</h2>
            {sentQs.map((q) => (
              <QuestionnaireCard key={q.id} q={q} />
            ))}
          </section>
        )}

        <DemoNote>실제 서비스에서는 파일이 국내 리전 저장소에 암호화 저장되고 감사인에게만 공유됩니다 (설계 방향).</DemoNote>
      </main>
    </div>
  )
}

function RequestCard({ request: r, clientUser, users }: { request: AuditRequest; clientUser?: User; users: User[] }) {
  const today = useToday()
  const docs = useDocuments(r.engagementId)
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState(`${r.title}.xlsx`)
  const [comment, setComment] = useState('')
  const [showThread, setShowThread] = useState(r.status === 'returned')

  const attached = docs.filter((d) => r.documentIds.includes(d.id))
  const overdue = r.status !== 'accepted' && r.dueDate < today
  const returnReason = r.status === 'returned' ? r.comments[r.comments.length - 1] : undefined
  const canUpload = r.status === 'open' || r.status === 'returned' || r.status === 'submitted'
  const authorId = clientUser?.id ?? 'client'

  const upload = async () => {
    if (!fileName.trim()) return
    await api.uploadToRequest(r.id, fileName.trim(), authorId)
    setUploading(false)
  }
  const sendComment = async () => {
    if (!comment.trim()) return
    await api.commentRequest(r.id, comment.trim(), authorId)
    setComment('')
  }

  return (
    <article className={cx('rounded-lg border bg-white', r.status === 'returned' ? 'border-red-200' : 'border-line')}>
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-xs text-muted">{r.code}</span>
            <RequestStatusBadge status={r.status} />
            <span className="text-xs text-muted">{r.category}</span>
          </div>
          <h3 className="text-[15px] font-medium text-ink">{r.title}</h3>
          <p className="mt-1 text-[13px] text-ink-2">{r.description}</p>
          <p className={cx('mt-1.5 text-xs', overdue ? 'font-medium text-danger' : 'text-muted')}>
            제출 기한 {date(r.dueDate)}
            {overdue && ' · 기한 경과'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="ghost" icon={<MessageSquare size={14} />} onClick={() => setShowThread((v) => !v)}>
            {r.comments.length}
          </Button>
          {canUpload && (
            <Button size="sm" variant={r.status === 'submitted' ? 'secondary' : 'primary'} icon={<Upload size={14} />} onClick={() => setUploading((v) => !v)}>
              {r.status === 'submitted' ? '추가 업로드' : '파일 업로드'}
            </Button>
          )}
        </div>
      </div>

      {returnReason && (
        <div className="mx-5 mb-4 flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-red-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            <b className="font-medium">반려 사유</b> · {returnReason.text}
          </span>
        </div>
      )}

      {uploading && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-md border border-dashed border-line bg-canvas px-3 py-3">
          <Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1" autoFocus />
          <Button size="md" variant="primary" disabled={!fileName.trim()} onClick={upload}>
            제출
          </Button>
          <Button size="md" variant="ghost" onClick={() => setUploading(false)}>
            취소
          </Button>
        </div>
      )}

      {attached.length > 0 && (
        <ul className="mx-5 mb-4 flex flex-wrap gap-2">
          {attached.map((d) => (
            <li key={d.id} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-ink-2">
              <FileText size={13} className="text-brand" />
              {d.name}
              <span className="text-faint">{date(d.uploadedAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {showThread && (
        <div className="space-y-3 border-t border-line-2 px-5 py-4">
          {r.comments.map((c) => {
            const u = users.find((x) => x.id === c.authorId)
            return (
              <div key={c.id} className="flex gap-2.5">
                <Avatar user={u} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-ink">{u?.name ?? '—'}</span>
                    <span className="text-muted">{u?.role === 'client' ? u.title : '감사팀'}</span>
                    <span className="text-faint">{dateTime(c.at)}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] whitespace-pre-wrap text-ink-2">{c.text}</p>
                </div>
              </div>
            )
          })}
          <div className="flex items-start gap-2">
            <Textarea rows={1} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="감사팀에 메시지 남기기" />
            <Button disabled={!comment.trim()} onClick={sendComment}>
              등록
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

function QuestionnaireCard({ q }: { q: Questionnaire }) {
  const answered = q.questions.filter((x) => x.answer).length
  return (
    <article className="rounded-lg border border-line bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-medium text-ink">{q.title}</h3>
        <span className={cx('text-xs', answered === q.questions.length ? 'text-done' : 'text-muted')}>
          {answered}/{q.questions.length} 답변
        </span>
      </div>
      <ol className="space-y-4">
        {q.questions.map((x, i) => (
          <AnswerField key={x.id} qid={q.id} index={i} question={x} />
        ))}
      </ol>
    </article>
  )
}

function AnswerField({ qid, index, question }: { qid: string; index: number; question: Questionnaire['questions'][number] }) {
  const [text, setText] = useState(question.answer ?? '')
  const dirty = text.trim() !== (question.answer ?? '')
  return (
    <li>
      <p className="mb-1.5 text-[13px] text-ink">
        Q{index + 1}. {question.text}
      </p>
      <div className="flex items-start gap-2">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="답변을 입력하세요" />
        <Button size="md" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || !text.trim()} onClick={() => api.answerQuestion(qid, question.id, text.trim())}>
          {question.answer ? '수정' : '저장'}
        </Button>
      </div>
    </li>
  )
}
