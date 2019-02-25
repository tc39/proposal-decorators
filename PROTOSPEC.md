# Specification outline

An outline of the logic for this proposal, in the way that it would be specified:

## Grammar

```
DecoratorIdentifier :: @ IdentifierName

Decorator : DecoratorIdentifier ArgumentsList_opt

DecoratorList : Decorator+
```

`DecoratorList`s can be used as in the current decorators proposal: decorating classes, methods, or field declarations.

```
DecoratorDeclaration :
  decorator [no LineTerminator here] DecoratorIdentifier (FormalParameters[~Yield, ~Await])_opt { DecoratorList }
```

## Scopes

Similar to `#names`, there is a parallel lexical scope for `@names`. This is important so that `with` statements do not provide a way to dynamically create decorators.

Each construct which makes a new lexical scope for variables also names a lexical scope for decorators. The only type of declarations which decorators support are `const` declarations and `import { @name }` declarations.

There is a special outer scope for built-in decorators. When a decorator is declared at the module or script level, it is being declared in an inner, nested scope which may shadow things in this outer scope. In this way, built-in decorators can be polyfilled.

## Early errors

Although the decorators specification is designed to allow decorators to be analyzed ahead of time, the JavaScript specification is organized with everything running at runtime, except for analysis of early errors. Because decorators may be imported from other modules, decorators are specified to operate entirely runtime, rather than at early error time.

## Runtime representation of decorators

A decorator as applied is represented as a List of Decorator Records of the form { [[BuiltinDecorator]]: the String name of a built-in decorator, e.g., `"wrap"`, [[Arguments]]: a List of JavaScript values }.

A `decorator` declaration is, effectively, a function which converts a List of JavaScript values into a List of Decorator Records.

Note, the length of the list and the [[BuiltinDecorator]] fields can be pre-computed at parse time, if the imports are parsed. Only the [[Arguments]] will differ across multiple runs of the program.

## Execution

When evaluating decorators, there are two stages:
1. First, when evaluating the class declaration, the DecoratorLists are evaluated into a list 
2. Then, later in the class evaluation, the the built-in decorators which resulted from the previousl evaluation are invoked directly, at various points in time.

### Evaluating a decorator list

Decorator lists are evaluated interspersed with evaluation of the class (e.g., with respect to computed property names). In practice, at runtime, what's really being evaluated is the argument lists. The evaluation basically works like ordinary function calls, bottoming out when a built-in decorator is reached.
1. Let *result* be an empty list.
1. For each *decorator* in the DecoratorList:
  1. Evaluate the arguments of *decorator*.
  1. If *decorator* is a built-in decorator, append it as a Decorator Record to *result*.
  1. Otherwise, find the `decorator @thisDecorator` definition and call it, which will give a new DecoratorList. Recurse at Step 2.

### Applying built-in decorators

Decorator lists are evaluated into lists of built-in decorators. These are accumulated on the class in ways that are specific to each decorator:
- For `@register`, a class-wide list of calls to `register` is constructed (with the list including both the function to call and, if applicable, the property descriptor to pass to it). This list is called, in order (inside to outside, top to bottom), as the last step of creating a class.
- For `@initialize`, the field definition Record (as output by ClassFieldDefinitionEvaluation) is annotated with the callback passed, and then the callback is run each time the initializer is run. Note, only one `@initialize` call may be made per field.
- For `@wrap`, the `@wrap` usages in methods are filtered out of the DecoratorList and called immediately when filling in the class, from the inside to the outside, before defining the method.
