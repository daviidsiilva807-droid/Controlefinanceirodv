import { useState } from 'react'
import { Aviso, Botao, Campo, Cartao, Entrada } from '../components/ui'
import { mensagemDeErro } from '../lib/supabase'
import { useAuth } from '../store/authStore'

export function Entrar() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'cadastrar'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const entrar = useAuth((s) => s.entrar)
  const cadastrar = useAuth((s) => s.cadastrar)

  const enviar = async (e) => {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    setEnviando(true)

    try {
      if (modo === 'entrar') {
        await entrar(email.trim(), senha)
      } else {
        const { precisaConfirmarEmail } = await cadastrar({
          email: email.trim(),
          senha,
          nome: nome.trim(),
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

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {aviso && <Aviso tipo="info">{aviso}</Aviso>}

          <Botao type="submit" tamanho="lg" className="w-full" carregando={enviando}>
            {cadastrando ? 'Criar conta' : 'Entrar'}
          </Botao>
        </form>
      </Cartao>

      {/* Sem código de convite: cada conta é isolada e não existe forma de
          juntar duas pessoas nos mesmos dados. */}
      {cadastrando && (
        <p className="px-2 text-center text-xs text-slate-500 dark:text-slate-400">
          Seus lançamentos são só seus. Nenhum outro usuário do app — nem o administrador — consegue
          ver seus valores.
        </p>
      )}

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
