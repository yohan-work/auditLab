import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2, Users, Plug, ShieldCheck, Bell, CreditCard, UserRound, RotateCcw, Check, Lock, Server, Clock, Bot } from 'lucide-react'
import { Avatar, Button, Card, DemoNote, Field, Input, KrTag, Modal, Td, Th } from '@/components/ui'
import { resetDb } from '@/data/store'
import { api } from '@/data/api'
import {
  useAccessLog,
  useCurrentUser,
  useEngagements,
  useFirm,
  useIndependence,
  useIntegrations,
  useNotificationPrefs,
  useToday,
  useUsers,
} from '@/data/hooks'
import type { Integration, Role } from '@/domain/types'
import { cx } from '@/lib/format'

const roleLabel: Record<Role, string> = {
  partner: '업무수행이사',
  manager: '책임자',
  senior: '현장책임',
  staff: '담당',
  eqr: '심리(업무품질검토)',
  client: '고객사',
}

const tabs = [
  { key: 'profile', label: '내 프로필', icon: UserRound },
  { key: 'general', label: '법인 정보', icon: Building2 },
  { key: 'team', label: '구성원·권한', icon: Users },
  { key: 'integrations', label: '연동', icon: Plug, kr: true },
  { key: 'security', label: '보안·데이터 보관', icon: ShieldCheck },
  { key: 'notifications', label: '알림', icon: Bell },
  { key: 'billing', label: '요금제', icon: CreditCard },
  { key: 'demo', label: '시연 데이터·구조', icon: RotateCcw },
] as const

type TabKey = (typeof tabs)[number]['key']

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (tabs.find((t) => t.key === params.get('tab'))?.key ?? 'general') as TabKey

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-line px-6 py-5">
        <h1 className="text-[26px] font-normal text-ink">설정</h1>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-[240px] shrink-0 border-r border-line px-3 py-4">
          {tabs.map(({ key, label, icon: Icon, ...rest }) => (
            <button
              key={key}
              onClick={() => setParams({ tab: key })}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px]',
                tab === key ? 'bg-[#eef0f3] font-medium text-ink' : 'text-ink-2 hover:bg-canvas',
              )}
            >
              <Icon size={16} className="text-muted" />
              <span className="flex-1">{label}</span>
              {'kr' in rest && <KrTag />}
            </button>
          ))}
        </aside>
        <div className="min-w-0 flex-1 bg-canvas px-6 py-5">
          <div className="max-w-[920px] space-y-5">
            {tab === 'profile' && <ProfileTab />}
            {tab === 'general' && <GeneralTab />}
            {tab === 'team' && <TeamTab />}
            {tab === 'integrations' && <IntegrationsTab />}
            {tab === 'security' && <SecurityTab />}
            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'billing' && <BillingTab />}
            {tab === 'demo' && <DemoTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 공통 조각

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-line-2 py-3 first:border-t-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-right text-[13px] text-ink">{children}</dd>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-gray-300')}
    >
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

// ---------------------------------------------------------------- 내 프로필

function ProfileTab() {
  const me = useCurrentUser()
  const independence = useIndependence()
  const today = useToday()
  const year = Number(today.slice(0, 4))
  const signed = independence.find((c) => c.userId === me.id && c.year === year && c.signed)
  const [saved, setSaved] = useState(false)
  return (
    <>
      <Card title="내 프로필">
        <div className="flex items-center gap-4 pb-4">
          <Avatar user={me} size={56} />
          <div>
            <p className="text-lg font-semibold text-ink">{me.name}</p>
            <p className="text-[13px] text-muted">
              {me.title} · {roleLabel[me.role]}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="이메일">
            <Input defaultValue={me.email} />
          </Field>
          <Field label="휴대전화">
            <Input defaultValue={me.phone} />
          </Field>
          <Field label="공인회계사 등록번호" hint="시연용 가상 번호">
            <Input defaultValue={me.cpaNo} disabled />
          </Field>
          <Field label="소속">
            <Input defaultValue={useFirm().name} disabled />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="primary" onClick={() => setSaved(true)}>
            저장
          </Button>
          {saved && <span className="text-xs text-done">저장했습니다 (시연에서는 반영되지 않음)</span>}
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2">전자서명 · 독립성 <KrTag /></span>}>
        <dl>
          <Row label="조서 서명 방식">이름 + 일시 기록 (변조 방지 해시 · 설계 방향)</Row>
          <Row label={`${year} 독립성 확인서`}>
            {signed ? <span className="text-done">제출함 · {signed.submittedAt}</span> : <span className="text-danger">미제출 — 품질관리 화면에서 제출</span>}
          </Row>
          <Row label="2단계 인증">사용 중 (휴대전화 OTP)</Row>
        </dl>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 법인 정보

function GeneralTab() {
  const firm = useFirm()
  const today = useToday()
  const [draft, setDraft] = useState({ name: firm.name, representative: firm.representative ?? '', address: firm.address ?? '', phone: firm.phone ?? '' })
  const [saved, setSaved] = useState(false)
  return (
    <>
      <Card title="법인 정보">
        <div className="grid grid-cols-2 gap-4">
          <Field label="이름">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="대표 회계사">
            <Input value={draft.representative} onChange={(e) => setDraft({ ...draft, representative: e.target.value })} />
          </Field>
          <Field label="주소">
            <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </Field>
          <Field label="대표 전화">
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              api.updateFirm(draft)
              setSaved(true)
            }}
          >
            저장
          </Button>
          {saved && <span className="text-xs text-done">저장했습니다</span>}
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2">감사인 구분 <KrTag /></span>}>
        <dl>
          <Row label="형태">{firm.kind === 'audit_team' ? '감사반' : '회계법인'}</Row>
          <Row label="등록번호">{firm.regNo}</Row>
          <Row label="상장사 감사인 등록">미등록 (외부감사법 제9조의2)</Row>
          <Row label="개정 품질관리기준서 1 설계·실행 기한">2029-12-31 (등록법인 외)</Row>
          <Row label="회계연도 시작">{firm.fiscalYearStart}</Row>
          <Row label="시연 기준일">{today}</Row>
        </dl>
        <p className="mt-2 text-xs text-muted">회계법인/감사반 전환은 품질관리 화면에서 할 수 있습니다. 감사반이면 3인 공동감사 점검이 추가됩니다.</p>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 구성원·권한

const permissions: [string, Role[]][] = [
  ['감사 업무 생성·설정', ['partner', 'manager']],
  ['조서 작성 서명', ['partner', 'manager', 'senior', 'staff']],
  ['조서 검토 서명', ['partner', 'manager']],
  ['심리 서명', ['eqr']],
  ['감사시간 승인', ['partner', 'manager']],
  ['고객 자료 승인·반려', ['partner', 'manager', 'senior']],
  ['조서 최종 취합(잠금)', ['partner']],
]

function TeamTab() {
  const users = useUsers().filter((u) => u.role !== 'client')
  const clientsUsers = useUsers().filter((u) => u.role === 'client')
  const me = useCurrentUser()
  const engagements = useEngagements()
  const roles: Role[] = ['partner', 'manager', 'senior', 'staff', 'eqr']
  const [invite, setInvite] = useState(false)
  return (
    <>
      <Card title={`구성원 (${users.length})`} action={<Button size="sm" variant="primary" onClick={() => setInvite(true)}>+ 초대</Button>}>
        <table className="w-full">
          <thead>
            <tr>
              <Th className="pl-0">이름</Th>
              <Th>이메일</Th>
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
                <Td className="text-muted">{u.email}</Td>
                <Td>{roleLabel[u.role]}</Td>
                <Td className="tabular text-right">
                  {engagements.filter((e) => e.leadId === u.id || e.teamIds.includes(u.id) || e.eqrId === u.id).length}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="역할별 권한">
        <table className="w-full">
          <thead>
            <tr>
              <Th className="pl-0">권한</Th>
              {roles.map((r) => (
                <Th key={r} className="text-center">
                  {roleLabel[r]}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map(([label, allowed]) => (
              <tr key={label}>
                <Td className="pl-0">{label}</Td>
                {roles.map((r) => (
                  <Td key={r} className="text-center">
                    {allowed.includes(r) ? <Check size={15} className="inline text-done" /> : <span className="text-faint">—</span>}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">심리 회계사는 해당 업무의 업무수행이사를 겸할 수 없습니다(품질관리기준서 2). 시연에서는 권한을 강제하지 않습니다.</p>
      </Card>
      <Card title={`고객사 사용자 (${clientsUsers.length})`}>
        <ul className="divide-y divide-line-2">
          {clientsUsers.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2.5">
              <Avatar user={u} withName />
              <span className="text-xs text-muted">
                {u.title} · {u.email} · 고객 포털 전용
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Modal
        open={invite}
        onClose={() => setInvite(false)}
        title="구성원 초대"
        footer={
          <>
            <Button onClick={() => setInvite(false)}>취소</Button>
            <Button variant="primary" onClick={() => setInvite(false)}>
              초대 메일 보내기
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="이메일">
            <Input placeholder="name@firm.example" />
          </Field>
          <Field label="역할">
            <select className="h-9 w-full rounded-md border border-line px-3 text-sm">
              {roles.map((r) => (
                <option key={r}>{roleLabel[r]}</option>
              ))}
            </select>
          </Field>
          <DemoNote>실제 서비스에서는 초대 메일과 좌석 수 확인이 진행됩니다.</DemoNote>
        </div>
      </Modal>
    </>
  )
}

// ---------------------------------------------------------------- 연동

const statusLabel: Record<Integration['status'], { label: string; cls: string }> = {
  connected: { label: '연결됨', cls: 'bg-green-50 text-green-700' },
  available: { label: '연결 가능', cls: 'bg-blue-50 text-blue-700' },
  planned: { label: '개발 예정', cls: 'bg-gray-100 text-gray-600' },
}

function IntegrationsTab() {
  const list = useIntegrations()
  return (
    <>
      <DemoNote>연결 상태는 가상입니다. 실제 연동은 결제원 다운로드 파일·NICE 리포트·OpenDART API를 파싱하는 방식으로 설계합니다.</DemoNote>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((i) => {
          const st = statusLabel[i.status]
          return (
            <section key={i.id} className="flex flex-col rounded-lg border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-muted">{i.category}</p>
                  <h3 className="mt-0.5 flex items-center gap-2 text-[15px] font-medium text-ink">
                    {i.name} {i.kr && <KrTag />}
                  </h3>
                </div>
                <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span>
              </div>
              <p className="mt-2 flex-1 text-[13px] text-ink-2">{i.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-faint">{i.lastSync ? `마지막 동기화 ${i.lastSync}` : ''}</span>
                {i.status === 'connected' && (
                  <Button size="sm" onClick={() => api.setIntegrationStatus(i.id, 'available')}>
                    연결 해제
                  </Button>
                )}
                {i.status === 'available' && (
                  <Button size="sm" variant="primary" onClick={() => api.setIntegrationStatus(i.id, 'connected')}>
                    연결
                  </Button>
                )}
                {i.status === 'planned' && <span className="text-xs text-muted">준비 중</span>}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 보안·데이터 보관

function SecurityTab() {
  const log = useAccessLog()
  const users = useUsers()
  const [opts, setOpts] = useState({ twoFactor: true, ipLimit: false, downloadWatermark: true, aiOff: true })
  const set = (k: keyof typeof opts) => (v: boolean) => setOpts({ ...opts, [k]: v })
  const policies: [keyof typeof opts, string, string, ReactNode][] = [
    ['twoFactor', '2단계 인증 필수', '모든 구성원 로그인 시 OTP 요구', <Lock size={16} />],
    ['ipLimit', '접속 IP 제한', '사무실·VPN 대역에서만 접속 허용', <Server size={16} />],
    ['downloadWatermark', '다운로드 워터마크', '내려받는 문서에 사용자·일시 표시', <ShieldCheck size={16} />],
    ['aiOff', '외부 AI 전송 차단', '고객 자료를 외부 AI 모델로 보내지 않음(기본값)', <Bot size={16} />],
  ]
  return (
    <>
      <Card title={<span className="flex items-center gap-2">데이터 보관 <KrTag /></span>}>
        <dl>
          <Row label="저장 위치">국내 리전 (설계 방향)</Row>
          <Row label="암호화">저장 시 AES-256 · 전송 시 TLS (설계 방향)</Row>
          <Row label="감사조서 보존 기간">8년 (외부감사법 제19조)</Row>
          <Row label="조서 최종 취합 후">잠금 · 수정 불가 · 변조 방지 해시 기록</Row>
          <Row label="고객 자료 삭제">보존 기간 경과 후 일괄 파기 기록</Row>
        </dl>
      </Card>
      <Card title="보안 정책">
        <ul className="divide-y divide-line-2">
          {policies.map(([k, title, desc, icon]) => (
            <li key={k} className="flex items-center gap-3 py-3">
              <span className="text-muted">{icon}</span>
              <span className="flex-1">
                <span className="block text-[13px] text-ink">{title}</span>
                <span className="block text-xs text-muted">{desc}</span>
              </span>
              <Toggle label={title} on={opts[k]} onChange={set(k)} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">금감원은 AI 활용 시 감사정보 외부 유출 방지를 당부했습니다(2026-06). 외부 AI는 법인이 켜야만 사용됩니다.</p>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Clock size={15} className="text-muted" />접근 기록</span>}>
        <table className="w-full">
          <thead>
            <tr>
              <Th className="pl-0">일시</Th>
              <Th>사용자</Th>
              <Th>작업</Th>
              <Th>대상</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id}>
                <Td className="tabular pl-0">{l.at}</Td>
                <Td>
                  <Avatar user={users.find((u) => u.id === l.userId)} withName />
                </Td>
                <Td>{l.action}</Td>
                <Td className="max-w-[260px] truncate">{l.target}</Td>
                <Td className="tabular text-muted">{l.ip}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 알림

function NotificationsTab() {
  const prefs = useNotificationPrefs()
  return (
    <Card title="알림 받기">
      <table className="w-full">
        <thead>
          <tr>
            <Th className="pl-0">항목</Th>
            <Th className="text-center">앱 알림</Th>
            <Th className="text-center">이메일</Th>
          </tr>
        </thead>
        <tbody>
          {prefs.map((p) => (
            <tr key={p.id}>
              <Td className="pl-0">
                <span className="block text-ink">{p.label}</span>
                <span className="block text-xs text-muted">{p.description}</span>
              </Td>
              <Td className="text-center">
                <span className="inline-flex">
                  <Toggle label={`${p.label} 앱 알림`} on={p.inApp} onChange={(v) => api.setNotificationPref(p.id, 'inApp', v)} />
                </span>
              </Td>
              <Td className="text-center">
                <span className="inline-flex">
                  <Toggle label={`${p.label} 이메일`} on={p.email} onChange={(v) => api.setNotificationPref(p.id, 'email', v)} />
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ---------------------------------------------------------------- 요금제

function BillingTab() {
  const firm = useFirm()
  const plan = firm.plan
  if (!plan) return null
  const invoices = [
    ['2026-01-31', '감사반 스탠다드 · 연간', '시연'],
    ['2025-01-31', '감사반 스탠다드 · 연간', '시연'],
  ]
  return (
    <>
      <DemoNote>요금제와 금액은 정하지 않았습니다. 화면 구성만 보여주는 가상 정보입니다.</DemoNote>
      <Card title="현재 요금제">
        <dl>
          <Row label="요금제">{plan.name}</Row>
          <Row label="결제 주기">{plan.billing} (1~3월에만 쓰고 해지하는 문제를 막기 위해 연간 우선)</Row>
          <Row label="좌석">
            {plan.usedSeats} / {plan.seats}명 사용
          </Row>
          <Row label="갱신일">{plan.renewsAt}</Row>
        </dl>
      </Card>
      <Card title="결제 내역">
        <table className="w-full">
          <thead>
            <tr>
              <Th className="pl-0">일자</Th>
              <Th>내용</Th>
              <Th className="text-right">금액</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(([d, t, a]) => (
              <tr key={d}>
                <Td className="tabular pl-0">{d}</Td>
                <Td>{t}</Td>
                <Td className="text-right text-muted">{a}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------- 시연 데이터·구조

function DemoTab() {
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState(false)
  const code = (t: string) => <code className="rounded bg-canvas px-1 text-xs">{t}</code>
  return (
    <>
      <Card title="시연 데이터">
        <p className="mb-3 text-[13px] text-ink-2">요청 상태, 서명, 시간 기록 등 지금까지 클릭으로 바꾼 내용을 모두 처음 상태로 되돌립니다.</p>
        <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setConfirm(true)}>
          시연 데이터 초기화
        </Button>
        {done && <p className="mt-2 text-xs text-done">초기화했습니다.</p>}
      </Card>
      <Card title="아키텍처">
        <div className="space-y-2 text-[13px] leading-relaxed text-ink-2">
          <p>
            지금 보이는 데이터는 모두 브라우저 메모리의 시연용 데이터입니다({code('src/data/mock/')}). 새로고침하면 처음 상태로 돌아갑니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>화면은 읽기용 훅({code('src/data/hooks.ts')})과 쓰기용 {code('api')}만 사용합니다.</li>
            <li>업무 규칙(법정 기한, 진행률, 감리 모의고사)은 순수 함수({code('src/domain/rules.ts')})라 서버에서도 재사용합니다.</li>
            <li>
              실제 백엔드 교체 지점은 {code('src/data/api.ts')}입니다. {code('AuditApi')}를 HTTP로 구현하고 {code('export const api = mockApi')} 한 줄을 바꿉니다.
            </li>
          </ul>
        </div>
      </Card>
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
    </>
  )
}
