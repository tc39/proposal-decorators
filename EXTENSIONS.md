# Possible extensions

This file contains possible follow-on proposals which could be formulated within the framework of the class decorators proposal. This decorators proposal was designed to permit other syntactic elements to be decorated, but the Stage 2 proposal refers only to the class, field, method and accessor decorators. The main open question is whether to include parameter decorators initially, as they have attracted widespread interest and uptake in TypeScript within classes.

## Annotation syntax

**Annotations**, a declarative complement to decorators, use the syntax `@{ }`, which behaves exactly like an object literal. Arbitrary expressions, spread, computed property names, etc, are permitted. It is accessible from the annotated object through the `[Symbol.metadata]` property.

```mjs
@{x: "y"} @{v: "w"} class C {
  @{a: "b"} method() { }
  @{c: "d"} field;
}

C[Symbol.metadata].class.x                     // "y"
C[Symbol.metadata].class.v                     // "w"
C[Symbol.metadata].prototype.methods.method.a  // "a"
C[Symbol.metadata].instance.fields.field.c     // "d"
```

Annotations must always have a literal `@{` to start them. To use an existing object as an annotation, you can use the syntax `@{ ...obj }`. The entirety of object syntax is available, including computed property names, arbitrary expressions as values, shorthand names, concise methods, etc.

Libraries and frameworks which want to establish consistent conventions for using annotations may do so based on a Symbol property key that they export. Annotations have the potential advantage in load time performance that engines can directly execute them, as they are as declarative as an object literal.

Annotation semantics may be useful for cases like ORMs and serialization frameworks, which need information about class fields, without affecting their normal runtime semantics. However, the popular ecosystem examples that we've found of this form, using just metadata for fields, seem to depend on metadata generated by TypeScript types. From these examples, it seems that annotation syntax alone would not be a sufficient solution.

Some frameworks, including Angular, tend to use decorators which operate primarily by adding metadata. However, object literal annotations are not quite suitable for this usage, as they don't provide a way to be annotated in TypeScript to check types the way that functions do, they don't allow any processing of the metadata in code before it is saved, and because they don't provide a usable, stable identifier to be used for custom static analysis tools like tree shaking. For Angular, it may make more sense to use decorators which add metadata.

For these reasons, annotations are omitted from this proposal's "MVP" (minimum viable product) and considered as a possible follow-on proposal.

## Function decorators and annotations

The `@logged` decorator from earlier would Just Work(TM) on a function, with function decorators!

```js
@logged
@{x: "y"}
function f() { }

f();                        // prints logging information
f[Symbol.annotations][0].x  // "y"
```

Function declarations with decorators or annotations are not hoisted. This is because it would be unintuitive to reorder the evaluation of the decorator or annotation expressions.

Instead, functions with decorators or annotations are defined only when their declaration is reached. If they are used before they are defined, a ReferenceError is thrown, like classes. This ReferenceError condition is sometimes referred to as a "temporal dead zone" (TDZ). The TDZ risks unfortunate situations when refactoring, but at least those situations lead to easy-to-debug errors rather than the wrong function being run.

Function decorator details:
- First parameter: the function being decorated (or, whatever the next inner decorator returned)
- Second parameter: a context object which just has `{ kind: 'function' }`
- Return value: a new function, or undefined to keep the same function

The inner binding of a function expression inside itself is in TDZ until all the function decorators run.

## Parameter decorators and annotations

A parameter decorator wraps the value of a function/method argument. It returns a function which does the wrapping.

```js
function dec(_, context) {
  assert(context.kind === "parameter");
  return arg => arg - 1;
}

function f(@dec @{x: "y"} arg) { return arg * 2 ; }

f(5)  // 8
f[Symbol.annotations].parameters[0].x  // "y"
```

Functions with parameters that are decorated or annotated are treated similarly to decorated/annotated functions: they are not hoisted, and are in TDZ until their definition is executed.

Parameter decorator details:
- First parameter: undefined
- Second parameter: a context object which just has `{ kind: 'parameter' }`
- Return value: a function which takes a parameter value and returns a new parameter value. The function is called with the `this` value that the surrounding function is called with.

This example can be desugared as

```js
let decInstance = dec(undefined, {kind: "parameter"});

function f(arg_) {
  const arg = decInstance(arg_);
  return arg * 2 ;
}

f[Symbol.annotations] = {}
f[Symbol.annotations].parameters = []
f[Symbol.annotations].parameters[0] = {x: "y"};
```

## `let` decorators

Variables declared with `let` can be decorated, converting them into special getter/setter pairs that are invoked when the variable is read or written.

```js
let @deprecated x = 1;
++x;  // Shows deprecation warnings for read and write
```

`let` decorators might be useful for systems using reactivity based on local variables, e.g. "hooks" systems.

`let` decorator details:
- First parameter: A `{ get, set, value }` object (where the receiver is expected to be undefined, and where `value` is the RHS)
- Second parameter: a context object `{ kind: "let" }`
- Return value: A `{ get, set, value }` object, with potentially new behavior

This example can be desugared as:

```js
let { get_x, set_x, value: _x } = deprecated({value: 1, get() { return _x; }, set(v) { _x = v; }}, {kind: "let"});

set_x(get_x()++);
```

## `const` decorators

Variables declared with `const` can be decorated more simply--the decorator simply wraps the value being decorated when it's being defined.

```js
function inc(x) { return x+1; }
const @inc x = 1;  // 2
```

`const` decorator details:
- First parameter: The value of the RHS
- Second parameter: a context object `{ kind: "const" }`
- Return value: A new value for the variable

This could be desugared as follows:

```js
const x = inc(1, {kind: "const"});
```

(This form isn't so useful by itself, but may become more important if future proposals share more information through the context object.)

## Object literal and property decorators and annotations

- A decorated object literal works like a class decorator, but with `kind: "object"`.
- A decorated method, getter or setter in an object literal works just like one in a class, replacing that method.
- A decorated object property works like a field decorator, but with `kind: "property"`, and it receives the initial value in the `value` property of the input, and returns it in the output object, rather than returning an initializer function, since it only runs once (in this way, it is similar to `let` decorators).

Example:

```js
const x = @decA {
  @decB p: v,
  @decC m() { }
};
```

<!--
would desugar roughly into (in terms of the [`private`/`with` proposal](https://gist.github.com/littledan/5451d6426a8ed65c0f3c2822c51314d1))

```js
private #p;
let {get, set, value} = decB() // tood: fihish)

const x = decA({
  #p: initializer(value)
  valuedec
  m: decC(function m() { }, {kind: "method"})
}, {kind: "object"});
```
-->

## Block decorators

Decorating a block could wrap it as a function.

```js
@foo { bar; }
```

could desugar to

```js
foo(() => bar, { kind: "block" });
```

Similarly, in a class:

```js
class F {
  @foo { bar; }
}
```

could be equivalent to

```js
class F {
  #_() { bar; }
  constructor() {
    foo.call(this, this.#_, {kind: "class-block"});
  }
}
```

These patterns might improving ergonomics with "hooks"-like patterns and component lifecycle methods.

Note that this syntax could only work if it's in statement context; otherwise, it would be decorating an object literal.

## Initializer decorators

Decorating an initializer would turn the initializer in a thunk, so it can be run in the appropriate context (e.g., with usage tracking on) or re-run later (e.g., when dependencies change).

```js
let x @foo = bar;
```

could desugar into

```js
let x = foo(() => bar, {kind: "initializer"});
```

Similarly, for classes:

```js
class C {
  x @foo = bar;
}
```

could desugar into

```js
class C {
  #_() { return bar; }
  x = foo.call(this, this.#_);
}
```

This pattern may improve certain "computed" reactivity patterns.
