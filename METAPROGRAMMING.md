# Metaprogramming with decorators

Previously, metaprogramming within JavaScript was driven by use of dynamic operations that manipulate JavaScript objects, such as `Object.defineProperty`. ESnext upgrades classes with decorators, with the advantages:

* Decorators make it more clear what's going on--users write class literals and explicitly annotate the piece of source code that is being manipulated, rather than spooky action-at-a-distance where a big object is passed into a special application-dependent class framework.
* Decorators can manipulate private fields and private methods, whereas operations on objects are unable to manipulate the definitions of private names.
* Decorators do their manipulations at the time the class is defined, rather than when instances are being created and used, so they may lead to patterns which are more amenable to efficient implementation.

As stated in the readme, decorators can be used either to decorate a whole class or an individual class element (field or method). Decorators are implemented as functions which take a JSON-like representation of a class element as an argument and return a possibly-modified form of that, optionally with additional class elements. For both kinds of decorator functions, class elements are represented in the form:

```js
{
  kind: "method" or "field"
  key: String, Symbol or Private Name,
  placement: "static", "prototype" or "own",
  descriptor: Property Descriptor (argument to Object.defineProperty),
  initializer: method used to set the initial state of the class element
}
```

For class element decorators, the return value is allowed to add the following additional properties:

* `extras`: A property with additional class elements
* `finisher`: A callback that is called with the constructor, once it's created.

Class decorators (i.e. decorators that decorate the class as a whole) are passed in an Array of all class elements and output an object with fields `elements` for the new class elements, `constructor` for the function which should act as the construtor, and `finisher` for a similar callback.

For private fields, methods or accessors, the `key` will be a Private Name--this is similar to a String or Symbol, except that it is invalid to use with property access `[]` or with operations such as `Object.defineProperty`. Instead, it can only be used with decorators.

For example, the three decorators from README.md could be defined as follows:

```js
// Define the class as a custom element with the given tag name
function defineElement(tagName) {
  // In order for a decorator to take an argument, it takes that argument
  // in the outer function and returns a different function that's called
  // when actually decorating the class (manual currying).
  return function(classDescriptor) {
    let { kind, elements } = classDescriptor;
    assert(kind == 'class');
    return {
      kind,
      elements,
      // This callback is called once the class is otherwise fully defined
      finisher(klass) {
        window.customElements.define(tagName, klass);
      }
    };
  };
}

// Replace a method with a field with a bound version of the method
function bound(elementDescriptor) {
  let { kind, key, placement, descriptor } = elementDescriptor;
  assert(kind === 'method');
  if (placement == 'prototype') placement = 'own';
  const { value } = descriptor;
  function initializer() {
    return value.bind(this);
  }
  delete descriptor.value;
  return { kind: 'field', key, placement, descriptor, initializer };
}

// Whenever a read or write is done to a field, call the render()
// method afterwards. Implement this by replacing the field with
// a getter/setter pair.
function observed({kind, key, placement, descriptor, initializer}, get, set) {
  assert(kind == "field");
  assert(placement == "own");
  // Create a new anonymous private name as a key for a class element
  let storage = PrivateName();
  let underlyingDescriptor = { enumerable: false, configurable: false, writable: true };
  let underlying = { kind, key: storage, placement, descriptor: underlyingDescriptor, initializer };
  return {
    kind: 'method',
    key,
    placement,
    descriptor: {
      get() { get(this, storage); },
      set(value) {
        set(this, storage, value);
        // Assume the @bound decorator was used on render
        window.requestAnimationFrame(this.render);
      },
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable
    },
    extras: [underlying]
  };
}
```

And here is an example that uses the `finisher` property for a class element:

```js
class User {
  @readonly id;
  email;

  constructor(id = null, email = null) {
    this.id = id;
    this.email = email;
  }
}

function readonly(elementDecriptor) {
  // we don't want to set `writable` to false until after the property has been initialized
  elementDecriptor.finisher = () => {
    elementDecriptor.descriptor.writable = false;
  };
  return elementDecriptor;
}
```

The above code is functionally equivalent to the following:

```js
class User {
  id;
  email;

  constructor(id = null, email = null) {
    this.id = id;
    this.email = email;
    // finisher
    Object.defineProperty(this, 'id', {
      writable: false,
      // configurable: false and enumerable: true are the default for public class fields
      configurable: false,
      enumerable: true
    });
  }
}
```
