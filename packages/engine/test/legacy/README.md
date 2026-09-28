# Legacy oracle

`GameNode.js` is an unmodified copy of the Beta 0.8 rules implementation
(`client/src/GameNode.js` at commit `a38f32e`); `definitions.js` is the
relevant excerpt of `client/src/definitions.js`. They are loaded in a sandbox
by `../legacy.ts` and used by `../engine.test.ts` to prove that pushes and
ball effects work exactly as in the original. Do not edit them.

(The ball odds have changed since Beta 0.8 — see docs/rules.md §3 — so
`getRandomChessman` in `definitions.js` is historical and unused.)
