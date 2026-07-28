import { useMemo, useState } from 'react'
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
import { useRecorrentes } from '../hooks/useRecorrentes'
import { hojeISO } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { mensagemDeErro } from '../lib/supabase'
import { useDados } from '../store/dataStore'
import { useUI } from '../store/uiStore'

export function Recorrentes() {
  const { regras, carregando, salvar, excluir } = useRecorrentes()
  const [editando, setEditando] = useState(null)

  const totalMensal = regras
    .filter((r) => r.active && r.kind === 'expense')
    .reduce((a, r) => a + r.amount_cents, 0)

  return (
    <>
      <CabecalhoVoltar
        titulo="Contas recorrentes"
        subtitulo={totalMensal ? `${formatBRL(totalMensal)} por mês` : undefined}
        acao={<BotaoIcone nome="mais" rotulo="Nova recorrente" onClick={() => setEditando({})} />}
      />

      <div className="space-y-4 p-4">
        <Aviso tipo="info">
          Todo mês o app lança estas contas automaticamente como <strong>previstas</strong>. Elas
          não entram no saldo até você marcar como pagas.
        </Aviso>

        {carregando ? null : regras.length === 0 ? (
          <Vazio
            icone="repetir"
            titulo="Nenhuma conta recorrente"
            mensagem="Cadastre aluguel, assinaturas e mensalidades para não precisar lançar tudo mês a mês."
            acao={<Botao onClick={() => setEditando({})}>Cadastrar</Botao>}
          />
        ) : (
          <Cartao className="divide-y divide-slate-200 p-0 dark:divide-slate-800">
            {regras.map((r) => (
              <button
                key={r.id}
                onClick={() => setEditando(r)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors
                  active:bg-slate-100 dark:active:bg-slate-800 ${r.active ? '' : 'opacity-50'}`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ background: `${r.categories?.color ?? '#64748b'}22` }}
                >
                  {r.categories?.icon ?? '🔁'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {r.description || r.categories?.name}
                    </span>
                    {!r.active && <Etiqueta>pausada</Etiqueta>}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    todo dia {r.day_of_month} · {r.accounts?.name}
                  </span>
                </span>
                <span
                  className={`tabular shrink-0 text-sm font-semibold ${
                    r.kind === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatBRL(r.amount_cents)}
                </span>
                <Icone nome="direita" tamanho={16} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </Cartao>
        )}
      </div>

      {editando && (
        <FolhaRecorrente
          regra={editando}
          aoSalvar={salvar}
          aoExcluir={excluir}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  )
}

function FolhaRecorrente({ regra, aoSalvar, aoExcluir, aoFechar }) {
  const todasContas = useDados((s) => s.contas)
  const todasCategorias = useDados((s) => s.categorias)
  const contas = useMemo(() => todasContas.filter((c) => !c.archived), [todasContas])
  const categorias = useMemo(
    () => todasCategorias.filter((c) => !c.archived),
    [todasCategorias]
  )
  const mostrarToast = useUI((s) => s.mostrarToast)
  const editando = Boolean(regra.id)

  const [form, setForm] = useState({
    kind: regra.kind ?? 'expense',
    amount_cents: regra.amount_cents ?? 0,
    description: regra.description ?? '',
    account_id: regra.account_id ?? contas[0]?.id ?? '',
    category_id: regra.category_id ?? '',
    day_of_month: regra.day_of_month ?? 5,
    start_date: regra.start_date ?? hojeISO(),
    end_date: regra.end_date ?? '',
    active: regra.active ?? true,
  })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))
  const categoriasDoTipo = categorias.filter((c) => c.kind === form.kind)

  const confirmar = async () => {
    if (!form.amount_cents) return setErro('Informe o valor.')
    if (!form.category_id) return setErro('Escolha a categoria.')
    if (!form.account_id) return setErro('Escolha a conta.')

    setSalvando(true)
    try {
      await aoSalvar({ ...regra, ...form })
      mostrarToast('Conta recorrente salva.', 'sucesso')
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
        titulo={editando ? 'Editar recorrente' : 'Nova conta recorrente'}
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
          <Segmentado
            opcoes={[
              { valor: 'expense', rotulo: 'Despesa' },
              { valor: 'income', rotulo: 'Receita' },
            ]}
            valor={form.kind}
            aoMudar={(v) => {
              mudar('kind', v)
              mudar('category_id', '')
            }}
          />

          <CampoValor valor={form.amount_cents} aoMudar={(v) => mudar('amount_cents', v)} />

          <Campo rotulo="Descrição">
            <Entrada
              value={form.description}
              onChange={(e) => mudar('description', e.target.value)}
              placeholder="Ex.: Aluguel"
              maxLength={120}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Categoria">
              <Selecao
                value={form.category_id}
                onChange={(e) => mudar('category_id', e.target.value)}
              >
                <option value="">Escolha…</option>
                {categoriasDoTipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </Selecao>
            </Campo>

            <Campo rotulo="Conta">
              <Selecao value={form.account_id} onChange={(e) => mudar('account_id', e.target.value)}>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </Selecao>
            </Campo>
          </div>

          {/* Limitado a 28 para a regra funcionar igual em fevereiro — a
              restrição existe também no banco. */}
          <Campo rotulo="Todo dia" dica="De 1 a 28, para valer em todos os meses.">
            <Entrada
              type="number"
              min={1}
              max={28}
              inputMode="numeric"
              value={form.day_of_month}
              onChange={(e) => mudar('day_of_month', Number(e.target.value))}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Começa em">
              <Entrada
                type="date"
                value={form.start_date}
                onChange={(e) => mudar('start_date', e.target.value)}
              />
            </Campo>
            <Campo rotulo="Termina em" dica="Opcional">
              <Entrada
                type="date"
                value={form.end_date ?? ''}
                onChange={(e) => mudar('end_date', e.target.value)}
              />
            </Campo>
          </div>

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
        titulo="Excluir recorrente?"
        mensagem="Os lançamentos já criados por ela permanecem — só a regra deixa de gerar novos."
        textoConfirmar="Excluir"
        perigo
        aoConfirmar={async () => {
          await aoExcluir(regra.id)
          mostrarToast('Recorrente excluída.', 'sucesso')
          aoFechar()
        }}
        aoFechar={() => setConfirmarExclusao(false)}
      />
    </>
  )
}
