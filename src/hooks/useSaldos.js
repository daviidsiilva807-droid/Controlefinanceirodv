import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'

/**
 * Saldo atual de cada conta, vindo da RPC account_balances().
 *
 * O cálculo mora no banco porque depende de TODOS os lançamentos da conta,
 * desde sempre — trazer isso para o client significaria baixar o histórico
 * inteiro só para mostrar um número no topo da tela.
 */
export function useSaldos() {
  const casaId = useAuth((s) => s.casa?.id)
  const [saldos, setSaldos] = useState({})
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!casaId) return
    const { data, error } = await supabase.rpc('account_balances')
    if (!error) {
      setSaldos(Object.fromEntries((data ?? []).map((l) => [l.account_id, Number(l.balance_cents)])))
    }
    setCarregando(false)
  }, [casaId])

  useEffect(() => {
    buscar()
  }, [buscar])

  // Saldo muda a cada lançamento — inclusive os da outra pessoa.
  useEffect(() => {
    if (!casaId) return
    const canal = supabase
      .channel(`saldos:${casaId}`)
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

  const total = Object.values(saldos).reduce((acc, v) => acc + v, 0)
  return { saldos, total, carregando, recarregar: buscar }
}
