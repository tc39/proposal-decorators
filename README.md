# ESnext class features for JavaScript

Daniel Ehrenberg

This document proposes a combined vision for how the proposed class features could work together--[decorators](https://tc39.github.io/proposal-decorators/), [public fields](https://tc39.github.io/proposal-class-public-fields/) and [private fields](https://github.com/tc39/proposal-private-fields), drawing on the earlier [Orthogonal Classes](https://github.com/erights/Orthogonal-Classes) and [Class Evaluation Order](https://onedrive.live.com/view.aspx?resid=A7BBCE1FC8EE16DB!442046&app=PowerPoint&authkey=!AEeXmhZASk50KjA) proposals.

This page is an overview of the features and their interaction from a user perspective. For detailed semantics, see [DETAILS.md](https://github.com/littledan/proposal-unified-class-features/blob/master/DETAILS.md).

## A guiding example: Custom elements with classes

To define a counter widget which increments when clicked, you can define the following with ES2015:

```js
class Counter extends HTMLElement {
  clicked() {
    this.x++;
    window.requestAnimationFrame(this.render.bind(this));
  }

  constructor() {
    super();
    this.onclick = this.clicked.bind(this);
    this.x = 0;
  }

  connectedCallback() { this.render(); }

  render() {
    this.textContent = this.x.toString();
  }
}
window.customElements.define('num-counter', Counter);
```

## Field declarations

With the ESnext field declarations proposal, the above example can be written as


```js
class Counter extends HTMLElement {
  x = 0;

  clicked() {
    this.x++;
    window.requestAnimationFrame(this.render.bind(this));
  }

  constructor() {
    super();
    this.onclick = this.clicked.bind(this);
  }

  connectedCallback() { this.render(); }

  render() {
    this.textContent = this.x.toString();
  }
}
window.customElements.define('num-counter', Counter);
```

In the above example, you can see a field declared with the syntax `x = 0`. You can also declare a field without an initializer as `x`. By declaring fields up-front, class definitions become more self-documenting; instances go through fewer state transitions, as declared fields are always present.

## Private methods and fields

The above example has some implementation details exposed to the world that might be better kept internal. Using ESnext private fields and methods, the definition can be refined to:

```js
class Counter extends HTMLElement {
  #x = 0;

  #clicked() {
    #x++;
    window.requestAnimationFrame(this.render.bind(this));
  }

  constructor() {
    super();
    this.onclick = this.#clicked.bind(this);
  }

  connectedCallback() { this.render(); }

  render() {
    this.textContent = this.#x.toString();
  }
}
window.customElements.define('num-counter', Counter);
```

To make methods and fields private, just give them a name starting with `#`. A shorthand for `this.#x` is simply `#x`.

By defining things which are not visible outside of the class, ESnext provides stronger encapsulation, ensuring that your classes' users don't accidentally trip themselves up by depending on internals, which may change version to version.

Note that ESnext provides private fields only as declared up-front in a field declaration; private fields cannot be created as expandos.

## Decorators

ESnext provides decorators to let frameworks and libraries to implement part of the behavior of classes, as seen in the next version of the example:

```js
@defineElement('num-counter')
class Counter extends HTMLElement {
  @observed #x = 0;

  @bound
  #clicked() {
    this.#x++;
  }

  constructor() {
    super();
    this.onclick = this.#clicked;
  }

  connectedCallback() { this.render(); }

  @bound
  render() {
    this.textCountent = this.#x.toString();
  }
}
```

Here, decorators are used for:
- `@defineElement` defines the custom element, allowing the name of the element to be at the beginning of the class
- `@bound` makes `#clicked` into an auto-bound method, replacing the explicit `bind` call later
- `@observed` automatically schedules a call to the `render()` method when the `#x` field is changed

You can decorate the whole class, as well as declarations of fields, getters, setters and methods. Arguments and function declarations cannot be decorated.

To learn how to define your own decorators, see [METAPROGRAMMING.md](https://github.com/littledan/proposal-unified-class-features/blob/master/METAPROGRAMMING.md). To see how each form looks syntactically and how it's represented in decorators, see [TAXONOMY.md](https://github.com/littledan/proposal-unified-class-features/blob/master/TAXONOMY.md).
