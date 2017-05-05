# Details of unified orthogonal class features semantics

## Evaluation order

The proposal assumes that it will be following the [Class Evaluation Order](https://onedrive.live.com/view.aspx?resid=A7BBCE1FC8EE16DB!442046&app=PowerPoint&authkey=!AEeXmhZASk50KjA) proposal which finds a common time for all class elements to run. Because there was no contradiction or special interactions to draw out, the points of that proposal are not reiterated here--it just works as stated there.

## Orthogonality

In combining the proposals into a unified vision, this document works towards two types of orthogonality:
- All class components can be decorated--methods, fields, accessors, and the class at the top level
- All combinations are supported on the following axes:
  - Visibility: Public literal vs public computed property name vs private
  - Place: static vs instance/prototype vs object literal
  - Type: Method vs field vs accessor
  - async vs sync
  - generator vs non-generator

This proposal builds on the ideas of the [Orthogonal Classes](https://github.com/erights/Orthogonal-Classes) proposal, which works towards a unified mental model for new and old class features which provides a sense of continuity and regularity. Like that proposal, not all of this necessarily would ship at once, but this document gives a blueprint of where to go as we do add features.

There are a number of changes in this proposal compared to the previous orthogonal classes proposal:

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

In this proposal, from a user perspective, private identifiers should be just like public identifiers (properties) except that:
- You can't access private identifiers outside of the class or object literal
- Reflective operations are not available on private state except through decorators
- Only private identifiers get the shorthand

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
- `decorators.get(object, identifier)`: When `identifier` is a property key, return `object[identifer]`. When `identifier` is a private name, get the private field with that identifier, or throw a ReferenceError if it is missing. If `identifier` refers to an accessor, invoke the getter; if it refers to a method, get the method value.
- `decorators.set(object, identifier, value)`: When `identifier` is a property key, perform `object[identifer] = value`. When `identifier` is a private name, set the private field with that identifier to the value, or throw a ReferenceError if it is missing. If `identifier` is an accessor, invoke the setter; if `identifier` is a method, throw a ReferenceError.
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

#### Private and object literals

Object literals can have private fields, methods and accessors as well. For example:

```js
let x = {
  #counter: 0;
  #increment() { #counter++; }
  get next() { #increment(); return #counter; }
};
x.next();  // 1
x.next();  // 2
```

The semantics here follows analogously: `#counter` is a private field which belongs only to the single instance `x`, and `#instance` is a method which is only on this instance. In object literal syntax, the instance being constructed is not within scope to "initializers" (the right-hand side of `:`), and there is no equivalent of "return from super", so it's actually unobservable which order the fields are added to the object (though possibly it could be visible from decorators, if the initializer callback is called with the object under construction as the receiver).

### Elimination of the `own` token

The general trend of the feedback from most JavaScript programmers is that they don't want to write `own`. This proposal instead sticks with the previously proposed syntax, which users seem to have been happy with in public fields through transpiler environments. Additionally, with the type-implies-placement principle above, an extra token would only serve the purpose of a reminder of semantics, and it could start to feel like excessive typing for experienced programmers.

## Changes from the existing class features proposals

### Decorator `kind` field

A couple minor possible changes for the MemberDescriptor for decorators:
- The main change made here is from `kind: "property"` to `kind: "accessor"` and `kind: "method"` for accessor and method definitions respectively. The reason for the change is that the same form of MemberDescriptor is used for both public methods/accessors and private methods/accessors, differing only in the type of the `key`. Using the kind `"property"` would give the misleading impression that these private things are properties, which they are not.
- Maybe `isStatic` could be instead a `"place"` field with three possible values: `"instance"`, `"static"` and `"object"`. This could let a decorator know whether it's being used in an object literal. However, changes from `"object"` to other types would not be supported.

These are just strawman ideas, however.

### async or generator getters?

A hole in the orthogonality matrix that became apparent in writing this proposal is the lack of async getters and generator getters. Async and generator versions don't make much sense for setters (where the return value is not used) or constructors (where a constructor is often expected to return an instance related to the constructor, rather than a Promise or an Iterable). Unlike other orthgonality efforts (e.g., async generators, or this proposal), adding async/generator getters would be more a process of removing a restriction, rather than adding any particular other behavior.

### Should we reconsider the private state shorthand?

Private state allows omitting the `this.` in `this.#x`. This syntax feature isn't quite orthogonal--it doesn't exist for public state. Forms within class literals, such as a field declaration, always omit `this.`, whether it's for public or private fields. Although the shorthand has a sympathetic motivation (encourage people to use private state, which is generally the best practice), this asymmetry may be confusing for people learning the language, when context-switching between the forms which require `this.` and forms which do not.
