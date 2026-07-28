import { useState } from 'react'
import { Aviso, Botao, Campo, Cartao, Entrada } from '../components/ui'
import { mensagemDeErro, supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'

export function Entrar() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'cadastrar'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nomeDaCasa, setNomeDaCasa] = useState(null)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = useAuth((s) => s.entrar)
  const cadastrar = useAuth((s) => s.cadastrar)

  /**
   * Confere o código de convite ANTES do cadastro. O trigger no banco ignora
   * código inválido de propósito (uma exceção lá viraria "Database error
   * saving new user"), então a validação amigável precisa acontecer aqui.
   */
  const conferirCodigo = async (valor) => {
    const limpo = valor.trim().toUpperCase()
    setCodigo(limpo)
    setNomeDaCasa(null)
    if (limpo.length !== 6) return

    const { data } = await supabase.rpc('household_name_for_code', { p_code: limpo })
    setNomeDaCasa(data ?? false)
  }

  const enviar = async (e) => {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    setEnviando(true)

    try {
      if (modo === 'entrar') {
        await entrar(email.trim(), senha)
      } else {
        if (codigo && nomeDaCasa === false) {
          throw new Error('CODIGO_INVALIDO')
        }
        const { precisaConfirmarEmail } = await cadastrar({
          email: email.trim(),
          senha,
          nome: nome.trim(),
          codigoConvite: codigo,
        })
        if (precisaConfirmarEmail) {
          setAviso('Conta criada. Confirme o e-mail que enviamos e depois entre por aqui.')
          setModo('entrar')
        }
      }
    } catch (erroCapturado) {
      setErro(mensagemDeErro(erroCapturado))
    } finally {
      setEnviando(false)
    }
  }

  const cadastrando = modo === 'cadastrar'

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl shadow-lg shadow-brand-600/25">
          📊
        </div>
        <h1 className="text-2xl font-bold">Controle Financeiro</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {cadastrando ? 'Crie sua conta em 30 segundos.' : 'Entre para ver seus lançamentos.'}
        </p>
      </div>

      <Cartao>
        <form onSubmit={enviar} className="space-y-3">
          {cadastrando && (
            <Campo rotulo="Seu nome">
              <Entrada
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como quer ser chamado"
                autoComplete="name"
                required
              />
            </Campo>
          )}

          <Campo rotulo="E-mail">
            <Entrada
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </Campo>

          <Campo rotulo="Senha" dica={cadastrando ? 'Mínimo de 6 caracteres.' : undefined}>
            <Entrada
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              autoComplete={cadastrando ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </Campo>

          {cadastrando && (
            <Campo
              rotulo="Código de convite (opcional)"
              dica={
                nomeDaCasa === null
                  ? 'Se alguém já usa o app e quer dividir os lançamentos com você, peça o código.'
                  : undefined
              }
              erro={nomeDaCasa === false ? 'Código não encontrado.' : undefined}
            >
              <Entrada
                value={codigo}
                onChange={(e) => conferirCodigo(e.target.value)}
                placeholder="A7K2M9"
                maxLength={6}
                // Código é sempre maiúsculo; sem isso o teclado do celular
                // sugere minúsculas e a pessoa acha que errou.
                className="tabular uppercase tracking-widest"
                autoCapitalize="characters"
                autoCorrect="off"
              />
              {nomeDaCasa && (
                <span className="mt-1 block text-xs text-brand-600 dark:text-brand-400">
                  ✓ Você vai entrar em “{nomeDaCasa}”.
                </span>
              )}
            </Campo>
          )}

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {aviso && <Aviso tipo="info">{aviso}</Aviso>}

          <Botao type="submit" tamanho="lg" className="w-full" carregando={enviando}>
            {cadastrando ? 'Criar conta' : 'Entrar'}
          </Botao>
        </form>
      </Cartao>

      <button
        onClick={() => {
          setModo(cadastrando ? 'entrar' : 'cadastrar')
          setErro(null)
          setAviso(null)
        }}
        className="text-center text-sm text-slate-500 dark:text-slate-400"
      >
        {cadastrando ? (
          <>
            Já tem conta? <span className="font-semibold text-brand-600 dark:text-brand-400">Entrar</span>
          </>
        ) : (
          <>
            Primeira vez?{' '}
            <span className="font-semibold text-brand-600 dark:text-brand-400">Criar conta</span>
          </>
        )}
      </button>
    </div>
  )
}
