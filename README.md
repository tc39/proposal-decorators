# Integrated decorators and fields proposal for JavaScript

Daniel Ehrenberg

This document proposes a combined vision for how the proposed class features could work together--[decorators](https://tc39.github.io/proposal-decorators/), [public fields](https://tc39.github.io/proposal-class-public-fields/) and [private fields](https://github.com/tc39/proposal-private-fields).

In combining the proposals into a unified vision, this document works towards two types of orthogonality:
- All class components can be decorated--methods, fields, accessors, and the class at the top level
- All combinations are supported on the following axes:
  - Visibility: Public vs private
  - Place: static vs instance/prototype
  - Type: Method vs field vs accessor

This document builds on the ideas of the [Orthogonal Classes](https://github.com/erights/Orthogonal-Classes) proposal, which attempts to solve the very real problem of creating a single, unified mental model for new and old class features which provides a sense of continuity and regularity. Like that proposal, not all of this necessarily would ship at once, but this document gives a blueprint of where to go as we do add features.

## Changes from the orthogonal classes proposal

### Type implies placement

In the prior orthogonal classes proposal, the "static vs instance/prototype" axis is instead "static vs instance vs prototype". This proposal makes the design decision to say, the type implies the place:

  > If the place is not static, then methods and accessors are on the prototype, and fields are on the instance

Why?
- *Prototype fields*: The original orthogonal classes proposal already came to the conclusion that these should be excluded because the natural syntax would be easy to accidentally reach and counterintuitive in its semantics.
- *Instance methods and accessors*: These are excluded for a variety of softer reasons:
  - The language feature is mostly redundant since it's very convenient to write these in terms of fields
  - There's not a clear use case for them--possibly to be included in the set of own properties, but it's not necessary to make a distinct function identity for that
  - Instance methods and accessors are harder to optimize, e.g., using inlining and dispatch caches

Within this regular definition of what forms apply where, JavaScript is able to provide full orthogonality and therefore a simpler mental model.

### Elaborated private state object model

This proposal adds private methods and accessors, both to create a full complement of orthogonality in class features, where private can be used wherever public can, as well as due to concrete use cases requested by users:
- *Private methods*: Behavior encapsulation is an important for modularity similar to state encapsulation. Private methods provide a simple way to evolve classes towards more encapsulation--with a public method, only a name change is needed--with a public method, all that is needed is a preceding `#` to the name to make it private. A proposed complementary feature would be lexically scoped functions inside class bodies. This proposal is compatible with that, but lexically scoped functions in class bodies would change the way the receiver is passed, making it more difficult to evolve code.
- *Private accessors*: These may be most useful in conjunction with decorators on private fields, to turn private fields into private getter/setter pairs, for example:
  - An `@observed` decorator may call a callback to update a View if a private field is used as part of a Model, in one-way data binding.
  - A `@deprecated` decorator may print out warnings or count usages of deprecated private fields, when evolving a large class to remove usages of a field.

Private state is specified as segregated into a separate area on the object; it is observably the same as if there were a WeakMap with the object as keys, except for garbage collection semantics. Private state is unaffected by meta-object operations like preventExtensions, does not go through Proxy traps, cannot be accessed with the square bracket operator or `Object.defineProperty`/`Object.getOwnPropertyDescriptor`, and does not have properties like enumerability. Private state cannot be accessed outside of the class body unless something inside of the class body specifically exposes it.

However, in normal usage which does not reference these runtime metaprogramming-style features, private state is analogous to public state. Additionally, for decorator metaprogramming, private state also behaves analogously. Well-written decorators will need only minimal support for private state. Even though there's no "private prototype", private methods and accessors behave analogously to something defined on the prototype, in that it is common for all instances.

#### Private Names

Private state is not keyed on property keys--Strings or Symbols--but instead on Private Names. Literal references like `#x` are lexically bound to a Private Name which is textually present in the definition of a class, but decorators can create new, anonymous private fields by imperatively creating Private Names and adding them to the List of fields defined for the class.

To get and set the value of any field in an orthogonal way, a new built-in module `"decorators"` is created (as decorators are the only use case for metaprogramming here), with three functions exposed (the module may be used for other utilities as well, if needed):
- `decorators.get(identifier, object)`: When `identifier` is a property key, return `object[identifer]`. When `identifier` is a private name, get the private field with that identifier, or throw a ReferenceError if it is missing. If `identifier` refers to an accessor, invoke the getter; if it refers to a method, get the method value.
- `decorators.set(identifier, object, value)`: When `identifier` is a property key, perform `object[identifer] = value`. When `identifier` is a private name, set the private field with that identifier to the value, or throw a ReferenceError if it is missing. If `identifier` is an accessor, invoke the setter; if `identifier` is a method, throw a ReferenceError.
- `decorators.PrivateName([name])` returns a new opaque private name, optionally with the given descriptive name. TBD whether this name is a primitive or object (likely a new primitive type); the only operations possible on it are using it as a `key` in a decorator, and passing it to `decorators.get`/`decorators.set`.

The interface for adding a private field to an object is to add a field descriptor using a decorator. A particular private name may be used just once, to define a single field. With this pattern, each private field is added by exactly one class.

#### Private methods and accessors

Private names can be bound to storage on the instance, to methods, or to accessors. A reference like `#x` may have any of these semantics. The choice among these semantics is final by the time the decorators have all run--an initial value is present syntactically, and it may be modified by decorators. The possible semantics are:
- *Field*: This is similar to a data property on an instance of a JavaScript object. Instances have an internal slot which holds private state values, and they can be read and written. Fields are always read/write.
- *Method*: This is similar to a method on a prototype. References to read the private field always evaluate to the same Function, and writes result in a ReferenceError.
- *Accessor*: This is similar to a getter/setter pair. References to read and write the private field invoke fixed functions which are set when defining the field (either syntactically or by a decorator).

With this definition, private fields do not undergo runtime changes in their semantics. For convenience, in decorators, private fields are defined using property descriptors similar to ordinary properties, though an error will be thrown if they are declared with values that cannot be represented (e.g., configurable must always be false; writable must be false for methods and true for storage).

One possible specification representation for the semantics would be a write-once internal slot on Private Names, which is created just after all decorators are evaluated, which specifies which of the three categories the private name is used for, and points to the appropriate Functions if it is a method or accessor.

Private methods and accessors can only be used with receivers of the appropriate type. Type checking is done similarly to private fields: instances have a single, unified List of Records mapping Private Names to values, where methods and accessors are included with the value *empty*. All private methods and accessors are added to the instance before any instance properties are, so that initializers may call methods.

### Elimination of the `own` token

The general trend of the feedback from most JavaScript programmers is that they don't want to write `own`. This proposal instead sticks with the previously proposed syntax, which users seem to have been happy with in public fields through transpiler environments. Additionally, with the type-implies-placement principle above, an extra token would only serve the purpose of a reminder of semantics, and it could start to feel like excessive typing for experienced programmers.

## Changes from the existing class features proposals

The only change made here is from `kind: "property"` to `kind: "accessor"` and `kind: "method"` for accessor and method definitions respectively. The reason for the change is that the same form of MemberDescriptor is used for both public methods/accessors and private methods/accessors, differing only in the type of the `key`. Using the kind `"property"` would give the misleading impression that these private things are properties, which they are not.

These names are just a strawman; there's no particular reason to differentiate at this level, for one, as it's redundant with the property descriptor. For everything seen here, the name could just be eliminated, as it's redundant with what's found in the property descriptor (assuming the descriptor for uninitialized fields have an `initializer: undefined` property).

## Taxonomy of possibilities and semantic sketch

### Public

Public features are all based on ordinary JavaScript properties.

#### Public static

Ordinary JavaScript properties of the constructor.

##### Public static method

Feature of ES2015.

Syntax:

```js
class X {
  static foo() {}
}
```

Decorator reification (from the existing decorator proposal):

```js
{
  kind: "method",
  key: "foo",
  isStatic: true,
  descriptor: {
    value: function foo() {},
    writable: true,
    enumerable: false,
    configurable: true
  }
}
```

Semantics: Define this property on the constructor.

##### Public static field

In the public fields proposal

Syntax:

```js
class X {
  static foo = bar;
}
```

Decorator reification

```js
{
  kind: "field",
  key: "foo",
  isStatic: true,
  descriptor: {
    initializer: () => bar;
    writable: true,
    enumerable: true,
    configurable: true
  }
}
```

Semantics: Define this property on the constructor.

##### Public static accessor

Feature of ES2015.

Syntax:

```js
class X {
  static get foo() {}
  static set foo(value) {}
}
```

Decorator reification (from the existing decorator proposal):

```js
{
  kind: "accessor",
  key: "foo",
  isStatic: true,
  descriptor: {
    get: function foo() {},
    set: function foo(value) {},
    enumerable: false,
    configurable: true
  }
}
```

Semantics: Define this property on the constructor.

#### Public instance/prototype

##### Public prototype method

From ES2015

Syntax:

```js
class X {
  foo() {}
}
```

Decorator reification (from the existing decorator proposal):

```js
{
  kind: "method",
  key: "foo",
  isStatic: false,
  descriptor: {
    value: function foo() {},
    writable: true,
    enumerable: false,
    configurable: true
  }
}
```

Semantics: Define the property with the above descriptor on `X`.

##### Public instance field

In the public fields proposal

Syntax:

```js
class X {
  foo = bar;
}
```

Decorator reification

```js
{
  kind: "field",
  key: "foo",
  isStatic: false,
  descriptor: {
    initializer: () => bar;
    writable: true,
    enumerable: true,
    configurable: true
  }
}
```

Semantics: Define this property on each instance, upon returning from super() or constructing the instance

##### Public prototype accessor

Feature of ES2015.

Syntax:

```js
class X {
  get foo() {}
  set foo(value) {}
}
```

Decorator reification (from the existing decorator proposal):

```js
{
  kind: "accessor",
  key: "foo",
  isStatic: false,
  descriptor: {
    get: function foo() {},
    set: function foo(value) {},
    enumerable: false,
    configurable: true
  }
}
```

Semantics: Define this property on `X.prototype` with the above descriptor.

### Private

Private values are driven by private names, rather than properties, explained above.

#### Private static

Private static fields are private state which is installed on only exactly one object--the constructor of the class. The fields are not present on subclass constructors. This definition is analogous to public static fields.

##### Private static method

Syntax:

```js
class X {
  static #foo() {}
}
```

Decorator reification:

```js
{
  kind: "method",
  key: decorators.PrivateName("foo"),
  isStatic: true,
  descriptor: {
    value: function foo() {},
    writable: false,
    enumerable: false,
    configurable: false
  }
}
```

Semantics: This forms a method that can be called as `X.#foo`, or simply `#foo`, though a TypeError will be thrown if the receiver is not `X`. Writes to `#foo` will throw a TypeError, and reads will return the Function.

##### Private static field

Syntax:

```js
class X {
  static #foo = bar;
}
```

Decorator reification

```js
{
  kind: "field",
  key: decorators.PrivateName("foo"),
  isStatic: true,
  descriptor: {
    initializer: () => bar;
    writable: false,
    enumerable: false,
    configurable: false
  }
}
```

Semantics: This creates a single read/write variable which can be accessed only within the class body, as `X.#foo`, or as `#foo`, though a TypeError will be thrown if the receiver is not `X`.

##### Private static accessor

Syntax:

```js
class X {
  static get #foo() {}
  static set #foo(value) {}
}
```

Decorator reification:

```js
{
  kind: "accessor",
  key: decorators.PrivateName("foo"),
  isStatic: true,
  descriptor: {
    get: function foo() {},
    set: function foo(value) {},
    enumerable: false,
    configurable: false
  }
}
```

Semantics: Reads to `X.#foo` will call the getter, and writes will call the setter.

#### Private instance/"prototype"

##### Private "prototype" method

Syntax:

```js
class X {
  #foo() {}
}
```

Decorator reification:

```js
{
  kind: "method",
  key: decorators.PrivateName("foo"),
  isStatic: false,
  descriptor: {
    value: function foo() {},
    writable: true,
    enumerable: false,
    configurable: false
  }
}
```

Semantics: The method `#foo` can be called on instances of `X` within the class body. Writes to `#foo` will throw a TypeError, and reads will return the Function.

##### Private instance field

In the private fields proposal

Syntax:

```js
class X {
  #foo = bar;
}
```

Decorator reification:

```js
{
  kind: "field",
  key: decorators.PrivateName("foo"),
  isStatic: false,
  descriptor: {
    initializer: () => bar;
    writable: true,
    enumerable: false,
    configurable: false
  }
}
```

Semantics: Reads and writes to `instance.#foo` will access the property, which is added to the class in construction.

##### Private "prototype" accessor

Syntax:

```js
class X {
  get #foo() {}
  set #foo(value) {}
}
```

Decorator reification:

```js
{
  kind: "accessor",
  key: decorators.PrivateName("foo"),
  isStatic: false,
  descriptor: {
    get: function foo() {},
    set: function foo(value) {},
    enumerable: false,
    configurable: false
  }
}
```

Semantics: Reads to `instance.#foo` for an instance of `X` will call the `get` function, and writes will call the `set` function. If `instance` is not an instance of `X`, throw a TypeError. `#foo` is only visible within the class body.
