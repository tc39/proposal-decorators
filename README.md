# Decorators

This README describes a new proposal, to be presented to TC39 in the September 2020 meeting.

# Introduction

Decorators are a proposal for extending JavaScript classes which is widely adopted among developers in transpiler environments, with broad interest in standardization. TC39 has been iterating on decorators proposals for over five years. This document describes a new proposal for decorators based on elements from all past proposals.

**Decorators** `@decorator` are *functions* called on class elements or other JavaScript syntax forms during definition, potentially *wrapping* or *replacing* them with a new value returned by the decorator.

A decorated class field is treated as wrapping a getter/setter pair for accessing that storage. Decorated storage is useful for observation/tracking, which has been a pain point for the original legacy/experimental decorators combined with [[Define]] semantics for class fields. These semantics are based on Michel Weststrate's ["trapping decorators" proposal](https://github.com/tc39/proposal-decorators/issues/299).

Decorators may also annotate a class element with *metadata*. These are simple, unrestricted object properties, which are collected from all decorators which add them, and made available as a set of nested objects in the `[Symbol.metadata]` property.

By making decorators always simply wrap what they are decorating, rather than performing other transformations, this proposal aims to meet the following requirements:
- The class "shape" is visible without executing the code, making decorators more optimizable for engines.
- Implementations can work fully on a per-file basis, with no need for cross-file knowledge.
- No new namespace or type of second-class value is added--decorators are functions.

# Examples

A few examples of how to implement and use decorators in this proposal:

## `@logged`

The `@logged` decorator logs a console message when a method starts and finishes. Many other popular decorators will also want to wrap a function, e.g., `@deprecated`, `@debounce`, `@memoize`, etc.

Usage:

```mjs
import { logged } from "./logged.mjs";

class C {
  @logged
  m(arg) {
    this.#x = arg;
  }

  @logged
  set #x(value) { }
}

new C().m(1);
// starting m with arguments 1
// starting set #x with arguments 1
// ending set #x
// ending m
```

`@logged` can be implemented in JavaScript as a decorator. Decorators are functions that are called with an argument containing what's being decorated. For example:
- A decorated method is called with the method being decorated
- A decorated getter is called with the getter function being decorated
- A decorated setter is called with the setter function being decorated

(Decorators are called with a second parameter giving more context, but we don't need those details for the `@logged` decorator.)

The return value of a decorator is a new value that replaces the thing it's wrapping. For methods, getters and setters, the return value is another function to replace that method, getter or setter.

```mjs
// logged.mjs

export function logged(f) {
  const name = f.name;
  function wrapped(...args) {
    console.log(`starting ${name} with arguments ${args.join(", ")}`);
    const ret = f.call(this, ...args);
    console.log(`ending ${name}`);
    return ret;
  }
  Object.defineProperty(wrapped, 'name', { value: name, configurable: true })
  return wrapped;
}
```

This example roughly "desugars" to the following (i.e., could be transpiled as such):

```js
let x_setter;

class C {
  m(arg) {
    this.#x = arg;
  }

  static #x_setter(value) { }
  static { x_setter = C.#x_setter; }
  set #x(value) { return x_setter.call(this, value); }
}

C.prototype.m = logged(C.prototype.m, { kind: "method", name: "method", isStatic: false });
x_setter = logged(x_setter, {kind: "setter", isStatic: false});
```

Note that getters and setters are decorated separately. Accessors are not "coalesced" as in earlier decorators proposals (unless they are generated for a field; see below).

This desugaring is in terms of the [class static block proposal](https://github.com/tc39/proposal-class-static-block) which exposes a `static { }` construct to be used inside a class body, which runs in the lexical scope of the class. A desugaring in terms of throwaway static private fields would also be possible, but is messy and confusing. However, the decorators proposal does not depend on class static blocks; this is just an explanatory device.

## `@defineElement`

[HTML Custom Elements](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) lets you define your own HTML element. Elements are registered using `customElements.define`. Using decorators, the registration can happen up-front:

```mjs
import { defineElement } from "./defineElement.mjs";

@defineElement('my-class')
class MyClass extends HTMLElement { }
```

Classes can be decorated just like methods and accessors. The class shows up in the `value` option.

```mjs
// defineElement.mjs
export function defineElement(name, options) {
  return klass => { customElements.define(name, klass, options); return klass; }
}
```

The decorator takes arguments at its usage site, so it is implemented as a function that returns another function. You can think of it as a "decorator factory": after you apply the arguments, it gives you another decorator.

This decorator usage could be desugared as follows:

```js
class MyClass extends HTMLElement { }
MyClass = defineElement('my-class')(MyClass, {kind: "class"});
```

### Decorators adding metadata

Decorators can add metadata about class elements by adding a `metadata` property of the context object that is passed in to them. All of the metadata objects are `Object.assign`'ed together and placed in a property reachable from `[Symbol.metadata]` on the class. For example:

```mjs
@annotate({x: "y"}) @annotate({v: "w"}) class C {
  @annotate({a: "b"}) method() { }
  @annotate({c: "d"}) field;
}

C[Symbol.metadata].class.x                     // "y"
C[Symbol.metadata].class.v                     // "w"
C[Symbol.metadata].prototype.methods.method.a  // "a"
C[Symbol.metadata].instance.fields.field.c     // "d"
```

**NOTE:** The exact format of the annotations object is not very well-thought-out and could use more refinement. The main thing I'd like to illustrate here is, it's just an object, with no particular support library to read or write it, and it's automatically created by the system.

This decorator `@annotate` could be implemented as follows:

```js
function annotate(metadata) {
  return (_, context) => {
    context.metadata = metadata;
    return _;
  }
}
```

Each time a decorator is called, it is passed a new context object, and after each decorator returns, the context object's `metadata` property is read, and if it's not undefined, it's included in the `[Symbol.metadata]` for that class element.

<!--
The desugarings in this article usually omit it, but metadata is desugared as such:
class C {
  method() {  }
}
let context = { kind: "method", name: "method", isStatic: false };
C.prototype.method = annotate(C.prototype.method, context);
C[Symbol.metadata].prototype.methods.method = {...{a: "b"}, ...(context[Symbol.metadata] ?? {})};
-->

Note that, since metadata is held on the class, not on the method, the metadata is not visible to earlier decorators. Metadata on classes is added to the constructor after all class decorators have run so that they are not lost by later wrapping.

### `@tracked`

The `@tracked` decorator watches a field and triggers a `render()` method when the setter is called. This pattern, or patterns like it, is common in frameworks to avoid extra bookkeeping scattered throughout the application to ask for re-rendering.

Decorated fields have the semantics of getter/setter pairs around an underlying piece of private storage. The decorators can wrap these getter/setter functions. `@tracked` can wrap this getter/setter pair to implement the re-rendering behavior.

```mjs
import { tracked } from "./tracked.mjs";

class Element {
  @tracked counter = 0;

  increment() { this.counter++; }

  render() { console.log(counter); }
}

const e = new Element();
e.increment();  // logs 1
e.increment();  // logs 2
```

When fields are decorated, the "wrapped" value is an object with two properties: `get` and `set` functions that manipulate the underlying storage. They are built to be `.call()`ed with the instance of the class as a receiver. The decorator can then return a new object of the same form. (If one of the callbacks is missing, then it is left in place unwrapped.)

```mjs
// tracked.mjs

export function tracked({get, set}) {
  return {
    get,
    set(value) {
      if (get.call(this) !== value) {
        set.call(this, value);
        this.render();
      }
    }
  };
}
```

This example could be roughly desugared as follows:

```mjs
let initialize, get, set;

class Element {
  #counter = initialize(0);
  get counter() { return this.#counter; }
  set counter(v) { this.#counter = v; }

  increment() { this.counter++; }

  render() { console.log(counter); }
}

{ get, set } = Object.getOwnPropertyDescriptor(Element.prototype, "counter");
{ get, set, initialize } = tracked({get, set}, { kind: "field", name: "counter", isStatic: false })
Object.defineProperty(Element.prototype, "counter", {get, set});
```

### Limited access to private fields and methods

Sometimes, certain code outside of a class may need to access private fields and methods. For example, two classes may be "collaborating", or test code in a different file needs to reach inside a class.

Decorators can make this possible by giving someone access to a private field or method. This may be encapsulated in a "private key"--an object which contains these references, to be shared only with who's appropriate.

```mjs
import { PrivateKey } from "./private-key.mjs"

let key = new PrivateKey;

export class Box {
  @key.show #contents;
}

export function setBox(box, contents) {
  return key.set(box, contents);
}

export function getBox(box) {
  return key.get(box);
}
```

Note that this is a bit of a hack, and could be done better with constructs like references to private names with [`private.name`](https://gist.github.com/littledan/ab73ff08f98f33088a0072ad202445b1) and broader scope of private names with [`private`/`with`](https://gist.github.com/littledan/5451d6426a8ed65c0f3c2822c51314d1). But it shows that this decorator proposal "naturally" exposes existing things in a useful way.

```mjs
// private-key.mjs
export class PrivateKey {
  #get;
  #set;
  
  show({get, set}) {
    assert(this.#get === undefined && this.#set === undefined);
    this.#get = get;
    this.#set = set;
    return {get, set};
  }
  get(obj) {
    return this.#get(obj);
  }
  set(obj, value) {
    return this.#set(obj, value);
  }
}
```

This example could be roughly desugared as follows:

```mjs
let initialize, get, set;
export class Box {
  #_contents = initialize(undefined);
  get #contents() { return get.call(this); }
  set #contents(v) { set.call(this, v); }

  static {
    get = function() { return this.#_contents; },
    set = function(v) { this.#_contents = v; }
  }
}
({get, set, initialize} = key.show({get, set}, {kind: "field", isStatic: false}));
```

### `@deprecated`

The `@deprecated` decorator prints warnings when a deprecated field, method or accessor is used. As an example usage:

```mjs
import { deprecated } from "./deprecated.mjs"

export class MyClass {
  @deprecated field;

  @deprecated method() { }

  otherMethod() { }
}
```

To allow the `deprecated` to work on different kinds of class elements, the `kind` field of the context object lets decorators see which kind of syntactic construct they are deprecating. This technique also allows an error to be thrown when the decorator is used in a context where it can't apply--for example, the entire class cannot be marked as deprecated, since there is no way to intercept its access.

```mjs
// deprecated.mjs

function wrapDeprecated(fn) {
  let name = fn.name
  function method(...args) {
    console.warn(`call to deprecated code ${name}`);
    return fn.call(this, ...args);
  }
  Object.defineProperty(method, 'name', { value: name, configurable: true })
  return method;
}

export function deprecated(element, {kind}) {
  switch (kind) {
    case 'method':
    case 'getter':
    case 'setter':
      return wrapDecorated(element);
    case 'field': {
      let { get, set } = element;
      return { get: wrapDeprecated(get), set: wrapDeprecated(set) };
    }
    default: // includes 'class'
      throw new Error(`Unsupported @deprecated target ${kind}`);
  }
}
```

The desugaring here is analogous to the above examples, which show the use of `kind`.

## Method decorators requiring initialization work

Some method decorators are based on executing code when the class instance is being created. For example:

- A `@on('event')` decorator for methods on classes extending `HTMLElement` which registers that method as an event listener in the constructor.
- A `@bound` decorator, which does the equivalent of `this.method = this.method.bind(this)` in the constructor. This idiom meets Jordan Harband's goal of being friendlier to monkey-patching than the popular idiom of using an arrow function in a field initializer.

We're considering multiple possible options for how to provide for this type of idiom.

### Option A: Mixin constructors accessing metadata

These decorators can be built with the combination of metadata, and a mixin which performs the initialization actions in its constructor.

#### `@on` with a mixin

```js
class MyElement extends WithActions(HTMLElement) {
  @on('click') clickHandler() { }
}
```

This decorator could be defined as follows:

```js
const handler = Symbol("handler");
function on(eventName)
  return (method, context) => {
    context.metadata = {[handler]: eventName};
    return method;
  }
}

class MetadataLookupCache {
  #map = new WeakMap();
  #name;
  constructor(name) { this.#name = name; }
  get(newTarget) {
    let data = this.#map.get(newTarget);
    if (data === undefined) {
      data = [];
      let klass = newTarget;
      while (klass !== null && !(this.#name in klass)) {
        for (const [name, {[this.#name]: eventName}]
             of Object.entries(klass[Symbol.metadata].instance.methods)) {
          if (eventName !== undefined) {
            data.push({name, eventName});
          }
        }
        klass = klass.__proto__;
      }
      this.#map.set(newTarget, data)
    }
    return data;
  }
}

let handlersMap = new MetadataLookupCache(handler);

function WithActions(superclass) {
  return class C extends superclass {
    constructor(...args) {
      super(...args);
      let handlers = handlersMap.get(new.target, C);
      for (const {name, eventName} of handlers) {
        this.addEventListener(eventName, this[name].bind(this));
      }
    }
  }
}
```

#### `@bound` with a mixin

`@bound` could be used with a mixin superclass as follows:

```js
class C extends WithBoundMethod(Object) {
  #x = 1;
  @bound method() { return this.#x; }
}

let c = new C;
let m = c.method;
m();  // 1, not TypeError
```

This decorator could be defined as:

```js
const boundName = Symbol("boundName");
function bound(method, context) {
  context.metadata = {[boundName]: true};
  return method;
}
let boundMap = new MetadataLookupCache(boundName);

function WithBoundMethods(superclass) {
  return class C extends superclass {
    constructor(...args) {
      super(...args);
      let names = boundMap.get(new.target, C);
      for (const {name} of names) {
        this[name] = this[name].bind(this);
      }
    }
  }
}
```

Note the common use of `MetadataLookupCache` across both examples; this proposal or a follow-on one should consider adding a standard library for accing metadata for this purpose.

### Option B: The `init` contextual keyword for methods

If it's not acceptable to require a superclass/mixin for cases requiring initialization action, an The `init` keyword in a method declaration changes a method into an "init method". This keyword allows decorators to add initialization actions, run when the constructor executes.

#### `@on` with `init`

Usage:

```js
class MyElement extends HTMLElement {
  @on('click') init clickHandler() { }
}
```

An "init method" (method declared with `init`) is called similarly to a method decorator, but it is expected to return a pair `{method, initialize}`, where `initialize` is called with the `this` value being the new instance, taking no arguments and returning nothing. 

```js
function on(eventName) {
  return (method, context) => {
    assert(context.kind === "init-method");
    return {method, initialize() { this.addEventListener(eventName, method); }};
  }
}
```

The class definition would be desugared roughly as follows:

```js
let initialize;
class MyElement extends HTMLElement {
  clickHandler() { }
  constructor(...args) {
    super(...args);
    initialize.call(this);
  }
}
{method: MyElement.prototype.clickHandler, initialize} =
  on('click')(MyElement.prototype.clickHandler,
              {kind: "init-method", isStatic: false, name: "clickHandler"});
```

#### `@bound` with `init`

The `init` keyword for methods can also be used to build a `@bound` decorator, used as follows:

```js
class C {
  #x = 1;
  @bound init method() { return this.#x; }
}

let c = new C;
let m = c.method;
m();  // 1, not TypeError
```

The `@bound` decorator can be implemented as follows:

```js
function bound(method, {kind, name}) {
  assert(kind === "init-method");
  return {method, initialize() { this[name] = this[name].bind(this); }};
}
```

## Possible extensions

Decorators on further constructs are investigated in [EXTENSIONS.md](./EXTENSIONS.md).

# Syntax

This decorators proposal uses the syntax of the previous Stage 2 decorators proposal. This means that:
- Decorator expressions are restricted to a chain of variables, property access with `.` but not `[]`, and calls `()`. To use an arbitrary expression as a decorator, `@(expression)` is an escape hatch.
- Class expressions may be decorated, not just class declarations.
- Class decorators come after `export` and `default`.

There is no special syntax for defining decorators; any function can be applied as a decorator.

# Detailed semantics 

The three steps of decorator evaluation:
1. Decorator expressions (the thing after the `@`) are *evaluated* interspersed with computed property names.
1. Decorators are *called* (as functions) during class definition, after the methods have been evaluated but before the constructor and prototype have been put together.
1. Decorators are *applied* (mutating the constructor and prototype) all at once, after all of them have been called.

The semantics here generally follow the consensus at the May 2016 TC39 meeting in Munich.

## 1. Evaluating decorators

Decorators are evaluated as expressions, interspersed in their evaluation order with computed property names. This goes left to right, top to bottom. The result of decorators is stored in the equivalent of local variables to be later called after the class definition initially finishes executing.

## 2. Calling decorators

### The element being wrapped: the first parameter

The first parameter, of what the decorator is wrapping, depends on what is being decorated:
- In a method, init-method, getter or setter decorator: the relevant function object
- In a class decorator: the class
- In a field: An object with two properties
    - `get`: A function which takes no arguments, expected to be called with a receiver which is the appropriate object, returning the underlying value.
    - `set`: A function which takes a single argument (the new value), expected to be called with a receiver which is the object being set, expected to return `undefined`.

### The context object: the second parameter

The context object--the object passed as the second argument to the decorator--contains the following properties:
- `kind`: One of
    - `"class"`
    - `"method"`
    - `"init-method"`
    - `"getter"`
    - `"setter"`
    - `"field"``
- `name`:
    - Public field or method: the `name` is the String or Symbol property key.
    - Private field or method: missing (could be provided as some representation of the private name, in a follow-on proposal) 
    - Class: missing
- `isStatic`:
    - Static field or method: `true`
    - Instance field or method: `false`
    - Class: missing

The "target" (constructor or prototype) is not passed to field or method decorators, as it has not yet been built when the decorator runs.

### The return value

The return value is interpreted based on the type of decorator. The return value is expected as follows:
- Class: A new class
- Method, getter or setter: A new function
- field: An object with three properties (each individually optional):
    - `get`: A function of the same form as the `get` property of the first argument
    - `set`: Ditto, for `set`
    - `initialize`: A called with the same arguments as `set`, which returns a value which is used for the initializing set of the variable. This is called when initially setting the underlying storage based on the field initializer or method definition. This method shouldn't call the `set` input, as that would trigger an error. If `initialize` isn't provided, `set` is not called, and the underlying storage is written directly. This way, `set` can count on the field already existing, and doesn't need to separately track that.
- Init method: An object with the properties
    - `method`: A function to replace the method
    - `initialize`: A function with no arguments, whose return value is ignored, which is called with the newly constructed object as the receiver.

## 3. Applying decorators

Decorators are applied after all decorators have been called. The intermediate steps of the decorator application algorithm are not observable--the newly constructed class is not made available until after all method and non-static field decorators have been applied.

The class decorator is called only after all method and field decorators are called and applied.

Finally, static fields are executed and applied.

## Decorated field semantics in depth

Decorated fields have the semantics of getter-setter pairs backed by a private field. That is,

```js
function id(v) { return v; }

class C {
  @id x = y;
}
```

has the semantics of

```js
class C {
  #x = y;
  get x() { return this.#x; }
  set x(v) { this.#x = v; }
}
```

These semantics imply that decorated fields have "TDZ" like private fields. For example, the following is a TypeError because `y` is accessed before it is added to the instance.

```js
class C {
  @id x = this.y;
  @id y;
}
new C;  // TypeError
```

The getter/setter pair are ordinary JS method objects, and non-enumerable like other methods. The underlying private fields are added one-by-one, interspersed with initializers, just like ordinary private fields.

## Design goals

- It should be easy both to use decorators and to write your own decorators.
- Decorators should affect the thing they're decorating, and avoid confusing/non-local effects.

### Use case analysis

Some essential use cases that we've found include:
- Storing metadata about classes, fields and methods
- Turning a field into an accessor
- Wrapping a method

(TODO: Fill this in with more detail)

### Transpiler and native implementation constraints

From transpilers:
1. The transpiler output shouldn't be too big (both in terms of the direct output of the translation, and the size of the support library)
2. It should be possible to transpile on a file-by-file basis, without cross-file information

From native implementations:
A: The "shape" of the class should be apparent syntactically, without executing code
B: It should not be too complicated to process decorators, as this corresponds to a complex implementation
C: Minimize or eliminate observable mutations to objects while setting up the class

Constraints 2 + A together imply that all shape changes must be syntactically apparent. This constraint is met by making all shape changes syntactically aparent where the class is defined, by making it explicit to either opt into an "annotation" instead of the default (or, in a previous proposal with the opposite default, a "trap").

### Out of scope

Some things that have been described as potential decorators would *not* fit into the scheme here, and would require either dedicated syntax to meet the constraints raised by TC39 delegates, or the use of existing idioms to work around the need for a decorator.
- `@set`: This decorator would change a field from [[Define]] semantics to [[Set]]. This decorator changes which kind of code executes in the constructor in a different way which is not visible from syntax. These semantics can be accessed by putting a line of code in the constructor rather than a field declaration. However, note that this proposal reduces the need for opting into [[Set]] semantics in multiple ways:
    - [[Set]] semantics drove how fields worked with legacy/experimental decorators which created accessors. These mechanics are replaced in this proposal by having decorated field declarations initialize the underlying storage, not shadow the accessor.
    - If a setter is inherited, it is possible to write a decorator for a field which specifically calls super getters and setters, rather than using the underlying storage.
- `@frozen`: This decorator freezes the whole class, including static fields. Such a change is not possible within the phase ordering of decorators, where class decorators run before static fields are executed. Instead, the class can be frozen in a single line after the class, or potential future syntax for freezing the class.
- `@enumerable`: This decorator would make a method enumerable, overriding its default of non-enumerable. Decorators cannot change property attributes, as they do not receive property descriptors to manipulate them as in Stage 1 decorators, and they are not passed the constructor of the class to do so imperatively. This is to meet requirements from implementations that decorators leave classes with statically predictable shapes. Instead, changes like this could be done by `Object.defineProperty` calls after the class definition executes.
- `@reader`: This decorator for a private field would create a public accessor to read it. It is impossible to create, as decorators are not given access to the class. Such a change in shape would run counter to the "static shape" goals from native implementers.

## Standardization plan

- Present in September 2020, or whenever it is ready
- Iterate on open questions within the proposal, presenting them to TC39 and discussing further in the biweekly decorators calls, to bring a conclusion to committee in a future meeting:
    - What should be within scope of the "MVP"? (E.g., should parameter decorators be added the first time around, or in a follow-on proposal?)
    - What should the details of the annotation object model be? (This definitely needs iteration.)
    - How should `init` method use cases be handled--the contextual keyword, mixins+annotations, or some other model? How important are these use cases for the MVP?
- If feedback is positive, write spec text and implement in transpilers
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

Yes, private fields and methods can be decorated just like ordinary fields and methods. The only difference is that no property key is available in the context object. See the example under the heading, "Limited access to private fields and methods".

### How should this new proposal be used in transpilers, when it's implemented?

This decorators proposal would require a separate transpiler implementation from the previous legacy/experimental decorator semantics. The semantics could be switched into with a build-time option (e.g., a command-line flag or entry in a configuration file). Note that this proposal is expected to continue to undergo significant changes prior to Stage 3, and it should not be counted on for stability.

Modules exporting decorators are able to easily check whether they are being invoked in the legacy/experimental way or in the way described in this proposal, by checking whether their second argument is an object (in this proposal, always yes; previously, always no). So it should be possible to maintain decorator libraries which work with both approaches.

### What would the specification look like in detail?

(We haven't written it yet; the plan would be to do so after the proposal is discussed in the September 2020 TC39 meeting.)

### What makes this decorators proposal more statically analyzable than previous proposals? Is this proposal still statically analyzable even though it is based on runtime values?

In this decorators proposal, each decorator position has a consistent effect on the shape of the code generated after desugaring. No calls to `Object.defineProperty` with dynamic values for property attributes are made by the system, and it is also impractical to make these sorts of calls from user-defined decorators as the "target" is not provided to decorators; only the actual contents of the functions is left until rutnime.

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
