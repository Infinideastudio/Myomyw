# Legacy oracle

`GameNode.js` is an unmodified copy of the Beta 0.8 rules implementation
(`client/src/GameNode.js` at commit `a38f32e`); `definitions.js` is the
relevant excerpt of `client/src/definitions.js`. They are loaded in a sandbox
by `../legacy.ts` and used by `../equivalence.test.ts` to prove that the
TypeScript rules engine behaves exactly like the original. Do not edit them.
