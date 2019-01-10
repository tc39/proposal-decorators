# Taxonomy of class/object features

## Public

Public features are all based on ordinary JavaScript properties.

### Public static

Ordinary JavaScript properties of the constructor.

#### Public static method

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
  placement: "static",
  method: function foo() {},
  writable: true,
  enumerable: false,
  configurable: true
}
```

Semantics: Define this property on the constructor.

#### Public static field

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
  placement: "static",
  writable: true,
  enumerable: true,
  configurable: true
  initialize: () => bar
}
```

Semantics: Define this property on the constructor.

#### Public static accessor

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
  placement: "static",
  get: function foo() {},
  set: function foo(value) {},
  enumerable: false,
  configurable: true
}
```

Semantics: Define this property on the constructor.

### Public instance/prototype

#### Public prototype method

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
  placement: "prototype",
  method: function foo() {},
  writable: true,
  enumerable: false,
  configurable: true
}
```

Semantics: Define the property with the above descriptor on `X`.

#### Public instance field

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
  placement: "own",
  writable: true,
  enumerable: true,
  configurable: true
  initialize: () => bar
}
```

Semantics: Define this property on each instance, upon returning from super() or constructing the instance

#### Public prototype accessor

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
  placement: "prototype",
  get: function foo() {},
  set: function foo(value) {},
  enumerable: false,
  configurable: true
}
```

Semantics: Define this property on `X.prototype` with the above descriptor.

## Private

Private values are driven by private names, rather than properties, explained above.

### Private static

Private static fields are private state which is installed on only exactly one object--the constructor of the class. The fields are not present on subclass constructors. This definition is analogous to public static fields.

#### Private static method

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
  placement: "static",
  method: function foo() {},
  writable: false,
  enumerable: false,
  configurable: false
}
```

Semantics: This forms a method that can be called as `X.#foo`, or simply `#foo`, though a TypeError will be thrown if the receiver is not `X`. Writes to `#foo` will throw a TypeError, and reads will return the Function.

#### Private static field

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
  placement: "static",
  writable: false,
  enumerable: false,
  configurable: false
  initialize: () => bar
}
```

Semantics: This creates a single read/write variable which can be accessed only within the class body, as `X.#foo`, or as `#foo`, though a TypeError will be thrown if the receiver is not `X`.

#### Private static accessor

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
  placement: "static",
  get: function foo() {},
  set: function foo(value) {},
  enumerable: false,
  configurable: false
}
```

Semantics: Reads to `X.#foo` will call the getter, and writes will call the setter.

### Private instance/"prototype"

#### Private "prototype" method

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
  placement: "own",
  method: function foo() {},
  writable: true,
  enumerable: false,
  configurable: false
}
```

Semantics: The method `#foo` can be called on instances of `X` within the class body. Writes to `#foo` will throw a TypeError, and reads will return the Function.

#### Private instance field

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
  placement: "own",
  writable: true,
  enumerable: false,
  configurable: false
  initialize: () => bar
}
```

Semantics: Reads and writes to `instance.#foo` will access the property, which is added to the class in construction.

#### Private "prototype" accessor

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
  placement: "own",
  get: function foo() {},
  set: function foo(value) {},
  enumerable: false,
  configurable: false
}
```

Semantics: Reads to `instance.#foo` for an instance of `X` will call the `get` function, and writes will call the `set` function. If `instance` is not an instance of `X`, throw a TypeError. `#foo` is only visible within the class body.
