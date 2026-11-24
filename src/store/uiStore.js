import { create } from 'zustand'
import { chaveMes } from '../lib/dates'

const CHAVE_TEMA = 'cf.tema'
const CHAVE_MODO = 'cf.modo'
const TEMAS = ['gelo', 'verde', 'vinho', 'azul', 'neon']

function preferenciasIniciais() {
  const temaSalvo = localStorage.getItem(CHAVE_TEMA)
  const modoSalvo = localStorage.getItem(CHAVE_MODO)
  return {
    tema: TEMAS.includes(temaSalvo) ? temaSalvo : 'gelo',
    modo: modoSalvo === 'claro' || modoSalvo === 'escuro'
      ? modoSalvo
      : window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'claro'
        : 'escuro',
  }
}

function aplicarTema(tema, modo) {
  document.documentElement.classList.remove('tema-gelo', 'tema-verde', 'tema-vinho', 'tema-azul', 'tema-neon')
  document.documentElement.classList.add(`tema-${tema}`)
  document.documentElement.classList.toggle('dark', modo === 'escuro')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      modo === 'escuro'
        ? '#020617'
        : tema === 'gelo'
          ? '#475569'
          : tema === 'vinho'
          ? '#9F2D45'
          : tema === 'azul'
            ? '#0FA3B1'
            : tema === 'neon'
              ? '#00D77B'
              : '#0F766E'
    )
}

export const useUI = create((set, get) => ({
  tema: 'gelo',
  modo: 'escuro',
  // Mês em foco no app inteiro: dashboard, lista, orçamentos e cartões
  // andam juntos, então o estado é um só.
  mes: chaveMes(new Date()),
  toast: null,

  iniciarTema() {
    const preferencias = preferenciasIniciais()
    aplicarTema(preferencias.tema, preferencias.modo)
    set(preferencias)
  },

  alternarTema() {
    const modo = get().modo === 'escuro' ? 'claro' : 'escuro'
    localStorage.setItem(CHAVE_MODO, modo)
    aplicarTema(get().tema, modo)
    set({ modo })
  },

  definirTema(tema) {
    if (!TEMAS.includes(tema)) return
    localStorage.setItem(CHAVE_TEMA, tema)
    aplicarTema(tema, get().modo)
    set({ tema })
  },

  definirMes: (mes) => set({ mes }),
  irParaMesAtual: () => set({ mes: chaveMes(new Date()) }),

  // O formulário de lançamento é uma folha global, não uma rota: ele pode ser
  // aberto do botão flutuante, da lista, do dashboard ou da fatura, e sempre
  // volta para a tela de onde saiu.
  formLancamento: null,
  abrirForm: (transacao = {}) => set({ formLancamento: transacao }),
  fecharForm: () => set({ formLancamento: null }),

  mostrarToast(mensagem, tipo = 'info') {
    const id = Date.now()
    set({ toast: { id, mensagem, tipo } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 3200)
  },
  fecharToast: () => set({ toast: null }),
}))
