# Future built-in decorators

The decorators proposal is intentionally minimal: it only includes the kinds of functionality that are popular with TypeScript "experimental" and Babel "legacy" decorators. There is much more that we can do with these building blocks! This document describes some possible future directions.

**Nothing in this document is part of the MVP proposal; they are ideas for possible future proposals.**

## Use-case-driven built-in decorators for classes

A few common patterns for using decorators could have additional built-in support. Some of these would be possible otherwise, but may be more efficient as built-ins; others require additional support which is not exposed through the three basic built-in decorators.

The decorators in this section are not intended to form any sort of orthogonal, minimal base, but rather to solve practical problems. For a more general approach, see the following section.

### `@tracked`

`@tracked` wraps a public or private field with an accessor, so that, after writing to the field, a particular callback is called. As an example:

```js
class C {
  @tracked(f) x;
}
```

would behave as:

```js
class C {
  #x;
  get x() { return this.#x; }
  set x(v) { this.#x = v; f.call(this); }
}
```

### `@bound`

`@bound` makes a method auto-bound. By being built-in, it can have the following advantages over the `@bound` decorator described in the main README:
- Works on private methods, not just public methods.
- Can be applied to the whole class, rather than just a single method, to apply to all methods in the class.
- Can be implemented more efficiently, e.g., maintaining stable object shape, avoiding runtime metaprogramming commands, potentially tying into the object representation or the way that calls are done to make allocation lazier.

### `@metadata`

The `@metadata` decorator described in the main README could be a built-in decorator, making it so that the metadata can be set up all in one go, rather than incrementally, imperatively produced. For example, this could allow the V8 object boilerplate optimization to be used.

### `@accessor`

The `@accessor` decorator creates a getter/setter pair which exposes a private field, method or accessor, as mediated by `get` and `set` callbacks. For example:

```js
class C {
  @accessor(get, set) #x;
}
```

would behave as:

```js
class C {
  #x;
  get x() { return get(this.#x); }
  set x(value) { this.#x = set(value); }
}
```

`@accessor` could be implemented in terms of `@expose` as follows:

```js
decorator @accessor(get, set) {
  @expose((target, name, g, s) => {
    Object.defineProperty(target, name.slice(1), {
      get() { return get(g.call(this)); }
      set(value) { return s.call(this, set(value)); }
    });
  })
}
```

However, as a built-in decorator, `@accessor` avoids the dynamic `Object.defineProperty` and makes the class's shape more predictable and statically analyzable.

## Expressive decorator combinators for classes

TODO(littledan): Document what each of these would actually do and how the descriptors work (apologies for the delay!)

Input descriptors (only some of these will be present, depending on what's going on):

```
{
  kind,
  key,
  placement,
  writable,
  enumerable,
  configurable,
  target,
  method,
  get,
  set,
  initializer,
  storage
}
```

Output descriptors:

```
{
  method,
  get,
  set,
  initializer
}
```

If key is private, it is represented as
```
{
  name: "#foo",
  get,
  set
}
```
with `get` and `set` closing over the underlying storage

`storage` is just `{get,set}`.

- `@registerElement`
- `@wrapElement`
- `@toField`
- `@toMethod`
- `@toGet`
- `@toGetSet`
- `@toSet`
- `@toInitialize`
- `@addStorage`
- `@addInitialize`

Some examples of using this system, which would work equally on public and private fields:

```js
decorator @bound {
  @toField({method} => ({initializer() { return method.bind(this); }}))
}

decorator @tracked(callback) {
  @toGetSet({ storage } => ({
    initialize(value) { storage.set.call(this, value), },
    get() { return storage.get.call(this); }
    set(value) { storage.set.call(this, value); callback.call(this); }
  }))
  @addStorage
}
```

Holes in functionality:
- `@accessor` is only definable through runtime metaprogramming (e.g., from `@register` or `@exposed`)
- `@bound` needs to be annotated to each element and cannot be done at the class level (modulo the "Conditionals, loops" section below)
- Punt to mixins to add other random class elements (except through runtime metaprogramming from `@register`).

## Applying built-in decorators to other syntactic forms

### Functions

`@wrap` would make sense applied to function declarations, and it's what people are usually asking for when they ask for function decorators. This is what Python function decorators do.

As described in [#211](https://github.com/tc39/proposal-decorators/issues/211), for anonymous function expressions (which have an immutable inner binding), the inner function binding would refer to the original, unwrapped, inner function, not the function after wrapping.

`@register` would also make sense on functions, e.g., to record metadata on the function related to it. As with class decorators, `@register` callbacks are called after `@wrap` callbacks.

#### Function hoisting

Function hoisting has long been a difficult to solve problem for decorated functions. Many JavaScript idioms depend on function hoisting, and it would be an unexpected discontinuity if it were not allowed. For example:

```js
element.onclick = handler;

@logged
function handler() { }
```

When evolving the above code sample, it would be annoying if adding the `@logged` decorator suddenly made it so that `handler` was out of scope when it's set as the event handler.

Instead, decorated function declarations are still hoisted to the top of the block. Calls to functions from `@wrap` and `@register` are hoisted along with them.

Note, this means that if the decorator which is called on a function is defined within the same scope, it will be a TDZ since the definition will not yet have been reached. The situation can be handled by defining the decorator in an outer scope or a different module.

### Parameters

[TypeScript parameter decorators](https://www.typescriptlang.org/docs/handbook/decorators.html#parameter-decorators) have functionality similar to the `@register` decorator--it schedules a callback to be called, whose return value is not used. `@register` could be supported on parameters, with the same arguments passed as in TypeScript. `@wrap` could also work for parameters. There are some interesting issues to work out with ordering to work out (e.g., to make sure that parameter decorators can feed into method decorators).

### Object literals

`@wrap` and `@register`, applied to an entire object: either for replacing the object or calling a callback with it.

### Object properties

Similarly, `@initialize`, `@wrap` and `@register` for object properties make sense for individual properties inside an object, with similar semantics to classes.

## Other syntactic forms to decorate

This decorators proposal might be used for more things than just classes, objects and functions, with more functionality than `@wrap`, `@initialize` and `@register`. See [this document](https://github.com/littledan/proposal-reserved-decorator-like-syntax) for some more ideas.

### Blocks

#### `@using`

For resource usage, a block or a variable declaration could be decorated with a built-in `@using` decorator to schedule cleanup actions at the end of the block. This was proposed in the [using statement proposal](https://github.com/tc39/proposal-using-statement), but faced concerns over the use of a contextual keyword. As a decorator, there could also be greater control over the protocol used for cleaning up the object, while also maintaining good ergonomics. For example, the basic decorator provided could include a callback that's called at the end, and user-defined decorators could specialize it in various ways. See [related discussion](https://github.com/littledan/proposal-reserved-decorator-like-syntax#explicit-resource-management).

#### `@register`

Class declarations could contain a block inside of them, offset by the `@register` decorator, along the lines of the [class static blocks](https://github.com/tc39/proposal-class-static-block) proposal. The use of this decorator would clarify the scope, timing, etc. of this block, and be a more evocative name than `static`.

### Labels

A little-known feature of JavaScript is that statements can be labeled. This feature allows breaking/continuing from *outer* loops, or breaking out of a block early. We could make use of this syntax to declare that

#### `@censor:`

The [Function.prototype.toString censorship proposal](https://github.com/domenic/proposal-function-prototype-tostring-censorship) needs a statically analyzable syntax to declare nested code as not visible to Function.prototype.toString. A decorator label could be this syntax. See [previous discussion](https://github.com/littledan/proposal-reserved-decorator-like-syntax#functionprototypetostring-censorship).

#### JavaScript mode switches/assertions

It's not clear whether there is demand for this feature, but a syntax like `@module:` or `@script:` could be at the beginning of a program to assert that it is in module or script mode. Or, `@strict:` could be an alternate syntax to turn on strict mode.

### Numeric literals

The [extended numeric literals proposal](https://github.com/tc39/proposal-extended-numeric-literals) is an attempt to generalize literals like `3n` to other user-defined types. Decorators could be used here, rather than the proposal in that repository to call a runtime function. To be ergonomic and analogous to BigInt, the decorator could come after the numeric literal, e.g., `3@px`.


### Assertions of being a certain element type

Decorators like `@wrap` and `@replace` work on multiple different types of class elements, and so do some of the other decorators listed above. For greater reliability, there could be additional built-in decorators which assert that the thing they are decorating is of a particular type, throwing an exception when used on the wrong thing. (They cannot cause an early error because they may be imported from another module.) As some examples:

- `@assertClass` would assert that it's decorating a class
- `@assertPrivate` would assert that it's decorating a private class element
- `@assertField` would assert that it's decorating a field declaration
- `@assertStatic` would assert that it's decorating something defined on the constructor
- etc.

An alternative would be to make separate decorators for each type, e.g., `@registerClass` vs `@registerMethod`, so that each of these would contain a built-in assertion. However, this alternative is not proposed here, as such a restriction would make decorators both more wordy and less flexible.

## Custom decorators in tooling

Some tools may have a facility for creating custom decorators. This could be based on a macro system, or in the case of something like Babel, could be an AST transform. Custom decorator facilities could be used to prototype potential future built-in decorators, to do optimized code generation, or library/framework-specific transformations. This could fill a related, but slightly different, niche compared to [babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros). See [this document](https://github.com/littledan/proposal-reserved-decorator-like-syntax#custom-code-transforms) for related musings.

## Conditionals, loops

It's a bit far down the rabit hole, but the decorator language could be extended to include "higher order decorators" which could provide conditionals and loops in certain fixed ways. For example, the `@each` decorator on a class could apply another decorator to each element in the class. And a decorator like `@ifField` could apply another decorator if it is decorating a fields. Syntax and semantics TBD, but a driving principle would be that it must remain possible to expand these out *without* looking into JavaScript runtime values.
