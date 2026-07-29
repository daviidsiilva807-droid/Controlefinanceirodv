import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Aviso, Botao, Campo, Cartao, Entrada, Etiqueta, TituloSecao } from '../components/ui'
import { rotuloDataCompleta } from '../lib/dates'
import { mensagemDeErro } from '../lib/supabase'
import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'

const EMOJIS = ['🙂', '😎', '🐱', '🐶', '🦊', '🐼', '🦁', '🐸', '🌻', '⚡', '🎸', '🚀']

/**
 * Substitui a antiga tela "Família". Sem compartilhamento entre contas, o que
 * sobra aqui é o perfil da própria pessoa.
 */
export function Perfil() {
  const perfil = useAuth((s) => s.perfil)
  const sessao = useAuth((s) => s.sessao)
  const salvarPerfil = useAuth((s) => s.salvarPerfil)
  const mostrarToast = useUI((s) => s.mostrarToast)

  const [nome, setNome] = useState(perfil?.display_name ?? '')
  const [emoji, setEmoji] = useState(perfil?.emoji ?? '🙂')
  const [salvando, setSalvando] = useState(false)

  const mudou = nome.trim() !== (perfil?.display_name ?? '') || emoji !== perfil?.emoji

  const salvar = async () => {
    setSalvando(true)
    try {
      await salvarPerfil({ nome: nome.trim(), emoji })
      mostrarToast('Perfil atualizado.', 'sucesso')
    } catch (e) {
      mostrarToast(mensagemDeErro(e), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <CabecalhoVoltar titulo="Sua conta" />

      <div className="space-y-5 p-4">
        <Cartao className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-3xl dark:bg-brand-900/40">
            {emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              {perfil?.display_name}
              {perfil?.role === 'admin' && <Etiqueta cor="roxo">admin</Etiqueta>}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {sessao?.user?.email}
            </p>
            {perfil?.created_at && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {/* new Date() e não slice(0,10): created_at é timestamptz em
                    UTC, e cortar a string erra o dia à noite no Brasil. */}
                desde {rotuloDataCompleta(new Date(perfil.created_at))}
              </p>
            )}
          </div>
        </Cartao>

        <section>
          <TituloSecao>Como você aparece</TituloSecao>
          <Cartao className="space-y-4">
            <Campo rotulo="Nome">
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
            </Campo>

            <Campo rotulo="Avatar">
              <div className="grid grid-cols-6 gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`flex h-12 items-center justify-center rounded-xl text-xl transition-colors ${
                      emoji === e ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Campo>

            <Botao
              className="w-full"
              onClick={salvar}
              carregando={salvando}
              disabled={!mudou || !nome.trim()}
            >
              Salvar
            </Botao>
          </Cartao>
        </section>

        {/* Deixar isso explícito na tela evita a dúvida mais provável de quem
            usa um app financeiro com mais de uma conta cadastrada. */}
        <Aviso tipo="info">
          <p className="font-medium">Seus dados são só seus</p>
          <p className="mt-1">
            Lançamentos, contas, cartões e orçamentos ficam isolados na sua conta. Nenhum outro
            usuário enxerga — e o administrador também não: ele vê apenas nome, e-mail e data de
            cadastro, o suficiente para enviar uma mensagem.
          </p>
        </Aviso>
      </div>
    </>
  )
}
