import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import {
  AreaTexto,
  Aviso,
  Botao,
  Campo,
  Cartao,
  Entrada,
  Esqueleto,
  Etiqueta,
  Folha,
  Segmentado,
  TituloSecao,
  Vazio,
} from '../components/ui'
import {
  enviarMensagem,
  enviarParaTodos,
  useEnviadas,
  useUsuarios,
} from '../hooks/useMensagens'
import { rotuloDataCompleta, rotuloMomento } from '../lib/dates'
import { mensagemDeErro } from '../lib/supabase'
import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'

const TIPOS = [
  { valor: 'info', rotulo: 'Aviso' },
  { valor: 'aviso', rotulo: 'Atenção' },
  { valor: 'alerta', rotulo: 'Importante' },
]

export function Administracao() {
  const ehAdmin = useAuth((s) => s.perfil?.role === 'admin')
  const meuId = useAuth((s) => s.sessao?.user?.id)
  const { usuarios, carregando, recarregar } = useUsuarios()
  const { enviadas, recarregar: recarregarEnviadas } = useEnviadas()

  const [destinatario, setDestinatario] = useState(null) // usuário | 'todos'
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return usuarios
    return usuarios.filter(
      (u) =>
        u.display_name?.toLowerCase().includes(termo) || u.email?.toLowerCase().includes(termo)
    )
  }, [usuarios, busca])

  const outros = filtrados.filter((u) => u.id !== meuId)

  // A guarda vem DEPOIS de todos os hooks, e isso não é preferência de
  // estilo: o perfil carrega de forma assíncrona, então o primeiro render
  // ainda não sabe que você é admin. Com o `return` antes do useMemo, a
  // quantidade de hooks mudaria entre um render e outro e o React derrubaria
  // a árvore inteira — tela branca, sem mensagem.
  //
  // Esconder a rota do menu é conveniência; quem barra de verdade é o RLS.
  if (!ehAdmin) return <Navigate to="/" replace />


  return (
    <>
      <CabecalhoVoltar
        titulo="Administração"
        subtitulo={`${usuarios.length} usuário${usuarios.length === 1 ? '' : 's'} cadastrado${usuarios.length === 1 ? '' : 's'}`}
      />

      <div className="space-y-5 p-4">
        <Aviso tipo="info">
          <p className="font-medium">O que você vê aqui</p>
          <p className="mt-1">
            Nome, e-mail e data de cadastro — só isso. Você <strong>não</strong> tem acesso a
            lançamentos, saldos, cartões ou orçamentos de ninguém, e isso é garantido pelas regras do
            banco de dados, não por esta tela.
          </p>
        </Aviso>

        {outros.length > 0 && (
          <Botao
            className="w-full"
            tamanho="lg"
            icone="pessoas"
            onClick={() => setDestinatario('todos')}
          >
            Avisar todos ({outros.length})
          </Botao>
        )}

        <section>
          <TituloSecao>Usuários</TituloSecao>

          {usuarios.length > 4 && (
            <div className="relative mb-2">
              <Icone
                nome="busca"
                tamanho={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Entrada
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail…"
                className="pl-10"
                type="search"
              />
            </div>
          )}

          {carregando ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <Esqueleto key={i} className="h-16" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <Vazio icone="pessoas" titulo="Nenhum usuário encontrado" />
          ) : (
            <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
              {filtrados.map((u) => {
                const souEu = u.id === meuId
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
                      {u.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {u.display_name}
                        {u.role === 'admin' && <Etiqueta cor="roxo">admin</Etiqueta>}
                        {souEu && <Etiqueta cor="verde">você</Etiqueta>}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {u.email}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        desde {rotuloDataCompleta(new Date(u.created_at))}
                      </p>
                    </div>
                    {!souEu && (
                      <Botao variante="secundario" tamanho="sm" onClick={() => setDestinatario(u)}>
                        Mensagem
                      </Botao>
                    )}
                  </div>
                )
              })}
            </Cartao>
          )}
        </section>

        {enviadas.length > 0 && (
          <section>
            <TituloSecao>Enviadas recentemente</TituloSecao>
            <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
              {enviadas.slice(0, 8).map((m) => {
                const para = usuarios.find((u) => u.id === m.to_user_id)
                return (
                  <div key={m.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
                      {/* Saber se a pessoa leu é o dado mais útil aqui — evita
                          reenviar o mesmo aviso. */}
                      <Etiqueta cor={m.read_at ? 'verde' : 'slate'}>
                        {m.read_at ? 'lida' : 'não lida'}
                      </Etiqueta>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      para {para?.display_name ?? 'usuário'} · {rotuloMomento(m.created_at)}
                    </p>
                  </div>
                )
              })}
            </Cartao>
          </section>
        )}
      </div>

      {destinatario && (
        <FolhaEnviar
          destinatario={destinatario}
          quantidade={outros.length}
          aoFechar={() => setDestinatario(null)}
          aoEnviar={() => {
            recarregar()
            recarregarEnviadas()
          }}
        />
      )}
    </>
  )
}

function FolhaEnviar({ destinatario, quantidade, aoFechar, aoEnviar }) {
  const mostrarToast = useUI((s) => s.mostrarToast)
  const paraTodos = destinatario === 'todos'

  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [tipo, setTipo] = useState('info')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    if (!titulo.trim()) return setErro('Escreva um título.')
    setErro(null)
    setEnviando(true)
    try {
      if (paraTodos) {
        const total = await enviarParaTodos({ titulo, corpo, tipo })
        mostrarToast(`Enviado para ${total} usuário${total === 1 ? '' : 's'}.`, 'sucesso')
      } else {
        await enviarMensagem({ para: destinatario.id, titulo, corpo, tipo })
        mostrarToast(`Mensagem enviada para ${destinatario.display_name}.`, 'sucesso')
      }
      aoEnviar()
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
      titulo={paraTodos ? `Avisar todos (${quantidade})` : `Mensagem para ${destinatario.display_name}`}
      rodape={
        <Botao tamanho="lg" className="w-full" onClick={enviar} carregando={enviando}>
          Enviar
        </Botao>
      }
    >
      <div className="space-y-4">
        <Segmentado opcoes={TIPOS} valor={tipo} aoMudar={setTipo} />

        <Campo rotulo="Título">
          <Entrada
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Lembrete de fechamento do mês"
            maxLength={120}
            autoFocus
          />
        </Campo>

        <Campo rotulo="Mensagem" dica="Opcional. As quebras de linha são preservadas.">
          <AreaTexto
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            linhas={6}
            maxLength={2000}
            placeholder="Escreva aqui…"
          />
        </Campo>

        {paraTodos && (
          <Aviso tipo="alerta">
            Isto cria uma mensagem na caixa de entrada de <strong>{quantidade}</strong> pessoa
            {quantidade === 1 ? '' : 's'}. Não dá para desfazer em massa.
          </Aviso>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Folha>
  )
}
