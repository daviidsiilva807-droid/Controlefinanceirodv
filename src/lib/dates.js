import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Converte 'YYYY-MM-DD' (o tipo `date` do Postgres) em Date LOCAL.
 *
 * Não use `new Date('2026-07-28')`: o JavaScript interpreta isso como
 * meia-noite UTC, que no Brasil (UTC-3) é 21h do dia 27 — e o lançamento
 * aparece um dia antes na tela. Este bug é silencioso e só se manifesta
 * perto da virada do mês, que é justamente quando o número importa.
 */
export function parseData(iso) {
  if (!iso) return null
  if (iso instanceof Date) return iso
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/** Date → 'YYYY-MM-DD', também sem passar por UTC. */
export function toISODate(data) {
  const d = data instanceof Date ? data : parseData(data)
  return format(d, 'yyyy-MM-dd')
}

export const hojeISO = () => toISODate(new Date())

/** Primeiro dia do mês, no formato que o banco espera. */
export function inicioMesISO(data) {
  return toISODate(startOfMonth(data instanceof Date ? data : parseData(data)))
}

export function fimMesISO(data) {
  return toISODate(endOfMonth(data instanceof Date ? data : parseData(data)))
}

/** Chave estável de mês para estado e agrupamentos: '2026-07'. */
export function chaveMes(data) {
  return format(data instanceof Date ? data : parseData(data), 'yyyy-MM')
}

export function mesDaChave(chave) {
  return parse(chave, 'yyyy-MM', new Date())
}

/** 'julho de 2026' */
export function rotuloMes(data) {
  const d = data instanceof Date ? data : parseData(data)
  const texto = format(d, "MMMM 'de' yyyy", { locale: ptBR })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** 'jul/26' — para eixos de gráfico */
export function rotuloMesCurto(data) {
  return format(data instanceof Date ? data : parseData(data), 'MMM/yy', { locale: ptBR })
}

/**
 * Cabeçalho dos grupos na lista de lançamentos. 'Hoje' e 'Ontem' são muito
 * mais rápidos de ler do que a data por extenso.
 */
export function rotuloDia(iso) {
  const d = parseData(iso)
  const dias = differenceInCalendarDays(d, new Date())
  if (dias === 0) return 'Hoje'
  if (dias === -1) return 'Ontem'
  if (dias === 1) return 'Amanhã'
  const texto = format(d, "EEE, d 'de' MMM", { locale: ptBR })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function rotuloDataCompleta(iso) {
  return format(parseData(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

/**
 * Rótulo para um `timestamptz` (created_at de mensagem, por exemplo).
 *
 * Aqui `new Date(iso)` é o certo, ao contrário do que acontece com colunas
 * `date`: um timestamptz é um INSTANTE, e o JavaScript já o converte para o
 * fuso local corretamente. Cortar a string com `.slice(0, 10)` seria o erro —
 * ela vem em UTC, então uma mensagem enviada às 21h no Brasil apareceria como
 * "Amanhã".
 */
export function rotuloMomento(iso) {
  const d = new Date(iso)
  const dias = differenceInCalendarDays(d, new Date())
  const hora = format(d, 'HH:mm')
  if (dias === 0) return `Hoje, ${hora}`
  if (dias === -1) return `Ontem, ${hora}`
  const texto = format(d, "d 'de' MMM, HH:mm", { locale: ptBR })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Lista dos últimos N meses (mais antigo primeiro), para os relatórios. */
export function ultimosMeses(quantidade, referencia = new Date()) {
  return Array.from({ length: quantidade }, (_, i) =>
    startOfMonth(subMonths(referencia, quantidade - 1 - i))
  )
}

/**
 * Dias até o fechamento/vencimento do cartão, considerando que o dia já pode
 * ter passado neste mês (aí conta para o mês que vem).
 */
export function diasAte(diaDoMes, referencia = new Date()) {
  const esteMes = new Date(referencia.getFullYear(), referencia.getMonth(), diaDoMes)
  const alvo = esteMes >= new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate())
    ? esteMes
    : new Date(referencia.getFullYear(), referencia.getMonth() + 1, diaDoMes)
  return differenceInCalendarDays(alvo, referencia)
}

export { addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, format }
