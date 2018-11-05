
| **parameter descriptor**              | **<code>@decorator<br/>class</code>**    | **<code>@decorator<br/>method()</code>**    | **<code>@decorator<br/>field</code>**               | **<code>@decorator<br/>get field()<br/>set field()</code>**|
|---------------------------------------|------------------------------------------|---------------------------------------------|-----------------------------------------------------|------------------------------------------------------------|
|`{`                                    |                                          |                                             |                                                     |                                                            |
|&nbsp;&nbsp;`kind:`                    |`"class"`                                 |`"method"`                                   |`"field"`                                            |`"method"` <sup>4</sup>                                     |
|&nbsp;&nbsp;`elements:`                |*Array of member descriptors* <sup>1</sup>| -                                           | -                                                   | -                                                          |
|&nbsp;&nbsp;`key:`                     | -                                        |  *method name*                              |*method name*                                        |*property name*                                             |
|&nbsp;&nbsp;`placement:`               | -                                        |`"prototype" || "static"`                    |`"own" || "static"`                                  |`"prototype" || "static"`                                   |
|&nbsp;&nbsp;`initializer:`             | -                                        | -                                           |*function than return the initial value* <sup>2</sup>| -                                                          |
|&nbsp;&nbsp;`descriptor:{`             | -                                        |                                             |                                                     |                                                            |
|&nbsp;&nbsp;&nbsp;&nbsp;`value:`       | -                                        |  *method function*                          | - <sup>3</sup>                                      | -                                                          |
|&nbsp;&nbsp;&nbsp;&nbsp;`get:`         | -                                        | -                                           | -                                                   |*getter function*                                           |
|&nbsp;&nbsp;&nbsp;&nbsp;`set:`         | -                                        | -                                           | -                                                   |*setter function*                                           |
|&nbsp;&nbsp;&nbsp;&nbsp;`writable:`    | -                                        |`true`                                       |`true`                                               | - <sup>5</sup>                                             |
|&nbsp;&nbsp;&nbsp;&nbsp;`configurable:`| -                                        |`true`                                       |`true`                                               |`true`                                                      |
|&nbsp;&nbsp;&nbsp;&nbsp;`enumerable:`  | -                                        |`false`                                      |`false`                                              |`false`                                                     |
|&nbsp;&nbsp;`}`                        | -                                        |                                             |                                                     |                                                            |
|`}`                                    |                                          |                                             |                                                     |                                                            |
</table>

<sup>1</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors.

<sup>2</sup> `initializer` function is present only if the field is initialized into the class body: `field = 10`. Please, check if exist before call it.

<sup>3</sup> when `kind` is `field` don't include the value into the `descritor.value` and the value, if exist, is returned by `initializer` function.

<sup>4</sup> when the decorator is apply over a getter/setter `kind` is `method` and `descriptor.get` or `descriptor.set` has value. 

<sup>5</sup> when `descriptor.get` or `descriptor.set` has value, the property descriptor don't include `writable` value.

| **return descriptor (optional)**      | **`class`**                               | **`method()`**                           | **`field`**                              | **`getter/setter`**                      |
|---------------------------------------|-------------------------------------------|------------------------------------------|------------------------------------------|------------------------------------------|
|`{`                                    |                                           |                                          |                                          |                                          |
|&nbsp;&nbsp;`kind:`                    |`"class"`                                  |`"method"`                                |`"field"`                                 |`"method"`                                |
|&nbsp;&nbsp;`elements:`                |*Array of member descriptors* <sup>6</sup> | -                                        | -                                        | -                                        |
|&nbsp;&nbsp;`key:`                     | -                                         |  *method name*    <sup>8</sup>           |*field name* <sup>8</sup>                 |*field name* <sup>8</sup>                 |
|&nbsp;&nbsp;`placement:`               | -                                         |`"prototype" || "static" || "own"`        |`"prototype" || "static" || "own"`        |`"prototype" || "static" || "own"`        |
|&nbsp;&nbsp;`extras:`                  | -                                         |*Array of member descriptors* <sup>7</sup>|*Array of member descriptors* <sup>7</sup>|*Array of member descriptors* <sup>7</sup>|
|&nbsp;&nbsp;`initializer:`             | -                                         |                                          |*function than return the initial value*  | - <sup>10</sup>                          |
|&nbsp;&nbsp;`descriptor:{`             | -                                         | <sup>9</sup>                             | <sup>9</sup>                             | <sup>9</sup>                             |
|&nbsp;&nbsp;&nbsp;&nbsp;`value:`       | -                                         |*method function*                         | -                                        | - <sup>10</sup>                          |
|&nbsp;&nbsp;&nbsp;&nbsp;`get:`         | -                                         | -                                        | -                                        |*getter*                                  |
|&nbsp;&nbsp;&nbsp;&nbsp;`set:`         | -                                         | -                                        | -                                        |*setter*                                  |
|&nbsp;&nbsp;&nbsp;&nbsp;`writable:`    | -                                         |`true || false`                           |`true || false`                           | - <sup>10</sup>                          |
|&nbsp;&nbsp;&nbsp;&nbsp;`configurable:`| -                                         |`true || false`                           |`true || false`                           |`true || false`                           |
|&nbsp;&nbsp;&nbsp;&nbsp;`enumerable:`  | -                                         |`false || true`                           |`false || true`                           |`false || true`                           |
|&nbsp;&nbsp;`}`                        | -                                         |                                          |                                          |                                          |
|&nbsp;&nbsp;`finisher:`                |*callback* <sup>11</sup>                   |  *callback* <sup>11</sup>                |  *callback* <sup>11</sup>                |  *callback*    <sup>3</sup>              |
|`}`                                    |                                           |                                          |                                          |                                          |
</tbody>    
</table>

<sup>6</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors. You can add (include new object descriptor in this array), remove elements (delete existed object descriptor from this array) or change elements (modify object descriptor elements).

<sup>7</sup> `extra` is an array of decorator descriptors, not to be confused with property descriptors. You can add new member when a method or field is decorated.

<sup>8</sup> `key` can be change from the original. It's a mandatory field. If the member is private (#name) a `decorators.PrivateName(name)` is included in this property. key can be change from the original. It's a mandatory field.

<sup>9</sup> `descriptor` is a mandatory field, but can be an empty object.

<sup>10</sup> cannot include `initializaer`, `descriptor.value` or `descriptor.writable` when `descriptor.get` or `descriptor.set` are defined.

<sup>11</sup> `finisher` function is a callback that is called at the end of class creation. It's optional.

