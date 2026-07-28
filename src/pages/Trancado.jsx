import { useCallback, useEffect, useState } from 'react'
import { Icone } from '../components/Icone'
import { autenticarComBiometria, biometriaAtiva, verificarPin } from '../lib/pin'
import { useAuth } from '../store/authStore'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'apagar']

export function Trancado() {
  const destrancar = useAuth((s) => s.destrancar)
  const sair = useAuth((s) => s.sair)
  const perfil = useAuth((s) => s.perfil)

  const [digitos, setDigitos] = useState('')
  const [errou, setErrou] = useState(false)
  const temBiometria = biometriaAtiva()

  const tentarBiometria = useCallback(async () => {
    try {
      if (await autenticarComBiometria()) destrancar()
    } catch {
      // Cancelar o Face ID é uma ação normal do usuário, não um erro para
      // mostrar na tela — ele simplesmente digita o PIN.
    }
  }, [destrancar])

  // Oferece a biometria assim que a tela abre: é o caminho de um toque só.
  useEffect(() => {
    if (temBiometria) tentarBiometria()
  }, [temBiometria, tentarBiometria])

  useEffect(() => {
    if (digitos.length !== 6) return

    let ativo = true
    verificarPin(digitos).then((correto) => {
      if (!ativo) return
      if (correto) {
        destrancar()
      } else {
        setErrou(true)
        // Limpa depois da animação de erro, para o balanço ser percebido.
        setTimeout(() => {
          if (ativo) {
            setDigitos('')
            setErrou(false)
          }
        }, 450)
      }
    })

    return () => {
      ativo = false
    }
  }, [digitos, destrancar])

  const teclar = (tecla) => {
    if (errou) return
    if (tecla === 'apagar') return setDigitos((d) => d.slice(0, -1))
    if (tecla === 'bio') return tentarBiometria()
    setDigitos((d) => (d.length < 6 ? d + tecla : d))
  }

  // Teclado físico também funciona — útil quando o app é aberto no desktop.
  useEffect(() => {
    const aoTeclar = (e) => {
      if (/^[0-9]$/.test(e.key)) teclar(e.key)
      else if (e.key === 'Backspace') teclar('apagar')
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-slate-950 px-6 py-10 text-white pt-safe pb-safe">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800">
          <Icone nome="cadeado" tamanho={26} className="text-brand-400" />
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold">Olá, {perfil?.display_name ?? 'você'}</p>
          <p className="mt-0.5 text-sm text-slate-400">
            {errou ? 'PIN incorreto' : 'Digite seu PIN para continuar'}
          </p>
        </div>

        <div className={`flex gap-3 ${errou ? 'animate-shake' : ''}`} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full transition-colors ${
                errou
                  ? 'bg-rose-500'
                  : i < digitos.length
                    ? 'bg-brand-400'
                    : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {TECLAS.map((tecla) => {
          if (tecla === 'bio' && !temBiometria) return <span key={tecla} />
          return (
            <button
              key={tecla}
              onClick={() => teclar(tecla)}
              aria-label={
                tecla === 'bio' ? 'Usar biometria' : tecla === 'apagar' ? 'Apagar' : tecla
              }
              className="flex h-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl
                font-medium transition-colors active:bg-slate-800"
            >
              {tecla === 'bio' ? (
                <Icone nome="digital" tamanho={26} className="text-brand-400" />
              ) : tecla === 'apagar' ? (
                <Icone nome="esquerda" tamanho={24} />
              ) : (
                tecla
              )}
            </button>
          )
        })}
      </div>

      <button onClick={sair} className="mt-6 text-sm text-slate-500">
        Sair da conta
      </button>
    </div>
  )
}
