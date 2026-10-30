# Dependency verification — October 28, 2026

Local source only; not deployed. Tested on Linux with Node 20.19.2 and npm 11.21.1. See package.json for the supported engine range; that range is not a multi-runtime test claim.

## What changed

Vitest 3.2.7 → 4.1.12. Version 4 removes Tinypool and the installed mocker is patched. The app imported only the shadcn CLI package's CSS, so that CSS is now in src/styles, unchanged apart from an attribution comment, alongside the upstream MIT notice. The generator/registry/deepmerge chain is no longer installed. No forced transitive version override was used.

The baseline npm audit listed six affected package entries (including two critical entries), not six independent advisories. The first fresh post-change audit returned zero findings. Audit results change as advisories are published; zero findings does not establish application security.

## Reproduce

From the repository root, without credentials or .env files:

```sh
npm ci
npm audit
npm test
npm run lint
npm run build
npm run typecheck
RECEIPTS_MODE=mock npm run eval
RECEIPTS_MODE=mock npm run demo
```

Open http://127.0.0.1:41731 and follow the README cached-demo steps. Expect labelled cached maps and an empty map for the uncached task. The eval prints 10/10 fixture matches and zero incomplete checks, not live accuracy.

Round 1: fresh install, audit, 135 tests in 12 files, lint, production build, typecheck and cache eval all exited zero. A supplementary reviewer independently ran the tests in shuffled order and cache eval; both passed.

Round 2 used a new source directory and a fresh npm ci. Audit again reported zero findings; all 135 tests passed with shuffled seed 2831, along with lint/build/typecheck and cache eval10/10. Nine browser check groups passed: five maps with exact displayed citation/clipboard comparison, uncached empty map, sample eval, mobile overflow and no page errors/external browser requests. `demo/sarkari-cached-security.mp4` is the actual recorded local walkthrough (34.52 seconds), permanently labelled cached/no-live-provider; full video decode passed. It does not demonstrate a security exploit, live sponsor calls or visual parity pixel-for-pixel.

## Remaining warnings and limits

npm warns that ESLint 9.39.5 is deprecated, and that esbuild/unrs-resolver install scripts are not covered by its allowScripts policy. Installation and build succeeded under the recorded npm version. Different package-manager policies may behave differently. Vite warns about a future native config-loader default and ESM syntax in vitest.config.ts; the current loader works. These warnings were not suppressed. A separate config/tooling migration is preferable to switching the entire application to ESM for a warning.

Do not expose development or test servers to untrusted networks. There is no live provider proof, vulnerability exploit test, multi-OS test or hosted-security sign-off here. The mandated cheap+ review runner is absent; supplementary reviews do not replace it. Submission fields and sponsor eligibility remain unverified.
