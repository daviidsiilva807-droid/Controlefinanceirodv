import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { precisaDestrancar, pinConfigurado, marcarAtividade } from '../lib/pin'

export const useAuth = create((set, get) => ({
  carregando: true,
  sessao: null,
  perfil: null,
  casa: null,
  membros: [],
  // `trancado` é o PIN, não a sessão: você continua logado, só não vê a tela.
  trancado: false,

  /**
   * Chamado uma vez no boot. Além de ler a sessão salva, assina as mudanças
   * de auth — é o que faz o app reagir ao token expirando ou ao logout feito
   * em outra aba.
   */
  async iniciar() {
    if (!supabase) {
      set({ carregando: false })
      return
    }

    const { data } = await supabase.auth.getSession()
    await get().aplicarSessao(data.session, { primeiraCarga: true })

    supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'TOKEN_REFRESHED') return // nada muda para a UI
      get().aplicarSessao(sessao)
    })
  },

  async aplicarSessao(sessao, { primeiraCarga = false } = {}) {
    if (!sessao) {
      set({ sessao: null, perfil: null, casa: null, membros: [], carregando: false, trancado: false })
      return
    }

    set({ sessao })
    await get().carregarCasa()

    set({
      carregando: false,
      // Ao abrir o app já logado, o PIN vale. Depois de digitar a senha
      // agora mesmo, exigir o PIN em seguida seria só atrito.
      trancado: primeiraCarga ? precisaDestrancar() : false,
    })
    if (!primeiraCarga) marcarAtividade()
  },

  /** Carrega perfil, casa e os membros que dividem a casa com você. */
  async carregarCasa() {
    const uid = get().sessao?.user?.id
    if (!uid) return

    const { data: vinculo } = await supabase
      .from('household_members')
      .select('household_id, role, households(id, name, invite_code)')
      .eq('user_id', uid)
      .maybeSingle()

    const casa = vinculo?.households
      ? { ...vinculo.households, meuPapel: vinculo.role }
      : null

    const [{ data: perfil }, { data: membros }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      casa
        ? supabase
            .from('household_members')
            .select('user_id, role, joined_at, profiles(id, display_name, emoji)')
            .eq('household_id', casa.id)
        : Promise.resolve({ data: [] }),
    ])

    set({
      perfil,
      casa,
      membros: (membros ?? []).map((m) => ({
        id: m.user_id,
        papel: m.role,
        nome: m.profiles?.display_name ?? 'Alguém',
        emoji: m.profiles?.emoji ?? '🙂',
        souEu: m.user_id === uid,
      })),
    })
  },

  async entrar(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  },

  /**
   * O nome e o código de convite viajam em `data`, que o Postgres recebe em
   * raw_user_meta_data — é assim que o trigger handle_new_user() decide se
   * cria uma casa nova ou entra na casa de quem convidou.
   */
  async cadastrar({ email, senha, nome, codigoConvite }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          display_name: nome,
          invite_code: codigoConvite ? codigoConvite.trim().toUpperCase() : null,
        },
      },
    })
    if (error) throw error
    // Sem sessão = o projeto está exigindo confirmação de e-mail.
    return { precisaConfirmarEmail: !data.session }
  },

  async sair() {
    await supabase.auth.signOut()
    set({ sessao: null, perfil: null, casa: null, membros: [] })
  },

  async entrarNaCasa(codigo) {
    const { error } = await supabase.rpc('join_household', { p_code: codigo })
    if (error) throw error
    await get().carregarCasa()
  },

  async salvarPerfil({ nome, emoji }) {
    const uid = get().sessao?.user?.id
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nome, emoji })
      .eq('id', uid)
    if (error) throw error
    await get().carregarCasa()
  },

  trancar: () => set({ trancado: pinConfigurado() }),
  destrancar: () => {
    marcarAtividade()
    set({ trancado: false })
  },
}))
