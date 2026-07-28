import { useEffect, useState } from 'react'
import { CabecalhoVoltar } from '../components/AppShell'
import { Icone } from '../components/Icone'
import { Aviso, Botao, Cartao, Confirmacao, Folha, TituloSecao } from '../components/ui'
import {
  biometriaAtiva,
  biometriaSuportada,
  definirPin,
  pinConfigurado,
  registrarBiometria,
  removerBiometria,
  removerPin,
  verificarPin,
} from '../lib/pin'
import { useAuth } from '../store/authStore'
import { useUI } from '../store/uiStore'

export function Seguranca() {
  const perfil = useAuth((s) => s.perfil)
  const mostrarToast = useUI((s) => s.mostrarToast)

  const [temPin, setTemPin] = useState(pinConfigurado())
  const [temBio, setTemBio] = useState(biometriaAtiva())
  const [bioSuportada, setBioSuportada] = useState(false)
  const [definindoPin, setDefinindoPin] = useState(false)
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)

  useEffect(() => {
    biometriaSuportada().then(setBioSuportada)
  }, [])

  const ativarBiometria = async () => {
    try {
      await registrarBiometria(perfil?.display_name)
      setTemBio(true)
      mostrarToast('Biometria ativada.', 'sucesso')
    } catch {
      // Cancelar o prompt do sistema é comum e não é erro do app.
      mostrarToast('Não foi possível ativar a biometria neste aparelho.', 'erro')
    }
  }

  const desativarBiometria = () => {
    removerBiometria()
    setTemBio(false)
    mostrarToast('Biometria desativada.', 'info')
  }

  const removerTudo = () => {
    removerPin()
    setTemPin(false)
    setTemBio(false)
    mostrarToast('Bloqueio removido.', 'info')
  }

  return (
    <>
      <CabecalhoVoltar titulo="Bloqueio do app" />

      <div className="space-y-5 p-4">
        <Cartao className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              temPin ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
            }`}
          >
            <Icone nome="cadeado" tamanho={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{temPin ? 'App protegido' : 'App desprotegido'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {temPin
                ? 'O PIN é pedido ao abrir e após 5 minutos em segundo plano.'
                : 'Qualquer um que pegar seu celular desbloqueado vê suas finanças.'}
            </p>
          </div>
        </Cartao>

        <section>
          <TituloSecao>PIN de 6 dígitos</TituloSecao>
          <Cartao className="space-y-3">
            <Botao className="w-full" onClick={() => setDefinindoPin(true)}>
              {temPin ? 'Trocar PIN' : 'Criar PIN'}
            </Botao>
            {temPin && (
              <Botao
                variante="fantasma"
                className="w-full text-rose-600 dark:text-rose-400"
                onClick={() => setConfirmarRemocao(true)}
              >
                Remover bloqueio
              </Botao>
            )}
          </Cartao>
        </section>

        {temPin && (
          <section>
            <TituloSecao>Biometria</TituloSecao>
            <Cartao>
              {!bioSuportada ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Este aparelho ou navegador não oferece Face ID / leitor de digital para páginas
                  web. O PIN continua funcionando normalmente.
                </p>
              ) : temBio ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm">
                    <Icone nome="digital" tamanho={18} className="text-brand-600 dark:text-brand-400" />
                    Biometria ativa neste aparelho.
                  </p>
                  <Botao variante="contorno" className="w-full" onClick={desativarBiometria}>
                    Desativar biometria
                  </Botao>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Desbloqueie com Face ID ou digital em vez de digitar o PIN.
                  </p>
                  <Botao className="w-full" icone="digital" onClick={ativarBiometria}>
                    Ativar biometria
                  </Botao>
                </div>
              )}
            </Cartao>
          </section>
        )}

        {/* Esta explicação existe porque a alternativa é o usuário achar que o
            PIN criptografa os dados. Ele não criptografa, e essa confusão é
            perigosa: alguém poderia guardar informação sensível achando que
            está protegida por algo que é só uma tranca de tela. */}
        <Aviso tipo="info">
          <p className="font-medium">O que o PIN protege (e o que não protege)</p>
          <p className="mt-1">
            Ele impede que alguém com seu celular <em>já desbloqueado</em> abra o app e veja seus
            gastos. Ele <strong>não</strong> criptografa nada e não substitui a senha da conta.
          </p>
          <p className="mt-1.5">
            Seus dados ficam protegidos no servidor pelas regras de acesso do Supabase, que só
            liberam os lançamentos da sua casa para quem está logado nela.
          </p>
        </Aviso>
      </div>

      {definindoPin && (
        <FolhaDefinirPin
          trocando={temPin}
          aoConcluir={() => {
            setTemPin(true)
            setDefinindoPin(false)
            mostrarToast('PIN salvo.', 'sucesso')
          }}
          aoFechar={() => setDefinindoPin(false)}
        />
      )}

      <Confirmacao
        aberta={confirmarRemocao}
        titulo="Remover o bloqueio?"
        mensagem="O app vai abrir direto, sem pedir PIN nem biometria."
        textoConfirmar="Remover"
        perigo
        aoConfirmar={removerTudo}
        aoFechar={() => setConfirmarRemocao(false)}
      />
    </>
  )
}

/** Fluxo de 2 ou 3 etapas: (PIN atual →) novo PIN → repetir. */
function FolhaDefinirPin({ trocando, aoConcluir, aoFechar }) {
  const [etapa, setEtapa] = useState(trocando ? 'atual' : 'novo')
  const [valor, setValor] = useState('')
  const [primeiro, setPrimeiro] = useState('')
  const [erro, setErro] = useState(null)

  const avancar = async (digitos) => {
    setErro(null)

    if (etapa === 'atual') {
      if (await verificarPin(digitos)) {
        setEtapa('novo')
      } else {
        setErro('PIN atual incorreto.')
      }
    } else if (etapa === 'novo') {
      setPrimeiro(digitos)
      setEtapa('repetir')
    } else {
      if (digitos === primeiro) {
        await definirPin(digitos)
        aoConcluir()
        return
      }
      setErro('Os PINs não coincidem. Tente de novo.')
      setPrimeiro('')
      setEtapa('novo')
    }
    setValor('')
  }

  useEffect(() => {
    if (valor.length === 6) avancar(valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  const titulos = {
    atual: 'Digite o PIN atual',
    novo: 'Escolha um PIN de 6 dígitos',
    repetir: 'Repita o PIN',
  }

  return (
    <Folha aberta aoFechar={aoFechar} titulo="PIN">
      <div className="flex flex-col items-center gap-6 py-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">{titulos[etapa]}</p>

        <div className={`flex gap-3 ${erro ? 'animate-shake' : ''}`} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full ${
                i < valor.length ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {erro && <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>}

        <div className="grid w-full max-w-xs grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'apagar'].map((tecla, i) =>
            tecla === '' ? (
              <span key={`vazio-${i}`} />
            ) : (
              <button
                key={tecla}
                onClick={() =>
                  setValor((v) =>
                    tecla === 'apagar' ? v.slice(0, -1) : v.length < 6 ? v + tecla : v
                  )
                }
                aria-label={tecla === 'apagar' ? 'Apagar' : tecla}
                className="flex h-14 items-center justify-center rounded-2xl bg-slate-200 text-xl
                  font-medium transition-colors active:bg-slate-300 dark:bg-slate-800
                  dark:active:bg-slate-700"
              >
                {tecla === 'apagar' ? <Icone nome="esquerda" tamanho={22} /> : tecla}
              </button>
            )
          )}
        </div>
      </div>
    </Folha>
  )
}
