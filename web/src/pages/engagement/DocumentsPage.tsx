import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Archive, FileArchive, FileSpreadsheet, FileText, FileType, Folder, Search, Upload } from 'lucide-react'
import { Avatar, Button, Card, DemoNote, EmptyState, Field, Input, KrTag, Modal, Td, Th } from '@/components/ui'
import { api } from '@/data/api'
import { useDocuments, useEngagement, useRequests, useToday, useUsers, useWorkflow } from '@/data/hooks'
import { daysBetween, legalDeadlines } from '@/domain/rules'
import type { AuditDocument, DocumentSource } from '@/domain/types'
import { cx, date } from '@/lib/format'

const SOURCES: { key: DocumentSource; label: string; kr?: boolean; cls: string }[] = [
  { key: 'client', label: '회사 제출', cls: 'bg-sky-50 text-sky-700' },
  { key: 'firm', label: '감사팀', cls: 'bg-gray-100 text-gray-700' },
  { key: 'kftc', label: '금융결제원', kr: true, cls: 'bg-green-50 text-green-700' },
  { key: 'nice', label: 'NICE', kr: true, cls: 'bg-violet-50 text-violet-700' },
  { key: 'alphalyzer', label: 'Alphalyzer', kr: true, cls: 'bg-amber-50 text-amber-700' },
  { key: 'dart', label: 'DART', kr: true, cls: 'bg-blue-50 text-blue-700' },
]
const sourceMeta = (k: DocumentSource) => SOURCES.find((s) => s.key === k)!

function FileIcon({ ext }: { ext: AuditDocument['ext'] }) {
  if (ext === 'xlsx' || ext === 'csv') return <FileSpreadsheet size={17} className="text-green-600" />
  if (ext === 'pdf') return <FileText size={17} className="text-red-500" />
  if (ext === 'zip') return <FileArchive size={17} className="text-amber-600" />
  if (ext === 'hwp') return <FileType size={17} className="text-sky-600" />
  return <FileText size={17} className="text-blue-600" />
}

const sizeLabel = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

export function DocumentsPage() {
  const { id } = useParams()
  const engagement = useEngagement(id)
  const docs = useDocuments(id)
  const nodes = useWorkflow(id)
  const requests = useRequests(id)
  const users = useUsers()
  const today = useToday()

  const [folder, setFolder] = useState('')
  const [source, setSource] = useState<DocumentSource | ''>('')
  const [q, setQ] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  const folders = useMemo(() => {
    const m = new Map<string, number>()
    docs.forEach((d) => m.set(d.folder, (m.get(d.folder) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [docs])

  const linkCount = useMemo(() => {
    const m = new Map<string, number>()
    nodes.forEach((n) => {
      new Set(n.evidence.map((e) => e.documentId)).forEach((docId) => m.set(docId, (m.get(docId) ?? 0) + 1))
    })
    return m
  }, [nodes])

  if (!engagement) return null

  const filtered = docs
    .filter((d) => (!folder || d.folder === folder) && (!source || d.source === source) && (!q || d.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))

  const archive = legalDeadlines(engagement).find((d) => d.key === 'archive')

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[260px] shrink-0 space-y-6 overflow-auto border-r border-line px-4 py-5">
        <section>
          <h3 className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted uppercase">폴더</h3>
          <ul className="space-y-0.5">
            <FolderItem label="전체 문서" count={docs.length} active={!folder} onClick={() => setFolder('')} />
            {folders.map(([f, n]) => (
              <FolderItem key={f} label={f} count={n} active={folder === f} onClick={() => setFolder(f)} />
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted uppercase">출처</h3>
          <div className="flex flex-wrap gap-1.5 px-1">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                onClick={() => setSource(source === s.key ? '' : s.key)}
                className={cx(
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs',
                  source === s.key ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-white text-ink-2 hover:bg-canvas',
                )}
              >
                {s.label}
                {s.kr && <KrTag className="h-4 px-1 text-[9px]" />}
              </button>
            ))}
          </div>
          <p className="mt-3 px-2 text-xs leading-relaxed text-muted">
            금융결제원·NICE 조회 회신, Alphalyzer 분석 결과, DART 공시 감사보고서가 출처별로 자동 분류됩니다.
          </p>
        </section>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto">
        <div className="flex items-center justify-between px-6 py-5">
          <h1 className="text-[26px] font-normal text-ink">문서 ({docs.length})</h1>
          <Button variant="primary" icon={<Upload size={16} />} onClick={() => setUploadOpen(true)}>
            업로드
          </Button>
        </div>

        <div className="px-6">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Archive size={16} className="text-muted" /> 조서 취합·보존 <KrTag />
              </span>
            }
          >
            {archive ? (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px]">
                <div>
                  <span className="text-muted">최종 취합 기한 </span>
                  <span className="font-medium text-ink">{date(archive.date)}</span>
                  {archive.doneDate ? (
                    <span className="ml-2 text-done">완료 ({date(archive.doneDate)})</span>
                  ) : (
                    <span className={cx('ml-2', daysBetween(today, archive.date) < 0 ? 'text-danger' : 'text-pending')}>
                      {daysBetween(today, archive.date) < 0 ? `${-daysBetween(today, archive.date)}일 경과` : `D-${daysBetween(today, archive.date)}`}
                    </span>
                  )}
                </div>
                <div className="text-muted">{archive.basis}</div>
              </div>
            ) : (
              <p className="text-[13px] text-ink-2">
                감사보고서일이 정해지면 그날부터 <b className="font-medium">60일 이내</b>에 감사조서를 최종 취합해야 합니다. 현재 감사보고서일이
                없어 기한이 아직 시작되지 않았습니다.
              </p>
            )}
            <p className="mt-2 text-xs text-muted">취합된 감사조서는 감사보고서일부터 8년간 보존해야 하며, 취합 후 임의로 수정·삭제할 수 없습니다 (외부감사법 제19조).</p>
          </Card>
        </div>

        <div className="flex items-center gap-3 px-6 pt-5 pb-2">
          <div className="relative w-72">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="파일명 검색" className="h-10 pl-9" />
          </div>
          {(folder || source) && (
            <Button variant="ghost" size="sm" onClick={() => (setFolder(''), setSource(''))}>
              필터 해제
            </Button>
          )}
          <span className="ml-auto text-xs text-muted">{filtered.length}건 표시</span>
        </div>

        <div className="px-6 pb-10">
          {filtered.length === 0 ? (
            <EmptyState title="조건에 맞는 문서가 없습니다." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <Th>파일명</Th>
                  <Th>출처</Th>
                  <Th>폴더</Th>
                  <Th>업로더</Th>
                  <Th>업로드일</Th>
                  <Th className="text-right">크기</Th>
                  <Th className="text-center">연결된 조서</Th>
                  <Th>관련 요청</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const s = sourceMeta(d.source)
                  const links = linkCount.get(d.id) ?? 0
                  const req = requests.find((r) => r.id === d.requestId)
                  return (
                    <tr key={d.id} className="hover:bg-canvas">
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <FileIcon ext={d.ext} />
                          <span className="font-medium text-ink">{d.name}</span>
                        </span>
                      </Td>
                      <Td>
                        <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', s.cls)}>{s.label}</span>
                      </Td>
                      <Td>{d.folder}</Td>
                      <Td>
                        <Avatar user={users.find((u) => u.id === d.uploadedBy)} />
                      </Td>
                      <Td>{date(d.uploadedAt)}</Td>
                      <Td className="text-right tabular-nums">{sizeLabel(d.sizeKb)}</Td>
                      <Td className="text-center">
                        {links > 0 ? (
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-soft px-2 text-xs font-medium text-brand-dark">
                            {links}
                          </span>
                        ) : (
                          <span className="text-faint">0</span>
                        )}
                      </Td>
                      <Td className="font-mono text-xs">{req ? req.code : <span className="text-faint">—</span>}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        engagementId={engagement.id}
        folders={folders.map(([f]) => f)}
        defaultFolder={folder}
      />
    </div>
  )
}

function FolderItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cx(
          'flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
          active ? 'bg-[#eef0f3] font-medium text-ink' : 'text-ink-2 hover:bg-canvas',
        )}
      >
        <Folder size={15} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-xs text-muted">{count}</span>
      </button>
    </li>
  )
}

function UploadModal({
  open,
  onClose,
  engagementId,
  folders,
  defaultFolder,
}: {
  open: boolean
  onClose: () => void
  engagementId: string
  folders: string[]
  defaultFolder: string
}) {
  const [name, setName] = useState('감사팀_작성자료.xlsx')
  const [folder, setFolder] = useState(defaultFolder || '감사팀 작성')
  const options = folders.includes(folder) ? folders : [...folders, folder]

  const submit = async () => {
    if (!name.trim()) return
    await api.uploadDocument(engagementId, name.trim(), 'firm', folder)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="문서 업로드"
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={submit}>
            업로드
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="파일명" hint="확장자(xlsx, pdf, docx, hwp, csv, zip)로 파일 아이콘이 정해집니다.">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="폴더">
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="h-9 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
          >
            {options.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <DemoNote>실제 파일은 올라가지 않고 목록에만 추가됩니다. 실제 서비스에서는 국내 리전 저장소에 암호화 저장하고 해시로 변경 여부를 추적합니다.</DemoNote>
      </div>
    </Modal>
  )
}
