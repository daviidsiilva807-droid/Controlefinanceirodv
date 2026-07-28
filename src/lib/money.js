/**
 * Tudo aqui trabalha com CENTAVOS INTEIROS. Nenhuma função desta camada
 * devolve ou aceita reais em ponto flutuante — é isso que impede o clássico
 * 0.1 + 0.2 = 0.30000000000000004 de virar erro de centavo no relatório.
 */

const formatador = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorSemSimbolo = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 123456 → "R$ 1.234,56" */
export function formatBRL(cents) {
  return formatador.format((Number(cents) || 0) / 100)
}

/** 123456 → "1.234,56" (para inputs e tabelas onde o R$ já está no rótulo) */
export function formatValor(cents) {
  return formatadorSemSimbolo.format((Number(cents) || 0) / 100)
}

/**
 * Versão curta para eixos de gráfico, onde "R$ 1.234,56" não cabe.
 * 123456 → "R$ 1,2 mil"
 */
export function formatBRLCurto(cents) {
  const reais = (Number(cents) || 0) / 100
  const abs = Math.abs(reais)
  if (abs >= 1_000_000) return `R$ ${(reais / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (abs >= 1_000) return `R$ ${(reais / 1_000).toFixed(1).replace('.', ',')} mil`
  return `R$ ${Math.round(reais)}`
}

/**
 * Converte o que o usuário digitou em centavos.
 *
 * O input de valor funciona como caixa de supermercado: a pessoa só digita
 * dígitos e as duas últimas casas viram os centavos ("1234" → R$ 12,34).
 * Por isso jogamos fora tudo que não é dígito, em vez de tentar interpretar
 * vírgula e ponto — que em pt-BR e en-US significam coisas opostas.
 */
export function parseCentavos(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '')
  if (!digitos) return 0
  // Limite de segurança: ~R$ 92 quatrilhões, bem dentro do bigint do Postgres.
  return Number(digitos.slice(0, 15))
}

/** Máscara progressiva do input: "1234" → "12,34" */
export function mascaraValor(texto) {
  return formatValor(parseCentavos(texto))
}

/**
 * Divide um valor em N parcelas sem perder nem inventar centavos.
 * Ex.: 10000 em 3 → [3334, 3333, 3333]. A sobra vai na primeira parcela,
 * que é como as operadoras de cartão fazem.
 */
export function dividirParcelas(totalCents, parcelas) {
  const n = Math.max(1, Math.floor(parcelas))
  const base = Math.floor(totalCents / n)
  const sobra = totalCents - base * n
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + sobra : base))
}

/** Cor semântica do valor: entrada verde, saída vermelha, zero neutro. */
export function corDoValor(cents, kind) {
  if (kind === 'income') return 'text-emerald-600 dark:text-emerald-400'
  if (kind === 'expense') return 'text-rose-600 dark:text-rose-400'
  if (cents > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (cents < 0) return 'text-rose-600 dark:text-rose-400'
  return 'text-slate-500 dark:text-slate-400'
}

/** Valor com sinal explícito, para listas onde entrada e saída se misturam. */
export function formatComSinal(cents, kind) {
  const sinal = kind === 'income' ? '+' : kind === 'expense' ? '−' : ''
  return `${sinal}${formatBRL(Math.abs(cents))}`
}
