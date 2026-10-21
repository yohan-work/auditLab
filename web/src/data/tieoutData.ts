// 전수대사 입력 자료. 지금은 poc 가상 자료(샘플제조 2025)를 정규화한 JSON을 쓴다.
// 실제 서비스에서는 고객 포털에 올라온 엑셀을 형식별 파서(더존·홈택스·은행)가 같은 TieoutInput으로 바꾼다.
import type { TieoutInput } from '@/domain/tieout/engine'

export interface AsisComparison {
  anomalies: { id: string; type: string; assertion: string; desc: string; amount: number; asis: string; asis_why: string; tobe_no: string }[]
  coverage: { asis_vouch_n: number; asis_vouch_amt: number; pop_n: number; pop_amt: number; asis_cutoff_n: number; tobe_cutoff_n: number; asis_conf_n: number }
  asisEffort: Record<string, number>
  tobeEffort: Record<string, number>
  asisVatDiff: number
}

export interface SampleDataset {
  input: TieoutInput & { files: { key: string; label: string; names: string[] }[] }
  asis: AsisComparison
}

/** 시연 자료가 붙어 있는 고객사 */
export const SAMPLE_CLIENT_ID = 'cl-sample'

let cache: Promise<SampleDataset> | null = null
export function loadSampleDataset(): Promise<SampleDataset> {
  cache ??= Promise.all([import('./mock/tieout/input.json'), import('./mock/tieout/asis.json')]).then(([i, a]) => ({
    input: i.default as unknown as SampleDataset['input'],
    asis: a.default as unknown as AsisComparison,
  }))
  return cache
}
