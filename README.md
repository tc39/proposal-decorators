# JavaScript Decorators

Stage 2

## Status

Decorators are a JavaScript language feature, proposed for standardization at TC39. Decorators are currently at Stage 2 in TC39's process, indicating that the committee expects them to eventually be included in the standard JavaScript programming language. The decorators champion group is considering a redesign of the proposal as "static decorators", which the rest of this document describes.

## The idea of this proposal

This decorators proposal aims to improve on past proposals by working towards twin goals:
- It should be easy not just to use decorators, but also to write your own.
- Decorators should be fast, both generating good code in transpilers, and executing fast in native JS implementations.

This proposal enables the basic functionality of the JavaScript original decorators proposal (e.g., most of what is available in TypeScript decorators), as well as two additional capabilities of the previous Stage 2 proposal which were especially important: access to private fields and methods, and registering callbacks which are called during the constructor.

Core elements:
- There's a set of **built-in decorators** that serve as the basic building blocks.
  - `@wrap`: Replace a method or the entire class with the return value of a given function
  - `@register`: Call a callback after the class is created
  - `@expose`: Call a callback given functions to access private fields or methods after the class is created
  - `@initialize`: Run a given callback when creating an instance of the class
- Decorators can be **defined in JavaScript by composing** other decorators
  - A `decorator @foo { }` declaration defines a new decorator. These are lexically scoped and can be imported and exported.
  - Decorators cannot be treated as JavaScript values; they may only be applied in classes, composed, exported, imported, etc.
  - As part of this, decorators have `@` as part of their name; `@decorator` names form a separate namespace. `@` 
  - Decorators can only be composed in rather fixed ways, making them more statically analyzable.

This proposal starts minimal, but more built-in decorators would be added over time, adding further capabilities like creating synthetic private names, statically changing the shape of the class, parameter and function decorators, etc.

## Motivation and use cases

ES6 classes were intentionally minimal, and they don't support some common behaviors needed from classes. Some of these use cases are handled by [class fields](https://github.com/tc39/proposal-class-fields) and [private methods](https://github.com/tc39/proposal-private-methods), but others require some kind of programmability or introspection. Decorators make class declarations programmable.

Decorators are very widely used in JavaScript through transpilers today. For example, see the documentation of [core-decorators](https://www.npmjs.com/package/core-decorators), [ember-decorators](https://ember-decorators.github.io/ember-decorators/), [Angular](https://medium.com/@madhavmahesh/list-of-all-decorators-available-in-angular-71bdf4ad6976), [Stencil](https://stenciljs.com/docs/decorators/), and [MobX](https://mobx.js.org/refguide/modifiers.html) decorators.

A few examples of how to implement and use decorators in this proposal:

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

export decorator @logged {
  @wrap(f => {
    const name = f.name;
    function wrapped(...args) {
      console.log(`starting ${name} with arguments ${args.join(", ")}`);
      f.call(this, ...args);
      console.log(`ending ${name}`);
    }
    wrapped.name = name;
    return wrapped;
  })
}
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
export decorator @defineElement(name, options) {
  @register(klass => customElements.define(name, klass, options))
}
```

This example uses a `decorator` declaration with a parameter list, which lets a decorator definition take arguments that can be used to supply arguments to other decorators in its definition.

### `@metadata`

The `@metdata(key, value)` decorator is similar to [`@Reflect.metadata`](https://github.com/rbuckton/reflect-metadata): It allows the easy retrieval of information which was stored by annotating the class. The following examples are written in terms of the Reflect.metadata proposal, but you could imagine storing the metadata in any other form.

```mjs
import { @metadata } from "./metadata.mjs";

// partially apply the decorator locally for terseness
decorator @localMeta { @metadata("key", "value") }

@localMeta class C {
  @localMeta method() { }
}

Reflect.getMetadata(C, "key");                      // "value"
Reflect.getMetadata(C.prototype, "key", "method");  // "value"
```

`@metadata` can also be defined in terms of `@register`. When `@register` is used with a public field, method or accessor, it is called with the second argument being the property key of that class element.

```mjs
// metadata.mjs
import "reflect-metadata";

export decorator @metadata(key, value) {
  @register((target, prop) => Reflect.defineMetadata(key, value, target, prop))
}
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
export decorator @frozen {
  @register(klass => {
    Object.freeze(klass);
    for (const key of Reflect.ownKeys(klass)) {
      Object.freeze(klass[key]);
    }
    for (const key of Reflect.ownKeys(klass.prototype)) {
      Object.freeze(klass.prototype[key]);
    }
  })
}
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

export decorator @set { @initialize(function(value, key) { this[key] = value }) }
```

### `@tracked`

The `@tracked` decorator turns a public field declaration into a getter/setter pair which triggers a `render()` method when the setter is called. This pattern, or patterns like it, is common in frameworks to avoid extra bookkeeping scattered throughout the application to ask for re-rendering.

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

export decorator @tracked {
  @initialize(function(value, name) { this[`__internal_${name}`] = value; })
  @register((target, name) => {
    Object.defineProperty(target, "name", {
      get() { return this[`__internal_${name}`]; },
      set() { this[`__internal_${name}`] = value; this.render(); },
      configurable: true
    });
  })
}
```

Note, further built-in decorators as in [NEXTBUILTINS.md](./NEXTBUILTINS.md#tracked) may provide a more direct and statically analyzable way to implement `@tracked` and avoid the use of `Object.defineProperty`.

### `@bound`

The `@bound` decorator makes a method auto-bound: it will carry around the original `this` value when accessed as `this.method` and not immediately called. This behavior matches Python's semantics, and it's been found useful in the React ecosystem, which makes frequent use of passing functions around. Example usage:

```mjs
import { @bound } from "./bound.mjs";

class Foo {
  x = 1;

  @bound method() { console.log(this.x); }

  queueMethod() { setTimeout(this.method, 1000); }
}

new Foo().queueMethod();  // will log 1, rather than undefined
```

The `@initialize` decorator could be used to ensure that, on construction of a class, a shadowing property of the method bound to the instance is made available. This pattern is similar to a common idiom used in JavaScript directly.

```mjs
// bound.mjs
export decorator @bound {
  @initialize(function(name) { this[name] = this[name].bind(this); })
}
```

There are various approaches to writing an auto-bound decorator, but ultimately, the most efficient way may be built into the JavaScript engine; see [NEXTBUILTINS.md](./NEXTBUILTINS.md#bound) for discussion of a built-in `@bound` decorator. The above approach is basically similar to that found in the [bound-decorator](https://github.com/mbrowne/bound-decorator) repository.

### `@callable`

The `@callable` decorator makes it possible to invoke the class without `new`. When a class decorated with `@callable` is called, its static `call` method is invoked.

```mjs
import { @callable } from "./callable.mjs";

@callable
class MyDate {
  static call(...args) { return Date(...args) }
  constructor(...args) { return new Date(...args) }
}
```

An implementation in terms of `@wrap`:

```mjs
// callable.mjs

decorator @call(callback) {
  @wrap(klass => {
    function subclass(...args) {
      if (new.target === undefined) {
        return callback.call(klass, ...args);
      } else {
        return Reflect.construct(klass, args, new.target);
      }
    }
    subclass.__proto__ = klass;
    subclass.prototype.__proto__ = klass;
    return subclass;
  })
}

export decorator @callable {
  @call(function(...args) { return this.call(...args); })
}
```

Note that a decorator like `@call` could be considered for a future built-in decorator, in a way that avoids creating an additional subclass.

### Limited access to private fields and methods

Sometimes, certain code outside of a class may need to access private fields and methods. For example, two classes may be because a few classes are "collaborating", or test code in a different file needs to reach inside a class.

Decorators can make this possible by giving someone access to a private field or method. This may be encapsulated in a "friend key"--an object which contains these references, to be shared only with who's appropriate.

```mjs
import { FriendKey, @show } from "./friend.mjs"

let key = new FriendKey;

export class Box {
  @show(key) #contents;
}

export function setBox(box, contents) {
  return key.set(box, "#x", contents);
}

export function getBox(box) {
  return key.get(box, "#x");
}
```

This notion of friend keys could be implemented using the `@expose` decorator, which is like `@register`, except it is with four arguments instead of one when applied to private fields and methods:
- The target (either the class or the prototype)
- The private identifier as a string (e.g., `"#x"`)
- A function which gets the private field or method, taking the object as a receiver
- A function which sets the private field or method, taking the object as a receiver

```mjs
export class FriendKey {
  #map = new Map();
  expose(name, get, set) {
    this.#map.set(name, { get, set });
  }
  get(obj, name) {
    return this.#map.get(name).get.call(obj);
  }
  set(obj, name, value) {
    return this.#map.get(name).set.call(obj, value);
  }
}

export decorator @show(key) {
  @expose((target, name, get, set) => key.expose(name, get, set))
}
```

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

## Built-in Decorators

This proposal defines a few built-in decorators that can either be used directly, or can be used as a basis to define other decorators. This section explains how the small set of built-in decorators work, in terms of explaining their effect as translating down to if you weren't using the decorator.

### `@wrap`

The `@wrap` decorator can be used on a method to pass the function through another function. For example,

```js
class C {
  @wrap(f) method() { }
}
```

is roughly equivalent to the following:

```js
class C {
  method() { }
}
C.prototype.method = f(C.prototype.method);
```

`@wrap` can also be used on a class to wrap the entire class.

```js
@wrap(f)
class C { }
```

is roughly equivalent to:

```js
class C { }
C = f(C);
```

Details:
- `@wrap` may be used on private methods as well as public ones, static as well as instance.
- The function is only passed the method, and no other context.
- The return value is used to replace the method or accessor.
- `@wrap` may be used on getters or setters, and applies to these individually.
- `@wrap` may not be used on field declarations, as there's no clear meaning.
- When `@wrap` is used on a class, if there is a use of `C` in a method or field initializer inside the class, it will refer to the original, unwrapped `C. See [#211](https://github.com/tc39/proposal-decorators/issues/211) for details.

### `@register`

The `@register` decorator schedules a callback to run after the class is created.

```js
class C {
  @register(f) method() { }
}
```

is roughly equivalent to

```js
class C {
  method() { }
}
f(C, "method");
```

Details:
- `@register` can be used on any method, field, accessor, or the class as a whole.
- Arguments passed into the callback given to `@register`:
  - First argument: the "target": For static fields and methods, or the class itself, it is the class; for instance fields and methods, it is the class's prototype.
  - Second argument: For public fields, methods or accessors, the property key; for private, or for the class itself, only one argument is passed.
  - Note, there is no third argument; the property descriptor is not passed into the callback, but the callback could look it up itself.
- The return value of the callback must be undefined.
- All `@wrap` callbacks run before all `@register` callbacks. This is because `@wrap` is used to set up the class, and `@register` runs on the class after it's created.

### `@initialize`

The `@initialize` decorator intercepts the initialization of a public class field and runs a callback supplied to the decorator in place of `Object.defineProperty`. For example:

```js
class C {
  @initialize(f) a = b;
}
```

is roughly equivalent to the following:

```js
class C {
  constructor() {
    f.call(this, "a", b);
  }
}
```

When invoked on something which is not a public field, or when used on the left of another `@initialize` decorator on the same public field, the callback is called without the final "value" argument. The other "property key" argument is also omitted when not available. So this becomes simply a way to schedule work. For example:

```js
@initialize(f)
class C { }
```

is roughly equivalent to the following:

```js
class C {
  constructor() {
    f.call(this);
  }
}
```

The return value is checked to be `undefined`.

### `@expose`

The `@expose` decorator is used on a private class element to expose access to get and set it. It's basically like `@register`, except that callbacks are passed into the provided function to access the element. For example:

```js
class C {
  @expose(f) #x;
}
```

would behave as:

```js
class C {
  @register(proto => f(proto,
                       "#x",
                       function() { return this.#x },
                       function(value) { this.#x = value }))
      #x;
}
```

`@expose` could be used as a building block for other decorators creating protected-like visibility, access to private elements for debugging or testing, etc.

`@expose` is separated from `@register` to reduce the risk that the private identifier string `"#x"` will be mistaken for a property key, and to avoid unused allocations of these functions when not needed. Technically speaking, these extra arguments could be passed into `@register` as additional arguments instead, though.

## User-defined Decorators

JavaScript programmers can make their own decorators by composing built-in decorators.

### `decorator @xyz` declarations

Decorators may be defined as a simple composition of other decorators. You can use all the fancy JavaScript features you want inside the arguments, but at the top level, this is just a string of decorators and arguments for these decorators. There's no way to conditionally use one decorator in one situation and another in another situation, for example.

Example:

```js
decorator @xyz {
  @foo @bar(arg) @baz(arg2)
}
@xyz class C { }
```

This is basically equivalent to listing those decorators explicitly:

```js
@foo @bar(arg) @baz(arg2)
class C { }
```

Decorators may also take arguments:

```js
decorator @xyz(arg, arg2) {
  @foo @bar(arg) @baz(arg2)
}
@xyz(1, 2) class C { }
```

This would be equivalent to:

```js
@foo @bar(1) @baz(2)
class C { }
```

Note, omitting the arguments list for a decorator (whether in a definition or usage) is equivalent to an empty arguments list, for `decorator` declarations. It's possible that future built-in decorators or declaration forms would treat them differently, however.

### Semantic details

Decorators can be declared in any lexical scope. They are always declared with `const`. Using a decorator before it's defined leads to a TDZ. Decorators can be imported and exported from modules.

`@` is part of the name of decorators. It's always used right at the beginning, with no whitespace between the `@` and the rest of the name.

Decorators, whether built-in or user-defined, are not JavaScript values--they can only be applied to classes or used in composed decorators.

See further details in [PROTOSPEC.md](./PROTOSPEC.md)

## FAQ

### How should I use decorators in transpilers today?

Unfortunately, we're in the classic trap of, "The old thing is deprecated, and the new thing is not ready yet!" For now, best to keep using the old thing.

The decorators champion group would recommend continuing to use Babel "legacy" decorators or TypeScript "experimental" decorators. If you're using decorators today, you're probably already using one of these versions. Note that these decorators depend on "[[Set]] semantics" for field declarations (in Babel, loose mode). We recommend that these tools maintain support for [[Set]] semantics alongside legacy decorators, until it's possible to transition to the decorators of this proposal.

Babel 7 supports the decorators proposal presented to TC39 in the November 2018 TC39 meeting. It's fine to use these for experimental purposes, but they face significant performance issues, are not yet widely adopted; we don't plan to continue pushing for this proposal in TC39. As such, we recommend against using this version for serious work. In follow-on proposals to add more built-in decorators, we hope to be able to recover the extra functionality that the November 2018 decorators proposal supported.

### How does this proposal compare to other versions of decorators?

#### Syntax changes

On the side of using decorators, this proposal makes several changes compared to previous decorators proposals:
- When importing a decorator from a module, include `@` as part of the name of the decorator; previous proposals excluded the `@` during an import.
- Forms like `@foo.bar` or `@(foo)` are no longer permitted, as decorators are not JavaScript expressions.
- The syntax for defining a decorator is completely different: Rather than a function as in the other decorators proposals, special "composed decorator" syntax is used.

Due to these syntax differences, no code using decorators will "just work" when upgrading from other versions of decorators; a codemod will be required.

#### Comparison with Babel "legacy" decorators

Babel legacy-mode decorators are based on the state of the JavaScript decorators proposal as of 2014. In addition to the syntax changes listed above:
- Babel legacy decorators are a single callback form that handles all of the changes, rather than different callbacks for different built-in decorators.
- Babel legacy decorators pass the property descriptor to the callback, and apply that automatically, whereas `@register` forces you to get and set the property descriptor yourself.

Despite these differences, it should generally be possible to achieve the same sort of functionality with this decorators proposal as with Babel legacy decorators. If you see important missing functionality in this proposal, please file an issue.

#### Comparison with TypeScript "experimental" decorators

TypeScript experimental decorators are largely similar to Babel legacy decorators, so the comments in that section apply as well. In addition:
- This proposal does not include parameter decorators, but they may be provided by future built-in decorators, see [NEXTBUILTINS.md](./NEXTBUILTINS.md).
- TypeScript decorators run all instance decorators before all static decorators, whereas the order of evaluation (for both `@wrap` and `@register`) in this proposal is based on the ordering in the program, regardless of whether they are static or instance.

Despite these differences, it should generally be possible to achieve the same sort of functionality with this decorators proposal as with TypeScript experimental decorators. If you see important missing functionality in this proposal, please file an issue.

#### Comparison with the previous Stage 2 decorators proposal

The previous Stage 2 decorators proposal was more full-featured than this proposal, including:
- Declaring new private fields
- Class decorator access to manipulating all fields and methods within the class
- More flexible handling of the initializer, treating it as a "thunk"
- Changing the shape of the class directly through the decorators API, rather than through mechanisms like `Object.defineProperty`.

These features aren't included in this initial proposal, but they may be provided by future built-in decorators.

The previous Stage 2 decorators proposal was based on a concept of descriptors which stand in for various class elements. Such descriptors do not exist in this proposal, but could be partially revived in future built-in decorators. However, those descriptors gave a bit too much flexibility/dynamism to the class shape in order to be efficiently optimizable; future built-in decorators would add the same functionality in a more statically analyzable way.

### If the Stage 2 decorators didn't work out, why not go back and standardize TS/Babel legacy decorators?

**Path towards features and analyzability**: Legacy decorators are run as a function, and they don't give any clear path towards being statically analyzable or expandable ahead of the time through tools, or a way to extend them to other possibilities, such as decorating field initializers, private class elements, functions, objects, etc.

**Technical infeasibility**: Legacy decorators, when applied to field declarations, depend deeply on the semantics that field initializers call setters. TC39 [concluded](https://github.com/tc39/proposal-class-fields/blob/master/README.md#public-fields-created-with-objectdefineproperty) that, instead, field declarations act like Object.defineProperty. This decision makes many patterns with legacy decorators no longer work.

### Why prioritize the features of "legacy" decorators, like classes, over other features that decorators could provide?

"Legacy" decorators have grown to huge popularity in the JavaScript ecosystem. That proves that they were onto something, and solve a problem that many people are facing. This proposal takes that knowledge and runs with it, building in native support in the JavaScript language. It does so in a way that leaves open the opportunity to use the same syntax for many more different kinds of extensions in the future.

### Why does `@name` have to be used when importing a decorator, rather than `name` as in transpilers?

By including the `@` in the name, decorators are distinguished from ordinary JavaScript values. All defined variables in JavaScript are associated with JavaScript values, which decorators are not.

Using a prefix lets us restrict in how decorators are defined and used. The ordinary JavaScript lexical variable scope permits various kinds of dynamism, e.g., through `with` statements, the global object, and `var` declarations leaking out of eval. By using a prefix, we can define those sources of variability away.

We've found that it's intuitive to have `@` as part of the name of decorators: Most documentation for decorators in practice today treated `@` as if it were part of the name, rather than the syntax for invoking decorators.

As a bonus: The separate namespace for the new, static decorators proposal should also help the transition path from previous transpiler-based decorators proposals: It's easy for tooling to see whether you're referring to a static decorator or not, just by what names it can see in scope.

### Could we support decorating objects, parameters, blocks, functions, etc?

Yes! Once we have validated this core approach, the authors of this proposal plan to come back and make proposals for more kinds of decorators. See [NEXTBUILTINS.md](./NEXTBUILTINS.md#applying-built-in-decorators-to-other-syntactic-forms).

### Will decorators let you access private fields and methods?

Yes: The `@expose` decorator is the core building block for accessing private fields and methods, but it does not allow new private fields or methods to be defined. Further capabilities are discussed in [NEXTBUILTINS.md](./NEXTBUILTINS.md). The focus of this proposal is on the *infrastructure* for built-in and user-defined decorators, and a minimum of functionality is provided.

### When are decorators evaluated?

The arguments to a decorator are evaluated inline with class evaluation, just like computed property names.

The built-in decorators take callbacks as arguments, which are scheduled to run later at different times:
- The `@wrap` wrapping function is executed while setting up the class.
- The `@register` and `@expose` callbacks are executed after the class is created.
- The `@initialize` callback is called just after executing the class initializer (normally, in the constructor).

Whenever there are multiple callbacks, they are executed from "top to bottom, inside to out", regardless of the type or placement of class element. This goes for all three built-in decorators. Here's an example based on `@register`:

```js
decorator @log(msg) { @register(k => { console.log(msg); return k }) }

@log("a") @log("b")
class C {
  @log("d") @log("e") method() { }

  @log("f") @log("g") static prop;
}
```

This example logs `"e"`, `"d"`, `"g"`, `"f"`, `"b"`, `"a"`.

Or, similarly, with `@wrap`:

```js
@wrap(a) @wrap(b)
class C {
  @wrap(d) @wrap(e) method() { }

  @wrap(f) @wrap(g) static m() { }
}
```

would be roughly equivalent to:

```js
class C {
  @wrap(d) @wrap(e) method() { }

  @wrap(f) @wrap(g) static m() { }
}
C.prototype.method = d(e(C.prototype.method));
C.m = f(g(C.m));
C = a(b(C));
```

### How should this new proposal be used in transpilers, when it's implemented?

Unlike previous decorator proposals, decorators in this proposal are not functions or first-class values. This means that, when they are imported from another module, that other module needs to be present in source form, not in transpiled form. The decorators champion group suggests exporting decorators from a separate module, both because this proposal is still under development, and to enable the rest of the package to be distributed in a more optimized form.

### What would the specification look like in detail?

See [PROTOSPEC.md](./PROTOSPEC.md) for the outline of a specification.

### What makes this decorators proposal more statically analyzable than previous proposals?

The decorators in this proposal are statically analyzable in the sense that, if you parse a module and all of its dependencies, it's possible to tell, without executing the program, which built-in decorators are used at any particular place where a decorator is used. The built-in decorators have a relatively fixed effect on the program (e.g., call this function at this place). The arguments to decorators--in the case of built-in decorators, the callbacks that will be called---are based on runtime values that flow through the program, and may differ across multiple runs of the same code, but the structure *around* those callbacks remains the same.

### Doesn't the dynamic nature of arguments negate the static analyzability?

The idea here is, the decorators (statically available) manipulate the shape of the code, and the arguments are plugged into that new shape. For example, the `@register` decorator creates a slot for a function to be called, and the argument is that function that will be called. Future decorators may change the shape of a class directly, e.g., turning a field into a getter/setter pair, while calling out to a function provided in an argument from *within* the getter or setter.

### Some of the above examples used Object.defineProperty. How is this statically analyzable?

It isn't really. The use of `Object.defineProperty` is rather unfortunate, and a compromise in this proposal for minimalism. Future built-in decorators can chip away at the cases where features like this would be used. However:

- **Limited scope of dynamic-ness**: In previous decorators proposals, basically everything had to go through `Object.defineProperty` if any sort of decorator was applied. With this proposal, only decorator definitions which explicitly call `Object.defineProperty` will do it.
- **Framework for making static transformations**: This proposal focuses on creates, for the first time, a new way that the list of transformations can be composed across modules while remaining statically analyzable. This will be a useful extension point for nailing down the details of these transformations and further reducing the use of `Object.defineProperty` over time, whereas previous proposals did not present any such path.

### How does static analyzability help transpilers and other tooling?

Statically analyzable decorators help tooling to generate faster and smaller JavaScript from build tools, enabling the decorators to be transpiled away, without causing extra data structures to be created and manipulated at runtime. It will be easier for tools to understand what's going on, which could help in tree shaking, type systems, etc.

An attempt by LinkedIn to use the previous Stage 2 decorators proposal found that it led to a significant performance overhead. Members of the Polymer and TypeScript team also noticed a significant increase in generated code size with these decorators.

By contrast, this decorator proposal should be compiled out into simply making function calls in particular places, or replacing one class element with another class element. We're working on proving out this benefit by implementing the proposal in Babel, so an informed comparison can be made before propsing for Stage 3.

Another case of static analyzability being useful for tooling was named exports from ES modules. The fixed nature of named imports and exports helps tree shaking, importing and exporting of types, and here, as the basis for the predictable nature of composed decorators. Even though the ecosystem remains in transition from exporting entirely dynamic objects, ES modules have taken root in tooling and found to be useful because, not despite, their more static nature.

See [IMPLNOTES.md](./IMPLNOTES.md#transpiler-implementations) for notes on how transpilers might be organized.

### How does static analyzability help native JS engines?

Although a [JIT](https://en.wikipedia.org/wiki/Just-in-time_compilation) can optimize away just about anything, it can only do so after a program "warms up". That is, when a typical JavaScript engine starts up, it's not using the JIT--instead, it compiles the JavaScript to bytecode and executes that directly. Later, if code is run lots of times, the JIT will kick in and optimize the program.

Studies of the execution traces of popular web applications show that a large proportion of the time starting up the page is often in parsing and execution through bytecode, typically with a smaller percentage running JIT-optimized code. This means that, if we want the web to be fast, we can't rely on fancy JIT optimizations.

Decorators, especially the previous Stage 2 proposal, added various sources of overhead, both for executing the class definition and for using the class, that would make startup slower if they weren't optimized out by a JIT. By contrast, composed decorators always boil down in a fixed way to built-in decorators, which can be handled directly by bytecode generation.

See [IMPLNOTES.md](./IMPLNOTES.md#native-implementations) for notes on how JS engines might implement decorators.

### What happened to coalescing getter/setter pairs?

Given the initial decorator set of `@register`, `@wrap` and `@initialize`, nothing needs coalesced getter/setter pairs, and works just fine decorating individual class elements. Coalescing could be exposed as part of the semantics of a future built-in decorator, invoked only when that decorator is used. The use cases that require coalescing are a bit unclear, but see [issue #256](https://github.com/tc39/proposal-decorators/issues/256) for further discussion. Removing getter/setter coalescing is a relatively large simplification of both the specification and implementations, so all else being equal, we're better off without it.

### Why is decorators taking so long?

We are truly sorry about the delay here. We understand that this causes real problems in the JavaScript ecosystem, and are working towards a solution as fast as we can.

It took us a long time for everyone to get on the same page about the requirements spanning frameworks, tooling and native implementations. Only after pushing hard towards the previous direction did we get real-world experience that it was slow in transpilers and a detailed explanation of how they would be slow in native implementations.

We are working to develop better communication within TC39 and with the broader JavaScript community so that this sort of problem can be corrected sooner in the future.
