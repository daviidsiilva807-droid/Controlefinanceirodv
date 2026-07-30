/**
 * Derivações puras sobre a lista de lançamentos do mês. Ficam fora dos hooks
 * de propósito: são funções sem estado, fáceis de conferir de cabeça e
 * reutilizadas por dashboard, relatórios e orçamentos.
 *
 * Transferências nunca entram em receita nem despesa — mover dinheiro entre
 * as suas próprias contas não é ganhar nem gastar. Contá-las é o erro mais
 * comum em app de finanças caseiro e infla os dois lados do relatório.
 */

export function resumirMes(transacoes) {
  let receitas = 0
  let despesas = 0
  let receitasPrevistas = 0
  let despesasPrevistas = 0

  for (const t of transacoes) {
    if (t.kind === 'transfer') continue
    if (t.kind === 'income') {
      if (t.paid) receitas += t.amount_cents
      else receitasPrevistas += t.amount_cents
    } else {
      if (t.paid) despesas += t.amount_cents
      else despesasPrevistas += t.amount_cents
    }
  }

  return {
    receitas,
    despesas,
    saldo: receitas - despesas,
    receitasPrevistas,
    despesasPrevistas,
    // O que sobra se tudo que está previsto for pago/recebido.
    saldoProjetado: receitas + receitasPrevistas - despesas - despesasPrevistas,
    aPagar: despesasPrevistas,
  }
}

/** Total por categoria, do maior para o menor. Inclui previsto e pago. */
export function totaisPorCategoria(transacoes, kind = 'expense') {
  const mapa = new Map()

  for (const t of transacoes) {
    if (t.kind !== kind || !t.categories) continue
    const atual = mapa.get(t.category_id)
    if (atual) atual.total += t.amount_cents
    else
      mapa.set(t.category_id, {
        id: t.category_id,
        nome: t.categories.name,
        icone: t.categories.icon,
        cor: t.categories.color,
        total: t.amount_cents,
      })
  }

  const lista = [...mapa.values()].sort((a, b) => b.total - a.total)
  const soma = lista.reduce((acc, c) => acc + c.total, 0)
  return lista.map((c) => ({ ...c, percentual: soma ? (c.total / soma) * 100 : 0 }))
}

/** Agrupa por dia para a lista de lançamentos, mantendo a ordem decrescente. */
export function agruparPorDia(transacoes) {
  const grupos = new Map()

  for (const t of transacoes) {
    if (!grupos.has(t.date)) grupos.set(t.date, { data: t.date, itens: [], total: 0 })
    const grupo = grupos.get(t.date)
    grupo.itens.push(t)
    if (t.kind === 'income') grupo.total += t.amount_cents
    else if (t.kind === 'expense') grupo.total -= t.amount_cents
  }

  return [...grupos.values()].sort((a, b) => (a.data < b.data ? 1 : -1))
}

/** Filtro da tela de lançamentos, aplicado sobre os dados já carregados. */
export function filtrarTransacoes(transacoes, { busca, contaId, categoriaId, tipo, situacao }) {
  const termo = busca?.trim().toLowerCase()

  return transacoes.filter((t) => {
    if (tipo && tipo !== 'todos' && t.kind !== tipo) return false
    if (contaId && t.account_id !== contaId && t.transfer_account_id !== contaId) return false
    if (categoriaId && t.category_id !== categoriaId) return false
    if (situacao === 'pagos' && !t.paid) return false
    if (situacao === 'previstos' && t.paid) return false
    if (termo) {
      // A observação entra na busca: quem anotou o número da nota fiscal
      // espera encontrar o lançamento procurando por ele.
      const alvo = `${t.description} ${t.notes ?? ''} ${t.categories?.name ?? ''} ${
        t.accounts?.name ?? ''
      }`.toLowerCase()
      if (!alvo.includes(termo)) return false
    }
    return true
  })
}

/**
 * Cruza os orçamentos do mês com o que já foi gasto em cada categoria.
 * `nivel` é o que a UI usa para escolher a cor da barra.
 */
export function calcularOrcamentos(orcamentos, transacoes) {
  const gastoPorCategoria = new Map()
  for (const t of transacoes) {
    if (t.kind !== 'expense') continue
    gastoPorCategoria.set(t.category_id, (gastoPorCategoria.get(t.category_id) ?? 0) + t.amount_cents)
  }

  return orcamentos
    .map((o) => {
      const gasto = gastoPorCategoria.get(o.category_id) ?? 0
      const percentual = o.limit_cents ? (gasto / o.limit_cents) * 100 : 0
      return {
        ...o,
        gasto,
        restante: o.limit_cents - gasto,
        percentual,
        nivel: percentual >= 100 ? 'estourado' : percentual >= 80 ? 'atencao' : 'ok',
      }
    })
    .sort((a, b) => b.percentual - a.percentual)
}

/**
 * Projeção simples de fechamento: se você manteve o ritmo até aqui, quanto
 * gasta até o fim do mês? Só faz sentido no mês corrente — em mês passado o
 * número real já é definitivo, e em mês futuro não há ritmo nenhum.
 */
export function projetarGasto(gastoAtual, hoje = new Date()) {
  const diaAtual = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  if (diaAtual < 3) return null // amostra pequena demais para projetar
  return Math.round((gastoAtual / diaAtual) * diasNoMes)
}
