// Various mechanisms for sharing access to private fields
// and methods using decorators
// This file is placed in the Public Domain
// By Daniel Ehrenberg

// protected inheritance, inspired by work by Kevin Gibbons

// Mapping for each class mapping strings to PrivateNames,
// inheriting up through the prototype chain.
class PrivateNameMap {
  #map = new WeakMap;  // WeakMap<class, Map<name, PrivateName>>

  get(klass, keyString) {
    while (klass !== null) {
      let classMap = this.#map.get(klass);
      if (classMap === undefined) {
        klass = Object.getPrototypeOf(klass);
        continue;
      }
      assert(classMap instanceof Map);
      let possibleKey = classMap.get(keyString);
      if (possibleKey === undefined) {
        klass = Object.getPrototypeOf(klass);
        continue;
      } else {
        assert(typeof possibleKey === "object");
        return possibleKey;
      }
    }
  }

  set(klass, keyString, key) {
    let classMap = this.#map.get(klass);
    if (classMap === undefined) {
      classMap = new Map;
      this.#map.set(klass, classMap);
    }
    classMap.set(keyString, key);
  }
}

// There is no built-in PrivateName constructor, but a new private name can
// be constructed by extracting it from a throwaway class
function PrivateName() {
  let name;
  function extract({key}) { name = key; }
  class Throwaway { @extract #_; }
  return name;
}

let exposeMap = new PrivateNameMap;

// @expose #foo = bar;
// @expose #foo() { bar; }
// Make #foo available to subclasses.
export function expose(descriptor) {
  let key = descriptor.key;
  if (typeof key !== "object")
    throw new TypeError("@expose must be used on #private declarations");
  return {
    ...descriptor
    extras: [{ kind: 'hook', placement: 'static', register(klass) {
      exposeMap.set(klass, key.description, key);
    }}],
  };
}

// @inherit #foo;
// Make #foo, declared in a superclass, available in this subclass.
export function inherit(descriptor) {
  let key = descriptor.key;
  let placement = descriptor.placement;
  if (typeof key !== "object" ||
      descriptor.kind !== "field" ||
      descriptor.initialize !== undefined) {
    throw new TypeError("invalid declaration for @inherit");
  }
  let superKey;
  let keyString = key.description;
  return {
    kind: "accessor",
    key,
    placement,
    get() { return superKey.get(this); },
    set(value) { set.set(this, value); },
    configurable: false,
    enumerable: false,
    extras: [{ kind: 'hook', placement: 'static', register(klass) {
      superKey = exposeMap.get(klass, keyString);
      if (typeof superKey === undefined) {
        throw new TypeError("@inherit must be used on @exposed names");
      }
    }}],
  };
}

// Usage example

class SuperClass {
  @expose #foo = 1;
  @expose #bar() { return 2; }
}

class SubClass extends SuperClass {
  @inherit #foo;
  @inherit #bar;
  method() { console.log(this.#foo, this.#bar()) }
}

// FriendKey exposes class private elements to the outside
// using a metaprogramming-like API
export class FriendKey {
  #names = new Map();  // Map<string, PrivateName>

  // key.get(this, "#foo")
  // gets the value of the private field #foo
  get(receiver, name) {
    let key = this.#names.get(name);
    if (key === undefined) throw new TypeError;
    return key.get(receiver);
  }

  // key.set(this, "#foo", value)
  // sets the private field #foo to value
  set(receiver, name, value) {
    let key = this.#names.get(name);
    if (key === undefined) throw new TypeError;
    return key.set(receiver, value);
  }

  // key.call(this, "#foo", arg)
  // calls the private method #foo with the argument arg
  call(receiver, name, ...args) {
    let method = this.get(receiver, name);
    return method.apply(receiver, args);
  }

  // @key.expose #foo
  // Make #foo available externally using the key
  expose = descriptor => {
    let key = descriptor.key;
    let string = key.description;
    if (typeof key !== "object") {
      throw new TypeError(
        "@expose may only be used with private class elements");
    }
    if (this.#names.has(string)) {
      throw new TypeError("@expose used on the same name repeatedly");
    }
    this.#names.set(string, key);
    return descriptor;
  }
}

// Usage example

let key = new FriendKey;

class MyClass {
  @key.expose
  #x;

  @key.expose
  #y() { return this.#x; }

  constructor(x) { this.#x = x; }
}

class FriendOfMyClass {
  callMethod(myClassInstance) {
    return key.get(myClassInstance, '#x');
  }

  writeVar(myClassInstance) {
    key.set(myClassInstance, '#x', 2);
  }

  readVar(myClassInstance) {
    return key.call(myClassInstance, '#y');
  }
}

// Pure or defaulted virtual protected methods
// Modelled as an anonymous private field, and an accessor to reach it

let abstractMap = new PrivateNameMap;
let emptySentinel = Symbol();

// @abstract #foo;
// @abstract #foo() { }
// Declare a virtual protected method which can be used or overridden
// in subclasses with @override.
export function abstract(descriptor) {
  let key = descriptor.key;
  let isPure = descriptor.kind === "field" &&
               descriptor.initialize === undefined;
  let isMethod = descriptor.kind === "method" &&
                 descriptor.value !== undefined;
  let value = descriptor.value;
  if (typeof key !== "object" ||
      !(isPure || isMethod) ||
      descriptor.placement !== "own") {
   throw new TypeError("invalid declaration for @abstract");
  }

  let internalKey = PrivateName();

  return {
    key,
    kind: "accessor",
    placement: "own",
    get() {
      return internalKey.get(this);
    }
    enumerable: false,
    configurable: false,
    extras: [
      {
        key: internalKey,
        kind: "method",
        placement: "own",
        value: isPure ? emptySentinel : value,
        writable: true,
        configurable: false,
        enumerable: false,
      },
      {
        kind: "hook",
        placement: "static",
        register(klass) {
          abstractMap.set(klass, key.description, internalKey);
        }
      }
    ]
  }
}

// @override #foo;
// Override a virtual protected method
export function override(descriptor) {
  let key = descriptor.key;
  let placement = descriptor.placement;
  if (typeof key !== "object" ||
      descriptor.kind === "field" ||
      placement !== "own") {
    throw new TypeError("invalid declaration for @override");
  }
  let body = descriptor.value;
  let internalKey;
  let keyString = key.description;
  return {
    kind: "accessor",
    key,
    placement,
    // All reads of the method read the underlying shared internal
    // private name. This means that if the subclass is subclassed
    // again, then it will still act as virtual.
    get() { return get(internalKey, this); },
    configurable: false,
    enumerable: false,
    extras: [
      {
        kind: "hook",
        placement,
        start() {
          set(internalKey, this, body);
        }
      },
      {
        kind: "hook",
        placement: "static",
        register(klass) {
          internalKey = privateNameMap.get(klass, keyString);
          if (typeof internalKey === undefined) {
            throw new TypeError("@override must be used on @exposed names");
          }
        }
      }
    ]
  };
}

// Usage example

class SuperClass {
  @abstract #foo;

  bar() { return this.#foo(); }
}

class SubA extends SuperClass {
  @override #foo() { return 1; }
}

class SubB extends SuperClass {
  @override #foo() { return 2; }
}

new SubA().bar();  // 1
new SubB().bar();  // 2
