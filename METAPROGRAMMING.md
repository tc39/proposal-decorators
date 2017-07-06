# Metaprogramming with decorators

Previously, metaprogramming within JavaScript was driven by use of dynamic operations that manipulate JavaScript objects, such as `Object.defineProperty`. ESnext upgrades classes with decorators, with the advantages:
- Decorators make it more clear what's going on--users write class literals and explicitly annotate the piece of source code that is being manipulated, rather than spooky action-at-a-distance where a big object is passed into a special application-dependent class framework.
- Decorators can manipulate private fields and private methods, whereas operations on objects are unable to manipulate the definitions of private names.
- Decorators do their manipulations at the time the class is defined, rather than when instances are being created and used, so they may lead to patterns which are more amenable to efficient implementation.

Decorators are implemented as functions which take a JSON-like representation of a class element as an argument and return a possibly-modified form of that, optionally with additional class elements. Class elements are represented in the form: 

```js
{
  kind: "method" or "field"
  key: String, Symbol or Private Name,
  placement: "static", "prototype" or "own",
  descriptor: Property Descriptor (argument to Object.defineProperty),
}
```

The return value is allowed to add an `extras` property with additional class elements, and a `finisher` property, which is a callback that is called with the constructor, once it's created.

Class decorators are passed in an Array of all class elements and output an object with fields `elements` for the new class elements, `constructor` for the function which should act as the construtor, and `finisher` for a similar callback.

For private fields, methods or accessors, the `key` will be a Private Name--this is similar to a String or Symbol, except that it is invalid to use with property access `[]` or with operations such as `Object.defineProperty`. Instead, it can only be used with decorators.


For example, the above three decorators could be defined as follows:
```js
import "decorators" as decorators;

// Define the class as a custom element with the given tag name
function defineElement(tagName) {
  // In order for a decorator to take an argument, it takes that argument
  // in the outer function and returns a different function that's called
  // when actually decorating the class (manual currying).
  return function(constructor) {
    return {
      constructor,
      // This callback is called once the class is otherwise fully defined
      finisher(klass) {
        window.customElements.define(tagName, klass);
      }
    }
  }
}

// Replace a method with a field with a bound version of the method
function bound(memberDescriptor) {
  assert(kind === "method");
  let {kind, key, isStatic, propertyDescriptor} = memberDescriptor;
  // Add an extra field which is initialized when instances are made
  // Leave the existing one in place so that it's available on the prototype
  memberDescriptor.extras = [{
    kind: "field",
    // The initializer callback is called with the receiver set to the new instance
    initializer() { return descriptor.value.bind(this); },
    descriptor,
    isStatic,
  }];
  return memberDescriptor;
}

// Whenever a read or write is done to a field, call the render()
// method afterwards. Implement this by replacing the field with
// a getter/setter pair.
function observed({kind, key, isStatic, descriptor}) {
  assert(kind == "field");
  // Create a new anonymous private name as a key for a class element
  let storage = decorators.PrivateName();
  let underlying = {kind, key: storage, isStatic, descriptor};
  return {
    kind: "accessor",
    key,
    isStatic,
    descriptor: {
      get() { decorators.get(this, storage); },
      set(value) {
        decorators.set(this, storage, value);
        // Assume the @bound decorator was used on render
        window.requestAnimationFrame(this.render);
      },
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
    },
    extras: [underlying]
  };
  
}
```
