// 전수대사 입력 자료: 회사가 올린 엑셀(또는 시연용 샘플 엑셀)을 브라우저에서 읽어 엔진 입력으로 바꾼다.
// 업로드 자료는 이 브라우저 메모리에만 있고 서버로 보내지 않는다(새로고침하면 다시 올려야 함).
import { create } from 'zustand'
import type { TieoutInput } from '@/domain/tieout/engine'
import type { PurchaseInput } from '@/domain/tieout/purchase'
import { assemble, parseWorkbook, type Cell, type FileKind, type ParsedFile } from '@/domain/tieout/parsers'

export interface AsisComparison {
  anomalies: { id: string; type: string; assertion: string; desc: string; amount: number; asis: string; asis_why: string; tobe_no: string }[]
  coverage: { asis_vouch_n: number; asis_vouch_amt: number; pop_n: number; pop_amt: number; asis_cutoff_n: number; tobe_cutoff_n: number; asis_conf_n: number }
  asisEffort: Record<string, number>
  tobeEffort: Record<string, number>
  asisVatDiff: number
}

export interface PurchaseTruth {
  anomalies: { id: string; type: string; assertion: string; amount: number; desc: string }[]
}

export interface TieoutDataset {
  source: 'sample' | 'upload'
  files: ParsedFile[]
  input: TieoutInput
  purchase: PurchaseInput | null
  /** 시연 자료에만 있는 '심어 둔 이상거래' 비교 */
  asis?: AsisComparison
  purchaseTruth?: PurchaseTruth
}

/** 시연 자료가 붙어 있는 고객사 */
export const SAMPLE_CLIENT_ID = 'cl-sample'

export const SAMPLE_FILES = [
  '02_분개장_2025.xlsx',
  '03_분개장_2026_1-2월.xlsx',
  '05_거래처원장_외상매출금_2025.xlsx',
  '06_거래처등록현황.xlsx',
  '07_매출전자세금계산서목록_2025.xlsx',
  '08_매출전자세금계산서목록_2026_1-2월.xlsx',
  '09_은행거래내역_KB국민_보통예금.xlsx',
  '10_부가가치세신고서_과세표준요약_2025.xlsx',
  '11_매입전자세금계산서목록_2025.xlsx',
  '12_매입전자세금계산서목록_2026_1-2월.xlsx',
]

export const sampleUrl = (f: string) => `${import.meta.env.BASE_URL}samples/${encodeURIComponent(f)}`

async function parseBuffer(name: string, buf: ArrayBuffer): Promise<ParsedFile> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf)
  const sheets = wb.SheetNames.map((n) => ({ name: n, rows: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }) }))
  return parseWorkbook(name, sheets)
}

export const parseFiles = (files: File[]) => Promise.all(files.map(async (f) => parseBuffer(f.name, await f.arrayBuffer())))

export function toDataset(files: ParsedFile[], source: TieoutDataset['source']): { dataset: TieoutDataset | null; missing: FileKind[] } {
  const a = assemble(files)
  if (!a.input) return { dataset: null, missing: a.missing }
  return {
    missing: [],
    dataset: {
      source,
      files,
      input: a.input,
      purchase: a.purchaseInvoices.length ? { fiscalYear: a.input.fiscalYear, journal: a.journalAll, invoices: a.purchaseInvoices, bank: a.input.bank } : null,
    },
  }
}

export async function loadSampleDataset(): Promise<TieoutDataset> {
  const files = await Promise.all(SAMPLE_FILES.map(async (f) => parseBuffer(f, await (await fetch(sampleUrl(f))).arrayBuffer())))
  const { dataset } = toDataset(files, 'sample')
  const [asis, truth] = await Promise.all([import('./mock/tieout/asis.json'), import('./mock/tieout/purchase_truth.json')])
  return { ...dataset!, asis: asis.default as unknown as AsisComparison, purchaseTruth: truth.default as unknown as PurchaseTruth }
}

/** 감사 업무별로 지금 화면에 올라와 있는 자료 (메모리 전용) */
export const useTieoutData = create<Record<string, TieoutDataset | undefined>>(() => ({}))
export const setTieoutData = (engagementId: string, d: TieoutDataset | undefined) => useTieoutData.setState({ [engagementId]: d })
