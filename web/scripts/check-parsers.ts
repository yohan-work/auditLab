// public/samples의 엑셀을 실제 업로드와 같은 경로(SheetJS → 파서 → 조립)로 읽어
// ① 변환 JSON(input.json)과 같은지 ② 엔진 결과가 같은지 대조한다. 실행: node scripts/check-parsers.ts
import { readFileSync, readdirSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { assemble, parseWorkbook, kindLabel, type Cell } from '../src/domain/tieout/parsers.ts'
import { runTieout, type TieoutInput } from '../src/domain/tieout/engine.ts'

const dir = new URL('../public/samples/', import.meta.url)
const parsed = readdirSync(dir)
  .filter((f) => f.endsWith('.xlsx'))
  .map((f) => {
    const wb = XLSX.read(readFileSync(new URL(f, dir)))
    const sheets = wb.SheetNames.map((n) => ({ name: n, rows: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[n], { header: 1, raw: true, defval: null }) }))
    return parseWorkbook(f, sheets)
  })
for (const p of parsed) console.log(`${p.kind === 'unknown' ? '·' : '✓'} ${p.fileName} → ${kindLabel[p.kind]} ${p.count}행 ${p.warnings.join(' ')}`)
const { input, missing } = assemble(parsed)
if (!input) {
  console.log('누락:', missing)
  process.exit(1)
}
const ref = JSON.parse(readFileSync(new URL('../src/data/mock/tieout/input.json', import.meta.url), 'utf8')) as TieoutInput
let fail = 0
for (const k of ['customers', 'journal', 'invoices', 'bank', 'ar', 'vatReturn', 'fiscalYear'] as const) {
  const a = JSON.stringify(input[k])
  const b = JSON.stringify(ref[k])
  if (a !== b) {
    fail++
    console.log('✗', k, a.slice(0, 300), '\n  vs', b.slice(0, 300))
  }
}
const r1 = runTieout(input)
const r2 = runTieout(ref)
if (JSON.stringify(r1.exceptions) !== JSON.stringify(r2.exceptions)) {
  fail++
  console.log('✗ 엔진 결과 다름')
}
console.log(fail ? `불일치 ${fail}건` : `엑셀 업로드 경로 = 변환 JSON · 예외 ${r1.exceptions.length}건 동일`)
process.exit(fail ? 1 : 0)
