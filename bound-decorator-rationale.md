# Rationale for the `@bound` decorator

You may have seen the following pattern for creating bound methods and be wondering why a `@bound` decorator would be preferred over this:

```js
class Counter extends HTMLElement {
  @observed #x = 0;

  onclick = () => {
    this.#x++;
  }

  ...
}
```

This is still a subject of some debate, but there are certainly valid reasons to prefer the decorator implementation:

### Mocking

The arrow function version is equivalent to the following:

```js
class Counter extends HTMLElement {
  ...

  constructor() {
    super();
    this.onclick = () => this.#x++;
  }

  ...
}
```

Therefore, the `onclick` method no longer exists on the `Counter`'s prototype. Suppose our `Counter` class had a couple other regular methods in addition to `onclick`:

```js
class Counter extends HTMLElement {
  ...
  foo() {...}
  bar() {...}
  ...
}
```

Then those methods would be defined on the prototype:

```js
Counter.prototype.foo  // defined
Counter.prototype.bar  // defined
```

But `onclick` would not:

```js
Counter.prototype.onclick  // undefined
```

It usually makes sense to put mock methods on the prototype, not on each instance separately (and this is how many testing libraries work when you ask them to create a mock or spy method):

```js
Counter.prototype.onclick = mockMethod
```

But this prototype method will be ignored, because `this.onclick` (own property) takes priority in the prototype chain.

### Inheritance

As we saw above, using arrow functions in class field initializers causes the method to be absent from the prototype. This can lead to unexpected results when using inheritance.

Suppose we have a subclass of `Counter` with its own `onclick` method:

```js
class Counter extends HTMLElement {
  ...
  onclick = () => {
    this.#x++;
  }
  ...
}

class SpecialCounter extends Counter {
  onclick() {
    console.log("SpecialCounter clicked");
  }
  ...
}

const specialCounter = new SpecialCounter();
// Which method gets called?
specialCounter.onclick();
// (Note: this example is for illustrative purposes only, since in the original example, `this.onclick = ...`
// sets up the event listener for the browser. Among other reasons, this example is not realistic because
// we're calling onclick() manually here.)
```

In the above example, the expectation is that you are calling the `onclick` method in the `SpecialCounter` class, but in fact that method is not called at all because the ES engine first looks for property values in the instance before it looks at the prototype. The method that is actually called is the `onclick` method in the parent `Counter` class.

`super` calls can also break unexpectedly:

```js
class SpecialCounter extends Counter {
  ...
  onclick = () => {
    // Uncaught TypeError: (intermediate value).onclick is not a function
    super.onclick();
  }
  ...
}
```

### Comparison with `@bind` decorator

Let's consider some alternative implementations of the original example from the readme:

```js
// Version A
class Counter extends HTMLElement {
  constructor() {
    super();
    this.onclick = this.#clicked.bind(this);
  }

  #clicked() {
    this.#x++;
  }
  ...
}

// Version B
class Counter extends HTMLElement {
  onclick = () => {
    this.#x++;
  }
  ...
}

// Version C
class Counter extends HTMLElement {
  onclick = this.#clicked.bind(this);

  #clicked() {
    this.#x++;
  }
  ...
}

// Version D
class Counter extends HTMLElement {
  onclick = this.#clicked;

  @bound
  #clicked() {
    this.#x++;
  }
  ...
}
```

It's generally agreed that concise, expressive code is preferable as long as it doesn't hide important details. From this perspective, versions B and D have the advantage. Version D (using the decorator) is often preferable to version B for the reasons explained above. Version C is the next most concise version that also avoids the issues with arrow functions, but it still requires that you call `bind()` manually for every function you want to bind. This is more obvious in cases where the decorator would allow you to write the method name only once. For example, in React you would not need to assign the method to `onclick` but could use a `handleClick` method directly:

```js
class Counter extends React.Component {
  ...
  @bound
  handleClick() {
    this.#x++;
  }

  render() {
    return (
      <div onClick={this.handleClick}>
        {this.props.children}
      </div>
    );
  }
}
```

Having said all that, the `@bound` decorator does not perfectly prevent all issues relating to bound functions and inheritance. For example, consider this:

```js
class Parent {
  @bound
  foo() {
    console.log("Parent");
  }
}

class Child {
  constructor() {
    super();
    // Logs "Parent", not "Child"
    this.foo();
  }

  foo() {
    console.log("Child");
  }
}
```

But there are still significantly fewer prototype and inheritance-related issues with the `@bound` decorator than there are with fields initialized to arrow functions.

### Counterarguments

Some people argue that the above issues are not sufficient reason to avoid arrow functions in class fields entirely, depending on your app. Obviously, in parts of your app where you are using inheritance, the arguments against arrow functions are more persuasive. There are also performance considerations when choosing between the two approaches. The performance differences are usually negligible but can be more significant in cases where you have hundreds or thousands of instances of a class. If you were to simply use arrow functions everywhere without thinking about the consequences, that could cause problems. Of course the same would be true of careless use of the `@bound` decorator. A full comparison of all the pros and cons in different situations is beyond the scope of this article. Suffice it to say that arrow functions are not an ideal solution in all situations, and the motivation to want a `@bound` decorator is realistic.
