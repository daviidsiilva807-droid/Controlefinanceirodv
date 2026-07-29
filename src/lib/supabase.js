import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Falta de configuração é o erro mais provável na primeira execução, então
 * detectamos aqui e o App mostra uma tela explicando o que fazer — melhor do
 * que um "Failed to fetch" genérico no console.
 */
export const supabaseConfigurado = Boolean(url && anonKey && !url.includes('xxxxx'))

export const supabase = supabaseConfigurado
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

/**
 * Traduz os erros que aparecem de verdade no uso diário. O Supabase responde
 * em inglês e com mensagens técnicas; num app pessoal isso só assusta.
 */
export function mensagemDeErro(erro) {
  if (!erro) return null
  const texto = String(erro.message ?? erro)

  const mapa = [
    ['Invalid login credentials', 'E-mail ou senha incorretos.'],
    ['Email not confirmed', 'Confirme seu e-mail antes de entrar.'],
    ['User already registered', 'Já existe uma conta com este e-mail.'],
    ['Password should be at least', 'A senha precisa ter pelo menos 6 caracteres.'],
    ['Unable to validate email', 'E-mail inválido.'],
    // Os dois erros abaixo têm a MESMA causa e a mesma solução, apesar de
    // parecerem coisas diferentes: a confirmação de e-mail está ligada, então
    // o Supabase tenta enviar uma mensagem a cada cadastro. O serviço embutido
    // do plano grátis limita isso a poucos envios por hora e só entrega para
    // endereços autorizados no projeto — daí o "e-mail inválido" em um
    // endereço perfeitamente válido.
    [
      'email_address_invalid',
      'O Supabase recusou este e-mail. Desligue “Confirm email” em Authentication → Sign In / Providers → Email, no painel do Supabase.',
    ],
    [
      'over_email_send_rate_limit',
      'Limite de envio de e-mails do Supabase atingido. Desligue “Confirm email” em Authentication → Sign In / Providers → Email para não precisar enviar e-mail nenhum.',
    ],
    ['SEM_PERMISSAO', 'Só o administrador pode enviar mensagens.'],
    ['USUARIO_INEXISTENTE', 'Este usuário não existe mais.'],
    ['NAO_AUTENTICADO', 'Sessão expirada. Entre novamente.'],
    ['duplicate key value', 'Já existe um registro com esse nome.'],
    ['violates foreign key', 'Este item está sendo usado em algum lançamento e não pode ser removido.'],
    ['Failed to fetch', 'Sem conexão com a internet.'],
    ['rate limit', 'Muitas tentativas. Aguarde um minuto.'],
  ]

  for (const [chave, amigavel] of mapa) {
    if (texto.includes(chave)) return amigavel
  }
  return texto
}
