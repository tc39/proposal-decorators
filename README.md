# JavaScript Decorators

Stage 2

## Status

Decorators are a JavaScript language feature, proposed for standardization at TC39. Decorators are currently at Stage 2 in TC39's process, indicating that the committee expects them to eventually be included in the standard JavaScript programming language. The decorators champion group is considering a redesign of the proposal, which the rest of this document describes.

## Motivation and use cases

ES6 classes were intentionally minimal, and they don't support some common behaviors needed from classes. Some of these use cases are handled by [class fields](https://github.com/tc39/proposal-class-fields) and [private methods](https://github.com/tc39/proposal-private-methods), but others require some kind of programmability or introspection. Decorators make class declarations programmable.

Decorators are very widely used in JavaScript today through transpilers today. For example, see the documentation of [core-decorators](https://www.npmjs.com/package/core-decorators), [ember-decorators](https://ember-decorators.github.io/ember-decorators/), [Angular](https://medium.com/@madhavmahesh/list-of-all-decorators-available-in-angular-71bdf4ad6976), [Stencil](https://stenciljs.com/docs/decorators/), and [MobX](https://mobx.js.org/refguide/modifiers.html) decorators. 

A few examples of how to implement and use decorators that are a bit more self-contained:

### `@logged`

The `@logged` decorator logs a console message when a method starts and finishes. Many other popular decorators will also want to wrap a function, e.g., `@deprecated`, `@debounce`, `@memoize`, dependency injection, etc.

Usage:

```mjs
import { @logged } from "./logged.mjs";

class C {
  @logged
  method(arg) {
    this.#x = arg;
  }

  @logged
  set #x(value) { }
}

new C().method(1);
// starting method with arguments 1
// starting set #x with arguments 1
// ending set #x
// ending method
```

`@logged` can be implemented in JavaScript in terms of built-in decorators: The `@logged` decorator is defined in terms of the `@wrap` built-in decorator, which takes a function as an argument. The method is passed through this function to get the method which is finally present on the class. `@wrap` is similar to core-decorators' [`@decorate`](https://www.npmjs.com/package/core-decorators#decorate) decorator.

```mjs
// logged.mjs

export const @logged = @wrap(f => {
  const name = f.name;
  function wrapped(...args) {
    console.log(`starting ${name} with arguments ${args.join(", ")}`);
    f.call(this, ...args);
    console.log(`ending ${name}`);
  }
  wrapped.name = name;
  return wrapped;
});
```

### `@tracked`

The `@tracked` decorator turns a public field declaration into a getter/setter pair which triggers a `render()` method when the setter is called. This pattern, or patterns like it, is common in frameworksto avoid extra bookkeeping scattered throughout the application to ask for re-rendering.

```mjs
import { @tracked } from "./tracked.mjs";

class Element {
  @tracked counter = 0;

  increment() { this.counter++; }

  render() { console.log(counter); }
}

const e = new Element();
e.increment();  // logs 1
e.increment();  // logs 2
```

`@tracked` is defined in terms of the combination of two built-in decorators:
- `@initialize` on a field declaration redirects the value of an initializer to a function which is provided, rather than calling `Object.defineProperty`. The function is called with the `this` value being the object under construction, and with two arguments `value` (what the initializer evaluates to, or `undefined` if there was no initializer) and `name` (the property key).
- `@register` on any class element or the class itself schedules a callback to be called once the class is created. The class is passed into this callback. If it's used on a public method or field declaration, the property key is passed in as the second argument.

```mjs
// tracked.mjs

export const @tracked =
  @initialize(function(value, name) { this[`__internal_${name}`] = value; })
  @register((klass, name) => {
    Object.defineProperty(klass.prototype, "name", {
      get() { return this[`__internal_${name}`]; },
      set() { this[`__internal_${name}`] = value; this.render(); },
      configurable: true
    });
  });
```

Note, further built-in decorators as in [NEXTBUILTINS.md](./NEXTBUILTINS.md) may provide a more direct and statically analyzable way to implement `@tracked`. This version unfortunately relies on metaprogramming when the class is defined.

<!-- `@metdata`? `@frozen`? -->

## The idea

A new goal of this proposal: It should be possible for tools and JS engines to understand what's going on with decorators.

Core elements:
- Decorators have `@` as part of their name; `@decorator` names form a separate namespace.
- There's a set of built-in decorators that serve as the basic building blocks.
- Developers to create their own decorators by composing other decorators.
- Decorators cannot be treated as JavaScript values; they may only be applied in classes, composed, exported, imported, etc.

Decorators can only be composed in rather fixed ways, making them more statically analyzable.

## Built-in Decorators

### `@wrap`

### `@register`

### `@initialize`

## Composed Decorators

### `const @decorator` declarations

### Decorator arrow functions

```mjs
const @decorator = @(arg, arg2) => @foo @bar(arg) @baz(arg2);
@decorator(arg, arg2) class C { }
```

### Importing and exporting from modules

## FAQ

### How should I use decorators in transpilers today?

Unfortunately, we're in the classic trap of, "The old thing is deprecated, and the new thing is not ready yet!" For now, best to keep using the old thing.

The decorators champion group would recommend continuing to use Babel "legacy" decorators or TypeScript "experimental" decorators. If you're using decorators today, you're probably already using one of these versions. Note that these decorators depend on "[[Set]] semantics" for field declarations (in Babel, loose mode). We recommend that these tools maintain support for [[Set]] semantics alongisde legacy decorators, until it's possible to transition to the decorators of this proposal.

Babel 7 supports the decorators proposal presented to TC39 in the November 2018 TC39 meeting. It's fine to use these for experimental purposes, but they face significant performance issues, are not yet widely adopted; we don't plan to continue pushing for this proposal in TC39. As such, we recommend against using this version for serious work. In follow-on proposals to add more built-in decorators, we hope to be able to recover the extra functionality that the November 2018 decorators proposal supported.

### How does this proposal compare to other versions of decorators?

#### Syntax changes

#### Comparison with TypeScript "experimental" decorators

#### Comparison with Babel "legacy" decorators

#### Comparison with the previous Stage 2 decorators proposal

### If the Stage 2 decorators didn't work out, why not go back to TS/Babel "legacy" decorators?

- Legacy decorators, when applied to field declarations, depend deeply on the semantics that field initializers call setters. TC39 [concluded](https://github.com/tc39/proposal-class-fields/blob/master/README.md#public-fields-created-with-objectdefineproperty) that, instead, field declarations act like Object.defineProperty. This would mean that 
- Legacy decorators are run as a function, and they don't give any clear path towards being statically analyzable or expandable ahead of the time through tools, or a way to extend them to other possibilities, such as decorating field initializers, private class elements, functions, objects, etc.

### Why prioritize the features of "legacy" decorators, like classes, over other features?

"Legacy" decorators have grown to huge popularity in the JavaScript ecosystem. That proves that they were onto something, and solve a problem that many people are facing. This proposal takes that knowledge and runs with it, building in native support in the JavaScript language. It does so in a way that leaves open the opportunity to use the same syntax for many more different kinds of extensions in the future.

### Could we support decorating objects, parameters, blocks, functions, etc?

Yes! Once we have validated this core approach, the authors of this proposal plan to come back and make proposals for more kinds of decorators. See [NEXTBUILTINS.md](./NEXTBUILTINS.md) for details.

### Will decorators let you access private fields and methods?

This proposal does not include any built-in decorators that would provide the primitives to access private fields or methods (beyond wrapping them). We hope to provide this capability with future built-in decorators. See [NEXTBUILTINS.md](./NEXTBUILTINS.md) for details.

### When are decorators evaluated?

The arguments to a decorator are evaluated inline with class evaluation, just like computed property names.

The built-in decorators take callbacks as arguments, which are scheduled to run later at different times:
- The `@wrap` wrapping function is executed while setting up the class.
- The `@register` callback is executed after the class is created.
- The `@initialize` callback is called just after executing the class initializer (normally, in the constructor).

Whenever there are multiple callbacks, they are executed from "top to bottom, inside to out", regardless of the type or placement of class element. This goes for all three built-in decorators. Here's an example based on `@register`:

```js
const @log = @(msg) => @register(k => { console.log(msg); return k });

@log("a") @log("b")
class C {
  @log("d") @log("e") method() { }

  @log("f") @log("g") static prop;
}
```

This example logs `"e"`, `"d"`, `"g"`, `"f"`, `"b"`, `"a"`.

### How should this new proposal be used in transpilers, when it's implemented?

Unlike previous decorator proposals, decorators in this proposal are not functions or first-class values. This means that, when they are imported from another module, that other module needs to be present in source form, not in transpiled form. The decorators champion group suggests exporting decorators from a separate module, both because this proposal is still under development, and to enable the rest of the package to be distributed in a more optimized form.

### What would the specification look like in detail?

See [PROTOSPEC.md](./PROTOSPEC.md) for the outline of a specification.

### How might this proposal be implemented in transpilers and JS engines?

See [IMPLNOTES.md](./IMPLNOTES.md) for notes on how implementations might be organized.

### Why is decorators taking so long?

We are truly sorry about the delay here. We understand that this causes real problems in the JavaScript ecosystem, and are working towards a solution as fast as we can.

It took us a long time for everyone to get on the same page about the requirements spanning frameworks, tooling and native implementations. Only after pushing hard towards the previous direction did we get real-world experience that it was slow in transpilers and a detailed explanation of how they would be slow in native implementations. 

We are working to develop better communication within TC39 and with the broader JavaScript community so that this sort of problem can be corrected sooner in the future.
