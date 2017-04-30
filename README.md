# ESnext class features for JavaScript

Daniel Ehrenberg

This document proposes a combined vision for how the proposed class features could work together--[decorators](https://tc39.github.io/proposal-decorators/), [public fields](https://tc39.github.io/proposal-class-public-fields/) and [private fields](https://github.com/tc39/proposal-private-fields), drawing on the earlier [Orthogonal Classes](https://github.com/erights/Orthogonal-Classes) and [Class Evaluation Order](https://onedrive.live.com/view.aspx?resid=A7BBCE1FC8EE16DB!442046&app=PowerPoint&authkey=!AEeXmhZASk50KjA) proposals.

## Defining and using methods and fields

```js
class IncrementalDownload {
  constructor(url) {
    this.url = url;
    #response = fetch(url);
    #progressBar = document.querySelector('#progressBar');
    #run();
  }

  // INSERT REALISTIC EXAMPLE
}
```

In the above example, you can see two new features of classes:
- Fields can be defined with syntax like `fieldName = value`, or just `fieldName`
- Fields and methods can be made private by using a name starting with `#`.
  - A shorthand for `this.#x` is simply `#x`.

## Using decorators in classes

Decorators allow frameworks and libraries to extend the behavior of classes. Decorators are used by putting `@decoratorName(args)` before an element of a class. Some decorators take arguments, and others expect no arguments. Decorators can do all sorts of things--see the documentation of particular decorator for more information. You can decorate any class element, or the entire class as a whole, as in this example:

```js
@registerElement('counter')
class Counter extends HTMLElement {
  @observed #x = 0;

  @bound
  #clicked() {
    #x++;
  }

  constructor() {
    this.onclick = #clicked;
  }

  render() {
    this.innerHTML = #x.toString();
  }
}
```

You can decorate the whole class, as well as declarations of fields, getters, setters and methods. Arguments and function declarations cannot be decorated.

To learn how to define your own decorators, see [METAPROGRAMMING.md].

## Further details

This page is a high-level overview of the features and their interaction from a user perspective. For detailed semantics, see [DETAILS.md]. For a taxonomy of supported forms, see [TAXONOMY.md].
