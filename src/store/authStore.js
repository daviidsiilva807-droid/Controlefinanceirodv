import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { precisaDestrancar, pinConfigurado, marcarAtividade } from '../lib/pin'

export const useAuth = create((set, get) => ({
  carregando: true,
  sessao: null,
  perfil: null,
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
      set({ sessao: null, perfil: null, carregando: false, trancado: false })
      return
    }

    set({ sessao })
    await get().carregarPerfil()

    set({
      carregando: false,
      // Ao abrir o app já logado, o PIN vale. Depois de digitar a senha agora
      // mesmo, exigir o PIN em seguida seria só atrito.
      trancado: primeiraCarga ? precisaDestrancar() : false,
    })
    if (!primeiraCarga) marcarAtividade()
  },

  async carregarPerfil() {
    const uid = get().sessao?.user?.id
    if (!uid) return

    const { data: perfil } = await supabase
      .from('profiles')
      .select('id, display_name, email, emoji, role, created_at')
      .eq('id', uid)
      .maybeSingle()

    set({ perfil })
  },

  /**
   * O papel vem do banco, nunca de estado local: a interface esconder o menu
   * de administração é conveniência, não segurança — quem barra de verdade
   * são as policies e o GRANT por coluna que impede alterar `role`.
   */
  ehAdmin: () => get().perfil?.role === 'admin',

  async entrar(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw error
  },

  async cadastrar({ email, senha, nome }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { display_name: nome } },
    })
    if (error) throw error
    // Sem sessão = o projeto está exigindo confirmação de e-mail.
    return { precisaConfirmarEmail: !data.session }
  },

  async sair() {
    await supabase.auth.signOut()
    set({ sessao: null, perfil: null })
  },

  async salvarPerfil({ nome, emoji }) {
    const uid = get().sessao?.user?.id
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nome, emoji })
      .eq('id', uid)
    if (error) throw error
    await get().carregarPerfil()
  },

  trancar: () => set({ trancado: pinConfigurado() }),
  destrancar: () => {
    marcarAtividade()
    set({ trancado: false })
  },
}))
