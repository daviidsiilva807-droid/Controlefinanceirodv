import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { assinarTabela } from '../lib/realtime'
import { useAuth } from '../store/authStore'

/**
 * Caixa de entrada do usuário logado.
 *
 * Assina realtime para o sino acender no momento em que o administrador
 * envia — sem isso a pessoa só descobriria a mensagem ao recarregar o app,
 * o que derruba o propósito de "notificação".
 */
export function useMensagens() {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('messages')
      .select('id, title, body, kind, read_at, created_at, from_user_id')
      .eq('to_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error) setMensagens(data ?? [])
    setCarregando(false)
  }, [userId])

  useEffect(() => {
    buscar()
  }, [buscar])

  useEffect(
    () => assinarTabela({ tabela: 'messages', coluna: 'to_user_id', valor: userId, aoMudar: buscar }),
    [userId, buscar]
  )

  /**
   * Marca como lida. O UPDATE otimista deixa o contador cair na hora — o
   * realtime traz a confirmação depois, e como o valor é o mesmo, não pisca.
   */
  const marcarComoLida = useCallback(async (id) => {
    setMensagens((atual) =>
      atual.map((m) => (m.id === id && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m))
    )
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', id)
  }, [])

  const marcarTodasComoLidas = useCallback(async () => {
    const agora = new Date().toISOString()
    setMensagens((atual) => atual.map((m) => (m.read_at ? m : { ...m, read_at: agora })))
    await supabase
      .from('messages')
      .update({ read_at: agora })
      .eq('to_user_id', userId)
      .is('read_at', null)
  }, [userId])

  const excluir = useCallback(async (id) => {
    setMensagens((atual) => atual.filter((m) => m.id !== id))
    await supabase.from('messages').delete().eq('id', id)
  }, [])

  const naoLidas = mensagens.filter((m) => !m.read_at).length

  return { mensagens, naoLidas, carregando, marcarComoLida, marcarTodasComoLidas, excluir, recarregar: buscar }
}

/**
 * Só o contador, para o sino no cabeçalho. Hook separado do de cima para o
 * badge não obrigar cada tela a carregar a lista inteira de mensagens.
 */
export function useNaoLidas() {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const [total, setTotal] = useState(0)

  const contar = useCallback(async () => {
    if (!userId) return
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .is('read_at', null)
    setTotal(count ?? 0)
  }, [userId])

  useEffect(() => {
    contar()
  }, [contar])

  useEffect(
    () => assinarTabela({ tabela: 'messages', coluna: 'to_user_id', valor: userId, aoMudar: contar }),
    [userId, contar]
  )

  return total
}

// ------------------------------------------------------------- lado admin

/** Lista de usuários — nome, e-mail e data. Nada financeiro. */
export function useUsuarios() {
  const ehAdmin = useAuth((s) => s.perfil?.role === 'admin')
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)

  const buscar = useCallback(async () => {
    if (!ehAdmin) {
      setCarregando(false)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, emoji, role, created_at')
      .order('created_at')

    if (!error) setUsuarios(data ?? [])
    setCarregando(false)
  }, [ehAdmin])

  useEffect(() => {
    buscar()
  }, [buscar])

  return { usuarios, carregando, recarregar: buscar }
}

/** Mensagens que o admin já enviou, para ele ter histórico do que mandou. */
export function useEnviadas() {
  const userId = useAuth((s) => s.sessao?.user?.id)
  const ehAdmin = useAuth((s) => s.perfil?.role === 'admin')
  const [enviadas, setEnviadas] = useState([])

  const buscar = useCallback(async () => {
    if (!ehAdmin || !userId) return
    const { data } = await supabase
      .from('messages')
      .select('id, to_user_id, title, body, kind, read_at, created_at')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setEnviadas(data ?? [])
  }, [ehAdmin, userId])

  useEffect(() => {
    buscar()
  }, [buscar])

  return { enviadas, recarregar: buscar }
}

export async function enviarMensagem({ para, titulo, corpo, tipo }) {
  const { error } = await supabase.rpc('send_message', {
    p_to: para,
    p_title: titulo,
    p_body: corpo ?? '',
    p_kind: tipo ?? 'info',
  })
  if (error) throw error
}

export async function enviarParaTodos({ titulo, corpo, tipo }) {
  const { data, error } = await supabase.rpc('broadcast_message', {
    p_title: titulo,
    p_body: corpo ?? '',
    p_kind: tipo ?? 'info',
  })
  if (error) throw error
  return data ?? 0
}
