// K-Tieout: 원장 × 홈택스 전자세금계산서 × 은행 거래내역 3방향 전수대사 엔진.
// poc/ktieout.py를 그대로 옮긴 결정론적 규칙이다(같은 입력 → 같은 결과). AI를 쓰지 않는다.
// 이 파일은 외부 의존이 없어 브라우저·서버(Node)에서 모두 실행된다.
// 도구는 장부를 고치지 않는다. 결과는 회계사 판단을 위한 자료다(외부감사법 제6조⑥).

// ---------------------------------------------------------------- 입력 (형식별 파서가 이 모양으로 정규화)

export interface TieoutInput {
  company: string
  fiscalYear: number
  customers: { code: string; name: string; bizno: string }[]
  /** 분개장 중 108(외상매출금)·404(제품매출)·257(가수금) 행 */
  journal: { date: string; no: string; acct: string; cust: string; memo: string; dr: number; cr: number }[]
  invoices: { appr: string; wdate: string; idate: string; bizno: string; name: string; total: number; supply: number; vat: number; kind: string; note: string; item: string }[]
  /** 거래일시 "YYYY.MM.DD HH:MM:SS" */
  bank: { dt: string; kind: string; memo: string; out: number; in: number }[]
  ar: { code: string; opening: number; balance: number }[]
  vatReturn: number[]
}

export interface TieoutOptions {
  fyStart: string
  fyEnd: string
  subEnd: string
  cutoffFrom: string
  cutoffTo: string
  feeTol: number
  dateWindow: number
  agingDays: number
  trivial: number
}

export function defaultOptions(fy: number): TieoutOptions {
  return {
    fyStart: `${fy}-01-01`,
    fyEnd: `${fy}-12-31`,
    subEnd: `${fy + 1}-02-28`,
    cutoffFrom: `${fy}-12-15`,
    cutoffTo: `${fy + 1}-01-15`,
    feeTol: 3_000,
    dateWindow: 20,
    agingDays: 150,
    trivial: 2_500_000,
  }
}

// ---------------------------------------------------------------- 출력

export type Risk = '매우 높음' | '높음' | '중간'

export interface TieoutException {
  no: string
  kind: string
  assertion: string
  risk: Risk
  amount: number
  detail: string
  action: string
  ledger: string | null
  appr: string | null
  cust: string | null
  custName: string
  deposit: string | null
}

export interface LedgerSale {
  id: string
  date: string
  no: string
  cust: string
  total: number
  supply: number
  memo: string
  inv: string | null
  rule: string | null
}

export interface TieoutRow {
  ledgerId: string
  date: string
  no: string
  custName: string
  amount: number
  appr: string | null
  invDate: string | null
  invAmount: number | null
  deposits: string
  payment: '' | '입금완료' | '부분입금' | '미입금'
  rule: string
  ok: boolean
}

export interface TieoutResult {
  summary: {
    ledgerSales: number
    ledgerAmount: number
    invoices: number
    invoiceAmount: number
    deposits: number
    depositAmount: number
    matched: number
    matchedAmount: number
    matchedPaid: number
    matchedPaidAmount: number
  }
  exceptions: TieoutException[]
  rules: Record<string, number>
  vat: { return: number[]; hometax: number[]; ledger: number[]; items: { no: string; label: string; quarters: number[]; total: number }[]; unexplained: number }
  perCustomer: { cust: string; name: string; ledger: number; evidence: number; diff: number; reasons: string[] }[]
  cutoff: { date: string; no: string; memo: string; custName: string; amount: number; appr: string; invDate: string; ok: boolean }[]
  rows: TieoutRow[]
  depositRows: { id: string; dt: string; memo: string; amount: number; custName: string; alloc: string; rule: string }[]
}

// ---------------------------------------------------------------- 도우미

const DAY = 86_400_000
const toTime = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
const days = (a: string, b: string) => Math.round((toTime(a) - toTime(b)) / DAY) // a − b
const addDays = (iso: string, n: number) => new Date(toTime(iso) + n * DAY).toISOString().slice(0, 10)
const year = (iso: string) => +iso.slice(0, 4)
const quarter = (iso: string) => Math.floor((+iso.slice(5, 7) - 1) / 3)
const won = (n: number) => n.toLocaleString('en-US')
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
/** 파이썬 round()와 같은 은행가 반올림 */
const roundHalfEven = (x: number) => {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}
/** 첫 번째 최솟값(파이썬 min과 같은 동점 처리) */
function minBy<T>(xs: T[], key: (x: T) => number): T {
  let best = xs[0]
  let bk = key(best)
  for (const x of xs.slice(1)) {
    const k = key(x)
    if (k < bk) {
      best = x
      bk = k
    }
  }
  return best
}
/** itertools.combinations와 같은 순서 */
function* combinations<T>(xs: T[], k: number): Generator<T[]> {
  const n = xs.length
  if (k > n) return
  const idx = Array.from({ length: k }, (_, i) => i)
  yield idx.map((i) => xs[i])
  for (;;) {
    let i = k - 1
    while (i >= 0 && idx[i] === i + n - k) i--
    if (i < 0) return
    idx[i]++
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1
    yield idx.map((t) => xs[t])
  }
}
function firstCombo<T>(xs: T[], ks: number[], ok: (g: T[]) => boolean): T[] | null {
  for (const k of ks) for (const g of combinations(xs, k)) if (ok(g)) return g
  return null
}
const norm = (s: string | null | undefined) => (s ?? '').replace(/\(주\)|주\)|\(주|㈜|주식회사|\s/g, '')

// ---------------------------------------------------------------- 엔진

interface Inv {
  appr: string
  wdate: string
  bizno: string
  name: string
  total: number
  supply: number
  kind: string
  orig: string | null
  cust: string | null
  ledger: string | null
  rule: string | null
}
interface Dep {
  id: string
  dt: string // ISO "YYYY-MM-DDTHH:MM:SS"
  date: string
  kind: string
  memo: string
  in: number
  cust: string | null
  alloc: [string, number][]
  rule: string | null
}
interface Item {
  key: string
  cust: string
  date: string
  amt: number
  amtYe?: number
  src: '전기이월' | '세금계산서' | '원장(증빙없음)'
  paid: number
  paidByYe: number
  deps: string[]
}

export function runTieout(input: TieoutInput, opt: TieoutOptions = defaultOptions(input.fiscalYear)): TieoutResult {
  const { fyStart, fyEnd, cutoffFrom, cutoffTo, feeTol, dateWindow, agingDays, trivial } = opt
  const custs = new Map(input.customers.map((c) => [c.code, c]))
  const biz2code = new Map(input.customers.map((c) => [c.bizno, c.code]))
  const custName = (code: string | null) => (code && custs.get(code)?.name) || ''
  const j = input.journal
  const subEndLabel = opt.subEnd

  // 원장 매출: 외상매출금 차변
  const sales: LedgerSale[] = []
  for (const r of j) {
    if (r.acct === '108' && r.dr) {
      sales.push({ id: `L${String(sales.length + 1).padStart(4, '0')}`, date: r.date, no: r.no, cust: r.cust, total: r.dr, memo: r.memo, inv: null, rule: null, supply: 0 })
    }
  }
  const supplyByKey = new Map<string, number[]>()
  for (const r of j) {
    if (r.acct === '404') {
      const k = `${r.date}|${r.no}`
      supplyByKey.set(k, [...(supplyByKey.get(k) ?? []), r.cr])
    }
  }
  for (const s of sales) s.supply = (supplyByKey.get(`${s.date}|${s.no}`) ?? [roundHalfEven(s.total / 1.1)])[0]
  const suspense = j.filter((r) => r.acct === '257' && r.cr)

  const inv: Inv[] = input.invoices.map((i) => ({
    appr: i.appr,
    wdate: i.wdate,
    bizno: i.bizno,
    name: i.name,
    total: i.total,
    supply: i.supply,
    kind: i.kind,
    orig: /당초승인번호 ([0-9a-f-]+)/.exec(i.note)?.[1] ?? null,
    cust: biz2code.get(i.bizno) ?? null,
    ledger: null,
    rule: null,
  }))
  const invBy = new Map(inv.map((i) => [i.appr, i]))

  const log: Record<string, number> = {}
  const bump = (k: string) => (log[k] = (log[k] ?? 0) + 1)

  // (1) 세금계산서 ↔ 원장: 같은 거래처·같은 금액, 일자가 가장 가까운 전표
  for (const i of [...inv].sort((a, b) => a.wdate.localeCompare(b.wdate))) {
    const cands = sales.filter((s) => s.inv === null && s.cust === i.cust && s.total === i.total && Math.abs(days(s.date, i.wdate)) <= dateWindow)
    if (!cands.length) continue
    const s = minBy(cands, (s) => Math.abs(days(s.date, i.wdate)))
    const diff = days(s.date, i.wdate)
    s.inv = i.appr
    i.ledger = s.id
    s.rule = i.rule = diff === 0 ? '일자·금액 일치' : `금액 일치·일자 ${diff > 0 ? '+' : ''}${diff}일`
    bump(diff === 0 ? '원장-세금계산서: 일자·금액 일치' : '원장-세금계산서: 금액 일치, 일자 차이')
  }

  const exceptions: TieoutException[] = []
  const X = (
    kind: string,
    assertion: string,
    risk: Risk,
    amount: number,
    detail: string,
    action: string,
    ref: { ledger?: string; appr?: string; cust?: string | null; deposit?: string } = {},
  ) =>
    exceptions.push({
      no: `EX-${String(exceptions.length + 1).padStart(2, '0')}`,
      kind,
      assertion,
      risk,
      amount,
      detail,
      action,
      ledger: ref.ledger ?? null,
      appr: ref.appr ?? null,
      cust: ref.cust ?? null,
      custName: custName(ref.cust ?? null),
      deposit: ref.deposit ?? null,
    })

  // (2) 남은 것끼리 금액 불일치 쌍 (같은 거래처, 일자 ±5일, 금액 ±20%)
  for (const i of inv) {
    if (i.ledger || i.total <= 0) continue
    const cands = sales.filter((s) => s.inv === null && s.cust === i.cust && Math.abs(days(s.date, i.wdate)) <= 5 && Math.abs(s.total - i.total) <= 0.2 * i.total)
    if (!cands.length) continue
    const s = minBy(cands, (s) => Math.abs(s.total - i.total))
    s.inv = i.appr
    i.ledger = s.id
    s.rule = i.rule = '금액 불일치'
    bump('원장-세금계산서: 금액 불일치(쌍)')
    if (year(s.date) === input.fiscalYear) {
      X('금액 불일치', '정확성', Math.abs(s.total - i.total) >= trivial ? '높음' : '중간', s.total - i.total,
        `원장 ${won(s.total)} vs 세금계산서 ${won(i.total)} (공급가액 ${won(s.supply)} vs ${won(i.supply)})`,
        '회사에 정정 근거 요청, 수정분개 필요 여부 판단', { ledger: s.id, appr: i.appr, cust: s.cust })
    }
  }

  // (3) 원장에만 있는 매출
  for (const s of sales) {
    if (s.inv || year(s.date) !== input.fiscalYear) continue
    const twin = sales.filter((t) => t !== s && t.inv && t.cust === s.cust && t.date === s.date && t.total === s.total)
    if (twin.length) {
      s.rule = '중복 의심'
      X('원장 중복 계상 의심', '실재성', '높음', s.total, `${s.date} 같은 거래처·같은 금액 전표가 2건, 세금계산서는 1건(${twin[0].inv})`,
        '중복 전표 여부 확인, 수정분개 필요 여부 판단', { ledger: s.id, appr: twin[0].inv!, cust: s.cust })
    } else s.rule = '세금계산서 없음'
  }

  // (4) 세금계산서에만 있는 것
  for (const i of inv) {
    if (i.ledger) continue
    if (i.total < 0) {
      i.rule = '수정세금계산서 원장 미반영'
      if (year(i.wdate) === input.fiscalYear) {
        X('수정세금계산서 원장 미반영', '정확성·실재성', '높음', i.total, `${i.wdate} ${i.kind} ${won(i.total)}원 (당초 ${i.orig}), 원장에 매출 차감 없음`,
          '반품·에누리 사실 확인, 매출·채권 차감 분개 필요 여부 판단', { appr: i.appr, cust: i.cust })
      }
    } else if (year(i.wdate) === input.fiscalYear) {
      i.rule = '원장 매출 없음'
      const near = i.wdate >= cutoffFrom
      X('세금계산서O·원장X' + (near ? ' (기말 근접)' : ''), '완전성' + (near ? '·기간귀속' : ''), '높음', -i.total,
        `${i.wdate} 발행 ${won(i.total)}원, ${input.fiscalYear}년·${input.fiscalYear + 1}년 원장 어디에도 매출 없음`,
        '매출 누락 여부 확인 (입금 처리 계정 확인)', { appr: i.appr, cust: i.cust })
    }
  }

  // (5) 기간귀속: 연도가 다른 원장·세금계산서 쌍
  const cutoffPairs: [LedgerSale, Inv][] = []
  for (const s of sales) {
    if (s.inv === null) continue
    const i = invBy.get(s.inv)!
    const inWindow = (cutoffFrom <= s.date && s.date <= cutoffTo) || (cutoffFrom <= i.wdate && i.wdate <= cutoffTo)
    if (inWindow) cutoffPairs.push([s, i])
    if (year(s.date) !== year(i.wdate)) {
      const over = year(s.date) === input.fiscalYear
      X('기간귀속 ' + (over ? '(당기 과대)' : '(당기 과소)'), '기간귀속', '높음', (over ? 1 : -1) * s.total, `원장 ${s.date} / 세금계산서 작성일 ${i.wdate}`,
        '출고증·인수증으로 실제 인도일 확인, 귀속연도 판단', { ledger: s.id, appr: i.appr, cust: s.cust })
    }
  }
  // (6) 기말 직전 매출의 후속기간 취소
  for (const i of inv) {
    if (i.total < 0 && i.wdate > fyEnd && i.orig) {
      const o = invBy.get(i.orig)
      if (o && o.wdate >= cutoffFrom && o.wdate <= fyEnd) {
        X('기말 직전 매출 후속 취소', '실재성·기간귀속', '높음', o.total, `${o.wdate} 매출 ${won(o.total)}원이 ${i.wdate} 수정세금계산서로 ${won(i.total)}원 취소`,
          '반품 사유·물류 기록 확인, 당기 매출 인식 적정성 판단', { appr: o.appr, cust: o.cust })
      }
    }
  }

  // (7) 은행 입금 → 거래처
  const byNorm = new Map<string, string>()
  for (const [code, c] of custs) byNorm.set(norm(c.name), code)
  const who = (memo: string) => {
    const n = norm(memo)
    if (!n) return null
    const hits = new Set<string>()
    for (const [nn, k] of byNorm) if (nn === n || (n.length >= 3 && (nn.startsWith(n) || n.startsWith(nn)))) hits.add(k)
    return hits.size === 1 ? [...hits][0] : null
  }

  const deps: Dep[] = []
  input.bank.forEach((b, idx) => {
    if (!b.in) return
    const dt = `${b.dt.slice(0, 4)}-${b.dt.slice(5, 7)}-${b.dt.slice(8, 10)}T${b.dt.slice(11)}`
    deps.push({ id: `B${String(idx + 1).padStart(4, '0')}`, dt, date: dt.slice(0, 10), kind: b.kind, memo: b.memo, in: b.in, cust: null, alloc: [], rule: null })
  })
  for (const d of deps) d.cust = d.kind !== '이자' ? who(d.memo) : null
  const byDt = (a: Dep, b: Dep) => a.dt.localeCompare(b.dt)

  // 받을 채권 항목: 전기이월 + 세금계산서(수정분은 당초에 합산) + 세금계산서 없는 원장 매출
  const items: Item[] = []
  for (const a of input.ar) if (a.opening) items.push({ key: `OPEN-${a.code}`, cust: a.code, date: addDays(fyStart, -1), amt: a.opening, src: '전기이월', paid: 0, paidByYe: 0, deps: [] })
  const net = new Map<string, number>()
  for (const i of inv) if (i.total > 0) net.set(i.appr, i.total)
  const netYe = new Map(net)
  for (const i of inv) {
    if (i.total < 0 && i.orig && net.has(i.orig)) {
      net.set(i.orig, net.get(i.orig)! + i.total)
      if (i.wdate <= fyEnd) netYe.set(i.orig, netYe.get(i.orig)! + i.total)
    }
  }
  for (const i of inv) {
    if (i.total > 0 && netYe.get(i.appr)! > 0) {
      items.push({ key: i.appr, cust: i.cust!, date: i.wdate, amt: net.get(i.appr)!, amtYe: netYe.get(i.appr)!, src: '세금계산서', paid: 0, paidByYe: 0, deps: [] })
    }
  }
  for (const s of sales) if (s.rule === '세금계산서 없음') items.push({ key: s.id, cust: s.cust, date: s.date, amt: s.total, src: '원장(증빙없음)', paid: 0, paidByYe: 0, deps: [] })
  const itemBy = new Map(items.map((it) => [it.key, it]))

  const assign = (d: Dep, its: Item[], rule: string, partial?: number) => {
    for (const it of its) {
      const take = partial !== undefined ? partial : it.amt - it.paid
      it.paid += take
      if (d.date <= fyEnd) it.paidByYe += take
      it.deps.push(d.id)
      d.alloc.push([it.key, take])
    }
    d.rule = rule
    bump('입금-채권: ' + rule)
  }

  const byC = new Map<string, Item[]>()
  for (const it of items) byC.set(it.cust, [...(byC.get(it.cust) ?? []), it])
  const rem = (it: Item) => it.amt - it.paid
  const openItems = (cust: string | null, d: Dep) =>
    (cust ? (byC.get(cust) ?? []) : items).filter((it) => rem(it) > 0 && it.date <= d.date).sort((a, b) => a.date.localeCompare(b.date))

  // 1단계: 입금 1건 ↔ 채권 1건 또는 여러 건
  for (const d of [...deps].sort(byDt)) {
    if (!d.cust) continue
    const a = d.in
    const open = openItems(d.cust, d)
    let hit = open.find((it) => rem(it) === a)
    if (hit) {
      assign(d, [hit], '단건 일치')
      continue
    }
    hit = open.find((it) => rem(it) - a > 0 && rem(it) - a <= feeTol)
    if (hit) {
      assign(d, [hit], '수수료 차감 입금')
      continue
    }
    let grp: Item[] | null = null
    outer: for (let k = 2; k < 7; k++) {
      for (let st = 0; st < Math.max(0, open.length - k + 1); st++) {
        const g = open.slice(st, st + k)
        const diff = sum(g.map(rem)) - a
        if (diff >= 0 && diff <= feeTol) {
          grp = g
          break outer
        }
      }
    }
    if (grp) {
      assign(d, grp, '합산 입금')
      continue
    }
    grp = firstCombo(open.slice(0, 12), [2, 3], (g) => {
      const diff = sum(g.map(rem)) - a
      return diff >= 0 && diff <= feeTol
    })
    if (grp) assign(d, grp, '합산 입금(비연속)')
  }

  // 2단계: 남은 입금 2~3건의 합 ↔ 채권 1건 (분할 입금)
  const splitPass = (keyOf: (d: Dep) => string | null, label: string) => {
    const left = new Map<string, Dep[]>()
    for (const d of deps) {
      if (!d.alloc.length && d.kind !== '이자') {
        const k = keyOf(d)
        if (k !== null) left.set(k, [...(left.get(k) ?? []), d])
      }
    }
    const hits: [Item, Dep[]][] = []
    for (const [key, ds] of left) {
      ds.sort(byDt)
      const pool = label === '분할 입금' ? (byC.get(key) ?? []) : items
      for (const it of pool.filter((it) => rem(it) > 0).sort((a, b) => a.date.localeCompare(b.date))) {
        const cand = ds.filter((d) => !d.alloc.length && it.date <= d.date && d.date <= addDays(it.date, 200))
        const g = firstCombo(cand.slice(0, 10), [2, 3], (g) => {
          const diff = rem(it) - sum(g.map((d) => d.in))
          return diff >= 0 && diff <= feeTol
        })
        if (g) {
          for (const d of g) assign(d, [it], label, d.in)
          hits.push([it, g])
        }
      }
    }
    return hits
  }
  splitPass((d) => d.cust, '분할 입금')

  // 3단계: 남은 거래처 입금은 오래된 채권부터 추정 배분
  for (const d of [...deps].sort(byDt)) {
    if (!d.cust || d.alloc.length) continue
    let a = d.in
    for (const it of openItems(d.cust, d)) {
      if (a <= 0) break
      const take = Math.min(a, rem(it))
      assign(d, [it], '추정 배분(오래된 채권부터)', take)
      a -= take
    }
    if (!d.alloc.length) {
      d.rule = '미배정(거래처 확인됨)'
      bump('입금-채권: 미배정')
    }
  }

  // 거래처를 못 찾은 입금 → 열린 채권과 금액이 같으면 제3자 입금 의심
  const depTxt = (d: Dep) => `${d.date} ${won(d.in)}`
  const third = (it: Item, ds: Dep[]) =>
    X('제3자 명의 입금', '실재성(거래 상대방)', '중간', sum(ds.map((d) => d.in)),
      `입금자 '${ds[0].memo}' ${ds.length}건 (${ds.map(depTxt).join(', ')}) → ${custName(it.cust)} 채권(${it.key})과 금액 일치`,
      '입금자와 매출처 관계 확인 (특수관계자 여부 포함)', { appr: it.key, cust: it.cust, deposit: ds.map((d) => d.id).join(', ') })

  for (const d of deps) {
    if (d.kind === '이자') {
      d.rule = '비매출(이자)'
      continue
    }
    if (d.cust || d.alloc.length) continue
    const hit = items.filter((it) => rem(it) === d.in && it.date <= d.date)
    if (hit.length === 1) {
      assign(d, hit, '제3자 입금 의심')
      third(hit[0], [d])
    }
  }
  for (const [it, g] of splitPass((d) => (d.cust || d.alloc.length ? null : d.memo), '제3자 입금 의심')) third(it, g)
  for (const d of deps) {
    if (!d.alloc.length && d.kind !== '이자' && !d.cust) {
      d.rule = '미확인 입금'
      bump('입금-채권: 미확인 입금')
    }
  }

  // 원장에만 있는 매출의 입금 여부
  for (const s of sales) {
    if (s.rule !== '세금계산서 없음') continue
    const it = itemBy.get(s.id)!
    if (it.paid) {
      X('원장O·세금계산서X·입금O', '발생(세무)', '중간', s.total, `${s.date} ${won(s.total)}원 매출·입금(${it.deps.join(', ')}) 있으나 세금계산서 없음`,
        '세금계산서 미발행 사유 확인, 부가세 신고 누락 여부 확인', { ledger: s.id, cust: s.cust })
    } else {
      X('원장O·세금계산서X·입금X', '실재성', '매우 높음', s.total, `${s.date} ${won(s.total)}원, 세금계산서·입금(${subEndLabel}까지) 모두 없음`,
        '계약서·출고증·거래처 실체 확인, 외부조회 우선 대상', { ledger: s.id, cust: s.cust })
    }
  }

  // 세금계산서O·원장X 건이 입금됐다면 어느 계정으로 처리됐는지 단서 추가
  for (const x of exceptions) {
    if (!x.kind.startsWith('세금계산서O·원장X')) continue
    const it = x.appr ? itemBy.get(x.appr) : undefined
    if (it && it.deps.length) {
      const d = deps.find((d) => d.id === it.deps[0])!
      const sus = suspense.filter((r) => r.date === d.date)
      x.detail += ` / 입금 ${d.date} ${won(d.in)}원` + (sus.length ? ' → 원장상 가수금(257) 처리' : '')
    }
  }

  // (8) 장기 미회수
  for (const it of items) {
    if (it.src === '세금계산서' && year(it.date) === input.fiscalYear && it.paid === 0 && days(fyEnd, it.date) > agingDays) {
      X('장기 미회수', '평가', '중간', it.amt, `작성일 ${it.date}, 기말까지 ${days(fyEnd, it.date)}일 경과, ${subEndLabel}까지 입금 없음`,
        '회수 가능성 검토, 대손충당금 적정성 판단', { appr: it.key, cust: it.cust })
    }
  }

  // (9) 거래처별 기말 채권: 장부 vs 증빙 기준
  const ledgerBal = new Map(input.ar.map((a) => [a.code, a.balance]))
  const codes = [...new Set([...ledgerBal.keys(), ...items.map((it) => it.cust)])].sort()
  const perCustomer = codes.map((code) => {
    let ev = 0
    for (const it of items) {
      if (it.cust !== code || it.date > fyEnd || it.src === '원장(증빙없음)') continue
      const left = (it.amtYe ?? it.amt) - it.paidByYe
      ev += it.paidByYe && left <= feeTol ? 0 : left
    }
    const lb = ledgerBal.get(code) ?? 0
    return { cust: code, name: custName(code), ledger: lb, evidence: ev, diff: lb - ev, reasons: exceptions.filter((x) => x.cust === code && x.kind !== '장기 미회수').map((x) => x.no) }
  })

  // (10) 부가세 대사 (분기) + 차이 원인 분해
  const fy = input.fiscalYear
  const htQ = [0, 1, 2, 3].map((k) => sum(inv.filter((i) => year(i.wdate) === fy && quarter(i.wdate) === k).map((i) => i.supply)))
  const glQ = [0, 1, 2, 3].map((k) => sum(sales.filter((s) => year(s.date) === fy && quarter(s.date) === k).map((s) => s.supply)))
  const salesBy = new Map(sales.map((s) => [s.id, s]))
  const vatItems: TieoutResult['vat']['items'] = []
  const explained = [0, 0, 0, 0]
  for (const x of exceptions) {
    if (['장기 미회수', '제3자 명의 입금', '기말 직전 매출 후속 취소'].includes(x.kind)) continue
    const s = x.ledger ? salesBy.get(x.ledger) : undefined
    const i = x.appr ? invBy.get(x.appr) : undefined
    const v = [0, 0, 0, 0]
    if (x.kind === '금액 불일치') v[quarter(s!.date)] = s!.supply - i!.supply
    else if (x.kind.startsWith('기간귀속')) {
      if (year(s!.date) === fy) v[quarter(s!.date)] = s!.supply
      else v[quarter(i!.wdate)] = -i!.supply
    } else if (x.kind.startsWith('원장O') || x.kind === '원장 중복 계상 의심') v[quarter(s!.date)] = s!.supply
    else if (x.kind.startsWith('세금계산서O') || x.kind === '수정세금계산서 원장 미반영') v[quarter(i!.wdate)] = -i!.supply
    v.forEach((n, k) => (explained[k] += n))
    vatItems.push({ no: x.no, label: `${x.kind} · ${x.custName}`, quarters: v, total: sum(v) })
  }
  const vatDiff = sum(glQ) - sum(input.vatReturn)

  // 요약·대사표
  const s25 = sales.filter((s) => year(s.date) === fy)
  const i25 = inv.filter((i) => year(i.wdate) === fy)
  const matched = s25.filter((s) => s.inv && s.rule !== '금액 불일치')
  const paidFull = (s: LedgerSale) => {
    const it = s.inv ? itemBy.get(s.inv) : undefined
    return !!it && it.paid >= it.amt - feeTol
  }
  const matchedPaid = matched.filter(paidFull)

  const rows: TieoutRow[] = s25.map((s) => {
    const i = s.inv ? invBy.get(s.inv) : undefined
    const it = items.find((it) => it.key === s.inv || it.key === s.id)
    const st: TieoutRow['payment'] = !it ? '' : it.paid >= it.amt - feeTol ? '입금완료' : it.paid ? '부분입금' : '미입금'
    return {
      ledgerId: s.id,
      date: s.date,
      no: s.no,
      custName: custName(s.cust),
      amount: s.total,
      appr: i?.appr ?? null,
      invDate: i?.wdate ?? null,
      invAmount: i?.total ?? null,
      deposits: it ? it.deps.join(', ') : '',
      payment: st,
      rule: s.rule ?? '',
      ok: !!i && s.rule !== '금액 불일치' && st === '입금완료',
    }
  })

  return {
    summary: {
      ledgerSales: s25.length,
      ledgerAmount: sum(s25.map((s) => s.total)),
      invoices: i25.length,
      invoiceAmount: sum(i25.map((i) => i.total)),
      deposits: deps.length,
      depositAmount: sum(deps.map((d) => d.in)),
      matched: matched.length,
      matchedAmount: sum(matched.map((s) => s.total)),
      matchedPaid: matchedPaid.length,
      matchedPaidAmount: sum(matchedPaid.map((s) => s.total)),
    },
    exceptions,
    rules: log,
    vat: { return: input.vatReturn, hometax: htQ, ledger: glQ, items: vatItems, unexplained: vatDiff - sum(explained) },
    perCustomer,
    cutoff: cutoffPairs
      .sort((a, b) => a[0].date.localeCompare(b[0].date))
      .map(([s, i]) => ({ date: s.date, no: s.no, memo: s.memo, custName: custName(s.cust), amount: s.total, appr: i.appr, invDate: i.wdate, ok: year(s.date) === year(i.wdate) })),
    rows,
    depositRows: deps.map((d) => ({ id: d.id, dt: d.dt.replace('T', ' ').slice(0, 16), memo: d.memo, amount: d.in, custName: custName(d.cust), alloc: d.alloc.map(([k]) => k).join(', '), rule: d.rule ?? '' })),
  }
}
