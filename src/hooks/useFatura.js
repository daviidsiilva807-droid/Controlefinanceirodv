import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { assinarTabela } from '../lib/realtime'
import { useAuth } from '../store/authStore'
import { useDados } from '../store/dataStore'
import { addMonths, inicioMesISO, mesDaChave } from '../lib/dates'

/**
 * Fatura do cartão é uma visão diferente do mês.
 *
 * A lista de lançamentos agrupa por DATA DA COMPRA ("quanto gastei em
 * julho"). A fatura agrupa por INVOICE_MONTH ("o que vou pagar na fatura de
 * julho") — e os dois conjuntos não coincidem: com fechamento no dia 25, uma
 * compra de 28/junho é gasto de junho mas cai na fatura de julho. Por isso a
 * consulta é separada, e não um filtro sobre a outra.
 */
export function useFatura(chave) {
  const userId = useAuth((s) => s.sessao?.user?.id)
  // O seletor devolve o array cru e o filtro acontece no useMemo. Filtrar
  // dentro do seletor criaria um array novo a cada render, e o React trata
  // isso como "o estado mudou de novo" — o resultado é um loop de renders.
  const contas = useDados((s) => s.contas)
  const cartoes = useMemo(
    () => contas.filter((c) => c.type === 'cartao' && !c.archived),
    [contas]
  )
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!userId || !chave) return
    setCarregando(true)

    const mes = mesDaChave(chave)
    const esteMes = inicioMesISO(mes)
    const proximoMes = inicioMesISO(addMonths(mes, 1))

    // Busca a fatura do mês E a do mês seguinte na mesma consulta. A segunda
    // existe por um motivo de usabilidade concreto: com fechamento no dia 25,
    // uma compra feita no dia 26 não aparece em lugar nenhum da tela do mês
    // atual — e a pessoa conclui, com razão, que o app não registrou. Saber o
    // total da próxima fatura permite avisar em vez de deixar no vácuo.
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id, amount_cents, description, date, paid, account_id, category_id, invoice_month,
        installment_no, installment_total,
        categories ( id, name, icon, color )
      `)
      .in('invoice_month', [esteMes, proximoMes])
      .order('date', { ascending: false })

    if (!error) setItens((data ?? []).map((i) => ({ ...i, _proxima: i.invoice_month === proximoMes })))
    setCarregando(false)
  }, [userId, chave])

  useEffect(() => {
    buscar()
  }, [buscar])

  useEffect(
    () => assinarTabela({ tabela: 'transactions', coluna: 'user_id', valor: userId, aoMudar: buscar }),
    [userId, buscar]
  )

  /** Uma entrada por cartão, mesmo que a fatura esteja zerada no mês. */
  const faturas = useMemo(() => {
    return cartoes.map((cartao) => {
      const doCartao = itens.filter((i) => i.account_id === cartao.id)
      const lancamentos = doCartao.filter((i) => !i._proxima)
      const proximos = doCartao.filter((i) => i._proxima)
      const total = lancamentos.reduce((acc, i) => acc + i.amount_cents, 0)

      return {
        cartao,
        lancamentos,
        total,
        // O que já caiu na fatura seguinte por causa do fechamento.
        totalProxima: proximos.reduce((acc, i) => acc + i.amount_cents, 0),
        qtdProxima: proximos.length,
        // Quanto do limite já está comprometido por esta fatura.
        percentualDoLimite: cartao.credit_limit_cents
          ? (total / cartao.credit_limit_cents) * 100
          : null,
      }
    })
  }, [cartoes, itens])

  const totalGeral = faturas.reduce((acc, f) => acc + f.total, 0)

  return { faturas, totalGeral, carregando, recarregar: buscar }
}

/**
 * Parcelas ainda não pagas de meses futuros — o "já comprometido" que o saldo
 * de hoje não mostra e que costuma ser a origem do susto no fim do mês.
 */
export function useParcelasFuturas() {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const [parcelas, setParcelas] = useState([])

  useEffect(() => {
    if (!userId) return
    let ativo = true

    supabase
      .from('transactions')
      .select(`
        id, amount_cents, description, date, account_id,
        installment_no, installment_total,
        accounts!transactions_account_id_fkey ( id, name, icon, color )
      `)
      .not('installment_group_id', 'is', null)
      .eq('paid', false)
      .gt('date', new Date().toISOString().slice(0, 10))
      .order('date')
      .then(({ data }) => {
        if (ativo) setParcelas(data ?? [])
      })

    return () => {
      ativo = false
    }
  }, [userId])

  const total = parcelas.reduce((acc, p) => acc + p.amount_cents, 0)
  return { parcelas, total }
}
