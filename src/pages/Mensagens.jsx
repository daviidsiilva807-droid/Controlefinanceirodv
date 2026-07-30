import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { Botao, Esqueleto, Etiqueta, Folha, Vazio } from '../components/ui'
import { useMensagens } from '../hooks/useMensagens'
import { rotuloMomento } from '../lib/dates'

const ESTILO = {
  info: { cor: 'roxo', icone: 'info', rotulo: 'Aviso' },
  aviso: { cor: 'ambar', icone: 'alerta', rotulo: 'Atenção' },
  alerta: { cor: 'vermelho', icone: 'alerta', rotulo: 'Importante' },
}

export function Mensagens() {
  const { mensagens, naoLidas, carregando, marcarComoLida, marcarTodasComoLidas, excluir } =
    useMensagens()
  const [aberta, setAberta] = useState(null)

  const abrir = (mensagem) => {
    setAberta(mensagem)
    if (!mensagem.read_at) marcarComoLida(mensagem.id)
  }

  return (
    <>
      <CabecalhoVoltar
        titulo="Mensagens"
        subtitulo={naoLidas ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : undefined}
        acao={
          naoLidas > 0 && (
            <Botao variante="fantasma" tamanho="sm" onClick={marcarTodasComoLidas}>
              Marcar todas
            </Botao>
          )
        }
      />

      <div className="space-y-3 p-4">
        {carregando ? (
          [0, 1, 2].map((i) => <Esqueleto key={i} className="h-20" />)
        ) : mensagens.length === 0 ? (
          <Vazio
            icone="info"
            titulo="Nenhuma mensagem"
            mensagem="Avisos enviados pelo administrador aparecem aqui."
          />
        ) : (
          mensagens.map((m) => {
            const estilo = ESTILO[m.kind] ?? ESTILO.info
            return (
              <button
                key={m.id}
                onClick={() => abrir(m)}
                className={`block w-full rounded-2xl border p-4 text-left transition-colors
                  active:bg-slate-100 dark:active:bg-slate-800 ${
                    m.read_at
                      ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                      : 'border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/40'
                  }`}
              >
                <div className="flex items-center gap-2">
                  {/* Bolinha de não lida: o negrito sozinho é sutil demais
                      numa lista com várias mensagens. */}
                  {!m.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  <span className={`min-w-0 flex-1 truncate text-sm ${m.read_at ? 'font-medium' : 'font-semibold'}`}>
                    {m.title}
                  </span>
                  <Etiqueta cor={estilo.cor}>{estilo.rotulo}</Etiqueta>
                </div>

                {m.body && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {m.body}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  {rotuloMomento(m.created_at)}
                </p>
              </button>
            )
          })
        )}
      </div>

      {aberta && (
        <Folha
          aberta
          aoFechar={() => setAberta(null)}
          titulo={(ESTILO[aberta.kind] ?? ESTILO.info).rotulo}
          rodape={
            <div className="flex gap-2">
              <Botao
                variante="fantasma"
                className="text-rose-600 dark:text-rose-400"
                icone="lixeira"
                onClick={() => {
                  excluir(aberta.id)
                  setAberta(null)
                }}
              >
                Excluir
              </Botao>
              <Botao className="flex-1" onClick={() => setAberta(null)}>
                Fechar
              </Botao>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Icone nome={(ESTILO[aberta.kind] ?? ESTILO.info).icone} tamanho={20} />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">{aberta.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {rotuloMomento(aberta.created_at)}
                </p>
              </div>
            </div>

            {aberta.body && (
              // whitespace-pre-line preserva as quebras de linha que o admin
              // digitou, sem precisar de editor rico.
              <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {aberta.body}
              </p>
            )}
          </div>
        </Folha>
      )}
    </>
  )
}
