// 회사가 제출한 엑셀(행 배열)을 전수대사 엔진 입력(TieoutInput)으로 정규화한다.
// 파일 종류는 파일 이름이 아니라 내용(제목·머리글)으로 알아본다. 외부 의존이 없어 브라우저·Node에서 모두 돌아간다.
import type { TieoutInput } from './engine'

export type Cell = string | number | boolean | Date | null | undefined
export interface SheetRows {
  name: string
  rows: Cell[][]
}

export type FileKind = 'journal' | 'salesInvoices' | 'purchaseInvoices' | 'bank' | 'ar' | 'customers' | 'vat' | 'unknown'

export const kindLabel: Record<FileKind, string> = {
  journal: '분개장',
  salesInvoices: '홈택스 매출 전자세금계산서 목록',
  purchaseInvoices: '홈택스 매입 전자세금계산서 목록',
  bank: '은행 거래내역',
  ar: '거래처원장 (외상매출금)',
  customers: '거래처등록현황',
  vat: '부가가치세 신고서 (과세표준)',
  unknown: '알 수 없는 형식',
}

export interface ParsedFile {
  fileName: string
  kind: FileKind
  count: number
  meta: { company?: string; period?: string }
  warnings: string[]
  journal?: TieoutInput['journal']
  invoices?: TieoutInput['invoices']
  bank?: TieoutInput['bank']
  ar?: TieoutInput['ar']
  customers?: TieoutInput['customers']
  vat?: number[]
}

// ---------------------------------------------------------------- 값 정리

const text = (v: Cell) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim())
const compact = (v: Cell) => text(v).replace(/\s/g, '')

export function toNumber(v: Cell): number {
  if (typeof v === 'number') return v
  const s = text(v).replace(/[,\s원]/g, '')
  if (!s || s === '-') return 0
  const n = Number(s.replace(/^\((.*)\)$/, '-$1'))
  return Number.isFinite(n) ? n : 0
}

/** 문자열(2025-01-02, 2025.01.02, 20250102)·엑셀 일련번호·Date → YYYY-MM-DD */
export function toIsoDate(v: Cell): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000)
    return d.toISOString().slice(0, 10)
  }
  const s = text(v)
  const m = /^(\d{4})[-./]?(\d{2})[-./]?(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s
}

/** 은행 거래일시 → "YYYY.MM.DD HH:MM:SS" (엔진 입력 형식) */
function toBankDt(v: Cell): string {
  if (typeof v === 'number') {
    const ms = Date.UTC(1899, 11, 30) + v * 86_400_000
    const d = new Date(Math.round(ms / 1000) * 1000).toISOString()
    return `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)} ${d.slice(11, 19)}`
  }
  const s = text(v)
  const m = /^(\d{4})[-./](\d{2})[-./](\d{2})[ T]?(\d{2}:\d{2}(?::\d{2})?)?/.exec(s)
  if (!m) return s
  const time = m[4] ? (m[4].length === 5 ? `${m[4]}:00` : m[4]) : '00:00:00'
  return `${m[1]}.${m[2]}.${m[3]} ${time}`
}

const findHeader = (rows: Cell[][], must: string[], within = 15) =>
  rows.slice(0, within).findIndex((r) => must.every((m) => r.some((c) => compact(c) === m.replace(/\s/g, ''))))

const colOf = (header: Cell[], name: string) => header.findIndex((c) => compact(c) === name.replace(/\s/g, ''))

const metaText = (rows: Cell[][], upto: number) =>
  rows
    .slice(0, Math.max(0, upto))
    .flat()
    .map(text)
    .filter(Boolean)
    .join(' ')

// ---------------------------------------------------------------- 형식별 해석

function parseJournal(rows: Cell[][], h: number): Partial<ParsedFile> {
  const H = rows[h]
  const c = (n: string) => colOf(H, n)
  const [date, no, acct, cust, memo, dr, cr] = [c('일자'), c('번호'), c('계정코드'), c('거래처코드'), c('적요'), c('차변'), c('대변')]
  const journal: TieoutInput['journal'] = []
  let total = 0
  for (const r of rows.slice(h + 1)) {
    if (!text(r[date])) continue
    total++
    const a = text(r[acct])
    if (a !== '108' && a !== '404' && a !== '257' && a !== '251' && a !== '153' && a !== '135' && a !== '103') continue
    journal.push({ date: toIsoDate(r[date]), no: text(r[no]), acct: a, cust: text(r[cust]), memo: text(r[memo]), dr: toNumber(r[dr]), cr: toNumber(r[cr]) })
  }
  return { journal, count: total }
}

/** 홈택스 목록조회 내려받기 형식: 머리글 이름이 중복되므로 표준 열 위치를 쓰고 머리글로 확인한다. */
function parseHometax(rows: Cell[][], h: number): Partial<ParsedFile> {
  const H = rows[h].map(compact)
  const warnings: string[] = []
  if (H[14] !== '합계금액' || H[15] !== '공급가액') warnings.push('홈택스 표준 열 순서와 다릅니다. 금액 열을 확인하세요.')
  const invoices: TieoutInput['invoices'] = []
  for (const r of rows.slice(h + 1)) {
    if (!text(r[1])) continue
    invoices.push({
      appr: text(r[1]),
      wdate: toIsoDate(r[0]),
      idate: toIsoDate(r[2]),
      // 매출 목록은 공급받는자(9·11), 매입 목록은 공급자(4·6)가 상대방이다. 아래에서 종류에 맞춰 바꾼다.
      bizno: text(r[9]),
      name: text(r[11]),
      total: toNumber(r[14]),
      supply: toNumber(r[15]),
      vat: toNumber(r[16]),
      kind: text(r[17]),
      note: text(r[20]),
      item: text(r[26]),
      ...{ _supplierBizno: text(r[4]), _supplierName: text(r[6]) },
    } as TieoutInput['invoices'][number])
  }
  return { invoices, count: invoices.length, warnings }
}

function parseBank(rows: Cell[][], h: number): Partial<ParsedFile> {
  const H = rows[h]
  const [dt, kind, memo, out, inn] = [colOf(H, '거래일시'), colOf(H, '적요'), colOf(H, '기재내용'), colOf(H, '찾으신금액'), colOf(H, '맡기신금액')]
  const bank: TieoutInput['bank'] = []
  for (const r of rows.slice(h + 1)) {
    if (!text(r[dt])) continue
    bank.push({ dt: toBankDt(r[dt]), kind: text(r[kind]), memo: text(r[memo]), out: toNumber(r[out]), in: toNumber(r[inn]) })
  }
  return { bank, count: bank.length }
}

function parseAr(rows: Cell[][], h: number): Partial<ParsedFile> {
  const H = rows[h]
  const [code, open, bal] = [colOf(H, '코드'), colOf(H, '전기이월'), colOf(H, '잔액')]
  const ar = rows
    .slice(h + 1)
    .filter((r) => text(r[code]))
    .map((r) => ({ code: text(r[code]), opening: toNumber(r[open]), balance: toNumber(r[bal]) }))
  return { ar, count: ar.length }
}

function parseCustomers(rows: Cell[][], h: number): Partial<ParsedFile> {
  const H = rows[h]
  const [code, name, biz] = [colOf(H, '코드'), colOf(H, '거래처명'), colOf(H, '사업자등록번호')]
  const customers = rows
    .slice(h + 1)
    .filter((r) => text(r[code]))
    .map((r) => ({ code: text(r[code]), name: text(r[name]), bizno: text(r[biz]) }))
  return { customers, count: customers.length }
}

function parseVat(rows: Cell[][], h: number): Partial<ParsedFile> {
  const col = colOf(rows[h], '합계 금액')
  const vat = rows
    .slice(h + 1)
    .filter((r) => text(r[0]))
    .map((r) => toNumber(r[col]))
  return { vat, count: vat.length, warnings: vat.length === 4 ? [] : [`분기 4개가 아니라 ${vat.length}개입니다.`] }
}

/** 시트 하나를 보고 종류를 판정해 해석한다. */
export function parseSheet(fileName: string, sheet: SheetRows): ParsedFile {
  const rows = sheet.rows
  const base: ParsedFile = { fileName, kind: 'unknown', count: 0, meta: {}, warnings: [] }
  const tries: [FileKind, string[], (rows: Cell[][], h: number) => Partial<ParsedFile>][] = [
    ['journal', ['일자', '계정코드', '차변', '대변'], parseJournal],
    ['salesInvoices', ['작성일자', '승인번호', '발급일자'], parseHometax],
    ['bank', ['거래일시', '맡기신금액'], parseBank],
    ['ar', ['코드', '전기이월', '잔액'], parseAr],
    ['customers', ['코드', '거래처명', '사업자등록번호'], parseCustomers],
    ['vat', ['신고구분', '과세기간', '합계 금액'], parseVat],
  ]
  for (const [kind, must, fn] of tries) {
    const h = findHeader(rows, must)
    if (h < 0) continue
    const meta = metaText(rows, h)
    const parsed = fn(rows, h)
    let k = kind
    if (kind === 'salesInvoices' && /매입/.test(meta)) {
      k = 'purchaseInvoices'
      parsed.invoices = parsed.invoices!.map((i) => {
        const x = i as typeof i & { _supplierBizno: string; _supplierName: string }
        return { ...i, bizno: x._supplierBizno, name: x._supplierName }
      })
    }
    parsed.invoices = parsed.invoices?.map((i) => {
      const { _supplierBizno: _a, _supplierName: _b, ...rest } = i as typeof i & { _supplierBizno?: string; _supplierName?: string }
      return rest
    })
    return {
      ...base,
      ...parsed,
      kind: k,
      warnings: [...(parsed.warnings ?? [])],
      meta: { company: /회사명\s*:\s*(\S+)/.exec(meta)?.[1] ?? /상호\s+(\S+)/.exec(meta)?.[1], period: /기\s*간\s*:\s*([^계]+)/.exec(meta)?.[1]?.trim() },
    }
  }
  return base
}

/** 파일 하나(여러 시트)에서 알아볼 수 있는 첫 시트를 쓴다. */
export function parseWorkbook(fileName: string, sheets: SheetRows[]): ParsedFile {
  for (const s of sheets) {
    const p = parseSheet(fileName, s)
    if (p.kind !== 'unknown') return p
  }
  return { fileName, kind: 'unknown', count: 0, meta: {}, warnings: ['분개장·홈택스 목록·은행 거래내역·거래처원장·거래처등록·부가세 신고서 형식이 아닙니다.'] }
}

// ---------------------------------------------------------------- 조립

export const requiredKinds: FileKind[] = ['journal', 'salesInvoices', 'bank', 'ar', 'customers']

export interface Assembled {
  input: TieoutInput | null
  missing: FileKind[]
  purchaseInvoices: TieoutInput['invoices']
  /** 매입 대사용: 분개장 전체(108·404·257 외 251·153·135·103 포함) */
  journalAll: TieoutInput['journal']
}

export function assemble(files: ParsedFile[], company = '회사'): Assembled {
  const of = (k: FileKind) => files.filter((f) => f.kind === k)
  const missing = requiredKinds.filter((k) => of(k).length === 0)
  const purchaseInvoices = of('purchaseInvoices').flatMap((f) => f.invoices ?? [])
  const journalFiles = of('journal').sort((a, b) => (a.journal?.[0]?.date ?? '').localeCompare(b.journal?.[0]?.date ?? ''))
  const journalAll = journalFiles.flatMap((f) => f.journal ?? [])
  if (missing.length) return { input: null, missing, purchaseInvoices, journalAll }
  // 분개장은 기간 순서로 이어 붙인다(당기 → 후속기간)
  const invFiles = of('salesInvoices').sort((a, b) => (a.invoices?.[0]?.wdate ?? '').localeCompare(b.invoices?.[0]?.wdate ?? ''))
  const journal = journalAll
  const fiscalYear = Number(journal[0]?.date.slice(0, 4))
  const vat = of('vat')[0]?.vat ?? [0, 0, 0, 0]
  return {
    missing,
    purchaseInvoices,
    journalAll,
    input: {
      company: journalFiles[0].meta.company ?? company,
      fiscalYear,
      customers: of('customers')[0].customers ?? [],
      // 매출 대사는 108·404·257만 쓴다(매입 대사는 purchase 엔진이 따로 읽음)
      journal: journal.filter((r) => r.acct === '108' || r.acct === '404' || r.acct === '257'),
      invoices: invFiles.flatMap((f) => f.invoices ?? []),
      bank: of('bank').flatMap((f) => f.bank ?? []),
      ar: of('ar')[0].ar ?? [],
      vatReturn: vat,
    },
  }
}
