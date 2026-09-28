# Legacy oracle

`GameNode.js` is an unmodified copy of the Beta 0.8 rules implementation
(`client/src/GameNode.js` at commit `a38f32e`); `definitions.js` is the
relevant excerpt of `client/src/definitions.js`. They are loaded in a sandbox
by `../legacy.ts` and used by `../engine.test.ts` to prove that the engine
plays by exactly the same rules as the original. Do not edit them.
