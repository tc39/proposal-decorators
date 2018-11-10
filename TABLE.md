
| **parameter descriptor**   | **`@decorator`<br/>`class`**             | **`@decorator`<br/>`method()`**             | **`@decorator`<br/>`field`**                                     | **`@decorator`<br/>`get field()`<br/>`set field()`**|
|----------------------------|------------------------------------------|---------------------------------------------|------------------------------------------------------------------|-----------------------------------------------------|
|`{`                         |                                          |                                             |                                                                  |                                                     |
|`  kind:`                   |`"class"`                                 |`"method"`                                   |`"field"`                                                         |`"method"` <sup>4</sup>                              |
|`  elements:`               |*Array of member descriptors* <sup>1</sup>| -                                           | -                                                                | -                                                   |
|`  key:`                    | -                                        |  *method name*                              |*property name*                                                   |*property name*                                      |
|`  placement:`              | -                                        |`"prototype" \|\| "static"`                  |`"own" \|\| "static"`                                             |`"prototype" \|\| "static"`                          |
|`  initializer:`            | -                                        | -                                           |*Function used to set the initial value of the field* <sup>2</sup>| -                                                   |
|`  descriptor:{`            | -                                        |                                             |                                                                  |                                                     |
|`    value:`                | -                                        |  *method function*                          | - <sup>3</sup>                                                   | -                                                   |
|`    get:`                  | -                                        | -                                           | -                                                                |*getter function*                                    |
|`    set:`                  | -                                        | -                                           | -                                                                |*setter function*                                    |
|`    writable:`             | -                                        |`true`                                       |`true`                                                            | - <sup>5</sup>                                      |
|`    configurable:`         | -                                        |`true`                                       |`true`                                                            |`true`                                               |
|`    enumerable:`           | -                                        |`false`                                      |`false`                                                           |`false`                                              |
|`  }`                       | -                                        |                                             |                                                                  |                                                     |
|`}`                         |                                          |                                             |                                                                  |                                                     |
</table>

<sup>1</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors.

<sup>2</sup> `initializer` function is present only if the field is initialized into the class body: `field = 10`. Please, check if exist before call it.

<sup>3</sup> when `kind` is `field` don't include the value into the `descritor.value` and the value, if exist, is returned by `initializer` function.

<sup>4</sup> when the decorator is apply over a getter/setter `kind` is `method` and `descriptor.get` or `descriptor.set` has value. 

<sup>5</sup> when `descriptor.get` or `descriptor.set` has value, the property descriptor don't include `writable` value.

| **return descriptor (optional)** | **`class`**                               | **`method()`**                           | **`field`**                                         | **`getter/setter`**                      | **Initializers**                         |
|----------------------------------|-------------------------------------------|------------------------------------------|-----------------------------------------------------|------------------------------------------|------------------------------------------|
|`{`                               |                                           |                                          |                                                     |                                          |                                          |
|`  kind:`                         |`"class"`                                  |`"method"`                                |`"field"`                                            |`"method"`                                |`"initializer"` <sup>12</sup>             |
|`  elements:`                     |*Array of member descriptors* <sup>6</sup> | -                                        | -                                                   | -                                        | -                                        |
|`  key:`                          | -                                         |  *method name*    <sup>8</sup>           |*field name* <sup>8</sup>                            |*field name* <sup>8</sup>                 | -                                        |
|`  placement:`                    | -                                         |`"prototype" \|\| "static" \|\| "own"`    |`"prototype" \|\| "static" \|\| "own"`               |`"prototype" \|\| "static" \|\| "own"`    |`"prototype" \|\| "static" \|\| "own"`    |
|`  extras:`                       | -                                         |*Array of member descriptors* <sup>7</sup>|*Array of member descriptors* <sup>7</sup>           |*Array of member descriptors* <sup>7</sup>| -                                        |
|`  initializer:`                  | -                                         |                                          |*Function used to set the initial value of the field*| - <sup>10</sup>                          | -                                        |
|`  descriptor:{`                  | -                                         | <sup>9</sup>                             | <sup>9</sup>                                        | <sup>9</sup>                             |                                          |
|`    value:`                      | -                                         |*method function*                         | -                                                   | - <sup>10</sup>                          | -                                        |
|`    get:`                        | -                                         | -                                        | -                                                   |*getter*                                  | -                                        |
|`    set:`                        | -                                         | -                                        | -                                                   |*setter*                                  | -                                        |
|`    writable:`                   | -                                         |`true \|\| false`                         |`true \|\| false`                                    | - <sup>10</sup>                          | -                                        |
|`    configurable:`               | -                                         |`true \|\| false`                         |`true \|\| false`                                    |`true \|\| false`                         | -                                        |
|`    enumerable:`                 | -                                         |`false \|\| true`                         |`false \|\| true`                                    |`false \|\| true`                         | -                                        |
|`  }`                             | -                                         |                                          |                                                     |                                          |                                          |
|`  finisher:`                     |*callback* <sup>11</sup>                   |  *callback* <sup>11</sup>                |  *callback* <sup>11</sup>                           |  *callback*    <sup>11</sup>             | *callback*    <sup>12</sup>              |
|`}`                               |                                           |                                          |                                                     |                                          |                                          |
</tbody>    
</table>

<sup>6</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors. You can add (include new object descriptor in this array), remove elements (delete existed object descriptor from this array) or change elements (modify object descriptor elements).

<sup>7</sup> `extra` is an array of decorator descriptors, not to be confused with property descriptors. You can add other new members when a method or field is decorated.

<sup>8</sup> `key` can be change from the original. If the member is private (`#name`) a `decorators.PrivateName(name)` is included in this property. It's a mandatory field.

<sup>9</sup> `descriptor` is a mandatory field, but can be an empty object.

<sup>10</sup> cannot include `initializer`, `descriptor.value` or `descriptor.writable` when `descriptor.get` or `descriptor.set` are defined.

<sup>11</sup> `finisher` function is a callback that is called at the end of class creation. It's optional.

<sup>12</sup> `kind: "initializer"` permits to define a `finisher` callback to be used purely for perform a side effect when instantiating a class. This descriptor don't create new members. Do not confuse with the `initializer` property used to set the initial value to a field.

**Note**: you can replace a field decorator with a method descriptor, or a getter, or vice-versa, but you can't interchange those with classes.
