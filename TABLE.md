
| **parameter descriptor**   | **`@decorator`<br/>`class`**             | **`@decorator`<br/>`method()`**             | **`@decorator`<br/>`field`**                                     | **`@decorator`<br/>`get field()`<br/>`set field()`**|
|----------------------------|------------------------------------------|---------------------------------------------|------------------------------------------------------------------|-----------------------------------------------------|
|`{`                         |                                          |                                             |                                                                  |                                                     |
|`  kind:`                   |`"class"`                                 |`"method"`                                   |`"field"`                                                         |`"accessor"` <sup>4</sup>                            |
|`  elements:`               |*Array of member descriptors* <sup>1</sup>| -                                           | -                                                                | -                                                   |
|`  key:`                    | -                                        |  *method name*                              |*property name*                                                   |*property name*                                      |
|`  placement:`              | -                                        |`"prototype" \|\| "static"`                  |`"own" \|\| "static"`                                             |`"prototype" \|\| "static"`                          |
|`  initialize:`             | -                                        | -                                           |*Function used to set the initial value of the field* <sup>2</sup>| -                                                   |
|`  method:`                 | -                                        |  *method function*                          | - <sup>3</sup>                                                   | -                                                   |
|`  get:`                    | -                                        | -                                           | -                                                                |*getter function*                                    |
|`  set:`                    | -                                        | -                                           | -                                                                |*setter function*                                    |
|`  writable:`               | -                                        |`true`                                       |`true`                                                            | - <sup>5</sup>                                      |
|`  configurable:`           | -                                        |`true`                                       |`true`                                                            |`true`                                               |
|`  enumerable:`             | -                                        |`false`                                      |`false`                                                           |`false`                                              |
|`}`                         |                                          |                                             |                                                                  |                                                     |
</table>

<sup>1</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors.

<sup>2</sup> `initialize` function is present only if the field is initialized into the class body: `field = 10`. A declaration like `field;` has `initialize` as undefined. Please, check if exist before calling it.

<sup>3</sup> when `kind` is `field`, don't include the value into the `method` and the value, if it exists, is returned by `initialize` function.

<sup>4</sup> when the decorator is apply over a getter/setter `kind` is `accessor` and `get` or `set` has value. 

<sup>5</sup> when `get` or `set` has value, the property descriptor doesn't include `writable` value.

| **return descriptor (optional)** | **`class`**                               | **`method()`**                           | **`field`**                                         | **`getter/setter`**                      | **Hooks**                                |
|----------------------------------|-------------------------------------------|------------------------------------------|-----------------------------------------------------|------------------------------------------|------------------------------------------|
|`{`                               |                                           |                                          |                                                     |                                          |                                          |
|`  kind:`                         |`"class"`                                  |`"method"`                                |`"field"`                                            |`"accessor"`                              |`"hook"` <sup>11</sup>                    |
|`  elements:`                     |*Array of member descriptors* <sup>6</sup> | -                                        | -                                                   | -                                        | -                                        |
|`  key:`                          | -                                         |  *method name*    <sup>8</sup>           |*field name* <sup>8</sup>                            |*field name* <sup>8</sup>                 | -                                        |
|`  placement:`                    | -                                         |`"prototype" \|\| "static" \|\| "own"`    |`"prototype" \|\| "static" \|\| "own"`               |`"prototype" \|\| "static" \|\| "own"`    |`"prototype" \|\| "static" \|\| "own"`    |
|`  extras:`                       | -                                         |*Array of member descriptors* <sup>7</sup>|*Array of member descriptors* <sup>7</sup>           |*Array of member descriptors* <sup>7</sup>| -                                        |
|`  initialize:`                   | -                                         | -                                        |*Function used to set the initial value of the field*| - <sup>9</sup>                           | -                                        |
|`  start:`                        | -                                         | -                                        | -                                                   | -                                        | *Function for effect* <sup>10</sup>      |
|`  register:`                     | -                                         | -                                        | -                                                   | -                                        | *Function for effect* <sup>10</sup>      |
|`  replace:`                      | -                                         | -                                        | -                                                   | -                                        | *Function for replacement* <sup>10</sup> |
|`  method:`                       | -                                         |*method function*                         | -                                                   | - <sup>9</sup>                           | -                                        |
|`  get:`                          | -                                         | -                                        | -                                                   |*getter*                                  | -                                        |
|`  set:`                          | -                                         | -                                        | -                                                   |*setter*                                  | -                                        |
|`  writable:`                     | -                                         |`true \|\| false`                         |`true \|\| false`                                    | - <sup>9</sup>                           | -                                        |
|`  configurable:`                 | -                                         |`true \|\| false`                         |`true \|\| false`                                    |`true \|\| false`                         | -                                        |
|`  enumerable:`                   | -                                         |`false \|\| true`                         |`false \|\| true`                                    |`false \|\| true`                         | -                                        |
|`}`                               |                                           |                                          |                                                     |                                          |                                          |
</tbody>    
</table>

<sup>6</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors. You can add (include new object descriptor in this array), remove elements (delete existed object descriptor from this array) or change elements (modify object descriptor elements).

<sup>7</sup> `extra` is an array of decorator descriptors, not to be confused with property descriptors. You can add other new members when a method or field is decorated.

<sup>8</sup> `key` can be change from the original. If the member is private (`#name`) a PrivateName object is included in this property. It's a mandatory field.

<sup>9</sup> cannot include `initialize`, `method` or `writable` when `get` or `set` are defined.

<sup>11</sup> `kind: "hook"` doesn't create new members. You can use the `start` field to include a callback to be used purely for perform a side effect, interspersed with field initializers. Do not confuse with the `initialize` property used to set the initial value to a field. The `register` callback is called for side effect at the end of construction, and the `replace` side effect is called at that time as well, to return a replacement class. A hook may contain only one of these three functions.

**Note**: you can replace a field decorator with a method descriptor, or a getter, or vice-versa, but you can't interchange those with classes.
