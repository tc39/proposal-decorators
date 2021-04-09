# Decorators

![Stage 3](https://badges.aleen42.com/src/tc39_4.svg)

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

Decorators have three primary capabilities:

1. They can **replace** the value that is being decorated with a _matching_ value that has the same semantics. (e.g. a decorator can replace a method with another method, a field with another field, a class with another class, and so on).
2. They can associate **metadata** with the value that is being decorated. This metadata can then be read externally and used for metaprogramming and introspection.
3. They can provide **access** to the value that is being decorated, via metadata. For public values, they can do this via the name of the value. For private values, they receive accessor functions which they can then choose to share.

Essentially, decorators can be used to metaprogram and add functionality to a value, without fundamentally changing its external behavior.

This proposal differs from previous iterations where decorators could replace the decorated value with a completely different type of value. The requirement for decorators to only replace a value with one that has the same semantics as the original value fulfills two major design goals:

- **It should be easy both to use decorators and to write your own decorators.** Previous iterations such as the _static decorators_ proposal were complicated for authors and implementers in particular. In this proposal, decorators are plain functions, and are accessible and easy to write.
- **Decorators should affect the thing they're decorating, and avoid confusing/non-local effects.** Previously decorators could change the decorated value in unpredictable ways, and also add completely new values which were unrelated. This was problematic both for _runtimes_, since it meant decorated values could not be analyzed statically, and for _developers_, since decorated values could turn into completely different types of values without any indicator to the user.

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

Finally, there is an additional syntax which can be used when decorating a value that allows the decorator to run additional initialization code for that value:

```js
@init:customElement('my-element')
class Example {
  @init:eventHandler('click')
  onClick() {
    // ...
  }
}
```

This syntax can be used with any decorator type, and is used in cases where additional setup steps are necessary.

## Detailed Design

In general, decorators receive two parameters:

1. The value being decorated, or `undefined` in the case of class fields which are a special case (see below for details).
2. A context object containing metadata about the value being decorated

Using TypeScript interfaces for brevity and clarity, this is the general shape of the API:

```ts
type Decorator = (value: Input, context: {
  kind: string;
  name?: string | symbol;
  access?: {
    get?(): unknown;
    set?(value: unknown): void;
  };
  isPrivate?: boolean;
  isStatic?: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => Output | void;
```

`Input` and `Output` here represent the values passed to and returned from a given decorator. Each type of decorator has a different input and output, and these are covered below in more detail. All decorators can choose to return nothing, which defaults to using the original, undecorated value.

The context object also varies depending on the value being decorated. Breaking down the properties:

- `kind`: The kind of decorated value. This can be used to assert that the decorator is used correctly, or to have different behavior for different types of values. It is one of the following values.
  - `"class"`
  - `"init-class"`
  - `"method"`
  - `"init-method"`
  - `"getter"`
  - `"setter"`
  - `"field"`
  - `"auto-accessor"`
- `name`: The name of the value. This is only available for classes and _public_ class elements.
- `access`: An object containing methods to access the value. This is only available for _private_ class elements, since public class elements can be accessed externally by knowing the name of the element. These methods also get the _final_ value of the private element on the instance, not the current value passed to the decorator. This is important for most use cases involving access, such as type validators or serializers. See the section on Access below for more details.
- `isStatic`: Whether or not the value is a `static` class element. Only applies to class elements.
- `isPrivate`: Whether or not the value is a private class element. Only applies to class elements.
- `defineMetadata`: Allows the user to define some metadata to be associated with this property. This metadata can then be accessed on the class via `Symbol.metadata`. See the section on Metadata below for more details.

### Decorator APIs

#### Class Methods

```ts
type ClassMethodDecorator = (value: Function, context: {
  kind: "method";
  name?: string | symbol;
  access?: { get(): unknown };
  isStatic: boolean;
  isPrivate: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => Function | void;
```

Class method decorators receive the method that is being decorated as the first value, and can optionally return a new method to replace it. If a new method is returned, it will replace the original on the prototype (or on the class itself in the case of static methods). If any other type of value is returned, an error will be thrown.

Method decorators do not receive access to the instances of the class, and cannot be used to add functionality that requires it. An example of such a decorator is the `@bound` decorator, which would bind the method to the instance of the class. In order to add instance initialization logic, users must convert the method into an Initialized Method (see below for more details).

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
  m(arg) {
    this.x = arg;
  }
}

C.prototype.m = logged(C.prototype.m, {
  kind: "method",
  name: "m",
  isStatic: false,
  isPrivate: false,
  defineMetadata() { /**/ }
});
```

#### Class Accessors

```ts
type ClassGetterDecorator = (value: Function, context: {
  kind: "getter";
  name?: string | symbol;
  access?: { get?(): unknown };
  isStatic: boolean;
  isPrivate: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => Function | void;

type ClassSetterDecorator = (value: Function, context: {
  kind: "setter";
  name?: string | symbol;
  access?: { set?(value: unknown): void };
  isStatic: boolean;
  isPrivate: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => Function | void;
```

Accessor decorators receive the original underlying getter/setter function as the first value, and can optionally return a new getter/setter function to return it. Like method decorators, this new function is placed on the prototype in place of the original (or on the class for static accessors), and if any other type of value is returned, an error will be thrown.

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
  defineMetadata() { /**/ }
});

Object.defineProperty(C.prototype, "x", { set });
```

#### Class Fields

```ts
type ClassFieldDecorator = (value: undefined, context: {
  kind: "field";
  name?: string | symbol;
  access?: { get(): unknown, set(value: unknown): void };
  isStatic: boolean;
  isPrivate: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
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
  defineMetadata() { /**/ }
}) ?? (initialValue) => initialValue ;

class C {
  x = initializeX(1);
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

#### Classes

```ts
type ClassDecorator = (value: Function, context: {
  kind: "class";
  name: string | undefined;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => Function | void;
```

Class decorators receive the class that is being decorated as the first parameter, and may optionally return a new class to replace it. If a non-constructable value is returned, then an error is thrown.

We can further extend our `@logged` decorator to log whenever an instance of a class is created:

```js
function logged(value, { kind, name }) {
  if (kind === "class") {
    return class extends value {
      constructor(...args) {
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
  defineMetadata() { /**/ }
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
type ClassPropDecorator = (
  value: {
    get: () => unknown;
    set(value: unknown) => void;
  },
  context: {
    kind: "auto-accessor";
    name?: string | symbol;
    access?: { get(): unknown, set(value: unknown): void };
    isStatic: boolean;
    isPrivate: boolean;
    defineMetadata(key: string | symbol | number, value: unknown);
  }
) => {
  get?: () => unknown;
  set?: (value: unknown) => void;
  initialize?: (initialValue: unknown) => unknown;
} | void;
```

Unlike field decorators, auto-accessor decorators receive a value, which is an object containing the `get` and `set` accessors defined on the prototype of the class (or the class itself in the case of static props). The decorator can then wrap these and return a _new_ `get` and/or `set`, allowing access to the property to be intercepted by the decorator. This is a capability that is not possible with fields, but is possible with props. In addition, props can return an `initialize` function, which can be used to change the initial value of the prop, similar to field decorators. If an object is returned but any of the values are omitted, then the default behavior for the omitted values is to use the original behavior. If any other type of value besides an object containing these properties is returned, an error will be thrown.

Further extending the `@logged` decorator, we can make it handle auto-accessors as well, logging when the auto-accessor is initialized and whenever it is accessed:

```js
function logged(value, { kind, name }) {
  if (kind === "auto-accessor") {
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

      initialize(initialValue) {
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
  #x = initializeX(1);

  get x() {
    return this.#x;
  }

  set x(val) {
    this.#x = val;
  }
}

let { get: oldGet, set: oldSet } = Object.getOwnPropertyDescriptor(C.prototype, "x");

let {
  get: newGet,
  set: newSet,
  initialize: initializeX
} = logged(
  { get: oldGet, set: oldSet },
  {
    kind: "auto-accessor",
    name: "x",
    isStatic: false,
    isPrivate: false,
    defineMetadata() { /**/ }
  }
);

Object.defineProperty(C.prototype, "x", { get: newGet, set: newSet });
```

### `@init:` Decorators

The `@init:` syntax can be used with any decorator, and allows the decorator to return an `initialize` function along with the new decorated value. This initializer has different semantics depending on the type of value decorated, and the placement of the value.

- Class decorator initializers are run after the class has been fully defined, and class static fields have been assigned.
- Class element initializers run after an instance of the class has been created and the constructor for the class has been run, but _before_ any subclass constructors are run.
- Class _static_ element initializers run after the class has been fully defined, and class static fields have been assigned.

In general, init decorators have the same signatures as the equivalent standard decorators, with the exception that they always return an object and can optionally return an `initialize` function on that object. Since class fields and props already have the ability to run code on initialization, their signatures do not change, but the syntax can be used with them for consistency.

#### Class Init Decorator

```ts
type ClassDecorator = (value: Function, context: {
  kind: "init-class";
  name: string | undefined;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => {
  definition?: Function;
  initialize?: (value: Function) => void;
}
```

Like class decorators, init-class decorators receive the class definition and can return a new class definition, alongside an `initialize` function. We can further extend our `@logged` decorator to log when the class has finished being defined:

```js
function logged(value, { kind, name }) {
  if (kind === "init-class") {
    return {
      definition: class extends value {
        constructor(...args) {
          console.log(`constructing an instance of ${name} with arguments ${args.join(", ")}`);
        }
      },

      initialize() {
        console.log(`finished defining ${this.name}`);
      }
    };
  }

  // ...
}

@init:logged
class C {}

new C(1);
// constructing an instance of C with arguments 1
```

This example roughly "desugars" to the following (i.e., could be transpiled as such):

```js
class C {}

let { definition, initialize } = logged(C, {
  kind: "init-class",
  name: "C",
  defineMetadata() { /**/ }
});

C = definition ?? C;

initialize.call(C);

new C(1);
```

If the class being decorated is an anonymous class, then the `name` property of the `context` object is `undefined`.

#### Class Init Method Decorators

```ts
type ClassInitMethodDecorator = (value: Function, context: {
  kind: "init-method";
  name?: string | symbol;
  access?: { get(): unknown };
  isStatic: boolean;
  isPrivate: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => {
  method?: Function,
  initialize?: (value: Function) => void
} | void;
```

Like method decorators, init-method decorators receive the original function defined on the prototype as the function being decorated. They can optionally return a new method and an initializer function. The new method, if present, is defined in place of the original method on the prototype, and the initializer function, if present, is called during construction of class instances.

Further extending the `@logged` decorator, we can make it handle init-methods as well, logging both whenever an instance of the class is initialized and whenever it is called.

```js
function logged(value, { kind, name }) {
  if (kind === "init-method") {
    return {
      method(...args) {
        console.log(`starting ${name} with arguments ${args.join(", ")}`);
        const ret = value.call(this, ...args);
        console.log(`ending ${name}`);
        return ret;
      },

      initialize(initialValue) {
        console.log(`initializing ${name}`);
        return initialValue;
      }
    };
  }

  // ...
}

class C {
  @init:logged
  m() {}
}

let c = new C();
// initializing m
c.m(1);
// starting m with arguments 1
// ending m
```

This example roughly "desugars" to the following:

```js
let initializeM;

class C {
  constructor() {
    initializeM.apply(this);
  }

  m() {}
}

let {
  method,
  initialize
} = logged(
  C.prototype.m,
  {
    kind: "prop",
    name: "x",
    isPrivate: false,
    defineMetadata() { /**/ }
  }
);

initializeM = initialize;
C.prototype.m = method;
```

#### Class Init Accessor Decorators

```ts
type ClassGetterDecorator = (value: Function, context: {
  kind: "init-getter";
  name?: string | symbol;
  access?: { get?(): unknown };
  isStatic: boolean;
  isPrivate: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => {
  get?: Function,
  initialize?: (value: Function) => Function
} | void;

type ClassSetterDecorator = (value: Function, context: {
  kind: "init-setter";
  name?: string | symbol;
  access?: { set?(value: unknown): void };
  isStatic: boolean;
  isPrivate: boolean;
  defineMetadata(key: string | symbol | number, value: unknown);
}) => {
  set?: Function,
  initialize?: (value: Function) => Function
} | void;
```

Like accessor decorators, init-getter and init-setter decorators receive the original getter/setter defined on the prototype as the value being decorated. They can optionally return a new method and an initializer function. The new method, if present, is defined in place of the original method on the prototype, and the initializer function, if present, is called when during the construction of the class instance.

Further extending the `@logged` decorator, we can make it handle init-methods as well, logging both whenever an instance of the class is initialized and whenever it is called.

```js
function logged(value, { kind, name }) {
  if (kind === "init-getter") {
    return {
      method(...args) {
        console.log(`accessing ${name}`);
        return value.call(this, ...args);
      },

      initialize(initialValue) {
        console.log(`initializing ${name}`);
        return initialValue;
      }
    };
  }

  // ...
}

class C {
  @init:logged
  get m() {}
}

let c = new C();
// initializing m
c.m;
// accessing m
// ending m
```

This example roughly "desugars" to the following:

```js
let initializeM;

class C {
  constructor() {
    initializeM.apply(this);
  }

  get m() {}
}

let {
  method,
  initialize
} = logged(
  Object.getOwnPropertyDescriptor(C.prototype, 'm'),
  {
    kind: "prop",
    name: "x",
    isPrivate: false,
    defineMetadata() { /**/ }
  }
);

initializeM = initialize;
Object.defineProperty(C.prototype, {
  get: method,
});
```

### Metadata

Every decorator has the ability to expose metadata related to the decorated value via the `defineMetadata` method on the context object. This method recieves two parameters, a key which must be a valid property key (string/symbol/number), and a value which can be anything.

```js
const MY_META = Symbol();

function myMeta(value, context) {
  context.defineMetadata("my-meta", true);
  context.defineMetadata(MY_META, 123);
}
```

All of the metadata defined on a single decorated value is collected into an object with corresponding keys and values. For instance, the above decorator would produce the following object:

```js
let meta = {
  "my-meta": true,
  [MY_META]: 123,
}
```

This object would then be assigned to another object representing all of the metadata on the class _or_ class prototype, depending on its placement. Static class elements are placed on one object, and non-static class elements are placed on another. In addition, public element metadata is namespaced under the `public` key of this object, and private element metadata is namespaced under the `private` key. So for instance, this example:

```js
const MY_META = Symbol();

function myMeta(value, context) {
  context.defineMetadata("my-meta", true);
  context.defineMetadata(MY_META, true);
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

Would produce the following two metadata objects:

```js
let staticMeta = {
  public: {
    constructor: { "my-meta": true, [MY_META]: true },
    x: { "my-meta": true, [MY_META]: true },
    y: { "my-meta": true, [MY_META]: true },
  },

  private: {
    "#z": { "my-meta": true, [MY_META]: true },
  }
}

let nonStaticMeta = {
  public: {
    a: { "my-meta": true, [MY_META]: true },
    b: { "my-meta": true, [MY_META]: true },
  },

  private: {
    "#c": { "my-meta": true, [MY_META]: true },
  }
}
```

Notes:

1. Metadata defined by a class decorator is assigned to the static `constructor` key. This is because `constructor` is a reserved name within class definitions, so it cannot conflict with another class element with the same name.
2. Private fields are assigned to a property that is the _spelling_ of their name in code. This key cannot be used to access the private element itself, it only serves as a unique identifier to associate the metadata with. To see how metadata associated with private elements can be used, and how access can be exposed, read the section on Access below.

These metadata objects are then exposed via the `Symbol.metadata` property on the class (for static metadata) and the class prototype (for non-static metadata). So the above example is roughly equivalent, when executed, to:

```js
C[Symbol.metadata] = {
  constructor: { "my-meta": true, [MY_META]: true },
  baz: { "my-meta": true, [MY_META]: true },
  qux: { "my-meta": true, [MY_META]: true },
};

C.prototype[Symbol.metadata] = {
  foo: { "my-meta": true, [MY_META]: true },
  bar: { "my-meta": true, [MY_META]: true },
};
```

This is not quite a "desugaring", since we would still need to execute the decorators to determine what metadata would be generated. This is mainly for illustrative purposes.

If two class elements exist on the same class with the same name, then any metadata associated with either element gets combined with metadata on the other:

```js
function meta1(value, context) {
  context.defineMetadata('meta1', 1);
}

function meta2(value, context) {
  context.defineMetadata('meta2', 2);
}

class C {
  @meta1
  m() {};

  @meta2
  m = 123;
}

C.prototype[Symbol.metadata].m;
// { meta1: 1, meta2: 2 }
```

In addition, subsequent definitions to the same key will result in an array of values instead of a single value.

```js
function validateString(value, context) {
  context.defineMetadata("validations", (value) => typeof value === "string"));
}

function validateMaxLength(length) {
  return (value, context) => {
    context.defineMetadata("validations", (value) => value.length < length);
  }
}

class C {
  @validateString
  @validateMaxLength(10)
  foo = "hello!";
}

C.prototype[Symbol.metadata].foo.validations.length;
// 2
```

This API design meets the following goals:

- It is easy for any decorator library to directly access the metadata that it defined. Defining metadata requires a key, which the library can then use to access it later. Alternatives include placing all metadata in an array, but this would require users to manually sort through and find their own metadata.
- Metadata is easy to access, and it's possible to tell which class element it was associated with.
- Metadata access is uniform, all metadata is accessed the same way. There is no need to learn a different technique for each type of class element.
- Multiple decorators can collaborate, progressively building up metadata on a single key. This means that libraries such as validation libraries can associate multiple values with a single key.

#### Hiding metadata

This metadata API is inherently open. By defining metadata, anyone can access it via `Symbol.metadata`. Even if a Symbol is used as the key, users can find these properties via `Object.getOwnPropertySymbols`.

Sometimes, users may wish to hide the details of their metadata, to prevent external code from reading it. Users can do this by exposing a _key_ in the metadata, rather than the metadata itself. This key can then be used to read the metadata from a private data store, only available in module scope for instance. For example, you could do this with an object and a WeakMap like so:

```js
MY_META = new WeakMap();

function myMeta(value, context) {
  let key = {};

  MY_META.set(key, { secret: "values" })

  context.defineMetadata("my-meta", key);
}
```

The metadata can then be accessed using this key. For example:

```js
class C {
  @myMeta x = 1;
}

MY_META.get(C.prototype[Symbol.metadata].x);
// { secret: "values" }
```

### Access

So far we've seen how metadata can be defined for decorated values, and for public values its possible to see how this could be used. For instance, one could develop a validation library which annotates values with various validations, and then reads the metadata when validating:

```js
function validateString(value, context) {
  context.defineMetadata("validation", (value) => typeof value === "string"));
}

function validate(instance) {
  let metadata = Object.getPrototypeOf(instance)[Symbol.metadata];

  for (let key in metadata) {
    let validation = metadata[key].validation;

    if (validation) {
      let value = instance[key];
      let isValid = validation(value);

      if (!isValid) {
        return false;
      }
    }
  }

  return true;
}

class C {
  @validateString
  foo = "hello!";
}

let c = new C();
validate(c);
// true

c.foo = 123;
validate(c);
// false
```

However, it is not possible to do this as directly _private_ elements, as the key the metadata is defined with cannot be used to access it externally.

This is the purpose of the `access` object that is passed to private elements. This object gives decorators a way to expose access via metadata, like so:

```js
function validatePrivateString(value, context) {
  let { get } = context.access;

  context.defineMetadata("validation", (instance) => {
    let value = get.call(instance);

    return typeof value === "string";
  });
}

function validate(instance) {
  let metadata = Object.getPrototypeOf(instance)[Symbol.metadata];

  for (let key in metadata) {
    let validation = metadata[key].validation;

    if (validation && !validation(instance)) {
      return false;
    }
  }

  return true;
}

class C {
  @validatePrivateString
  #foo = "hello!";

  updateFoo(val) {
    this.#foo = val;
  }
}

let c = new C();
validate(c);
// true

c.updateFoo(123);
validate(c);
// false
```

Calling the `get` and `set` functions is equivalent to accessing the value on the instance.

```js
function exposeField(value, context) {
  context.defineMetadata("fieldAccess", context.access);
}

class C {
  @exposeField #x = 1;

  updateX() {
    let { get, set } = C.prototype[Symbol.metadata]["#x"];

    let x1 = get.call(this);
    set.call(this, x1 + 1);

    // is equivalent to...
    let x2 = this.#x;
    this.#x = x2 + 1;
  }
}
```

This means that if you call `get` or `set` with a private field or accessor, then it will _trigger_ the accessors on the instance.

Access is generally provided based on whether or not the value is a value meant to be read or written. Fields and props can be both read and written to. Accessors can either be read in the case of getters, or wriitten in the case of setters. Methods can only be read.

## Syntax

This decorators proposal uses the syntax of the previous Stage 2 decorators proposal. This means that:
- Decorator expressions are restricted to a chain of variables, property access with `.` but not `[]`, and calls `()`. To use an arbitrary expression as a decorator, `@(expression)` is an escape hatch.
- Class expressions may be decorated, not just class declarations.
- Class decorators come after `export` and `default`.

There is no special syntax for defining decorators; any function can be applied as a decorator.

## Detailed semantics

The three steps of decorator evaluation:

1. Decorator expressions (the thing after the `@`) are *evaluated* interspersed with computed property names.
1. Decorators are *called* (as functions) during class definition, after the methods have been evaluated but before the constructor and prototype have been put together.
1. Decorators are *applied* (mutating the constructor and prototype) all at once, after all of them have been called.

The semantics here generally follow the consensus at the May 2016 TC39 meeting in Munich.

### 1. Evaluating decorators

Decorators are evaluated as expressions, being ordered along with computed property names. This goes left to right, top to bottom. The result of decorators is stored in the equivalent of local variables to be later called after the class definition initially finishes executing.

### 2. Calling decorators

#### The element being wrapped: the first parameter

The first parameter, of what the decorator is wrapping, depends on what is being decorated:
- In a method, init-method, getter or setter decorator: the relevant function object
- In a class decorator: the class
- In a field: An object with two properties
    - `get`: A function which takes no arguments, expected to be called with a receiver which is the appropriate object, returning the underlying value.
    - `set`: A function which takes a single argument (the new value), expected to be called with a receiver which is the object being set, expected to return `undefined`.

#### The context object: the second parameter

The context object--the object passed as the second argument to the decorator--contains the following properties:
- `kind`: One of
    - `"class"`
    - `"method"`
    - `"init-method"`
    - `"getter"`
    - `"setter"`
    - `"field"`
- `name`:
    - Public field or method: the `name` is the String or Symbol property key.
    - Private field or method: missing (could be provided as some representation of the private name, in a follow-on proposal)
    - Class: missing
- `isStatic`:
    - Static field or method: `true`
    - Instance field or method: `false`
    - Class: missing

The "target" (constructor or prototype) is not passed to field or method decorators, as it has not yet been built when the decorator runs.

#### The return value

The return value is interpreted based on the type of decorator. The return value is expected as follows:
- Class: A new class
- Method, getter or setter: A new function
- field: An object with three properties (each individually optional):
    - `get`: A function of the same form as the `get` property of the first argument
    - `set`: Ditto, for `set`
    - `initialize`: A function called with the same arguments as `set`, which returns a value which is used for the initializing set of the variable. This is called when initially setting the underlying storage based on the field initializer or method definition. This method shouldn't call the `set` input, as that would trigger an error. If `initialize` isn't provided, `set` is not called, and the underlying storage is written directly. This way, `set` can count on the field already existing, and doesn't need to separately track that.
- Init method: An object with the properties
    - `method`: A function to replace the method
    - `initialize`: A function with no arguments, whose return value is ignored, which is called with the newly constructed object as the receiver.

### 3. Applying decorators

Decorators are applied after all decorators have been called. The intermediate steps of the decorator application algorithm are not observable--the newly constructed class is not made available until after all method and non-static field decorators have been applied.

The class decorator is called only after all method and field decorators are called and applied.

Finally, static fields are executed and applied.

## Possible extensions

Decorators on further constructs are investigated in [EXTENSIONS.md](./EXTENSIONS.md).

## Design goals

- It should be easy both to use decorators and to write your own decorators.
- Decorators should affect the thing they're decorating, and avoid confusing/non-local effects.

### Use case analysis

Some essential use cases that we've found include:
- Storing metadata about classes and methods
- Turning a field into an accessor
- Wrapping a method or class

Previously, there was concern that it was important to store metadata about fields without converting them into accessors. However, the use cases that the decorator champion group has found for metadata around fields (e.g., serialization frameworks, ORMs) were each in conjunction with a specialized TypeScript option to emit metadata for types. Such a TypeScript extension is beyond the scope of what the JavaScript standard covers. We expect that either, types will continue to be covered by language extensions like TypeScript, or a future TC39 proposal would include the appropriate facilities for type-based metadata.

(TODO: Fill this in with more detail)

### Transpiler and native implementation constraints

From transpilers:
1. The transpiler output shouldn't be too big (both in terms of the direct output of the translation, and the size of the support library)
2. It should be possible to transpile on a file-by-file basis, without cross-file information

From native implementations:
A: The "shape" of the class should be apparent syntactically, without executing code
B: It should not be too complicated to process decorators, as this corresponds to a complex implementation
C: Minimize or eliminate observable mutations to objects while setting up the class

Constraint 1 is met by the simple desugarings, listed above, which avoid reliance on any kind of complex support library.

Constraint 2 is met by treating the decorator as a function, so no cross-file knowledge is needed.

Constraint A is met by making all shape changes syntactically apparent where the class is defined, by making each decorator type be associated with one fixed transformation.

Constraint B is met by the same simple desugarings, and by eliminating the complicated descriptors present in Stage 2 decorators.

Constraint C implies that we should not expose the class to JavaScript code while decorators are incrementally applying to it. This is met by eliminating the "target" concept from legacy/experimental decorators, and not passing the class under construction to decorators.

### Out of scope

Some things that have been described as potential decorators would *not* fit into the scheme here, and would require either dedicated syntax to meet the constraints raised by TC39 delegates, or the use of existing idioms to work around the need for a decorator.
- `@set`: This decorator would change a field from [[Define]] semantics to [[Set]]. This decorator changes which kind of code executes in the constructor in a different way which is not visible from syntax. These semantics can be accessed by putting a line of code in the constructor rather than a field declaration. However, note that this proposal reduces the need for opting into [[Set]] semantics in multiple ways:
    - [[Set]] semantics drove how fields worked with legacy/experimental decorators which created accessors. These mechanics are replaced in this proposal by having decorated field declarations initialize the underlying storage, not shadow the accessor.
    - If a setter is inherited, it is possible to write a decorator for a field which specifically calls super getters and setters, rather than using the underlying storage.
- `@frozen`: This decorator freezes the whole class, including static fields. Such a change is not possible within the phase ordering of decorators, where class decorators run before static fields are executed. Instead, the class can be frozen in a single line after the class, or potential future syntax for freezing the class.
    - It is possible to write a `@frozen` class decorator which *mostly* works, but which prevents the use of static fields.
- `@enumerable`: This decorator would make a method enumerable, overriding its default of non-enumerable. Decorators cannot change property attributes, as they do not receive property descriptors to manipulate them as in Stage 1 decorators, and they are not passed the constructor of the class to do so imperatively. This is to meet requirements from implementations that decorators leave classes with statically predictable shapes. Instead, changes like this could be done by `Object.defineProperty` calls after the class definition executes.
- `@reader`: This decorator for a private field would create a public accessor to read it. It is impossible to create, as decorators are not given access to the class. Such a change in shape would run counter to the "static shape" goals from native implementers.

## Open questions

- **Accessor coalescing**: In the above proposal, getters and setters are decorated separately, whereas in earlier decorators proposals, they were coalesced into a unit which applies to the decorator together. This is done in order to keep the decorator desugaring simple and efficient, without the need for an intermediate data structure to associate getters with setters (which may be dynamic due to computed property names). Should decorator coalescing be restored?
- **Metadata format**: How should metadata added by decorators be represented in the object graph? Should there be a built-in library of functions to query this metadata? How should adding metadata to class elements be timed relative to other observable operations with decorators?

## Standardization plan

- Write spec text and tests and implement in experimental transpilers
- Collect feedback from JavaScript developers testing the transpiler implementation
- Iterate on open questions within the proposal, presenting them to TC39 and discussing further in the biweekly decorators calls, to bring a conclusion to committee in a future meeting
- Propose for Stage 3 no sooner than six months after prototyping begins, so we have time to collect experience from developers in transpilers

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

Yes, private fields and methods can be decorated just like ordinary fields and methods. The only difference is that no property key is available in the context object, and instead an `access` object with `get`/`set` functions is provided. See the example under the heading, "Access".

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
