// poc(Python) 결과와 TS 엔진 결과가 같은지 대조한다. 실행: node scripts/check-tieout.ts
import { readFileSync } from 'node:fs'
import { runTieout, type TieoutInput } from '../src/domain/tieout/engine.ts'

const input = JSON.parse(readFileSync(new URL('../src/data/mock/tieout/input.json', import.meta.url), 'utf8')) as TieoutInput
const py = JSON.parse(readFileSync(new URL('../../poc/output/to-be/ktieout_result.json', import.meta.url), 'utf8'))
const t0 = performance.now()
const ts = runTieout(input)
const ms = Math.round(performance.now() - t0)

let fail = 0
const eq = (label: string, a: unknown, b: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (!ok) {
    fail++
    console.log('✗', label, '\n   ts:', JSON.stringify(a), '\n   py:', JSON.stringify(b))
  }
}
eq('예외 건수', ts.exceptions.length, py.exceptions.length)
ts.exceptions.forEach((x, k) => {
  const p = py.exceptions[k] ?? {}
  eq(`${x.no} kind`, x.kind, p.kind)
  eq(`${x.no} amount`, x.amount, p.amount)
  eq(`${x.no} detail`, x.detail, p.detail)
  eq(`${x.no} refs`, [x.ledger, x.appr, x.cust, x.deposit], [p.ledger, p.appr, p.cust, p.deposit])
})
const s = py.summary
eq('요약', [ts.summary.ledgerSales, ts.summary.ledgerAmount, ts.summary.invoices, ts.summary.deposits, ts.summary.matched, ts.summary.matchedAmount, ts.summary.matchedPaid, ts.summary.matchedPaidAmount],
  [s.ledger_sales, s.ledger_amount, s.invoices, s.deposits, s.matched, s.matched_amount, s.matched_paid, s.matched_paid_amount])
eq('규칙별 건수', Object.fromEntries(Object.entries(ts.rules).sort()), Object.fromEntries(Object.entries(s.rules).sort()))
eq('부가세 분기', [ts.vat.return, ts.vat.hometax, ts.vat.ledger], [py.vat.return, py.vat.hometax, py.vat.ledger])
eq('부가세 분해', ts.vat.items.map((i) => [i.no, i.total]), py.vat.items.map((i: { no: string; v: number }) => [i.no, i.v]))
eq('거래처별 채권', ts.perCustomer.map((p) => [p.cust, p.ledger, p.evidence, p.diff, p.reasons]), py.per_customer.map((p: any) => [p.cust, p.ledger, p.evidence, p.diff, p.reasons]))
console.log(fail ? `불일치 ${fail}건` : `poc와 완전히 일치 · 예외 ${ts.exceptions.length}건 · 미설명 부가세 차이 ${ts.vat.unexplained} · ${ms}ms`)
process.exit(fail ? 1 : 0)
