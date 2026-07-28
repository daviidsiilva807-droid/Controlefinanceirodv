import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'
import { dividirParcelas } from '../lib/money'
import { addMonths, fimMesISO, inicioMesISO, mesDaChave, toISODate } from '../lib/dates'

const SELECT = `
  id, kind, amount_cents, description, date, paid, invoice_month,
  account_id, category_id, transfer_account_id,
  installment_group_id, installment_no, installment_total, recurring_rule_id,
  created_by, created_at,
  categories ( id, name, icon, color, kind ),
  accounts!transactions_account_id_fkey ( id, name, icon, color, type )
`

/**
 * Lançamentos de um mês (pela DATA do lançamento — a fatura do cartão é outra
 * visão, veja useFatura).
 *
 * Assina realtime porque duas pessoas usam o mesmo app: quando um lança o
 * mercado, o outro vê aparecer sem precisar puxar a tela.
 */
export function useTransacoes(chave) {
  const casaId = useAuth((s) => s.casa?.id)
  const [transacoes, setTransacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const requisicaoAtual = useRef(0)

  const buscar = useCallback(async () => {
    if (!casaId || !chave) return
    const id = ++requisicaoAtual.current
    setCarregando(true)

    const mes = mesDaChave(chave)
    const { data, error } = await supabase
      .from('transactions')
      .select(SELECT)
      .gte('date', inicioMesISO(mes))
      .lte('date', fimMesISO(mes))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    // Trocar de mês rápido dispara várias buscas; só a última pode escrever
    // no estado, senão a tela pisca com dados do mês errado.
    if (id !== requisicaoAtual.current) return

    if (error) setErro(error)
    else {
      setTransacoes(data ?? [])
      setErro(null)
    }
    setCarregando(false)
  }, [casaId, chave])

  useEffect(() => {
    buscar()
  }, [buscar])

  useEffect(() => {
    if (!casaId) return
    const canal = supabase
      .channel(`transacoes:${casaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${casaId}` },
        () => buscar()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [casaId, buscar])

  return { transacoes, carregando, erro, recarregar: buscar }
}

// ---------------------------------------------------------------- escrita
//
// As funções abaixo ficam fora do hook porque também são chamadas de telas
// que não estão listando o mês (formulário em sheet, tela de cartões).

/**
 * Cria um lançamento. Se `parcelas > 1`, gera uma linha por parcela: cada mês
 * enxerga o valor daquele mês, e o relatório de meses futuros já sabe o que
 * está comprometido.
 */
export async function criarLancamento(dados) {
  const {
    kind,
    amount_cents,
    description,
    date,
    account_id,
    category_id,
    transfer_account_id = null,
    paid = true,
    parcelas = 1,
  } = dados

  if (kind !== 'transfer' && parcelas > 1) {
    const grupo = crypto.randomUUID()
    const valores = dividirParcelas(amount_cents, parcelas)
    const primeiraData = new Date(date.slice(0, 4), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))

    const linhas = valores.map((valor, i) => ({
      kind,
      amount_cents: valor,
      description,
      date: toISODate(addMonths(primeiraData, i)),
      account_id,
      category_id,
      // Só a primeira parcela nasce quitada; as futuras entram como previstas.
      paid: i === 0 ? paid : false,
      installment_group_id: grupo,
      installment_no: i + 1,
      installment_total: parcelas,
    }))

    const { error } = await supabase.from('transactions').insert(linhas)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('transactions').insert({
    kind,
    amount_cents,
    description,
    date,
    account_id,
    category_id: kind === 'transfer' ? null : category_id,
    transfer_account_id: kind === 'transfer' ? transfer_account_id : null,
    paid,
  })
  if (error) throw error
}

export async function atualizarLancamento(id, dados) {
  const { error } = await supabase
    .from('transactions')
    .update({
      kind: dados.kind,
      amount_cents: dados.amount_cents,
      description: dados.description,
      date: dados.date,
      account_id: dados.account_id,
      category_id: dados.kind === 'transfer' ? null : dados.category_id,
      transfer_account_id: dados.kind === 'transfer' ? dados.transfer_account_id : null,
      paid: dados.paid,
    })
    .eq('id', id)
  if (error) throw error
}

/**
 * Exclui um lançamento. Em compra parcelada, `todasAsParcelas` apaga o grupo
 * inteiro — apagar só a 4ª de 10 quase nunca é o que a pessoa quis.
 */
export async function excluirLancamento(transacao, { todasAsParcelas = false } = {}) {
  const query = supabase.from('transactions').delete()
  const { error } =
    todasAsParcelas && transacao.installment_group_id
      ? await query.eq('installment_group_id', transacao.installment_group_id)
      : await query.eq('id', transacao.id)
  if (error) throw error
}

/** Marca uma conta prevista como paga (ou desfaz). */
export async function alternarPago(transacao) {
  const { error } = await supabase
    .from('transactions')
    .update({ paid: !transacao.paid })
    .eq('id', transacao.id)
  if (error) throw error
}
