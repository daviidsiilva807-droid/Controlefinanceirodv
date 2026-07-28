/**
 * Verificação das funções puras do app: dinheiro, datas e agregações.
 *
 * São justamente as que erram em silêncio — um centavo perdido no
 * parcelamento ou uma data que anda um dia para trás não quebram a tela,
 * só deixam o relatório errado. Rode com:  node scripts/verificar.mjs
 */
import assert from 'node:assert/strict'
import { formatBRL, parseCentavos, dividirParcelas, formatComSinal } from '../src/lib/money.js'
import { parseData, toISODate, chaveMes, rotuloMes, diasAte } from '../src/lib/dates.js'
import {
  resumirMes,
  totaisPorCategoria,
  calcularOrcamentos,
  projetarGasto,
} from '../src/lib/resumo.js'

let passou = 0
const teste = (nome, fn) => {
  try {
    fn()
    passou++
    console.log(`  ok    ${nome}`)
  } catch (e) {
    console.log(`  FALHA ${nome}\n        ${e.message}`)
    process.exitCode = 1
  }
}

console.log('\nDinheiro')
teste('0,10 + 0,20 dá exatamente 0,30 (o bug do float)', () => {
  const soma = parseCentavos('10') + parseCentavos('20')
  assert.equal(soma, 30)
  assert.equal(formatBRL(soma).replace(/ /g, ' '), 'R$ 0,30')
})
teste('input funciona como caixa de supermercado', () => {
  assert.equal(parseCentavos('1'), 1)
  assert.equal(parseCentavos('1234'), 1234)
  assert.equal(parseCentavos('12,34'), 1234)
  assert.equal(parseCentavos('R$ 1.234,56'), 123456)
  assert.equal(parseCentavos(''), 0)
})
teste('R$ 100,00 em 3x soma exatamente R$ 100,00', () => {
  const p = dividirParcelas(10000, 3)
  assert.deepEqual(p, [3334, 3333, 3333])
  assert.equal(p.reduce((a, b) => a + b, 0), 10000)
})
teste('R$ 899,90 em 3x não perde centavo', () => {
  assert.equal(dividirParcelas(89990, 3).reduce((a, b) => a + b, 0), 89990)
})
teste('sinal explícito em entrada e saída', () => {
  assert.ok(formatComSinal(1000, 'income').startsWith('+'))
  assert.ok(formatComSinal(1000, 'expense').startsWith('−'))
})

console.log('\nDatas')
teste('data do banco não anda um dia para trás (fuso UTC)', () => {
  const d = parseData('2026-07-01')
  assert.equal(d.getDate(), 1)
  assert.equal(d.getMonth(), 6)
  assert.equal(toISODate(d), '2026-07-01')
})
teste('chave e rótulo de mês', () => {
  assert.equal(chaveMes(parseData('2026-07-28')), '2026-07')
  assert.equal(rotuloMes(parseData('2026-07-28')), 'Julho de 2026')
})
teste('dias até o vencimento viram o mês seguinte quando o dia já passou', () => {
  const ref = new Date(2026, 6, 20)
  assert.equal(diasAte(25, ref), 5)
  assert.equal(diasAte(5, ref), 16)
})

console.log('\nResumo do mês')
const tx = (over) => ({
  kind: 'expense',
  amount_cents: 1000,
  paid: true,
  category_id: 'c1',
  categories: { name: 'Mercado', icon: '🛒', color: '#eb6834' },
  ...over,
})

teste('transferência não conta como receita nem despesa', () => {
  const r = resumirMes([
    tx({ kind: 'income', amount_cents: 500000 }),
    tx({ amount_cents: 120000 }),
    tx({ kind: 'transfer', amount_cents: 999999 }),
  ])
  assert.equal(r.receitas, 500000)
  assert.equal(r.despesas, 120000)
  assert.equal(r.saldo, 380000)
})
teste('previsto fica separado do pago', () => {
  const r = resumirMes([tx({ amount_cents: 10000 }), tx({ amount_cents: 5000, paid: false })])
  assert.equal(r.despesas, 10000)
  assert.equal(r.despesasPrevistas, 5000)
  assert.equal(r.saldoProjetado, -15000)
})
teste('totais por categoria somam e percentuam', () => {
  const lista = totaisPorCategoria([
    tx({ amount_cents: 7500 }),
    tx({ amount_cents: 2500 }),
    tx({
      category_id: 'c2',
      amount_cents: 10000,
      categories: { name: 'Lazer', icon: '🎉', color: '#4a3aa7' },
    }),
  ])
  assert.equal(lista.length, 2)
  assert.equal(lista[0].total, 10000)
  assert.equal(lista[0].percentual, 50)
})

console.log('\nOrçamentos')
teste('níveis de alerta viram em 80% e em 100%', () => {
  const orcamentos = ['c1', 'c2', 'c3'].map((c) => ({ id: c, category_id: c, limit_cents: 50000 }))
  const gastos = [
    tx({ category_id: 'c1', amount_cents: 20000 }),
    tx({ category_id: 'c2', amount_cents: 45000 }),
    tx({ category_id: 'c3', amount_cents: 60000 }),
  ]
  const por = Object.fromEntries(
    calcularOrcamentos(orcamentos, gastos).map((o) => [o.category_id, o])
  )
  assert.equal(por.c1.nivel, 'ok')
  assert.equal(por.c2.nivel, 'atencao')
  assert.equal(por.c3.nivel, 'estourado')
  assert.equal(por.c3.restante, -10000)
})
teste('projeção usa o ritmo do mês e se cala quando é cedo demais', () => {
  assert.equal(projetarGasto(10000, new Date(2026, 6, 10)), 31000)
  assert.equal(projetarGasto(10000, new Date(2026, 6, 1)), null)
})

console.log(`\n${passou} verificações passaram.\n`)
