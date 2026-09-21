import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'

export const TIPOS_ASSINATURA = {
  streaming: { rotulo: 'Streaming de vídeo', emoji: '🎬' },
  musica: { rotulo: 'Streaming de música', emoji: '🎵' },
  ia: { rotulo: 'Inteligência artificial', emoji: '🤖' },
  saude: { rotulo: 'Plano de saúde', emoji: '🩺' },
  academia: { rotulo: 'Academia e bem-estar', emoji: '🏋️' },
  nuvem: { rotulo: 'Armazenamento em nuvem', emoji: '☁️' },
  software: { rotulo: 'Softwares e apps', emoji: '💻' },
  jogos: { rotulo: 'Jogos', emoji: '🎮' },
  educacao: { rotulo: 'Cursos e educação', emoji: '📚' },
  noticias: { rotulo: 'Notícias e revistas', emoji: '📰' },
  outro: { rotulo: 'Outro', emoji: '🔖' },
}

export function useAssinaturas() {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const [assinaturas, setAssinaturas] = useState([])
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('amount_cents', { ascending: false })
    if (!error) setAssinaturas(data ?? [])
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    buscar()
  }, [buscar])

  const salvar = useCallback(
    async (assinatura) => {
      const payload = {
        name: assinatura.name,
        type: assinatura.type,
        amount_cents: assinatura.amount_cents,
        billing_day: assinatura.billing_day || null,
        notes: assinatura.notes ?? '',
        active: assinatura.active ?? true,
      }
      const query = assinatura.id
        ? supabase.from('subscriptions').update(payload).eq('id', assinatura.id)
        : supabase.from('subscriptions').insert(payload)
      const { error } = await query
      if (error) throw error
      await buscar()
    },
    [buscar]
  )

  const excluir = useCallback(
    async (id) => {
      const { error } = await supabase.from('subscriptions').delete().eq('id', id)
      if (error) throw error
      await buscar()
    },
    [buscar]
  )

  const totalMensal = assinaturas
    .filter((a) => a.active)
    .reduce((soma, a) => soma + a.amount_cents, 0)

  return { assinaturas, carregando, totalMensal, salvar, excluir, recarregar: buscar }
}
