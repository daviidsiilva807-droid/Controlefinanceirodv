/**
 * Bloqueio local do app: PIN de 6 dígitos + biometria (Face ID / digital).
 *
 * SEJA CLARO SOBRE O QUE ISSO É: uma tranca de conveniência. Ela impede que
 * alguém que pegou seu celular já desbloqueado abra o app e veja suas
 * finanças. Ela NÃO criptografa nada e NÃO substitui a autenticação — quem
 * protege os dados de verdade é o login do Supabase mais o RLS no servidor.
 * Um atacante com acesso ao dispositivo e conhecimento técnico contorna isso;
 * o objetivo aqui é o cenário real do dia a dia, não um modelo de ameaça
 * avançado.
 */

const CHAVES = {
  salt: 'cf.pin.salt',
  hash: 'cf.pin.hash',
  credencial: 'cf.bio.cred',
  ultimaAtividade: 'cf.lock.ultima',
}

/** Depois de 5 minutos em segundo plano, pede o PIN de novo. */
export const TEMPO_ATE_TRANCAR_MS = 5 * 60 * 1000

// ------------------------------------------------------------------- base64

const paraBase64Url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const deBase64Url = (texto) => {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
  return Uint8Array.from(binario, (c) => c.charCodeAt(0))
}

// ---------------------------------------------------------------------- PIN

async function derivarHash(pin, salt) {
  // 150 mil rodadas de PBKDF2: um PIN de 6 dígitos tem só 1 milhão de
  // combinações, então sem alongamento de chave o hash cairia em segundos.
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: deBase64Url(salt), iterations: 150_000, hash: 'SHA-256' },
    material,
    256
  )
  return paraBase64Url(bits)
}

export function pinConfigurado() {
  return Boolean(localStorage.getItem(CHAVES.hash))
}

export async function definirPin(pin) {
  const salt = paraBase64Url(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await derivarHash(pin, salt)
  localStorage.setItem(CHAVES.salt, salt)
  localStorage.setItem(CHAVES.hash, hash)
}

export async function verificarPin(pin) {
  const salt = localStorage.getItem(CHAVES.salt)
  const hash = localStorage.getItem(CHAVES.hash)
  if (!salt || !hash) return false
  return (await derivarHash(pin, salt)) === hash
}

export function removerPin() {
  Object.values(CHAVES).forEach((k) => localStorage.removeItem(k))
}

// --------------------------------------------------------------- biometria

export function biometriaDisponivelNoNavegador() {
  return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential)
}

/** O aparelho tem leitor de digital / Face ID utilizável pelo navegador? */
export async function biometriaSuportada() {
  if (!biometriaDisponivelNoNavegador()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function biometriaAtiva() {
  return Boolean(localStorage.getItem(CHAVES.credencial))
}

/**
 * Registra uma passkey no aparelho. Só faz sentido depois que o PIN existe:
 * a biometria é o atalho, o PIN continua sendo o caminho garantido (aparelho
 * novo, dedo molhado, máscara no rosto…).
 */
export async function registrarBiometria(nomeUsuario) {
  const idUsuario = crypto.getRandomValues(new Uint8Array(16))
  const credencial = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Controle Financeiro', id: location.hostname },
      user: {
        id: idUsuario,
        name: nomeUsuario || 'usuario',
        displayName: nomeUsuario || 'Usuário',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // o sensor do próprio aparelho
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })

  if (!credencial) throw new Error('Não foi possível registrar a biometria.')
  localStorage.setItem(CHAVES.credencial, paraBase64Url(credencial.rawId))
  return true
}

/**
 * Pede a biometria. Devolve true se o aparelho confirmou o usuário.
 *
 * A assinatura não é verificada em servidor nenhum — como explicado no topo
 * do arquivo, isto é uma tranca local, não um segundo fator de autenticação.
 */
export async function autenticarComBiometria() {
  const credId = localStorage.getItem(CHAVES.credencial)
  if (!credId) return false

  const assercao = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: deBase64Url(credId) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })
  return Boolean(assercao)
}

export function removerBiometria() {
  localStorage.removeItem(CHAVES.credencial)
}

// ------------------------------------------------------- controle de tempo

export function marcarAtividade() {
  localStorage.setItem(CHAVES.ultimaAtividade, String(Date.now()));
}

export function precisaDestrancar() {
  if (!pinConfigurado()) return false
  const ultima = Number(localStorage.getItem(CHAVES.ultimaAtividade) || 0)
  return Date.now() - ultima > TEMPO_ATE_TRANCAR_MS
}
