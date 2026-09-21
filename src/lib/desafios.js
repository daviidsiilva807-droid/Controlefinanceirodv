const CHAVE_DESAFIOS = 'controle-financeiro:desafios'

export const DESAFIOS_PADRAO = [
  {
    id: 'cem-depositos',
    nome: '100 depósitos',
    alvoCents: 370000,
    dias: 100,
    cor: 'brand',
    concluidos: [],
  },
  {
    id: 'reserva-30-dias',
    nome: 'Reserva em 30 dias',
    alvoCents: 100000,
    dias: 30,
    cor: 'amber',
    concluidos: [],
  },
]

export function lerDesafios() {
  try {
    const salvos = JSON.parse(localStorage.getItem(CHAVE_DESAFIOS) ?? 'null')
    if (Array.isArray(salvos)) {
      return salvos.map((desafio) => ({ ...desafio, concluidos: desafio.concluidos ?? [] }))
    }

    const antigo = JSON.parse(localStorage.getItem('desafio-100-depositos') ?? 'null')
    if (Array.isArray(antigo)) {
      return DESAFIOS_PADRAO.map((desafio, indice) =>
        indice === 0
          ? { ...desafio, concluidos: antigo.filter((dia) => Number.isInteger(dia) && dia >= 0 && dia < 100) }
          : desafio
      )
    }

    return DESAFIOS_PADRAO
  } catch {
    return DESAFIOS_PADRAO
  }
}

export function salvarDesafios(desafios) {
  localStorage.setItem(CHAVE_DESAFIOS, JSON.stringify(desafios))
}

export function valorDoDia(desafio, dia) {
  const base = Math.floor(desafio.alvoCents / desafio.dias)
  return dia === desafio.dias - 1 ? desafio.alvoCents - base * (desafio.dias - 1) : base
}

export function totalConcluido(desafio) {
  return desafio.concluidos.reduce((total, dia) => total + valorDoDia(desafio, dia), 0)
}

export function percentualDesafio(desafio) {
  return desafio.dias ? Math.round((desafio.concluidos.length / desafio.dias) * 100) : 0
}