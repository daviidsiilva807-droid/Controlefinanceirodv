import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'

export function useEmprestimos() {
  const userId = useAuth((state) => state.sessao?.user?.id)
  const [emprestimos, setEmprestimos] = useState([])
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setEmprestimos(data ?? [])
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    buscar()
  }, [buscar])

  const salvar = useCallback(
    async (emprestimo) => {
      const payload = {
        name: emprestimo.name.trim(),
        amount_cents: emprestimo.amount_cents,
        installments: emprestimo.installments,
        installment_amount_cents: emprestimo.installment_amount_cents,
        active: emprestimo.active ?? true,
      }
      const query = emprestimo.id
        ? supabase.from('loans').update(payload).eq('id', emprestimo.id)
        : supabase.from('loans').insert(payload)
      const { error } = await query
      if (error) throw error
      await buscar()
    },
    [buscar]
  )

  const excluir = useCallback(
    async (id) => {
      const { error } = await supabase.from('loans').delete().eq('id', id)
      if (error) throw error
      await buscar()
    },
    [buscar]
  )

  return { emprestimos, carregando, salvar, excluir, recarregar: buscar }
}