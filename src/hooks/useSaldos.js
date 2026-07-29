import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { assinarTabela } from '../lib/realtime'
import { useAuth } from '../store/authStore'

/**
 * Saldo atual de cada conta, vindo da RPC account_balances().
 *
 * O cálculo mora no banco porque depende de TODOS os lançamentos da conta,
 * desde sempre — trazer isso para o client significaria baixar o histórico
 * inteiro só para mostrar um número no topo da tela.
 */
export function useSaldos() {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const [saldos, setSaldos] = useState({})
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase.rpc('account_balances')
    if (!error) {
      setSaldos(Object.fromEntries((data ?? []).map((l) => [l.account_id, Number(l.balance_cents)])))
    }
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    buscar()
  }, [buscar])

  // Saldo muda a cada lançamento, inclusive os feitos em outro aparelho.
  useEffect(
    () => assinarTabela({ tabela: 'transactions', coluna: 'user_id', valor: userId, aoMudar: buscar }),
    [userId, buscar]
  )

  const total = Object.values(saldos).reduce((acc, v) => acc + v, 0)
  return { saldos, total, carregando, recarregar: buscar }
}
