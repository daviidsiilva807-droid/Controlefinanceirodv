import { Component } from 'react'
import { Botao } from './ui'
import { Icone } from './Icone'

/**
 * Captura erros de renderização e mostra uma tela explicativa.
 *
 * Sem isto, um erro em qualquer componente derruba a árvore inteira do React
 * e o usuário vê uma PÁGINA EM BRANCO — sem mensagem, sem botão, sem pista do
 * que fazer. Já aconteceu duas vezes neste app (um canal de realtime com nome
 * repetido e uma variável esquecida numa refatoração), e nas duas o sintoma
 * relatado foi "a aba fica vazia".
 *
 * Precisa ser classe: React não oferece equivalente em hook para
 * componentDidCatch.
 */
export class LimiteDeErro extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    // Vai para o console do navegador, que é onde dá para investigar depois.
    console.error('Erro na tela:', erro, info?.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
          <Icone nome="alerta" tamanho={26} />
        </div>

        <div>
          <h1 className="text-lg font-bold">Algo quebrou nesta tela</h1>
          <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Seus dados estão salvos e intactos — o problema é só na exibição.
          </p>
        </div>

        {/* A mensagem técnica fica visível: é ela que permite relatar o
            problema de forma útil em vez de "não funciona". */}
        <pre className="max-w-full overflow-x-auto rounded-xl bg-slate-100 p-3 text-left text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          {String(this.state.erro?.message ?? this.state.erro)}
        </pre>

        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => this.setState({ erro: null })}>
            Tentar de novo
          </Botao>
          <Botao onClick={() => (window.location.href = '/')}>Voltar ao início</Botao>
        </div>
      </div>
    )
  }
}
