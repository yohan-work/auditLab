// 매입 3방향 대사: 원장(외상매입금 251) × 홈택스 매입 전자세금계산서 × 은행 출금.
// 핵심 목적은 '미기록 부채'(국세청엔 있는데 장부에 없는 매입)와 후속기간 지급 전수 검토(감사기준서 330·500 미기록부채 검토).
// 결정론적 규칙만 쓰며 외부 의존이 없다. 장부는 고치지 않는다.
import type { Risk, TieoutException, TieoutInput } from './engine'

export interface PurchaseInput {
  fiscalYear: number
  /** 분개장 전체 행(251·153 포함) */
  journal: TieoutInput['journal']
  /** 홈택스 매입 목록: bizno·name은 공급자 */
  invoices: TieoutInput['invoices']
  bank: TieoutInput['bank']
}

export interface PurchaseResult {
  summary: { ledgerPurchases: number; ledgerAmount: number; invoices: number; invoiceAmount: number; payments: number; paymentAmount: number; matched: number; matchedAmount: number }
  exceptions: TieoutException[]
  perSupplier: { name: string; ledger: number; evidence: number; diff: number; reasons: string[] }[]
  subsequent: { date: string; supplier: string; amount: number; ledgerDate: string | null; invDate: string | null; verdict: '당기 부채로 계상됨' | '익기 매입' | '당기 귀속 · 장부 미계상' | '대응 매입 없음'; ref: string }[]
  vat: { hometax: number[]; ledger: number[]; items: { no: string; label: string; total: number }[]; unexplained: number }
  rows: { id: string; date: string; supplier: string; amount: number; invDate: string | null; invAmount: number | null; paid: string; rule: string; ok: boolean }[]
}

const DAY = 86_400_000
const t = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const days = (a: string, b: string) => Math.round((t(a) - t(b)) / DAY)
const year = (iso: string) => +iso.slice(0, 4)
const quarter = (iso: string) => Math.floor((+iso.slice(5, 7) - 1) / 3)
const won = (n: number) => n.toLocaleString('en-US')
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const norm = (s: string | null | undefined) => (s ?? '').replace(/\(주\)|주\)|\(주|㈜|주식회사|\s/g, '')
const bankDate = (dt: string) => `${dt.slice(0, 4)}-${dt.slice(5, 7)}-${dt.slice(8, 10)}`

interface LP {
  id: string
  date: string
  supplier: string
  total: number
  inv: string | null
  rule: string
}
interface PI {
  appr: string
  wdate: string
  supplier: string
  total: number
  supply: number
  kind: string
  ledger: string | null
}
interface Out {
  id: string
  date: string
  supplier: string
  amount: number
  used: boolean
}

export function runPurchaseTieout(input: PurchaseInput, opt = { dateWindow: 20, subEnd: `${input.fiscalYear + 1}-02-28` }): PurchaseResult {
  const fy = input.fiscalYear
  const fyEnd = `${fy}-12-31`
  const names = [...new Set(input.invoices.map((i) => i.name))]
  const byNorm = names.map((n) => [norm(n), n] as const).sort((a, b) => b[0].length - a[0].length)
  const supplierOf = (txt: string) => {
    const n = norm(txt)
    return byNorm.find(([k]) => k && n.includes(k))?.[1] ?? null
  }

  const ledger: LP[] = []
  const ledgerPay: { date: string; supplier: string; amount: number }[] = []
  for (const r of input.journal) {
    if (r.acct !== '251') continue
    const s = supplierOf(r.memo) ?? supplierOf(r.cust) ?? r.memo
    if (r.cr > 0) ledger.push({ id: `P${String(ledger.length + 1).padStart(4, '0')}`, date: r.date, supplier: s, total: r.cr, inv: null, rule: '' })
    if (r.dr > 0) ledgerPay.push({ date: r.date, supplier: s, amount: r.dr })
  }
  const inv: PI[] = input.invoices.map((i) => ({ appr: i.appr, wdate: i.wdate, supplier: i.name, total: i.total, supply: i.supply, kind: i.kind, ledger: null }))
  const outs: Out[] = []
  input.bank.forEach((b, k) => {
    const s = b.out > 0 ? supplierOf(b.memo) : null
    if (s) outs.push({ id: `W${String(k + 1).padStart(4, '0')}`, date: bankDate(b.dt), supplier: s, amount: b.out, used: false })
  })

  const exceptions: TieoutException[] = []
  const X = (kind: string, assertion: string, risk: Risk, amount: number, detail: string, action: string, supplier: string, ref: { ledger?: string; appr?: string; deposit?: string } = {}) =>
    exceptions.push({
      no: `PX-${String(exceptions.length + 1).padStart(2, '0')}`,
      kind,
      assertion,
      risk,
      amount,
      detail,
      action,
      ledger: ref.ledger ?? null,
      appr: ref.appr ?? null,
      cust: supplier,
      custName: supplier,
      deposit: ref.deposit ?? null,
    })
  const payOf = (supplier: string, amount: number, from: string) => {
    const o = outs.find((o) => !o.used && o.supplier === supplier && o.amount === amount && o.date >= from && o.date <= opt.subEnd)
    if (o) o.used = true
    return o
  }

  // 1. 세금계산서 ↔ 원장: 같은 공급자·같은 금액, 가장 가까운 날짜
  for (const i of [...inv].sort((a, b) => a.wdate.localeCompare(b.wdate))) {
    const c = ledger.filter((l) => !l.inv && l.supplier === i.supplier && l.total === i.total && Math.abs(days(l.date, i.wdate)) <= opt.dateWindow)
    if (!c.length) continue
    const l = c.reduce((a, b) => (Math.abs(days(b.date, i.wdate)) < Math.abs(days(a.date, i.wdate)) ? b : a))
    l.inv = i.appr
    i.ledger = l.id
    l.rule = '일치'
  }
  // 2. 금액 불일치 쌍
  for (const i of inv) {
    if (i.ledger || i.total <= 0) continue
    const c = ledger.filter((l) => !l.inv && l.supplier === i.supplier && Math.abs(days(l.date, i.wdate)) <= 5 && Math.abs(l.total - i.total) <= 0.2 * i.total)
    if (!c.length) continue
    const l = c[0]
    l.inv = i.appr
    i.ledger = l.id
    l.rule = '금액 불일치'
    if (year(l.date) === fy)
      X('금액 불일치', '정확성', '높음', l.total - i.total, `장부 ${won(l.total)} vs 세금계산서 ${won(i.total)} (${l.date})`, '거래명세서·검수 기록으로 실제 매입 금액 확인, 수정 필요 여부 판단', i.supplier, { ledger: l.id, appr: i.appr })
  }
  // 3. 기간귀속: 당기 작성 세금계산서가 익기 장부에 계상
  for (const i of inv) {
    if (i.ledger || i.total <= 0 || year(i.wdate) !== fy) continue
    const l = ledger.find((l) => !l.inv && l.supplier === i.supplier && l.total === i.total && year(l.date) === fy + 1 && days(l.date, i.wdate) <= 45)
    if (!l) continue
    l.inv = i.appr
    i.ledger = l.id
    l.rule = '기간귀속'
    X('기간귀속 (당기 매입 과소)', '기간귀속·완전성', '높음', -i.total, `세금계산서 작성일 ${i.wdate} / 장부 계상 ${l.date} → ${fy}년 매입·미지급금 ${won(i.total)}원 누락`, '입고일·검수일 확인, 당기 부채 계상 필요 여부 판단', i.supplier, { ledger: l.id, appr: i.appr })
  }
  // 4. 세금계산서에만 있는 것
  for (const i of inv) {
    if (i.ledger || year(i.wdate) !== fy) continue
    if (i.total < 0) {
      X('수정세금계산서(매입 차감) 미반영', '정확성', '중간', i.total, `${i.wdate} ${i.kind} ${won(i.total)}원이 장부 매입·미지급금에 반영되지 않음`, '에누리·반품 사실 확인, 원가·미지급금 차감 필요 여부 판단', i.supplier, { appr: i.appr })
      continue
    }
    const twin = inv.find((x) => x !== i && x.ledger && x.supplier === i.supplier && x.wdate === i.wdate && x.total === i.total)
    if (twin) {
      X('세금계산서 중복 수취 의심', '정확성(세무)', '중간', i.total, `${i.wdate} 같은 공급자·같은 금액 세금계산서 2건(장부 1건, 대응 ${twin.appr})`, '중복 발급 여부 확인, 매입세액 공제 신고 확인', i.supplier, { appr: i.appr })
      continue
    }
    const paid = payOf(i.supplier, i.total, i.wdate)
    if (paid)
      X('세금계산서O·원장X·지급O', '완전성', '높음', -i.total, `${i.wdate} ${won(i.total)}원 세금계산서·출금(${paid.date})은 있으나 장부 매입 없음`, '지급 처리 계정 확인, 매입·원가 누락 여부 판단', i.supplier, { appr: i.appr, deposit: paid.id })
    else
      X('세금계산서O·원장X·지급X (미기록 부채 의심)', '완전성', '매우 높음', -i.total, `${i.wdate} ${won(i.total)}원 세금계산서가 국세청에 있으나 장부 매입·미지급금 없음, ${opt.subEnd}까지 지급도 없음`, '공급자 조회·거래명세서 확인, 미지급금 계상 필요 여부 판단 (외부조회 우선 대상)', i.supplier, { appr: i.appr })
  }
  // 5. 장부에만 있는 매입
  for (const l of ledger) {
    if (l.inv || year(l.date) !== fy) continue
    l.rule = '세금계산서 없음'
    const paid = outs.find((o) => o.supplier === l.supplier && o.amount === l.total && o.date >= l.date && o.date <= opt.subEnd)
    X('원장O·세금계산서X', '발생', paid ? '높음' : '매우 높음', l.total, `${l.date} 장부 매입 ${won(l.total)}원에 대응하는 국세청 세금계산서 없음${paid ? ` (지급 ${paid.date} 완료)` : ''}`, '거래명세서·입고 기록 확인, 가공 매입 및 매입세액 공제 적정성 판단', l.supplier, { ledger: l.id, deposit: paid?.id })
  }

  // 6. 후속기간 지급 전수 검토 (미기록부채 검토)
  const subsequent: PurchaseResult['subsequent'] = outs
    .filter((o) => o.date > fyEnd)
    .map((o) => {
      const l = ledger.filter((l) => l.supplier === o.supplier && l.total === o.amount && l.date <= o.date).sort((a, b) => b.date.localeCompare(a.date))[0]
      const i = l?.inv ? inv.find((x) => x.appr === l.inv) : inv.find((x) => x.supplier === o.supplier && x.total === o.amount && x.wdate <= o.date)
      const verdict: PurchaseResult['subsequent'][number]['verdict'] = !l && !i ? '대응 매입 없음' : l && l.date <= fyEnd ? '당기 부채로 계상됨' : i && i.wdate <= fyEnd ? '당기 귀속 · 장부 미계상' : '익기 매입'
      return { date: o.date, supplier: o.supplier, amount: o.amount, ledgerDate: l?.date ?? null, invDate: i?.wdate ?? null, verdict, ref: o.id }
    })

  // 7. 공급자별 기말 미지급금: 장부(당기 증감) vs 증빙(세금계산서 − 출금)
  const perSupplier = names
    .sort()
    .map((n) => {
      const lg = sum(ledger.filter((l) => l.supplier === n && l.date <= fyEnd && year(l.date) === fy).map((l) => l.total)) - sum(ledgerPay.filter((p) => p.supplier === n && p.date <= fyEnd && year(p.date) === fy).map((p) => p.amount))
      const ev = sum(inv.filter((i) => i.supplier === n && year(i.wdate) === fy).map((i) => i.total)) - sum(outs.filter((o) => o.supplier === n && year(o.date) === fy).map((o) => o.amount))
      return { name: n, ledger: lg, evidence: ev, diff: lg - ev, reasons: exceptions.filter((x) => x.cust === n).map((x) => x.no) }
    })

  // 8. 매입 공급가액 대사 (분기): 홈택스 vs 장부
  const htQ = [0, 1, 2, 3].map((k) => sum(inv.filter((i) => year(i.wdate) === fy && quarter(i.wdate) === k).map((i) => i.supply)))
  const glQ = [0, 1, 2, 3].map((k) => sum(ledger.filter((l) => year(l.date) === fy && quarter(l.date) === k).map((l) => Math.round(l.total / 1.1))))
  // 각 예외가 '장부 − 홈택스' 공급가액 차이에 주는 영향 (중복 수취·매입 차감 미반영은 홈택스 쪽에만 있음)
  const effect = (x: TieoutException) => (x.kind.includes('중복') || x.kind.includes('매입 차감') ? -x.amount : x.amount)
  const items = exceptions.map((x) => ({ no: x.no, label: `${x.kind} · ${x.custName}`, total: Math.round(effect(x) / 1.1) }))
  const unexplained = sum(glQ) - sum(htQ) - sum(items.map((i) => i.total))

  const fyLedger = ledger.filter((l) => year(l.date) === fy)
  const matched = fyLedger.filter((l) => l.rule === '일치')
  const rows = fyLedger.map((l) => {
    const i = l.inv ? inv.find((x) => x.appr === l.inv) : undefined
    const p = outs.find((o) => o.supplier === l.supplier && o.amount === l.total && o.date >= l.date && o.date <= opt.subEnd)
    return { id: l.id, date: l.date, supplier: l.supplier, amount: l.total, invDate: i?.wdate ?? null, invAmount: i?.total ?? null, paid: p ? p.date : '', rule: l.rule, ok: l.rule === '일치' && !!p }
  })

  return {
    summary: {
      ledgerPurchases: fyLedger.length,
      ledgerAmount: sum(fyLedger.map((l) => l.total)),
      invoices: inv.filter((i) => year(i.wdate) === fy).length,
      invoiceAmount: sum(inv.filter((i) => year(i.wdate) === fy).map((i) => i.total)),
      payments: outs.length,
      paymentAmount: sum(outs.map((o) => o.amount)),
      matched: matched.length,
      matchedAmount: sum(matched.map((l) => l.total)),
    },
    exceptions,
    perSupplier,
    subsequent,
    vat: { hometax: htQ, ledger: glQ, items, unexplained },
    rows,
  }
}
