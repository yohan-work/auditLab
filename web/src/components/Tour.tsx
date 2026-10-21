import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button, KrTag } from '@/components/ui'
import { endTour, setTourStep, startTour, tourSeen, useUi } from '@/data/ui'
import { PRIMARY_ENGAGEMENT_ID } from '@/data/mock/seed'

const E = `/engagements/${PRIMARY_ENGAGEMENT_ID}`

interface Step {
  path: string
  /** 강조할 요소. 없으면 안내 카드만 띄운다. */
  target?: string
  title: string
  body: string
  kr?: boolean
}

// 회계사에게 보여줄 때 따라가는 순서. 각 단계는 실제 화면으로 이동한다.
const steps: Step[] = [
  {
    path: '/engagements',
    target: 'main table',
    title: '감사 업무 목록',
    body: '법인이 맡은 감사 업무를 한눈에 봅니다. 자료 요청 진행 막대와, 감리에서 지적받을 만한 항목 수(감리 점검)가 업무별로 표시됩니다.',
  },
  {
    path: E,
    title: '감사 업무 대시보드',
    body: '자료 요청·조서 서명·리뷰 노트 진행률과 단계별 진행 현황을 봅니다. 정기총회일만 넣으면 재무제표 수령·보고서 제출 법정 기한이 자동 계산됩니다.',
    kr: true,
  },
  {
    path: `${E}/requests`,
    target: `a[href="${E}/requests"]`,
    title: '자료 요청 (PBC)',
    body: '회사에 필요한 자료를 요청하고 제출·검토·승인·반려 상태를 추적합니다. 한공회 서식 기준 요청 목록을 한 번에 만들 수 있습니다.',
  },
  {
    path: `/portal/${PRIMARY_ENGAGEMENT_ID}`,
    title: '고객 포털 (회사 담당자 화면)',
    body: '회사 담당자는 이 화면에서 파일을 올리고 반려 사유를 확인합니다. 올린 자료는 감사인 화면에 바로 "제출됨"으로 나타납니다.',
  },
  {
    path: `${E}/sheets?node=n-E-21`,
    target: `a[href="${E}/sheets"]`,
    title: '조서와 서명',
    body: '절차마다 작성자·검토자·심리 서명을 남기고, 리뷰 노트를 주고받습니다. "근거 잇기"로 조서와 원천 문서(결제원·NICE 회신 등)의 위치를 연결합니다.',
    kr: true,
  },
  {
    path: `${E}/reporting`,
    target: `a[href="${E}/reporting"]`,
    title: '재무제표와 전기 대사',
    body: '재무제표 계정마다 연결된 조서를 보고, 합계를 검증합니다. DART에 공시된 전기 감사보고서 금액과 다른 곳은 빨갛게 표시됩니다.',
    kr: true,
  },
  {
    path: `${E}/confirmations`,
    target: `a[href="${E}/confirmations"]`,
    title: '외부조회',
    body: '금융결제원·NICE 회신을 가져와 장부금액과 대사합니다. 회신이 없거나 차이가 있는 건은 대체절차를 기록해야 감리에서 지적받지 않습니다.',
    kr: true,
  },
  {
    path: `${E}/inspection`,
    target: `a[href="${E}/inspection"]`,
    title: '감리 모의고사',
    body: '금감원·한공회 감리에서 자주 지적되는 항목(독립성, 감사시간 승인, 검토 서명, 대체절차, 조서 60일 취합 등)을 자동 점검합니다. 서명하거나 기록하면 숫자가 바로 줄어듭니다.',
    kr: true,
  },
  {
    path: `${E}/addin`,
    title: '엑셀 애드인 (미리보기)',
    body: '회계사가 쓰던 엑셀 조서 옆에 같은 기능이 뜨는 모습입니다. 셀을 누르면 근거 문서와 서명 상태가 오른쪽 작업창에 나타납니다.',
  },
]

export function Tour() {
  const step = useUi((s) => s.tourStep)
  const navigate = useNavigate()
  const location = useLocation()
  const [rect, setRect] = useState<DOMRect | null>(null)

  // 처음 방문하면 자동으로 시작
  useEffect(() => {
    if (!tourSeen() && location.pathname === '/engagements') startTour()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = step === null ? undefined : steps[step]

  useEffect(() => {
    if (!s) return
    const current = location.pathname + location.search
    if (current !== s.path) navigate(s.path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useLayoutEffect(() => {
    if (!s?.target) return setRect(null)
    let frame = 0
    const update = () => {
      const el = document.querySelector(s.target!)
      setRect(el ? el.getBoundingClientRect() : null)
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [s, location.pathname])

  if (!s || step === null) return null
  const last = step === steps.length - 1

  return (
    <>
      {rect && (
        <div
          className="pointer-events-none fixed z-[60] rounded-lg ring-4 ring-brand/50 transition-all"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: Math.min(rect.height + 8, window.innerHeight - rect.top) }}
        />
      )}
      <div className="fixed right-6 bottom-6 z-[65] w-[380px] rounded-xl border border-line bg-white p-5 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-brand">
            둘러보기 {step + 1} / {steps.length}
          </span>
          <button onClick={endTour} aria-label="둘러보기 닫기" className="text-faint hover:text-ink-2">
            <X size={16} />
          </button>
        </div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          {s.title} {s.kr && <KrTag />}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{s.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                aria-label={`${i + 1}단계`}
                onClick={() => setTourStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-brand' : 'w-1.5 bg-line'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button size="sm" icon={<ArrowLeft size={14} />} onClick={() => setTourStep(step - 1)}>
                이전
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => (last ? endTour() : setTourStep(step + 1))}>
              {last ? '마치기' : '다음'} {!last && <ArrowRight size={14} />}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
