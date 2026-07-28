import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'
import { inicioMesISO, mesDaChave, subMonths } from '../lib/dates'

/** Orçamentos (limites por categoria) de um mês. */
export function useOrcamentos(chave) {
  const casaId = useAuth((s) => s.casa?.id)
  const [orcamentos, setOrcamentos] = useState([])
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!casaId || !chave) return
    setCarregando(true)
    const { data, error } = await supabase
      .from('budgets')
      .select('id, category_id, month, limit_cents, categories ( id, name, icon, color )')
      .eq('month', inicioMesISO(mesDaChave(chave)))

    if (!error) setOrcamentos(data ?? [])
    setCarregando(false)
  }, [casaId, chave])

  useEffect(() => {
    buscar()
  }, [buscar])

  /**
   * Define ou remove o limite de uma categoria no mês. Limite zero significa
   * "não quero orçamento aqui", então apagamos a linha em vez de gravar 0 —
   * a restrição do banco exige limit_cents > 0.
   */
  const salvar = useCallback(
    async (categoriaId, limiteCents) => {
      const mes = inicioMesISO(mesDaChave(chave))

      if (!limiteCents) {
        const { error } = await supabase
          .from('budgets')
          .delete()
          .eq('category_id', categoriaId)
          .eq('month', mes)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('budgets')
          .upsert(
            { category_id: categoriaId, month: mes, limit_cents: limiteCents },
            { onConflict: 'household_id,category_id,month' }
          )
        if (error) throw error
      }
      await buscar()
    },
    [chave, buscar]
  )

  /**
   * Copia os limites do mês anterior. Orçamento raramente muda de um mês para
   * o outro; sem isso a pessoa redigita tudo todo dia 1º e desiste no segundo
   * mês.
   */
  const copiarDoMesAnterior = useCallback(async () => {
    const mesAtual = mesDaChave(chave)
    const anterior = inicioMesISO(subMonths(mesAtual, 1))

    const { data, error } = await supabase
      .from('budgets')
      .select('category_id, limit_cents')
      .eq('month', anterior)
    if (error) throw error
    if (!data?.length) return 0

    const mes = inicioMesISO(mesAtual)
    const { error: erroInsert } = await supabase.from('budgets').upsert(
      data.map((o) => ({ category_id: o.category_id, month: mes, limit_cents: o.limit_cents })),
      { onConflict: 'household_id,category_id,month' }
    )
    if (erroInsert) throw erroInsert

    await buscar()
    return data.length
  }, [chave, buscar])

  return { orcamentos, carregando, salvar, copiarDoMesAnterior, recarregar: buscar }
}
