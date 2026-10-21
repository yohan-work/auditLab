export const num = (v?: number) => (v === undefined ? '' : v.toLocaleString('ko-KR'))

export const won = (v?: number) => (v === undefined ? '-' : `${v.toLocaleString('ko-KR')}원`)

/** 큰 금액을 '억/만' 단위로 줄여 표시 */
export function wonShort(v: number) {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1).replace(/\.0$/, '')}억원`
  if (Math.abs(v) >= 1e4) return `${Math.round(v / 1e4).toLocaleString('ko-KR')}만원`
  return `${v.toLocaleString('ko-KR')}원`
}

export const date = (iso?: string) => (iso ? iso.slice(0, 10) : '')

export function dateTime(iso?: string) {
  if (!iso) return ''
  return iso.length > 10 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso
}

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
