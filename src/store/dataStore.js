import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/**
 * Contas e categorias mudam raramente mas são lidas em quase toda tela
 * (formulário, lista, gráficos, orçamentos). Ficam num store único carregado
 * uma vez, em vez de cada tela buscar de novo.
 */
export const useDados = create((set, get) => ({
  contas: [],
  categorias: [],
  carregando: true,
  carregado: false,

  async carregar() {
    const [{ data: contas, error: e1 }, { data: categorias, error: e2 }] = await Promise.all([
      supabase.from('accounts').select('*').order('sort_order').order('name'),
      supabase.from('categories').select('*').order('sort_order').order('name'),
    ])
    if (e1 || e2) {
      set({ carregando: false })
      throw e1 ?? e2
    }
    set({ contas: contas ?? [], categorias: categorias ?? [], carregando: false, carregado: true })
  },

  limpar: () => set({ contas: [], categorias: [], carregando: true, carregado: false }),

  // --------------------------------------------------------------- contas

  contasAtivas: () => get().contas.filter((c) => !c.archived),
  cartoes: () => get().contas.filter((c) => c.type === 'cartao' && !c.archived),
  contaPorId: (id) => get().contas.find((c) => c.id === id),

  async salvarConta(conta) {
    const payload = {
      name: conta.name.trim(),
      type: conta.type,
      icon: conta.icon,
      color: conta.color,
      initial_balance_cents: conta.initial_balance_cents ?? 0,
      // Campos de cartão só existem para cartão; enviar null nos outros casos
      // evita que a restrição accounts_cartao_precisa_dias reclame.
      credit_limit_cents: conta.type === 'cartao' ? conta.credit_limit_cents ?? null : null,
      closing_day: conta.type === 'cartao' ? conta.closing_day : null,
      due_day: conta.type === 'cartao' ? conta.due_day : null,
      archived: conta.archived ?? false,
    }

    const query = conta.id
      ? supabase.from('accounts').update(payload).eq('id', conta.id)
      : supabase.from('accounts').insert(payload)

    const { error } = await query
    if (error) throw error
    await get().carregar()
  },

  async excluirConta(id) {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) throw error
    await get().carregar()
  },

  // ----------------------------------------------------------- categorias

  categoriasPorTipo: (kind) =>
    get().categorias.filter((c) => c.kind === kind && !c.archived),
  categoriaPorId: (id) => get().categorias.find((c) => c.id === id),

  async salvarCategoria(categoria) {
    const payload = {
      name: categoria.name.trim(),
      kind: categoria.kind,
      icon: categoria.icon,
      color: categoria.color,
      archived: categoria.archived ?? false,
    }

    const query = categoria.id
      ? supabase.from('categories').update(payload).eq('id', categoria.id)
      : supabase.from('categories').insert(payload)

    const { error } = await query
    if (error) throw error
    await get().carregar()
  },

  async excluirCategoria(id) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
    await get().carregar()
  },
}))
