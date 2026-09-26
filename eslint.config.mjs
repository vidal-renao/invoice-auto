import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const config = [
  ...nextVitals,
  ...nextTs,
  // `.claude/` is git-ignored scratch space — agent worktrees land there and
  // are full checkouts of their own. Linting them reported 1291 errors in
  // code that is not part of this project, which made `npm run verify`
  // always fail and therefore worthless.
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '.claude/**',
      'public/sw.js',
      'next-env.d.ts',
    ],
  },
]

export default config
