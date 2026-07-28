import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import {
  Aviso,
  Botao,
  Campo,
  Cartao,
  Entrada,
  Etiqueta,
  Folha,
  TituloSecao,
} from '../components/ui'
import { mensagemDeErro, supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'

const EMOJIS = ['🙂', '😎', '🐱', '🐶', '🦊', '🐼', '🦁', '🐸', '🌻', '⚡', '🎸', '🚀']

export function Familia() {
  const casa = useAuth((s) => s.casa)
  const membros = useAuth((s) => s.membros)
  const perfil = useAuth((s) => s.perfil)
  const carregarCasa = useAuth((s) => s.carregarCasa)
  const salvarPerfil = useAuth((s) => s.salvarPerfil)
  const entrarNaCasa = useAuth((s) => s.entrarNaCasa)
  const mostrarToast = useUI((s) => s.mostrarToast)

  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [entrandoEmCasa, setEntrandoEmCasa] = useState(false)
  const [nomeCasa, setNomeCasa] = useState(casa?.name ?? '')

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(casa.invite_code)
      mostrarToast('Código copiado.', 'sucesso')
    } catch {
      // clipboard falha em contexto não seguro (http) — o código está na tela
      // de qualquer forma, então não vale assustar o usuário com um erro.
      mostrarToast('Copie o código manualmente.', 'info')
    }
  }

  const renomearCasa = async () => {
    const nome = nomeCasa.trim()
    if (!nome || nome === casa.name) return
    const { error } = await supabase.from('households').update({ name: nome }).eq('id', casa.id)
    if (error) return mostrarToast(mensagemDeErro(error), 'erro')
    await carregarCasa()
    mostrarToast('Nome atualizado.', 'sucesso')
  }

  return (
    <>
      <CabecalhoVoltar titulo="Família" subtitulo={casa?.name} />

      <div className="space-y-5 p-4">
        <section>
          <TituloSecao>Quem divide os lançamentos</TituloSecao>
          <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
            {membros.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl dark:bg-slate-800">
                  {m.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {m.nome}
                    {m.souEu && <Etiqueta cor="verde">você</Etiqueta>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {m.papel === 'owner' ? 'criou a casa' : 'entrou pelo convite'}
                  </p>
                </div>
                {m.souEu && (
                  <button
                    onClick={() => setEditandoPerfil(true)}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400"
                  >
                    editar
                  </button>
                )}
              </div>
            ))}
          </Cartao>
        </section>

        {/* Convite: um código curto de 6 caracteres é ditado por telefone sem
            erro, e dispensa e-mail transacional configurado no Supabase. */}
        <section>
          <TituloSecao>Convidar alguém</TituloSecao>
          <Cartao>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              A outra pessoa cria a conta dela e digita este código no campo{' '}
              <strong>“Código de convite”</strong>. A partir daí vocês veem os mesmos lançamentos.
            </p>

            <button
              onClick={copiarCodigo}
              className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border-2
                border-dashed border-brand-400 py-4 dark:border-brand-700"
            >
              <span className="tabular text-2xl font-bold tracking-[0.3em] text-brand-700 dark:text-brand-300">
                {casa?.invite_code}
              </span>
              <Icone nome="compartilhar" tamanho={18} className="text-brand-600 dark:text-brand-400" />
            </button>

            <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
              toque para copiar
            </p>
          </Cartao>
        </section>

        <section>
          <TituloSecao>Nome da casa</TituloSecao>
          <Cartao>
            <div className="flex gap-2">
              <Entrada
                value={nomeCasa}
                onChange={(e) => setNomeCasa(e.target.value)}
                placeholder="Ex.: Casa da Ana e do Davi"
                maxLength={60}
              />
              <Botao onClick={renomearCasa} disabled={!nomeCasa.trim() || nomeCasa === casa?.name}>
                Salvar
              </Botao>
            </div>
          </Cartao>
        </section>

        {membros.length === 1 && (
          <>
            <Botao
              variante="contorno"
              className="w-full"
              icone="pessoas"
              onClick={() => setEntrandoEmCasa(true)}
            >
              Entrar na casa de outra pessoa
            </Botao>
            <Aviso tipo="alerta">
              Só é possível migrar enquanto você ainda não tem lançamentos. Depois disso, juntar dois
              históricos exigiria apagar um deles — e essa decisão é sua, não do app.
            </Aviso>
          </>
        )}
      </div>

      {editandoPerfil && (
        <FolhaPerfil perfil={perfil} aoSalvar={salvarPerfil} aoFechar={() => setEditandoPerfil(false)} />
      )}

      {entrandoEmCasa && (
        <FolhaEntrarNaCasa aoEntrar={entrarNaCasa} aoFechar={() => setEntrandoEmCasa(false)} />
      )}
    </>
  )
}

function FolhaPerfil({ perfil, aoSalvar, aoFechar }) {
  const mostrarToast = useUI((s) => s.mostrarToast)
  const [nome, setNome] = useState(perfil?.display_name ?? '')
  const [emoji, setEmoji] = useState(perfil?.emoji ?? '🙂')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    try {
      await aoSalvar({ nome: nome.trim(), emoji })
      mostrarToast('Perfil atualizado.', 'sucesso')
      aoFechar()
    } catch (e) {
      mostrarToast(mensagemDeErro(e), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo="Seu perfil"
      rodape={
        <Botao tamanho="lg" className="w-full" onClick={salvar} carregando={salvando}>
          Salvar
        </Botao>
      }
    >
      <div className="space-y-4">
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
      </div>
    </Folha>
  )
}

function FolhaEntrarNaCasa({ aoEntrar, aoFechar }) {
  const mostrarToast = useUI((s) => s.mostrarToast)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const confirmar = async () => {
    setErro(null)
    setEnviando(true)
    try {
      await aoEntrar(codigo)
      mostrarToast('Pronto! Vocês agora dividem os mesmos lançamentos.', 'sucesso')
      aoFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Folha
      aberta
      aoFechar={aoFechar}
      titulo="Entrar em uma casa"
      rodape={
        <Botao
          tamanho="lg"
          className="w-full"
          onClick={confirmar}
          carregando={enviando}
          disabled={codigo.length !== 6}
        >
          Entrar
        </Botao>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Peça o código de 6 caracteres para quem já usa o app.
        </p>
        <Entrada
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="A7K2M9"
          maxLength={6}
          className="tabular text-center text-2xl tracking-[0.3em] uppercase"
          autoCapitalize="characters"
          autoCorrect="off"
          autoFocus
        />
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Folha>
  )
}
