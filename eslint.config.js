import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Configuração enxuta de propósito: isto não é um verificador de estilo, é
 * uma rede contra a classe de bug que já derrubou o app duas vezes.
 *
 * O `vite build` NÃO acusa variável indefinida — ele empacota e sobe feliz.
 * O erro só aparece quando o usuário abre a tela, e aí o React derruba a
 * árvore inteira e a página fica EM BRANCO, sem nenhuma mensagem. Foi o que
 * aconteceu com um `casaId` esquecido na migração para contas isoladas.
 *
 * Rode com: npm run checar
 */
export default [
  { ignores: ['dist/**', 'dist-test/**', 'dev-dist/**', 'node_modules/**'] },

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      // A regra que importa: pega `casaId is not defined` antes de virar
      // tela branca no celular de alguém.
      'no-undef': 'error',

      // Hooks chamados condicionalmente ou fora de componente quebram de
      // formas difíceis de diagnosticar.
      'react-hooks/rules-of-hooks': 'error',

      // Dependência faltando em useEffect gera dado velho na tela, que num
      // app financeiro é pior do que erro visível. Aviso, não erro, porque
      // há casos legítimos de omitir.
      'react-hooks/exhaustive-deps': 'warn',

      // Variável não usada costuma ser resto de refatoração — exatamente o
      // rastro que o bug do cartão deixou. Argumentos ficam de fora porque
      // assinatura de callback muitas vezes exige o parâmetro.
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },
]
