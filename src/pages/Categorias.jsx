import { useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import {
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  Cartao,
  Confirmacao,
  Entrada,
  Folha,
  Segmentado,
  Vazio,
} from '../components/ui'
import { mensagemDeErro } from '../lib/supabase'
import { useDados } from '../store/dataStore'
import { useUI } from '../store/uiStore'

const ICONES = [
  '🍽️', '🛒', '🚗', '🏠', '💡', '🏥', '📚', '🎉', '👕', '💇',
  '🐶', '🎁', '✈️', '📱', '💳', '🛠️', '📦', '💰', '💼', '📈',
  '🔁', '✨', '⛽', '🎮', '☕', '🍺', '🏋️', '🚌', '💊', '🧾',
]

// Mesma paleta validada para daltonismo usada nas categorias padrão.
const CORES = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4',
  '#008300', '#4a3aa7', '#e34948', '#256abf', '#d95926',
  '#9085e9', '#c98500', '#d55181', '#199e70', '#898781',
]

export function Categorias() {
  const categorias = useDados((s) => s.categorias)
  const [tipo, setTipo] = useState('expense')
  const [editando, setEditando] = useState(null)

  const lista = categorias.filter((c) => c.kind === tipo && !c.archived)
  const arquivadas = categorias.filter((c) => c.kind === tipo && c.archived)

  return (
    <>
      <CabecalhoVoltar
        titulo="Categorias"
        acao={
          <BotaoIcone
            nome="mais"
            rotulo="Nova categoria"
            onClick={() => setEditando({ kind: tipo })}
          />
        }
      />

      <div className="space-y-4 p-4">
        <Segmentado
          opcoes={[
            { valor: 'expense', rotulo: 'Despesas' },
            { valor: 'income', rotulo: 'Receitas' },
          ]}
          valor={tipo}
          aoMudar={setTipo}
        />

        {lista.length === 0 ? (
          <Vazio
            icone="filtro"
            titulo="Nenhuma categoria"
            acao={<Botao onClick={() => setEditando({ kind: tipo })}>Criar categoria</Botao>}
          />
        ) : (
          <Cartao className="p-2">
            <div className="grid grid-cols-3 gap-2">
              {lista.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEditando(c)}
                  className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors
                    active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                    style={{ background: `${c.color}22` }}
                  >
                    {c.icon}
                  </span>
                  <span className="w-full truncate text-center text-xs">{c.name}</span>
                </button>
              ))}
            </div>
          </Cartao>
        )}

        {arquivadas.length > 0 && (
          <Cartao className="p-2">
            <p className="px-2 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Arquivadas
            </p>
            <div className="grid grid-cols-3 gap-2 opacity-60">
              {arquivadas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEditando(c)}
                  className="flex flex-col items-center gap-1.5 rounded-xl p-3"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-xl dark:bg-slate-800">
                    {c.icon}
                  </span>
                  <span className="w-full truncate text-center text-xs">{c.name}</span>
                </button>
              ))}
            </div>
          </Cartao>
        )}
      </div>

      {editando && <FolhaCategoria categoria={editando} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function FolhaCategoria({ categoria, aoFechar }) {
  const salvarCategoria = useDados((s) => s.salvarCategoria)
  const excluirCategoria = useDados((s) => s.excluirCategoria)
  const mostrarToast = useUI((s) => s.mostrarToast)
  const editando = Boolean(categoria.id)

  const [form, setForm] = useState({
    name: categoria.name ?? '',
    kind: categoria.kind ?? 'expense',
    icon: categoria.icon ?? '📦',
    color: categoria.color ?? '#2a78d6',
    archived: categoria.archived ?? false,
  })
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async () => {
    if (!form.name.trim()) return setErro('Dê um nome à categoria.')
    setSalvando(true)
    try {
      await salvarCategoria({ ...categoria, ...form })
      mostrarToast('Categoria salva.', 'sucesso')
      aoFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    try {
      await excluirCategoria(categoria.id)
      mostrarToast('Categoria excluída.', 'sucesso')
      aoFechar()
    } catch (e) {
      mostrarToast(
        mensagemDeErro(e).includes('lançamento')
          ? 'Esta categoria já foi usada. Arquive-a em vez de excluir.'
          : mensagemDeErro(e),
        'erro'
      )
    }
  }

  return (
    <>
      <Folha
        aberta
        aoFechar={aoFechar}
        titulo={editando ? 'Editar categoria' : 'Nova categoria'}
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
            <Botao tamanho="lg" className="flex-1" onClick={salvar} carregando={salvando}>
              Salvar
            </Botao>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: `${form.color}22` }}
            >
              {form.icon}
            </span>
            <Campo rotulo="Nome" className="flex-1">
              <Entrada
                value={form.name}
                onChange={(e) => mudar('name', e.target.value)}
                placeholder="Ex.: Delivery"
                autoFocus={!editando}
              />
            </Campo>
          </div>

          {!editando && (
            <Segmentado
              opcoes={[
                { valor: 'expense', rotulo: 'Despesa' },
                { valor: 'income', rotulo: 'Receita' },
              ]}
              valor={form.kind}
              aoMudar={(v) => mudar('kind', v)}
            />
          )}

          <Campo rotulo="Ícone">
            <div className="grid grid-cols-8 gap-1.5">
              {ICONES.map((i) => (
                <button
                  key={i}
                  onClick={() => mudar('icon', i)}
                  className={`flex h-10 items-center justify-center rounded-lg text-lg transition-colors ${
                    form.icon === i ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </Campo>

          <Campo
            rotulo="Cor"
            dica="Cores da paleta testada para daltonismo — a mesma usada nos gráficos."
          >
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button
                  key={c}
                  onClick={() => mudar('color', c)}
                  aria-label={`Cor ${c}`}
                  className={`h-9 w-9 rounded-full ${
                    form.color === c
                      ? 'ring-2 ring-slate-900 ring-offset-2 dark:ring-white dark:ring-offset-slate-950'
                      : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Campo>

          {editando && (
            <Segmentado
              opcoes={[
                { valor: false, rotulo: 'Ativa' },
                { valor: true, rotulo: 'Arquivada' },
              ]}
              valor={form.archived}
              aoMudar={(v) => mudar('archived', v)}
            />
          )}

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
        </div>
      </Folha>

      <Confirmacao
        aberta={confirmarExclusao}
        titulo="Excluir categoria?"
        mensagem="Só funciona se ela nunca foi usada. Categorias com histórico devem ser arquivadas."
        textoConfirmar="Excluir"
        perigo
        aoConfirmar={excluir}
        aoFechar={() => setConfirmarExclusao(false)}
      />
    </>
  )
}
