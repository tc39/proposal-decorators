# Decorators

**Stage**: 2

Decorators are a proposal for extending JavaScript classes which is widely adopted among developers in transpiler environments, with broad interest in standardization. TC39 has been iterating on decorators proposals for over five years. This document describes a new proposal for decorators based on elements from all past proposals.

This README describes the current decorators proposal, which is a work in progress. For previous iterations of this proposal, see the commit history of this repository.

## Introduction

**Decorators** are *functions* called on classes, class elements, or other JavaScript syntax forms during definition.

```js
@defineElement("my-class")
class C extends HTMLElement {
  @reactive accessor clicked = false;
}
```

Decorators have four primary capabilities:

1. They can **replace** the value that is being decorated with a _matching_ value that has the same semantics. (e.g. a decorator can replace a method with another method, a field with another field, a class with another class, and so on).
2. They can associate **metadata** with the value that is being decorated. This metadata can then be read externally and used for metaprogramming and introspection.
3. They can provide **access** to the value that is being decorated, via metadata. For public values, they can do this via the name of the value. For private values, they receive accessor functions which they can then choose to share.
4. They can **initialize** the value that is being decorated, running additional code after the value has been fully defined. In cases where the value is a member of class, then initialization occurs once per instance.

Essentially, decorators can be used to metaprogram and add functionality to a value, without fundamentally changing its external behavior.

This proposal differs from previous iterations where decorators could replace the decorated value with a completely different type of value. The requirement for decorators to only replace a value with one that has the same semantics as the original value fulfills two major design goals:

- **It should be easy both to use decorators and to write your own decorators.** Previous iterations such as the _static decorators_ proposal were complicated for authors and implementers in particular. In this proposal, decorators are plain functions, and are accessible and easy to write.
- **Decorators should affect the thing they're decorating, and avoid confusing/non-local effects.** Previously, decorators could change the decorated value in unpredictable ways, and also add completely new values which were unrelated. This was problematic both for _runtimes_, since it meant decorated values could not be analyzed statically, and for _developers_, since decorated values could turn into completely different types of values without any indicator to the user.

In this proposal, decorators can be applied to the following existing types of values:

- Classes
- Class fields (public, private, and static)
- Class methods (public, private, and static)
- Class accessors (public, private, and static)

In addition, this proposal introduces a new type of class element that can be decorated:

- Class _auto accessors_, defined by applying the `accessor` keyword to a class field. These have a getter and setter, unlike fields, which default to getting and setting the value on a private storage slot (equivalent to a private class field):

  ```js
  class Example {
    @reactive accessor myBool = false;
  }
  ```

This new element type can be used independently, and has its own semantics separate from usage with decorators. The reason it is included in this proposal is primarily because there are a number of use cases for decorators which require its semantics, since decorators can only replace an element with a corresponding element that has the same semantics. These use cases are common in the existing decorators ecosystem, demonstrating a need for the capabilities they provide.

## Detailed Design

The three steps of decorator evaluation:

1. Decorator expressions (the thing after the `@`) are *evaluated* interspersed with computed property names.
1. Decorators are *called* (as functions) during class definition, after the methods have been evaluated but before the constructor and prototype have been put together.
1. Decorators are *applied* (mutating the constructor and prototype) all at once, after all of them have been called.

> The semantics here generally follow the consensus at the May 2016 TC39 meeting in Munich.

### 1. Evaluating decorators

Decorators are evaluated as expressions, being ordered along with computed property names. This goes left to right, top to bottom. The result of decorators is stored in the equivalent of local variables to be later called after the class definition initially finishes executing.

### 2. Calling decorators

When decorators are called, they receive two parameters:

1. The value being decorated, or `undefined` in the case of class fields which are a special case.
2. A context object containing metadata about the value being decorated

Using TypeScript interfaces for brevity and clarity, this is the general shape of the API:

```ts
type Decorator = (value: Input, context: {
  kind: string;
  name: string | symbol;
  access?: {
    get?(): unknown;
    set?(value: unknown): void;
  };
  isPrivate?: boolean;
  isStatic?: boolean;
  addInitializer?(initializer: () => void): void;
  getMetadata(key: symbol);
  setMetadata(key: symbol, value: unknown);
}) => Output | void;
```

`Input` and `Output` here represent the values passed to and returned from a given decorator. Each type of decorator has a different input and output, and these are covered below in more detail. All decorators can choose to return nothing, which defaults to using the original, undecorated value.

The context object also varies depending on the value being decorated. Breaking down the properties:

- `kind`: The kind of decorated value. This can be used to assert that the decorator is used correctly, or to have different behavior for different types of values. It is one of the following values.
  - `"class"`
  - `"method"`
  - `"getter"`
  - `"setter"`
  - `"field"`
  - `"accessor"`
- `name`: The name of the value, or in the case of private elements the _description_ of it (e.g. the readable name).
- `access`: An object containing methods to access the value. This is only available for _private_ class elements, since public class elements can be accessed externally by knowing the name of the element. These methods also get the _final_ value of the private element on the instance, not the current value passed to the decorator. This is important for most use cases involving access, such as type validators or serializers. See the section on Access below for more details.
- `isStatic`: Whether or not the value is a `static` class element. Only applies to class elements.
- `isPrivate`: Whether or not the value is a private class element. Only applies to class elements.
- `addInitializer`: Allows the user to add additional initialization logic. This is available for all decorators which operate per-class, as opposed to per-instance (in other words, decorators which do not have kind `"field"` - discussed in more detail below).
- `setMetadata`: Allows the user to define some metadata to be associated with this property. This metadata can then be accessed on the class via `Symbol.metadata`. See the section on Metadata below for more details.

See the Decorator APIs section below for a detailed breakdown of each type of decorator and how it is applied.

### 3. Applying decorators

Decorators are applied after all decorators have been called. The intermediate steps of the decorator application algorithm are not observable--the newly constructed class is not made available until after all method and non-static field decorators have been applied.

The class decorator is called only after all method and field decorators are called and applied.

Finally, static fields are executed and applied.

### Syntax

This decorators proposal uses the syntax of the previous Stage 2 decorators proposal. This means that:
- Decorator expressions are restricted to a chain of variables, property access with `.` but not `[]`, and calls `()`. To use an arbitrary expression as a decorator, `@(expression)` is an escape hatch.
- Class expressions may be decorated, not just class declarations.
- Class decorators come after `export` and `default`.

There is no special syntax for defining decorators; any function can be applied as a decorator.

### Decorator APIs

#### Class Methods

```ts
type ClassMethodDecorator = (value: Function, context: {
  kind: "method";
  name: string | symbol;
  access?: { get(): unknown };
  isStatic: boolean;
  isPrivate: boolean;
  addInitializer(initializer: () => void): void;
  getMetadata(key: symbol);
  setMetadata(key: symbol, value: unknown);
}) => Function | void;
```

Class method decorators receive the method that is being decorated as the first value, and can optionally return a new method to replace it. If a new method is returned, it will replace the original on the prototype (or on the class itself in the case of static methods). If any other type of value is returned, an error will be thrown.

An example of a method decorator is the `@logged` decorator. This decorator receives the original function, and returns a new function that wraps the original and logs before and after it is called.

```js
function logged(value, { kind, name }) {
  if (kind === "method") {
    return function (...args) {
      console.log(`starting ${name} with arguments ${args.join(", ")}`);
      const ret = value.call(this, ...args);
      console.log(`ending ${name}`);
      return ret;
    };
  }
}

class C {
  @logged
  m(arg) {}
}

new C().m(1);
// starting m with arguments 1
// ending m
```

This example roughly "desugars" to the following (i.e., could be transpiled as such):

```js
class C {
  m(arg) {}
}

C.prototype.m = logged(C.prototype.m, {
  kind: "method",
  name: "m",
  isStatic: false,
  isPrivate: false,
  setMetadata() { /**/ }
}) ?? C.prototype.m;
```

#### Class Accessors

```ts
type ClassGetterDecorator = (value: Function, context: {
  kind: "getter";
  name: string | symbol;
  access?: { get(): unknown };
  isStatic: boolean;
  isPrivate: boolean;
  addInitializer(initializer: () => void): void;
  setMetadata(key: symbol, value: unknown);
}) => Function | void;

type ClassSetterDecorator = (value: Function, context: {
  kind: "setter";
  name: string | symbol;
  access?: { set(value: unknown): void };
  isStatic: boolean;
  isPrivate: boolean;
  addInitializer(initializer: () => void): void;
  getMetadata(key: symbol);
  setMetadata(key: symbol, value: unknown);
}) => Function | void;
```

Accessor decorators receive the original underlying getter/setter function as the first value, and can optionally return a new getter/setter function to replace it. Like method decorators, this new function is placed on the prototype in place of the original (or on the class for static accessors), and if any other type of value is returned, an error will be thrown.

Accessor decorators are applied _separately_ to getters and setters. In the following example, `@foo` is applied only to `get x()` - `set x()` is undecorated:

```js
class C {
  @foo
  get x() {
    // ...
  }

  set x(val) {
    // ...
  }
}
```

We can extend the `@logged` decorator we defined previously for methods to also handle accessors. The code is essentially the same, we just need to handle additional `kind`s.

```js
function logged(value, { kind, name }) {
  if (kind === "method" || kind === "getter" || kind === "setter") {
    return function (...args) {
      console.log(`starting ${name} with arguments ${args.join(", ")}`);
      const ret = value.call(this, ...args);
      console.log(`ending ${name}`);
      return ret;
    };
  }
}

class C {
  @logged
  set x(arg) {}
}

new C().x = 1
// starting x with arguments 1
// ending x
```

This example roughly "desugars" to the following (i.e., could be transpiled as such):

```js
class C {
  set x(arg) {}
}

let { set } = Object.getOwnPropertyDescriptor(C.prototype, "x");
set = logged(set, {
  kind: "setter",
  name: "x",
  isStatic: false,
  isPrivate: false,
  getMetadata() { /**/ }
  setMetadata() { /**/ }
}) ?? set;

Object.defineProperty(C.prototype, "x", { set });
```

#### Class Fields

```ts
type ClassFieldDecorator = (value: undefined, context: {
  kind: "field";
  name: string | symbol;
  access?: { get(): unknown, set(value: unknown): void };
  isStatic: boolean;
  isPrivate: boolean;
  getMetadata(key: symbol);
  setMetadata(key: symbol, value: unknown);
}) => (initialValue: unknown) => unknown | void;
```

Unlike methods and accessors, class fields do not have a direct input value when being decorated. Instead, users can optionally return an initializer function which runs when the field is assigned, receiving the initial value of the field and returning a new initial value. If any other type of value besides a function is returned, an error will be thrown.

We can expand our `@logged` decorator to be able to handle class fields as well, logging when the field is assigned and what the value is.

```js
function logged(value, { kind, name }) {
  if (kind === "field") {
    return function (initialValue) {
      console.log(`initializing ${name} with value ${initialValue}`);
      return initialValue;
    };
  }

  // ...
}

class C {
  @logged x = 1;
}

new C();
// initializing x with value 1
```

This example roughly "desugars" to the following (i.e., could be transpiled as such):

```js
let initializeX = logged(undefined, {
  kind: "field",
  name: "x",
  isStatic: false,
  isPrivate: false,
  setMetadata() { /**/ }
}) ?? (initialValue) => initialValue;

class C {
  x = initializeX.call(this, 1);
}
```

The initializer function is called with the instance of the class as `this`, so field decorators can also be used to bootstrap registration relationships. For instance, you could register children on a parent class:

```js
const CHILDREN = new WeakMap();

function registerChild(parent, child) {
  let children = CHILDREN.get(parent);

  if (children === undefined) {
    children = [];
    CHILDREN.set(parent, children);
  }

  children.push(child);
}

function getChildren(parent) {
  return CHILDREN.get(parent);
}

function register() {
  return function(value) {
    registerChild(this, value);

    return value;
  }
}

class Child {}
class OtherChild {}

class Parent {
  @register child1 = new Child();
  @register child2 = new OtherChild();
}

let parent = new Parent();
getChildren(parent); // [Child, OtherChild]
```

Since class fields already return an initializer, they do not receive `addInitializer` and cannot add additional initialization logic.

#### Classes

```ts
type ClassDecorator = (value: Function, context: {
  kind: "class";
  name: string | undefined;
  addInitializer(initializer: () => void): void;
  getMetadata(key: symbol);
  setMetadata(key: symbol, value: unknown);
}) => Function | void;
```

Class decorators receive the class that is being decorated as the first parameter, and may optionally return a new class to replace it. If a non-constructable value is returned, then an error is thrown.

We can further extend our `@logged` decorator to log whenever an instance of a class is created:

```js
function logged(value, { kind, name }) {
  if (kind === "class") {
    return class extends value {
      constructor(...args) {
        super(...args);
        console.log(`constructing an instance of ${name} with arguments ${args.join(", ")}`);
      }
    }
  }

  // ...
}

@logged
class C {}

new C(1);
// constructing an instance of C with arguments 1
```

This example roughly "desugars" to the following (i.e., could be transpiled as such):

```js
class C {}

C = logged(C, {
  kind: "class",
  name: "C",
  getMetadata() { /**/ }
  setMetadata() { /**/ }
}) ?? C;

new C(1);
```

If the class being decorated is an anonymous class, then the `name` property of the `context` object is `undefined`.

### New Class Elements

#### Class Auto-Accessors

Class auto-accessors are a new construct, defined by adding the `accessor` keyword in front of a class field:

```js
class C {
  accessor x = 1;
}
```

Auto-accessors, unlike regular fields, define a getter and setter on the class prototype. This getter and setter default to getting and setting a value on a private slot. The above roughly desugars to:

```js
class C {
  #x = 1;

  get x() {
    return this.#x;
  }

  set x(val) {
    this.#x = val;
  }
}
```

Both static and private auto-accessors can be defined as well:

```js
class C {
  static accessor x = 1;
  accessor #y = 2;
}
```

Auto-accessors can be decorated, and auto-accessor decorators have the following signature:

```ts
type ClassAutoAccessorDecorator = (
  value: {
    get: () => unknown;
    set(value: unknown) => void;
  },
  context: {
    kind: "accessor";
    name: string | symbol;
    access: { get(): unknown, set(value: unknown): void };
    isStatic: boolean;
    isPrivate: boolean;
    addInitializer(initializer: () => void): void;
    getMetadata(key: symbol);
    setMetadata(key: symbol, value: unknown);
  }
) => {
  get?: () => unknown;
  set?: (value: unknown) => void;
  initialize?: (initialValue: unknown) => unknown;
} | void;
```

Unlike field decorators, auto-accessor decorators receive a value, which is an object containing the `get` and `set` accessors defined on the prototype of the class (or the class itself in the case of static auto-accessors). The decorator can then wrap these and return a _new_ `get` and/or `set`, allowing access to the property to be intercepted by the decorator. This is a capability that is not possible with fields, but is possible with auto-accessors. In addition, auto-accessors can return an `init` function, which can be used to change the initial value of the backing value in the private slot, similar to field decorators. If an object is returned but any of the values are omitted, then the default behavior for the omitted values is to use the original behavior. If any other type of value besides an object containing these properties is returned, an error will be thrown.

Further extending the `@logged` decorator, we can make it handle auto-accessors as well, logging when the auto-accessor is initialized and whenever it is accessed:

```js
function logged(value, { kind, name }) {
  if (kind === "accessor") {
    let { get, set } = value;

    return {
      get() {
        console.log(`getting ${name}`);

        return get.call(this);
      },

      set(val) {
        console.log(`setting ${name} to ${val}`);

        return set.call(this, val);
      },

      init(initialValue) {
        console.log(`initializing ${name} with value ${initialValue}`);
        return initialValue;
      }
    };
  }

  // ...
}

class C {
  @logged accessor x = 1;
}

let c = new C();
// initializing x with value 1
c.x;
// getting x
c.x = 123;
// setting x to 123
```

This example roughly "desugars" to the following:

```js
class C {
  #x = initializeX.call(this, 1);

  get x() {
    return this.#x;
  }

  set x(val) {
    this.#x = val;
  }
}

let { get: oldGet, set: oldSet } = Object.getOwnPropertyDescriptor(C.prototype, "x");

let {
  get: newGet = oldGet,
  set: newSet = oldSet,
  init: initializeX = (initialValue) => initialValue
} = logged(
  { get: oldGet, set: oldSet },
  {
    kind: "accessor",
    name: "x",
    isStatic: false,
    isPrivate: false,
    getMetadata() { /**/ }
    setMetadata() { /**/ }
  }
) ?? {};

Object.defineProperty(C.prototype, "x", { get: newGet, set: newSet });
```

### Adding initialization logic with `addInitializer`

The `addInitializer` method is available on the context object that is provided to the decorator for every type of value _except_ class fields. This method can be called to associate an initializer function with the class or class element, which can be used to run arbitrary code after the value has been defined in order to finish setting it up. The timing of these initializers depends on the type of decorator:

- Class decorator initializers are run _after_ the class has been fully defined, and _after_ class static fields have been assigned.
- Class element initializers run during class construction, _before_ class fields are initialized.
- Class _static_ element initializers run during class definition, _before_ static class fields are defined, but _after_ class elements have been defined.

#### Example: `@customElement`

We can use `addInitializer` with class decorators in order to create a decorator which registers a web component in the browser.

```js
function customElement(name) {
  (value, { addInitializer }) => {
    addInitializer(function() {
      customElements.define(name, this);
    });
  }
}

@customElement('my-element')
class MyElement extends HTMLElement {
  static get observedAttributes() {
    return ['some', 'attrs'];
  }
}
```

This example roughly "desugars" to the following (i.e., could be transpiled as such):

```js
class MyElement {
  static get observedAttributes() {
    return ['some', 'attrs'];
  }
}

let initializersForMyElement = [];

MyElement = customElement(MyElement, {
  kind: "class",
  name: "MyElement",
  addInitializer(fn) {
    initializersForMyElement.push(fn);
  },
  getMetadata() { /**/ }
  setMetadata() { /**/ }
}) ?? MyElement;

for (let initializer of initializersForMyElement) {
  initializer.call(MyElement);
}
```

#### Example: `@bound`

We could also use `addInitializer` with method decorators to create a `@bound` decorator, which binds the method to the instance of the class:

```js
function bound(value, { name, addInitializer }) {
  addInitializer(function () {
    this[name] = this[name].bind(this);
  });
}

class C {
  message = "hello!";

  @bound
  m() {
    console.log(this.message);
  }
}

let { m } = new C();

m(); // hello!
```

This example roughly "desugars" to the following:

```js
class C {
  constructor() {
    for (let initializer of initializersForM) {
      initializer.call(this);
    }

    this.message = "hello!";
  }

  m() {}
}

let initializersForM = []

C.prototype.m = bound(
  C.prototype.m,
  {
    kind: "method",
    name: "m",
    isStatic: false,
    isPrivate: false,
    addInitializer(fn) {
      initializersForM.push(fn);
    },
    setMetadata() { /**/ }
  }
) ?? C.prototype.m;
```

### Metadata

Every decorator has the ability to expose metadata related to the decorated value via the `setMetadata` method on the context object. This method recieves two parameters, a key which must be _symbol_, minimizing the possibility of collisions, and a value which can be anything.

```js
const MY_META = Symbol();
const OTHER_META = Symbol();

function myMeta(value, context) {
  context.setMetadata(MY_META, 123);
  context.setMetadata(OTHER_META, 123);
}
```

All metadata defined under a particular symbol is gathered across the class and placed into a metadata object with the following interface:

```ts
interface Metadata {
  constructor?: unknown;
  public?: Record<string, unknown>;
  private?: unknown[];
}
```

Two of these objects may exist, one for static elements and the class itself, and one for non-static elements. These objects are then accessed via the `Symbol.metadata` property on the class, like so:

```js
target[Symbol.metadata][key];
```

Where `key` also must be a symbol. Static element metadata and class decorator metadata is accessed on the constructor directly, and non-static element metadata is accessed on the prototype.

Given the following example decorator and class:

```js
const MY_META = Symbol();

function myMeta(value, context) {
  context.setMetadata(MY_META, 'metadata');
}

@myMeta
class C {
  @myMeta a = 123
  @myMeta b() {}
  @myMeta #c = 456;

  @myMeta static x = 123;
  @myMeta static y() {}
  @myMeta static #z = 456;
}
```

You would be able to access the metadata for this class like so:

```js
C.prototype[Symbol.metadata][MY_META];
// {
//   public: {
//     a: 'metadata',
//     b: 'metadata',
//   },

//   private: ['metadata']
// }

C[Symbol.metadata][MY_META];
// {
//   constructor: 'metadata',

//   public: {
//     x: 'metadata',
//     y: 'metadata',
//   },

//   private: ['metadata']
// }
```

Subsequent definitions to the same metadata key overwrite the existing value, if one exists. If decorators wish to instead build upon existing metadata, they can use the `getMetadata` method of the context object to get the current value and modify it.

```js
const VALIDATIONS = Symbol();

function validateString(value, context) {
  let validations = context.getMetadata(VALIDATIONS) ?? [];

  validations.push((value) => typeof value === "string");

  context.setMetadata(VALIDATIONS, validations);
}

function validateMaxLength(length) {
  return (value, context) => {
    let validations = context.getMetadata(VALIDATIONS) ?? [];

    validations.push((value) => value.length < length);

    context.setMetadata(VALIDATIONS, validations);
  }
}

class C {
  @validateString
  @validateMaxLength(10)
  foo = "hello!";
}

C.prototype[Symbol.metadata][VALIDATIONS].public.foo.length; // 2
```

In addition, if two public class elements exist on the same class with the same name, then metadata defined on the second element will overwrite metadata defined on the element.

```js
const MY_META = Symbol();

function meta1(value, context) {
  context.setMetadata(MY_META, 1);
}

function meta2(value, context) {
  context.setMetadata(MY_META, 2);
}

class C {
  @meta1
  m() {};

  @meta2
  m = 123;
}

C.prototype[Symbol.metadata][MY_META].public.m; // 2
```

Finally, the metadata object itself inherits from the parent class' metadata object if it exists, the `public` object inherits from the parent's `public` object if it exists. The `private` array inherits as well by appending the private metadata of the class to the private metadata array of the parent.

```js
const MY_META = Symbol();

function myMeta(value, context) {
  context.setMetadata(MY_META, 'metadata');
}

@myMeta
class C {
  @myMeta a = 123;
  @myMeta #b = 456;
}

class D extends C {
  @myMeta c = 123;
  @myMeta #d = 456;
}

D[Symbol.metadata].constructor; // 'metadata'
D.prototype[Symbol.metadata];
// {
//   public: {
//     a: 'metadata',
//     c: 'metadata',
//   }

//   private: ['metadata', 'metadata'],
// }
```

This inheritance is prototype based in the case of public fields and `constructor`, allowing users to distinguish between _own_ metadata and inherited metadata in these cases.

This API design meets the following goals:

- It is easy for any decorator library to directly access the metadata that it defined. Defining metadata requires a key, which the library can then use to access it later. Alternatives include placing all metadata in an array, but this would require users to manually sort through and find their own metadata.
- Metadata is easy to access, and it's possible to tell which class element it was associated with.
- Metadata access is uniform, all metadata is accessed the same way. There is no need to learn a different technique for each type of class element.
- Multiple decorators can collaborate, progressively building up metadata on a single key. This means that libraries such as validation libraries can associate multiple values with a single key.

#### Hiding metadata

This metadata API is inherently open. By defining metadata, anyone can access it via `Symbol.metadata`. Even though Symbols are used as the keys, users can find these properties via `Object.getOwnPropertySymbols`.

Sometimes, users may wish to hide the details of their metadata, to prevent external code from reading it. Users can do this by exposing a key in the metadata, rather than the metadata itself. This key can then be used to read the metadata from a private data store, only available in module scope for instance. For example, you could do this with an object and a WeakMap like so:

```js
const HIDDEN_META = new WeakMap();
const META_KEY = Symbol();

function myMeta(value, context) {
  let key = {};

  HIDDEN_META.set(key, { secret: "values" })

  context.setMetadata(META_KEY, key);
}
```

The metadata can then be accessed using this key. For example:

```js
class C {
  @myMeta x = 1;
}

HIDDEN_META.get(C.prototype[Symbol.metadata][META_KEY].public.x);
// { secret: "values" }
```

### Access

So far we've seen how metadata can be defined for decorated values, and for public values its possible to see how this could be used. For instance, one could develop a dependency injection library which annotates fields with values to inject, and then injects them when creating the instance:

```js
const INJECTIONS = Symbol();

function inject(injectionKey) {
  return (value, context) => {
    context.setMetadata(INJECTIONS, { injectionKey })
  }
}

class Container {
  registry = new Map();

  register(injectionKey, value) {
    this.registry.set(injectionKey, value);
  }

  lookup(injectionKey) {
    this.register.get(injectionKey);
  }

  create(Class) {
    let instance = new Class();

    const { public } = instance[Symbol.metadata][INJECTIONS];

    for (let key in public) {
      instance[key] = this.lookup(public[key].injectionKey);
    }

    return instance;
  }
}

class Store {}

class C {
  @inject('store') store;
}

let container = new Container();
let store = new Store();

container.register('store', store);

let c = container.create(C);

c.store === store; // true
```

However, it is not possible to do this as directly _private_ elements, as the key the metadata is defined with cannot be used to access it externally.

This is the purpose of the `access` object that is passed to private elements. This object gives decorators a way to expose access via metadata, which can be used in a number of ways. For instance, we can update our dependency injection example to allow injection on private fields:

```js
const INJECTIONS = Symbol();

function inject(injectionKey) {
  return (value, context) => {
    let set = context.access?.set;

    context.setMetadata(INJECTIONS, { injectionKey, set })
  }
}

class Container {
  registry = new Map();

  register(injectionKey, value) {
    this.registry.set(injectionKey, value);
  }

  lookup(injectionKey) {
    this.register.get(injectionKey);
  }

  create(Class) {
    let instance = new Class();

    const { public, private } = instance[Symbol.metadata][INJECTIONS];

    for (let key in public) {
      instance[key] = this.lookup(public[key].injectionKey);
    }

    for (let { injectionKey, set } of private) {
      set.call(instance, this.lookup(injectionKey))
    }

    return instance;
  }
}

class Store {}

class C {
  @inject('store') #store;

  get store() {
    return this.#store;
  }
}

let container = new Container();
let store = new Store();

container.register('store', store);

let c = container.create(C);

c.store === store; // true
```

Calling the `get` and `set` functions is equivalent to accessing the value on the instance.

```js
const FIELD_ACCESS = Symbol();

function exposeField(value, context) {
  context.setMetadata(FIELD_ACCESS, context.access);
}

class C {
  @exposeField #x = 1;

  updateX() {
    let { get, set } = this[Symbol.metadata][FIELD_ACCESS].private[0];

    let x1 = get.call(this);
    set.call(this, x1 + 1);

    // is equivalent to...
    let x2 = this.#x;
    this.#x = x2 + 1;
  }
}
```

This means that if you call `get` or `set` with a private field or accessor, then it will _trigger_ the accessors on the instance.

Access is generally provided based on whether or not the value is a value meant to be read or written. Fields and auto-accessors can be both read and written to. Accessors can either be read in the case of getters, or wriitten in the case of setters. Methods can only be read.

## Possible extensions

Decorators on further constructs are investigated in [EXTENSIONS.md](./EXTENSIONS.md).

## Standardization plan

- [x] Iterate on open questions within the proposal, presenting them to TC39 and discussing further in the biweekly decorators calls, to bring a conclusion to committee in a future meeting
  - STATUS: Open questions have been resolved, decorators working group has reached general consensus on the design.
- [x] Write spec text
  - STATUS: Complete, available [here](https://arai-a.github.io/ecma262-compare/?pr=2417).
- [x] Implement in experimental transpilers
  - STATUS: An experimental implementation has been created and is available for general use. Work is ongoing to implement in Babel and get more feedback.
    - [x] Independent implentation: https://javascriptdecorators.org/
    - [ ] Babel plugin implementation
- [ ] Collect feedback from JavaScript developers testing the transpiler implementation
  - STATUS: Feedback is being collected using the experimental implementation. More feedback will be collected from the Babel plugin once it is completed.
- [ ] Propose for Stage 3 no sooner than six months after prototyping begins, so we have time to collect experience from developers in transpilers

## FAQ

### How should I use decorators in transpilers today?

Unfortunately, we're in the classic trap of, "The old thing is deprecated, and the new thing is not ready yet!" For now, best to keep using the old thing.

The decorators champion group would recommend continuing to use Babel "legacy" decorators or TypeScript "experimental" decorators. If you're using decorators today, you're probably already using one of these versions. Note that these decorators depend on "[[Set]] semantics" for field declarations (in Babel, loose mode). We recommend that these tools maintain support for [[Set]] semantics alongside legacy decorators, until it's possible to transition to the decorators of this proposal.

Babel 7 supports the decorators proposal presented to TC39 in the November 2018 TC39 meeting. It's fine to use these for experimental purposes, but they face significant performance issues, are not yet widely adopted; we don't plan to continue pushing for this proposal in TC39. As such, we recommend against using this version for serious work. In follow-on proposals to add more built-in decorators, we hope to be able to recover the extra functionality that the November 2018 decorators proposal supported.

### How does this proposal compare to other versions of decorators?

#### Comparison with Babel "legacy" decorators

Babel legacy-mode decorators are based on the state of the JavaScript decorators proposal as of 2014. In addition to the syntax changes listed above, the calling convention of Babel legacy decorators differs from this proposal:
- Legacy decorators are called with the "target" (the class or prototype under construction), whereas the class under construction is not made available to decorators in this proposal.
- Legacy decorators are called with a full property descriptor, whereas this proposal calls decorators with just "the thing being decorated" and a context object. This means, for example, that it is impossible to change property attributes, and that getters and setters are not "coalesced" but rather decorated separately.

Despite these differences, it should generally be possible to achieve the same sort of functionality with this decorators proposal as with Babel legacy decorators. If you see important missing functionality in this proposal, please file an issue.

#### Comparison with TypeScript "experimental" decorators

TypeScript experimental decorators are largely similar to Babel legacy decorators, so the comments in that section apply as well. In addition:
- This proposal does not include parameter decorators, but they may be provided by future built-in decorators, see [EXTENSIONS.md](./EXTENSIONS.md).
- TypeScript decorators run all instance decorators before all static decorators, whereas the order of evaluation in this proposal is based on the ordering in the program, regardless of whether they are static or instance.

Despite these differences, it should generally be possible to achieve the same sort of functionality with this decorators proposal as with TypeScript experimental decorators. If you see important missing functionality in this proposal, please file an issue.

#### Comparison with the previous Stage 2 decorators proposal

The previous Stage 2 decorators proposal was more full-featured than this proposal, including:
- The ability of all decorators to add arbitrary 'extra' class elements, rather than just wrapping/changing the element being decorated.
- Ability to declare new private fields, including reusing a private name in multiple classes
- Class decorator access to manipulating all fields and methods within the class
- More flexible handling of the initializer, treating it as a "thunk"

The previous Stage 2 decorators proposal was based on a concept of descriptors which stand in for various class elements. Such descriptors do not exist in this proposal. However, those descriptors gave a bit too much flexibility/dynamism to the class shape in order to be efficiently optimizable.

This decorators proposal deliberately omits these features, in order to keep the meaning of decorators "well-scoped" and intuitive, and to simplify implementations, both in transpilers and native engines.

#### Comparison with the "static decorators" proposal

Static decorators were an idea to include a set of built-in decorators, and support user-defined decorators derived from them. Static decorators were in a separate namespace, to support static analyzability.

The static decorators proposal suffered from both excessive complexity and insufficient optimizability. This proposal avoids that complexity by returning to the common model of decorators being ordinary functions.

See [V8's analysis of decorator optimizability](https://docs.google.com/document/d/1GMp938qlmJlGkBZp6AerL-ewL1MWUDU8QzHBiNvs3MM/edit) for more information on the lack of optimizability of the static decorators proposal, which this proposal aims to address.

### If the previous TC39 decorators proposals didn't work out, why not go back and standardize TS/Babel legacy decorators?

**Optimizability**: This decorator proposal and legacy decorators are common in decorators being functions. However, the calling convention of this proposal is designed to be more optimizable by engines by making the following changes vs legacy decorators:
- The incomplete class under construction is not exposed to decorators, so it does not need to observably undergo shape changes during class definition evaluation.
- Only the construct being decorated may be changed in its contents; the "shape" of the property descriptor may not change.

**Incompatibility with [[Define]] field semantics**: Legacy decorators, when applied to field declarations, depend deeply on the semantics that field initializers call setters. TC39 [concluded](https://github.com/tc39/proposal-class-fields/blob/master/README.md#public-fields-created-with-objectdefineproperty) that, instead, field declarations act like Object.defineProperty. This decision makes many patterns with legacy decorators no longer work. Although Babel provides a way to work through this by making the initializer available as a thunk, these semantics have been rejected by implementers as adding runtime cost.

### Why prioritize the features of "legacy" decorators, like classes, over other features that decorators could provide?

"Legacy" decorators have grown to huge popularity in the JavaScript ecosystem. That proves that they were onto something, and solve a problem that many people are facing. This proposal takes that knowledge and runs with it, building in native support in the JavaScript language. It does so in a way that leaves open the opportunity to use the same syntax for many more different kinds of extensions in the future, as described in [EXTENSIONS.md](./EXTENSIONS.md).

### Could we support decorating objects, parameters, blocks, functions, etc?

Yes! Once we have validated this core approach, the authors of this proposal plan to come back and make proposals for more kinds of decorators. In particular, given the popularity of TypeScript parameter decorators, we are considering including parameter decorators in this proposal's initial version. See [EXTENSIONS.md](./EXTENSIONS.md).

### Will decorators let you access private fields and methods?

Yes, private fields and methods can be decorated just like ordinary fields and methods. The only difference is that the `name` key on the context object is only a description of the element, not something we can be used to access it. Instead, an `access` object with `get`/`set` functions is provided. See the example under the heading, "Access".

### How should this new proposal be used in transpilers, when it's implemented?

This decorators proposal would require a separate transpiler implementation from the previous legacy/experimental decorator semantics. The semantics could be switched into with a build-time option (e.g., a command-line flag or entry in a configuration file). Note that this proposal is expected to continue to undergo significant changes prior to Stage 3, and it should not be counted on for stability.

Modules exporting decorators are able to easily check whether they are being invoked in the legacy/experimental way or in the way described in this proposal, by checking whether their second argument is an object (in this proposal, always yes; previously, always no). So it should be possible to maintain decorator libraries which work with both approaches.

### What would the specification look like in detail?

We are currently in the process of writing it, and will be updating the repo as progress is made.

### What makes this decorators proposal more statically analyzable than previous proposals? Is this proposal still statically analyzable even though it is based on runtime values?

In this decorators proposal, each decorator position has a consistent effect on the shape of the code generated after desugaring. No calls to `Object.defineProperty` with dynamic values for property attributes are made by the system, and it is also impractical to make these sorts of calls from user-defined decorators as the "target" is not provided to decorators; only the actual contents of the functions is left until runtime.

### How does static analyzability help transpilers and other tooling?

Statically analyzable decorators help tooling to generate faster and smaller JavaScript from build tools, enabling the decorators to be transpiled away, without causing extra data structures to be created and manipulated at runtime. It will be easier for tools to understand what's going on, which could help in tree shaking, type systems, etc.

An attempt by LinkedIn to use the previous Stage 2 decorators proposal found that it led to a significant performance overhead. Members of the Polymer and TypeScript team also noticed a significant increase in generated code size with these decorators.

By contrast, this decorator proposal should be compiled out into simply making function calls in particular places, and replacing one class element with another class element. We're working on proving out this benefit by implementing the proposal in Babel, so an informed comparison can be made before proposing for Stage 3.

Another case of static analyzability being useful for tooling was named exports from ES modules. The fixed nature of named imports and exports helps tree shaking, importing and exporting of types, and here, as the basis for the predictable nature of composed decorators. Even though the ecosystem remains in transition from exporting entirely dynamic objects, ES modules have taken root in tooling and found to be useful because, not despite, their more static nature.

### How does static analyzability help native JS engines?

Although a [JIT](https://en.wikipedia.org/wiki/Just-in-time_compilation) can optimize away just about anything, it can only do so after a program "warms up". That is, when a typical JavaScript engine starts up, it's not using the JIT--instead, it compiles the JavaScript to bytecode and executes that directly. Later, if code is run lots of times, the JIT will kick in and optimize the program.

Studies of the execution traces of popular web applications show that a large proportion of the time starting up the page is often in parsing and execution through bytecode, typically with a smaller percentage running JIT-optimized code. This means that, if we want the web to be fast, we can't rely on fancy JIT optimizations.

Decorators, especially the previous Stage 2 proposal, added various sources of overhead, both for executing the class definition and for using the class, that would make startup slower if they weren't optimized out by a JIT. By contrast, composed decorators always boil down in a fixed way to built-in decorators, which can be handled directly by bytecode generation.

### What happened to coalescing getter/setter pairs?

This decorators proposal is based on a common model where each decorator affects just one syntactic element--either a field, or a method, or a getter, or setter, or a class. It is immediately visible what is being decorated.

The previous "Stage 2" decorators proposal had a step of "coalescing" getter/setter pairs, which ended up being somewhat similar to how the legacy decorators operated on property descriptors. However, this coalescing was very complicated, both in the specification and implementations, due to the dynamism of computed property names for accessors. Coalescing was a big source of overhead (e.g., in terms of code size) in polyfill implementations of "Stage 2" decorators.

It is unclear which use cases benefit from getter/setter coalescing. Removing getter/setter coalescing has been a big simplification of the specification, and we expect it to simplify implementations as well.

If you have further thoughts here, please participate in the discussion on the issue tracker: [#256](https://github.com/tc39/proposal-decorators/issues/256).

### Why is decorators taking so long?

We are truly sorry about the delay here. We understand that this causes real problems in the JavaScript ecosystem, and are working towards a solution as fast as we can.

It took us a long time for everyone to get on the same page about the requirements spanning frameworks, tooling and native implementations. Only after pushing in various concrete directions did we get a full understanding of the requirements which this proposal aims to meet.

We are working to develop better communication within TC39 and with the broader JavaScript community so that this sort of problem can be corrected sooner in the future.
