import { useMemo, useState } from 'react'
import { Cabecalho } from '../components/AppShell'
import { LinhaOrcamento } from '../components/graficos'
import { SeletorMes } from '../components/SeletorMes'
import {
  Aviso,
  Botao,
  Campo,
  CampoValor,
  Cartao,
  Esqueleto,
  Folha,
  Selecao,
  TituloSecao,
  Vazio,
} from '../components/ui'
import { useOrcamentos } from '../hooks/useOrcamentos'
import { useTransacoes } from '../hooks/useTransacoes'
import { chaveMes } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { calcularOrcamentos, projetarGasto } from '../lib/resumo'
import { mensagemDeErro } from '../lib/supabase'
import { useDados } from '../store/dataStore'
import { useUI } from '../store/uiStore'

export function Orcamentos() {
  const mes = useUI((s) => s.mes)
  const mostrarToast = useUI((s) => s.mostrarToast)
  const todasCategorias = useDados((s) => s.categorias)
  const categorias = useMemo(
    () => todasCategorias.filter((c) => c.kind === 'expense' && !c.archived),
    [todasCategorias]
  )

  const { orcamentos, carregando, salvar, copiarDoMesAnterior } = useOrcamentos(mes)
  const { transacoes } = useTransacoes(mes)
  const [editando, setEditando] = useState(null)

  const calculados = useMemo(
    () => calcularOrcamentos(orcamentos, transacoes),
    [orcamentos, transacoes]
  )

  const totalLimite = calculados.reduce((a, o) => a + o.limit_cents, 0)
  const totalGasto = calculados.reduce((a, o) => a + o.gasto, 0)
  const semOrcamento = categorias.filter((c) => !orcamentos.some((o) => o.category_id === c.id))
  const projecao = mes === chaveMes(new Date()) ? projetarGasto(totalGasto) : null

  const copiar = async () => {
    try {
      const quantidade = await copiarDoMesAnterior()
      mostrarToast(
        quantidade ? `${quantidade} orçamentos copiados.` : 'O mês anterior não tinha orçamentos.',
        quantidade ? 'sucesso' : 'info'
      )
    } catch (e) {
      mostrarToast(mensagemDeErro(e), 'erro')
    }
  }

  return (
    <>
      <Cabecalho titulo="Orçamentos">
        <SeletorMes className="justify-center pb-2" />
      </Cabecalho>

      <div className="space-y-5 p-4">
        {carregando ? (
          <Esqueleto className="h-32" />
        ) : calculados.length === 0 ? (
          <Vazio
            icone="alvo"
            titulo="Nenhum orçamento neste mês"
            mensagem="Defina um limite de gasto por categoria e o app avisa quando você chegar perto dele."
            acao={
              <div className="flex flex-col gap-2">
                <Botao onClick={() => setEditando({})}>Criar orçamento</Botao>
                <Botao variante="fantasma" tamanho="sm" onClick={copiar}>
                  Copiar do mês anterior
                </Botao>
              </div>
            }
          />
        ) : (
          <>
            <Cartao>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Total orçado</span>
                <span className="tabular text-xl font-bold">{formatBRL(totalLimite)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Já gasto</span>
                <span
                  className={`tabular font-semibold ${
                    totalGasto > totalLimite
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {formatBRL(totalGasto)}
                </span>
              </div>

              {projecao != null && (
                <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {projecao > totalLimite ? (
                    <>
                      ⚠️ No ritmo atual você fecha o mês em{' '}
                      <strong className="text-rose-600 dark:text-rose-400">
                        {formatBRL(projecao)}
                      </strong>{' '}
                      — {formatBRL(projecao - totalLimite)} acima do orçado.
                    </>
                  ) : (
                    <>
                      No ritmo atual você fecha o mês em{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {formatBRL(projecao)}
                      </strong>
                      , dentro do orçamento.
                    </>
                  )}
                </p>
              )}
            </Cartao>

            <section>
              <TituloSecao
                acao={
                  <button
                    onClick={() => setEditando({})}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400"
                  >
                    + adicionar
                  </button>
                }
              >
                Por categoria
              </TituloSecao>
              <Cartao className="space-y-4">
                {calculados.map((o) => (
                  <LinhaOrcamento
                    key={o.id}
                    orcamento={o}
                    aoClicar={() =>
                      setEditando({ category_id: o.category_id, limit_cents: o.limit_cents })
                    }
                  />
                ))}
              </Cartao>
            </section>
          </>
        )}

        {calculados.length > 0 && semOrcamento.length > 0 && (
          <Aviso tipo="info">
            {semOrcamento.length} categoria{semOrcamento.length > 1 ? 's' : ''} ainda sem limite.
            Você não precisa orçar tudo — comece pelas que mais pesam.
          </Aviso>
        )}
      </div>

      {editando && (
        <FolhaOrcamento
          inicial={editando}
          categorias={categorias}
          orcamentos={orcamentos}
          aoSalvar={salvar}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  )
}

function FolhaOrcamento({ inicial, categorias, orcamentos, aoSalvar, aoFechar }) {
  const mostrarToast = useUI((s) => s.mostrarToast)
  const editandoExistente = Boolean(inicial.category_id)

  const [categoriaId, setCategoriaId] = useState(inicial.category_id ?? '')
  const [limite, setLimite] = useState(inicial.limit_cents ?? 0)
  const [salvando, setSalvando] = useState(false)

  // Ao criar, só ofereço categorias que ainda não têm limite — duas linhas
  // para a mesma categoria no mesmo mês são bloqueadas pelo banco de qualquer
  // forma, e o erro seria confuso.
  const disponiveis = editandoExistente
    ? categorias
    : categorias.filter((c) => !orcamentos.some((o) => o.category_id === c.id))

  const confirmar = async () => {
    if (!categoriaId) return
    setSalvando(true)
    try {
      await aoSalvar(categoriaId, limite)
      mostrarToast(limite ? 'Orçamento salvo.' : 'Orçamento removido.', 'sucesso')
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
      titulo={editandoExistente ? 'Editar orçamento' : 'Novo orçamento'}
      rodape={
        <Botao tamanho="lg" className="w-full" onClick={confirmar} carregando={salvando}>
          Salvar
        </Botao>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Categoria">
          <Selecao
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            disabled={editandoExistente}
          >
            <option value="">Escolha…</option>
            {disponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Limite do mês" dica="Deixe zerado para remover o orçamento desta categoria.">
          <CampoValor valor={limite} aoMudar={setLimite} autoFocus />
        </Campo>

        <div className="flex gap-2">
          {[20000, 50000, 100000, 200000].map((v) => (
            <button
              key={v}
              onClick={() => setLimite(v)}
              className="flex-1 rounded-xl bg-slate-200 py-2 text-xs font-medium text-slate-700
                dark:bg-slate-800 dark:text-slate-300"
            >
              {formatBRL(v)}
            </button>
          ))}
        </div>
      </div>
    </Folha>
  )
}
