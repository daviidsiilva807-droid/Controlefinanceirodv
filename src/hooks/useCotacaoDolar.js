import { useCallback, useEffect, useRef, useState } from 'react'
import { montarUrlCotacoes, selecionarCotacao } from '../lib/dolar'

const INTERVALO_ATUALIZACAO = 30 * 60 * 1000

export function useCotacaoDolar() {
  const [cotacao, setCotacao] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const controllerRef = useRef(null)

  const atualizar = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setCarregando(true)
    setErro(false)

    try {
      const resposta = await fetch(montarUrlCotacoes(), {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (!resposta.ok) throw new Error('Falha ao consultar o Banco Central.')

      const dados = await resposta.json()
      setCotacao(selecionarCotacao(dados))
    } catch (erroConsulta) {
      if (erroConsulta.name !== 'AbortError') setErro(true)
    } finally {
      if (!controller.signal.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    atualizar()
    const intervalo = window.setInterval(atualizar, INTERVALO_ATUALIZACAO)

    return () => {
      window.clearInterval(intervalo)
      controllerRef.current?.abort()
    }
  }, [atualizar])

  return { cotacao, carregando, erro, atualizar }
}
