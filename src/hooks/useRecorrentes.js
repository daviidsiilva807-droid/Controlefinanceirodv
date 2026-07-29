import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'
import { inicioMesISO, mesDaChave } from '../lib/dates'

export function useRecorrentes() {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const [regras, setRegras] = useState([])
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('recurring_rules')
      .select(`
        *,
        categories ( id, name, icon, color ),
        accounts ( id, name, icon, color, type )
      `)
      .order('day_of_month')
    if (!error) setRegras(data ?? [])
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    buscar()
  }, [buscar])

  const salvar = useCallback(
    async (regra) => {
      const payload = {
        account_id: regra.account_id,
        category_id: regra.category_id,
        kind: regra.kind,
        amount_cents: regra.amount_cents,
        description: regra.description,
        day_of_month: regra.day_of_month,
        start_date: regra.start_date,
        end_date: regra.end_date || null,
        active: regra.active ?? true,
      }
      const query = regra.id
        ? supabase.from('recurring_rules').update(payload).eq('id', regra.id)
        : supabase.from('recurring_rules').insert(payload)
      const { error } = await query
      if (error) throw error
      await buscar()
    },
    [buscar]
  )

  const excluir = useCallback(
    async (id) => {
      const { error } = await supabase.from('recurring_rules').delete().eq('id', id)
      if (error) throw error
      await buscar()
    },
    [buscar]
  )

  return { regras, carregando, salvar, excluir, recarregar: buscar }
}

/**
 * Gera os lançamentos das contas recorrentes do mês visitado.
 *
 * Roda no client apenas como gatilho — a lógica e a garantia de não duplicar
 * estão na função materialize_recurring() do Postgres, que é idempotente.
 * Se fosse feito aqui, dois celulares abrindo o app ao mesmo tempo criariam
 * o aluguel duas vezes.
 */
export function useMaterializarRecorrentes(chave, aoCriar) {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const jaRodou = useRef(new Set())

  useEffect(() => {
    if (!userId || !chave) return
    const marca = `${userId}:${chave}`
    if (jaRodou.current.has(marca)) return
    jaRodou.current.add(marca)

    supabase
      .rpc('materialize_recurring', { p_month: inicioMesISO(mesDaChave(chave)) })
      .then(({ data }) => {
        if (data > 0) aoCriar?.(data)
      })
  }, [userId, chave, aoCriar])
}
