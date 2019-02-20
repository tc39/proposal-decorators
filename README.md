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

In the above example, the *composed decorator* `@logged` is defined to expand out into a call of the `@wrap` decorator with a particular fixed callback.

### `@defineElement`

[HTML Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) lets you define your own HTML element. Elements are registered using `customElements.define`. Using decorators, the registration can happen up-front:

```mjs
import { @defineElement } from "./defineElement.mjs";

@defineElement('my-class')
class MyClass extends HTMLElement { }
```

The `@defineElement` decorator is based on the `@register` decorator. This decorator is called when the class is finished being defined, and it calls the provided callback with the class that resulted.

```mjs
// defineElement.mjs
export const @defineElement = @(name, options) => @register(klass => customElements.define(name, klass, options));
```

This example uses a *decorator arrow function* `@(args) => @decorators` which lets a decorator definition take arguments that can be used to supply arguments to other decorators in its definition. 

### `@metadata`

The `@metdata(key, value)` decorator is similar to [`@Reflect.metadata`](https://github.com/rbuckton/reflect-metadata): It allows the storage and retrieval of information 

```mjs
import { @metadata } from "./metadata.mjs";

// partially apply the decorator locally for terseness
const @localMeta = @metadata("key", "value");

@localMeta class C {
  @localMeta method() { }
}

Reflect.getMetadata(C, "key");                      // "value"
Reflect.getMetadata(C.prototype, "key", "method");  // "value"
```

`@metadata` can also be defined in terms of `@register`. When `@register` is used with a public field, method or accessor, it is called with the second argument being the property key of that class eleemnt.

```mjs
// metadata.mjs
import "reflect-metadata";

export const @metadata = @(key, value) =>
    @register((target, prop) => Reflect.defineMetadata(key, value, target, prop));
```

### `@frozen`

The `@frozen` decorator freezes the constructor and its `prototype` so that they cannot be mutated after the class is defined. It leaves instances mutable. Example usage:

```mjs
import { @frozen } from "./frozen.mjs";

@frozen
class MyClass {
  method() { }
}

MyClass.method = () => {};            // TypeError to add a method
MyClass.prototype.method = () => {};  // TypeError to overwrite a method
MyClass.prototype.method.foo = 1;     // TypeError to mutate a method
```

`@frozen` is implemented with the `@register` decorator, which allows a callback to be scheduled after the class is created. The callback is passed the class as an argument.

```mjs
// frozen.mjs
export const @frozen = @register(klass => {
  Object.freeze(klass);
  for (const [key, value] of Object.entries(klass)) {
    Object.freeze(value);
  }
  for (const [key, value] of Object.entries(klass.prototype)) {
    Object.freeze(value);
  }
});
```

### `@set`

The `@set` decorator makes a class field declaration behave as a setting a property when it's called, rather than as `Object.defineProperty`. In particular, setters will be called with a normal property set, whereas `Object.defineProperty` just clobbers setters without calling them. For example:

```mjs
class SuperClass {
  set x(value) { console.log(value); }
}

class SubClassA extends SuperClass {
  x = 1;
}

class SubClassB extends SuperClass {
  @set x = 1;
}

const a = new SubClassA();  // does not log anything
a.x;                        // 1

const b = new SubClassB();  // logs 1
b.x;                        // undefined
```

The `@set` decorator is implemented with `@initialize`, which can decorate public fields. `@initialize` takes a callback as an argument, which is called after the field initializer is evaluated, 

```mjs
// set.mjs

export const @set = @initialize(function(value, key) { this[key] = value });
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

`@tracked` is defined in terms of the combination of two built-in decorators that we've seen before above. `@initialize` is used to replace the property definition with setting a property which stores the underlying data. `@register` is used to define a getter/setter pair which is used when accessing the property.

```mjs
// tracked.mjs

export const @tracked =
  @initialize(function(value, name) { this[`__internal_${name}`] = value; })
  @register((target, name) => {
    Object.defineProperty(target, "name", {
      get() { return this[`__internal_${name}`]; },
      set() { this[`__internal_${name}`] = value; this.render(); },
      configurable: true
    });
  });
```

Note, further built-in decorators as in [NEXTBUILTINS.md](./NEXTBUILTINS.md) may provide a more direct and statically analyzable way to implement `@tracked` and avoid the use of `Object.defineProperty`. This version unfortunately relies on metaprogramming when the class is defined.

### `@bound`

The `@bound` decorator makes a method auto-bound: it will carry around the original `this` value when accessed as `this.method` and not immediately called. This behavior matches Python's semantics, and it's been found useful in the React ecosystem, which makes frequent use of passing functions around. Example usage:

```mjs
class Foo {
  x = 1;

  @bound method() { console.log(this.x); }

  queueMethod() { setTimeout(this.method, 1000); }
}

new Foo().queueMethod();  // will log 1, rather than undefined
```

One possible implementation, based on `@register`:

```mjs
// bound.mjs
export const @bound = @register((target, name) => {
  const method = target[name];
  Object.defineProperty(target, name, {
    get() {
      const bound = method.bind(this);
      Object.defineProperty(this, name, { value: bound, configurable: true });
    }
    configurable: true
  });
})
```

There are various appraoches to writing an auto-bound decorator, but ultimately, the most efficient way may be built into the JavaScript engine; see [NEXTBUILTINS.md](./NEXTBUILTINS.md) for discussion of a built-in `@bound` decorator, and the [bound-decorator](https://github.com/mbrowne/bound-decorator) repository for another approach.

### Combined example

Some of the above examples could be combined to form a mini-framework, to make it easier to write HTML Custom Elements.

```mjs
import { @set } from "./set.mjs";
import { @tracked } from "./tracked.mjs";
import { @bound } from "./bound.mjs";
import { @defineElement } from "./defineElement.mjs";

@defineElement('counter-widget')
class CounterWidget extends HTMLElement {
  @tracked x = 0;

  @set onclick = this.clicked;

  @bound clicked() { this.x++; }

  connectedCallback() { this.render(); }

  render() { this.textContent = this.x.toString(); }
}
```

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
