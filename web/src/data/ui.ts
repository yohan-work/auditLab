// 화면 상태(알림 토스트, 둘러보기). 업무 데이터와 분리해 저장소 교체 시 영향이 없게 한다.
import { create } from 'zustand'

export interface Toast {
  id: number
  kind: 'error' | 'success' | 'info'
  text: string
}

interface UiState {
  toasts: Toast[]
  tourStep: number | null
}

export const useUi = create<UiState>(() => ({ toasts: [], tourStep: null }))

let seq = 0
export function toast(kind: Toast['kind'], text: string) {
  const id = ++seq
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
  setTimeout(() => dismissToast(id), 4000)
}

export const dismissToast = (id: number) => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))

const TOUR_KEY = 'auditlab-tour-seen'
export const startTour = () => useUi.setState({ tourStep: 0 })
export const setTourStep = (n: number | null) => useUi.setState({ tourStep: n })
export function endTour() {
  useUi.setState({ tourStep: null })
  try {
    localStorage.setItem(TOUR_KEY, '1')
  } catch {
    /* 저장소를 쓸 수 없어도 둘러보기는 동작한다 */
  }
}
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1'
  } catch {
    return true
  }
}
