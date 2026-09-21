import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import {
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  CampoValor,
  Cartao,
  Confirmacao,
  Entrada,
  Etiqueta,
  Folha,
  Segmentado,
  Selecao,
  Vazio,
} from '../components/ui'
import { TIPOS_ASSINATURA, useAssinaturas } from '../hooks/useAssinaturas'
import { formatBRL } from '../lib/money'
import { mensagemDeErro } from '../lib/supabase'
import { useUI } from '../store/uiStore'

export function Assinaturas() {
  const { assinaturas, carregando, totalMensal, salvar, excluir } = useAssinaturas()
  const [editando, setEditando] = useState(null)

  return (
    <>
      <CabecalhoVoltar
        titulo="Assinaturas"
        subtitulo={totalMensal ? `${formatBRL(totalMensal)} por mês` : undefined}
        acao={<BotaoIcone nome="mais" rotulo="Nova assinatura" onClick={() => setEditando({})} />}
      />

      <div className="space-y-4 p-4">
        <Aviso tipo="info">
          Cadastre streamings, IAs, plano de saúde e outras cobranças mensais para acompanhar
          quanto elas somam por mês. Isso não lança nada no extrato — é só um controle.
        </Aviso>

        {carregando ? null : assinaturas.length === 0 ? (
          <Vazio
            icone="repetir"
            titulo="Nenhuma assinatura cadastrada"
            mensagem="Adicione Netflix, ChatGPT, plano de saúde e outras cobranças recorrentes."
            acao={<Botao onClick={() => setEditando({})}>Cadastrar</Botao>}
          />
        ) : (
          <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
            {assinaturas.map((a) => {
              const tipo = TIPOS_ASSINATURA[a.type] ?? TIPOS_ASSINATURA.outro
              return (
                <button
                  key={a.id}
                  onClick={() => setEditando(a)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors
                    active:bg-slate-100 dark:active:bg-slate-800 ${a.active ? '' : 'opacity-50'}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
                    {tipo.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{a.name}</span>
                      {!a.active && <Etiqueta>pausada</Etiqueta>}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {tipo.rotulo}
                      {a.billing_day ? ` · todo dia ${a.billing_day}` : ''}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {formatBRL(a.amount_cents)}
                  </span>
                  <Icone nome="direita" tamanho={16} className="shrink-0 text-slate-400" />
                </button>
              )
            })}
          </Cartao>
        )}
      </div>

      {editando && (
        <FolhaAssinatura
          assinatura={editando}
          aoSalvar={salvar}
          aoExcluir={excluir}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  )
}

function FolhaAssinatura({ assinatura, aoSalvar, aoExcluir, aoFechar }) {
  const mostrarToast = useUI((s) => s.mostrarToast)
  const editando = Boolean(assinatura.id)

  const [form, setForm] = useState({
    name: assinatura.name ?? '',
    type: assinatura.type ?? 'streaming',
    amount_cents: assinatura.amount_cents ?? 0,
    billing_day: assinatura.billing_day ?? '',
    active: assinatura.active ?? true,
  })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const confirmar = async () => {
    if (!form.name.trim()) return setErro('Dê um nome para a assinatura.')
    if (!form.amount_cents) return setErro('Informe o valor.')

    setSalvando(true)
    try {
      await aoSalvar({
        ...assinatura,
        ...form,
        name: form.name.trim(),
        billing_day: form.billing_day ? Number(form.billing_day) : null,
      })
      mostrarToast('Assinatura salva.', 'sucesso')
      aoFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <Folha
        aberta
        aoFechar={aoFechar}
        titulo={editando ? 'Editar assinatura' : 'Nova assinatura'}
        rodape={
          <div className="flex gap-2">
            {editando && (
              <BotaoIcone
                nome="lixeira"
                rotulo="Excluir"
                onClick={() => setConfirmarExclusao(true)}
                className="text-rose-600 dark:text-rose-400"
              />
            )}
            <Botao tamanho="lg" className="flex-1" onClick={confirmar} carregando={salvando}>
              Salvar
            </Botao>
          </div>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="Nome da assinatura">
            <Entrada
              value={form.name}
              onChange={(e) => mudar('name', e.target.value)}
              placeholder="Ex.: Netflix, ChatGPT Plus…"
              maxLength={80}
              autoFocus
            />
          </Campo>

          <Campo rotulo="Tipo">
            <Selecao value={form.type} onChange={(e) => mudar('type', e.target.value)}>
              {Object.entries(TIPOS_ASSINATURA).map(([valor, tipo]) => (
                <option key={valor} value={valor}>
                  {tipo.emoji} {tipo.rotulo}
                </option>
              ))}
            </Selecao>
          </Campo>

          <CampoValor valor={form.amount_cents} aoMudar={(v) => mudar('amount_cents', v)} />

          <Campo rotulo="Dia da cobrança" dica="Opcional, de 1 a 28">
            <Entrada
              type="number"
              min={1}
              max={28}
              inputMode="numeric"
              value={form.billing_day}
              onChange={(e) => mudar('billing_day', e.target.value)}
            />
          </Campo>

          {editando && (
            <Segmentado
              opcoes={[
                { valor: true, rotulo: 'Ativa' },
                { valor: false, rotulo: 'Pausada' },
              ]}
              valor={form.active}
              aoMudar={(v) => mudar('active', v)}
            />
          )}

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </div>
      </Folha>

      <Confirmacao
        aberta={confirmarExclusao}
        titulo="Excluir assinatura?"
        mensagem="Isso só remove do controle de assinaturas — nada é apagado do seu extrato."
        textoConfirmar="Excluir"
        perigo
        aoConfirmar={async () => {
          await aoExcluir(assinatura.id)
          mostrarToast('Assinatura excluída.', 'sucesso')
          aoFechar()
        }}
        aoFechar={() => setConfirmarExclusao(false)}
      />
    </>
  )
}
