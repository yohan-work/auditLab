// 매입 대사: 엑셀 업로드 경로로 읽어 심어 둔 이상거래 6건을 모두 찾는지, 오탐이 없는지 확인한다.
// 실행: node scripts/check-purchase.ts
import { readFileSync, readdirSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { assemble, parseWorkbook, type Cell } from '../src/domain/tieout/parsers.ts'
import { runPurchaseTieout } from '../src/domain/tieout/purchase.ts'

const dir = new URL('../public/samples/', import.meta.url)
const parsed = readdirSync(dir)
  .filter((f) => f.endsWith('.xlsx'))
  .map((f) => {
    const wb = XLSX.read(readFileSync(new URL(f, dir)))
    return parseWorkbook(f, wb.SheetNames.map((n) => ({ name: n, rows: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }) })))
  })
const a = assemble(parsed)
const r = runPurchaseTieout({ fiscalYear: a.input!.fiscalYear, journal: a.journalAll, invoices: a.purchaseInvoices, bank: a.input!.bank })
const truth = JSON.parse(readFileSync(new URL('../src/data/mock/tieout/purchase_truth.json', import.meta.url), 'utf8'))
console.log('요약', r.summary)
for (const x of r.exceptions) console.log(' ', x.no, x.kind, x.custName, x.amount.toLocaleString(), '|', x.detail)
const map: Record<string, string> = {
  P1: '미기록 부채', P2: '기간귀속', P3: '금액 불일치', P4: '원장O·세금계산서X', P5: '매입 차감', P6: '중복 수취',
}
let miss = 0
for (const t of truth.anomalies) {
  const hit = r.exceptions.find((x) => x.kind.includes(map[t.id]))
  console.log(hit ? '✓' : '✗', t.id, t.type, '→', hit?.no ?? '못 찾음')
  if (!hit) miss++
}
const fp = r.exceptions.length - truth.anomalies.length
console.log('후속기간 지급', r.subsequent.length, '건', Object.entries(r.subsequent.reduce<Record<string, number>>((m, s) => ((m[s.verdict] = (m[s.verdict] ?? 0) + 1), m), {})))
console.log('공급자별 차이', r.perSupplier.map((p) => [p.name, p.diff, p.reasons.join('/')]))
console.log('매입 공급가액 미설명 차이', r.vat.unexplained)
console.log(miss || fp ? `놓침 ${miss} · 오탐 ${fp}` : `심어 둔 ${truth.anomalies.length}건 모두 발견 · 오탐 0`)
process.exit(miss || fp ? 1 : 0)
