import { useEffect, useState } from 'react'
import { Icone } from './Icone'
import { Botao } from './ui'

const CHAVE_DISPENSADO = 'cf.instalar.dispensado'

const ehIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS moderno se identifica como Mac; o toque é o que o denuncia.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const jaInstalado = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

/**
 * Convite para colocar o app na tela inicial.
 *
 * São dois caminhos bem diferentes:
 *
 * - Android/Chrome dispara `beforeinstallprompt`, e aí conseguimos abrir o
 *   diálogo nativo de instalação com um clique.
 * - iOS/Safari NÃO tem esse evento nem banner automático. A única forma é a
 *   pessoa usar Compartilhar → "Adicionar à Tela de Início" na mão, então o
 *   máximo que dá para fazer é ensinar o caminho.
 */
export function DicaInstalar() {
  const [eventoInstalar, setEventoInstalar] = useState(null)
  const [mostrarIOS, setMostrarIOS] = useState(false)

  useEffect(() => {
    if (jaInstalado() || localStorage.getItem(CHAVE_DISPENSADO)) return

    const aoPoderInstalar = (e) => {
      e.preventDefault() // sem isso o Chrome mostra o banner dele por cima
      setEventoInstalar(e)
    }
    window.addEventListener('beforeinstallprompt', aoPoderInstalar)

    if (ehIOS()) setMostrarIOS(true)

    return () => window.removeEventListener('beforeinstallprompt', aoPoderInstalar)
  }, [])

  const dispensar = () => {
    localStorage.setItem(CHAVE_DISPENSADO, '1')
    setEventoInstalar(null)
    setMostrarIOS(false)
  }

  const instalar = async () => {
    if (!eventoInstalar) return
    eventoInstalar.prompt()
    await eventoInstalar.userChoice
    dispensar()
  }

  if (!eventoInstalar && !mostrarIOS) return null

  return (
    <div className="fixed inset-x-3 bottom-28 z-40 mx-auto max-w-md mb-safe">
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-xl dark:border-brand-900 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icone nome="baixar" tamanho={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Instale na tela inicial</p>
            {eventoInstalar ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Abre em tela cheia, como um app de verdade.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Toque em <Icone nome="compartilhar" tamanho={13} className="inline align-[-2px]" />{' '}
                <strong>Compartilhar</strong> na barra do Safari e escolha{' '}
                <strong>“Adicionar à Tela de Início”</strong>.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {eventoInstalar && (
            <Botao tamanho="sm" className="flex-1" onClick={instalar}>
              Instalar
            </Botao>
          )}
          <Botao variante="fantasma" tamanho="sm" className={eventoInstalar ? '' : 'flex-1'} onClick={dispensar}>
            Agora não
          </Botao>
        </div>
      </div>
    </div>
  )
}
