# Implementation notes

A core goal of this decorators proposal is to be implementation-friendly, both to tooling and to end-to-end JS implementations. This file contains some rough notes on how implementations might be organized. If you work on a JavaScript implementation of any kind, and you see any issues with this proposal or approach, please [file an issue](https://github.com/tc39/proposal-decorators/issues/new).

Decorators are specified as if they execute entirely at runtime. However, the limited expressiveness of user-defined decorators means that it's always predicable, if you've parsed all of the imported decorators, which built-in decorators the user-defined decorator ends up expanding out into. This property can be taken advantage of by implementations in varied ways.

## Transpiler implementations

Nicolò Ribaudo has written [notes](https://hackmd.io/44ErLPn8Qi6FshyoTcrXcA?view#) about a possible implementation strategy for Babel. To summarize:
- An additional file format, `.decorators.json`, would summarize what built-in decorators each exported decorator boils down to. This would be made available to the importing module, when transpiling.
- A runtime representation of decorators also has to exist, including name-mangled functions which execute these and can be imported by other modules.

If possible, it would be great to agree on common formats for these two items among tooling. If consensus can be reached among participating tooling implementations, the intention would be that IMPLNOTES.md will eventually contains a description of this shared format.

### Better code generation through custom decorators in transpilers

Even before further decorators are standard, transpilers can include the implementations of additional, tool-defined built-in decorators (which we could call "custom decorators"). Sometimes, these could add more fundamental capabilities; other times, they could do the same sort of thing as is possible with standard built-in decorators, but in a more fixed way. For example, the `@tracked` decorator could be implemented in a tool to convert directly to a getter/setter pair, with a "fallback" definition based on `@register`. Such decorators could also be explained specially to type systems, tree shaking, etc.

## Native implementations

The goal for native implementations is to permit the JS engine to see which built-in decorators are being called *when generating bytecode*. The challenge is how to see that when they may be imported from other modules.

Native JavaScript implementations, e.g., in web browsers or Node.js, doesn't have the luxury of asking for additional `.decorators.json` files, but on the other hand, they do see the entire module graph that's being executed. The only catch is, without built-in decorators, bytecode can be produced for the module graph in a "top-down" fashion (parsing and producing bytecode for a module while simultaneously scanning for imports, and firing off network fetches for them), whereas this strategy does not work with imported decorators: The file that is being imported from needs to be available in order to understand which built-in decorators are ultimately used from the user-defined decorator.

When such a case occurs, implementations may have to fall back from "parsing" to merely "pre-parsing"--that is, the process of generating bytecode would need to wait when an unknown user-defined decorator occurs, and instead, the code would need to be re-parsed to generate bytecode when the decorators are known. (If some bytecode has already been generated, and then an unknown user-defined decorator is encountered, then some bytecode may need to be thrown away.) By the time code is executing, the imported modules will be available, so it should be clear which built-in decorators are being called. On subsequent executions, the bytecode may be reused.
