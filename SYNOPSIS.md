# Built-in Decorators Synopsis

## `@wrap(f)`

It's evaluated while setting up the class.

**function f**
- *parameters*:
    - target: method (for method and accessor) or class (for class)
- *return*:
    - replace method or replace class or undefined
    
**decorate**: - *class* - *public method* - *public accessor* - *static public method*  - *static public accessor* - *private method* - *private accessor* - *static private method* - *static private accessor*


## `@register(f)`

It's evaluated after the class is created

**function f**

- *parameters*:
    - target: class (for static fields, static method and class) or class prototype (for instance fields and methods)   
    - key (for public fields, methods or accessors) or undefined (for private and class)
    
- *return*: 
    - undefined
    
**decorate**: all elements


## `@expose(f)`

It's evaluated after the class is created

**function f**

- *parameters*:
    - target: class (for static fields, static method and class)<br/>class prototype (for instance fields and methods)
    - key: private name string
    - get: function to get the member.`func(instance)` return the field value
    - set: function to get the member. `func(instance, value)` update field value and return the value

- *return*:
    - undefined

- **decorate**: - *private method* - *private accessor* - *private field* - *static private method* - *static private accessor* - *static private field*   

## `@initialize(f)`

It's evaluated after executing the field initializer

**function f**

- *parameters*
    - target: class instance
    - key: field key (for public field) or  or undefined (for class and private field)
    - value: field value (for public field) or undefined (for class, method and private field)
    
- *return*: 
    - undefined

**decorate**: all elements
