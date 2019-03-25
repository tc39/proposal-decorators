# Built-in Decorators Synopsis

|                           |                              `@wrap(f)`                                      /
|---------------------------|------------------------------------------------------------------------------|
| **when**                  | while setting up the class                                                   |
| **function f**            |                                                                              |
| *parameters*              | - target: method (for method and accessor) or class (for class)              |
| *return*                  | replace method or class or undefined                                         |
| **decorate**              |                                                                              |
| *class*                   |                                  X                                           |
| *public method*           |                                  X                                           |
| *public accessor*         |                                  X                                           |
| *public field*            |                                  -                                           |
| *static public method*    |                                  X                                           |
| *static public accessor*  |                                  X                                           |
| *static public field*     |                                  -                                           |
| *private method*          |                                  X                                           |
| *private accessor*        |                                  X                                           |
| *private field*           |                                  -                                           |
| *static private method*   |                                  X                                           |
| *static private accessor* |                                  X                                           |
| *static private field*    |                                  -                                           |


|                           |                            `@register(f)`                                    |
|---------------------------|------------------------------------------------------------------------------|
| **when**                  | after the class is created                                                   |
| **function f**            |                                                                              |
| *parameters*              | - target: class (for static fields, static method and class) or class prototype (for instance fields and methods) |
|                           | - key (for public fields, methods or accessors) or undefined (for private and class)                              |
| *return*                  | undefined                                                                    |
| **decorate**              |                                                                              |
| *class*                   |                                  X                                           |
| *public method*           |                                  X                                           |
| *public accessor*         |                                  X                                           |
| *public field*            |                                  X                                           |
| *static public method*    |                                  X                                           |
| *static public accessor*  |                                  X                                           |
| *static public field*     |                                  X                                           |
| *private method*          |                                  X                                           |
| *private accessor*        |                                  X                                           |
| *private field*           |                                  X                                           |
| *static private method*   |                                  X                                           |
| *static private accessor* |                                  X                                           |
| *static private field*    |                                  X                                           |

|                           |                              `@expose(f)`                                    |
|---------------------------|------------------------------------------------------------------------------|
| **when**                  | after the class is created                                                   |
| **function f**            |                                                                              |
| *parameters*              | - target: class (for static fields, static method and class)<br/>class prototype (for instance fields and methods) |
|                           | - key: private name string                                                   |
|                           | - get: function to get the member.`func(instance)` return the field value                                          |
|                           | - set: function to get the member. `func(instance, value)` update field value and return the value                 |
| *return*                  | undefined                                                                    |
| **decorate**              |                                                                              |
| *class*                   |                                       -                                      |
| *public method*           |                                       -                                      |
| *public accessor*         |                                       -                                      |
| *public field*            |                                       -                                      |
| *static public method*    |                                       -                                      |
| *static public accessor*  |                                       -                                      |
| *static public field*     |                                       -                                      |
| *private method*          |                                       X                                      |
| *private accessor*        |                                       X                                      |
| *private field*           |                                       X                                      |
| *static private method*   |                                       X                                      |
| *static private accessor* |                                       X                                      |
| *static private field*    |                                       X                                      |

|                           |                             `@initialize(f)`                                 |
|---------------------------|------------------------------------------------------------------------------|
| **when**                  | after executing the field initializer                                        |
| **function f**            |                                                                              |
| *parameters*              | - target: class instance (for public field)                                  |
|                           | - value: field value (for public field) or undefined (for private field)     |
|                           | - key: field key (for public field) or  or undefined (for private field)     |
| *return*                  | undefined                                                                    |
| **decorate**              |                                                                              |
| *class*                   |                                       -                                      |
| *public method*           |                                       X                                      |
| *public accessor*         |                                       X                                      |
| *public field*            |                                       X                                      |
| *static public method*    |                                       X                                      |
| *static public accessor*  |                                       X                                      |
| *static public field*     |                                       X                                      |
| *private method*          |                                       X                                      |
| *private accessor*        |                                       X                                      |
| *private field*           |                                       X                                      |
| *static private method*   |                                       X                                      |
| *static private accessor* |                                       X                                      |
| *static private field*    |                                       X                                      |


