import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, FileText } from 'lucide-react'
import { Button, EmptyState, Input, Textarea } from '@/components/ui'
import { api } from '@/data/api'
import { useForms } from '@/data/hooks'
import type { AuditForm, FormField } from '@/domain/types'
import { cx, date } from '@/lib/format'

function FormStatusBadge({ status }: { status: AuditForm['status'] }) {
  return status === 'completed' ? (
    <span className="inline-flex h-6 items-center rounded-full bg-green-50 px-2.5 text-xs font-medium text-green-700">완료</span>
  ) : (
    <span className="inline-flex h-6 items-center rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-700">작성 중</span>
  )
}

export function FormsPage() {
  const { id } = useParams()
  const forms = useForms(id)
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const selected = forms.find((f) => f.id === selectedId) ?? forms[0]

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[320px] shrink-0 overflow-auto border-r border-line">
        <div className="px-5 py-5">
          <h1 className="text-[26px] font-normal text-ink">서식 ({forms.length})</h1>
        </div>
        <ul>
          {forms.map((f) => {
            const filled = f.fields.filter((x) => x.value).length
            return (
              <li key={f.id}>
                <button
                  onClick={() => setSelectedId(f.id)}
                  className={cx(
                    'flex w-full items-start gap-3 border-t border-line-2 px-5 py-3.5 text-left',
                    selected?.id === f.id ? 'bg-brand-soft' : 'hover:bg-canvas',
                  )}
                >
                  <FileText size={17} className="mt-0.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{f.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {f.kind} · {filled}/{f.fields.length} 항목 · {date(f.updatedAt)}
                    </span>
                  </span>
                  <FormStatusBadge status={f.status} />
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto">
        {selected ? <FormDetail key={selected.id} form={selected} /> : <EmptyState title="서식이 없습니다." />}
      </div>
    </div>
  )
}

function FormDetail({ form }: { form: AuditForm }) {
  const missing = form.fields.filter((f) => f.required && !f.value)
  return (
    <div className="mx-auto max-w-[760px] px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">{form.kind}</span>
            <FormStatusBadge status={form.status} />
          </div>
          <h2 className="text-[22px] font-normal text-ink">{form.title}</h2>
          <p className="mt-1 text-xs text-muted">최종 수정 {date(form.updatedAt)}</p>
        </div>
        {form.status === 'draft' ? (
          <Button
            variant="primary"
            icon={<CheckCircle2 size={16} />}
            disabled={missing.length > 0}
            title={missing.length ? `필수 항목 ${missing.length}개가 비어 있습니다` : undefined}
            onClick={() => api.completeForm(form.id)}
          >
            완료 처리
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-done">
            <CheckCircle2 size={16} /> 완료됨
          </span>
        )}
      </div>

      <ol className="space-y-5">
        {form.fields.map((f, i) => (
          <li key={f.id} className="rounded-lg border border-line px-5 py-4">
            <p className="mb-2.5 text-[14px] text-ink">
              <span className="mr-1.5 text-muted">{i + 1}.</span>
              {f.label}
              {f.required && <span className="ml-1 text-danger">*</span>}
            </p>
            <FieldInput formId={form.id} field={f} />
          </li>
        ))}
      </ol>
      {form.status === 'draft' && missing.length > 0 && (
        <p className="mt-4 text-xs text-muted">필수 항목 {missing.length}개를 채우면 완료 처리할 수 있습니다.</p>
      )}
    </div>
  )
}

function FieldInput({ formId, field }: { formId: string; field: FormField }) {
  const [local, setLocal] = useState(field.value ?? '')
  useEffect(() => setLocal(field.value ?? ''), [field.value])
  const save = (v: string) => {
    if (v !== (field.value ?? '')) api.updateFormField(formId, field.id, v)
  }

  switch (field.type) {
    case 'yesno':
      return (
        <div className="inline-flex overflow-hidden rounded-md border border-line">
          {['예', '아니오'].map((opt) => (
            <button
              key={opt}
              onClick={() => api.updateFormField(formId, field.id, opt)}
              className={cx(
                'h-9 min-w-20 px-4 text-sm',
                opt === '아니오' && 'border-l border-line',
                field.value === opt ? 'bg-brand font-medium text-white' : 'bg-white text-ink-2 hover:bg-canvas',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )
    case 'select':
      return (
        <select
          value={field.value ?? ''}
          onChange={(e) => api.updateFormField(formId, field.id, e.target.value)}
          className="h-9 w-64 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-brand"
        >
          <option value="">선택</option>
          {field.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )
    case 'textarea':
      return <Textarea rows={3} value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => save(local)} />
    case 'number':
      return (
        <Input
          inputMode="decimal"
          className="w-64 text-right tabular-nums"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => save(local)}
        />
      )
    case 'date':
      return <Input type="date" className="w-48" value={local} onChange={(e) => (setLocal(e.target.value), save(e.target.value))} />
    default:
      return <Input value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => save(local)} />
  }
}
