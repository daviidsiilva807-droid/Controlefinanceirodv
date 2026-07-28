import { create } from 'zustand'
import { chaveMes } from '../lib/dates'

const CHAVE_TEMA = 'cf.tema'

function temaInicial() {
  const salvo = localStorage.getItem(CHAVE_TEMA)
  if (salvo === 'claro' || salvo === 'escuro') return salvo
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro'
}

function aplicarTema(tema) {
  document.documentElement.classList.toggle('dark', tema === 'escuro')
  // Mantém a barra de status do celular na cor certa quando instalado.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'escuro' ? '#020617' : '#059669')
}

export const useUI = create((set, get) => ({
  tema: 'escuro',
  // Mês em foco no app inteiro: dashboard, lista, orçamentos e cartões
  // andam juntos, então o estado é um só.
  mes: chaveMes(new Date()),
  toast: null,

  iniciarTema() {
    const tema = temaInicial()
    aplicarTema(tema)
    set({ tema })
  },

  alternarTema() {
    const tema = get().tema === 'escuro' ? 'claro' : 'escuro'
    localStorage.setItem(CHAVE_TEMA, tema)
    aplicarTema(tema)
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
