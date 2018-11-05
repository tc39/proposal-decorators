
<table>
<tr><td><b>parameter descriptor</b>                       </td><td><b><code>@decorator
class</code></b>      </td><td><b><code>@decorator
method()</code></b>  </td><td><b><code>@decorator
field</code></b>                  </td><td><b><code>@decorator
get field()
set field()</code></b> </td></tr>
<tr><td>`{`                                               </td><td>                                              </td><td>                                             </td><td>                                                          </td><td>                                                              </td></tr>
<tr><td>&nbsp;&nbsp;<code>kind:</code>                    </td><td><code>"class"</code>                          </td><td><code>"method"</code>                        </td><td><code>"field"</code>                                      </td><td><code>"method"</code> <sup>4</sup>                            </td></tr>
<tr><td>&nbsp;&nbsp;<code>elements:</code>                </td><td><i>Array of member descriptors</i><sup>1</sup></td><td> -                                           </td><td> -                                                        </td><td> -                                                            </td></tr>
<tr><td>&nbsp;&nbsp;<code>key:</code>                     </td><td> -                                            </td><td><i>method name</i>                           </td><td><i>method name</i>                                        </td><td><i>property name</i>                                          </td></tr>
<tr><td>&nbsp;&nbsp;<code>placement:</code>               </td><td> -                                            </td><td><code>"prototype" || "static"</code>         </td><td><code>"own" || "static"</code>                            </td><td><code>"prototype" || "static"</code>                          </td></tr>
<tr><td>&nbsp;&nbsp;<code>initializer:</code>             </td><td> -                                            </td><td> -                                           </td><td><i>function than return the initial value</i> <sup>2</sup></td><td> -                                                            </td></tr>
<tr><td>&nbsp;&nbsp;<code>descriptor:{</code>             </td><td> -                                            </td><td>                                             </td><td>                                                          </td><td>                                                              </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>value:</code>       </td><td> -                                            </td><td><i>method function</i>                       </td><td> - <sup>3</sup>                                           </td><td> -                                                            </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>get:</code>         </td><td> -                                            </td><td> -                                           </td><td> -                                                        </td><td> <i>getter function</i>                                       </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>set:</code>         </td><td> -                                            </td><td> -                                           </td><td> -                                                        </td><td> <i>setter function</i>                                       </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>writable:</code>    </td><td> -                                            </td><td><code>true</code>                            </td><td><code>true</code>                                         </td><td> - <sup>5</sup>                                               </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>configurable:</code></td><td> -                                            </td><td><code>true</code>                            </td><td><code>true</code>                                         </td><td><code>true</code>                                             </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>enumerable:</code>  </td><td> -                                            </td><td><code>false</code>                           </td><td><code>false</code>                                        </td><td><code>false || true</code> <sup>12</sup>                                           </td></tr>
<tr><td>&nbsp;&nbsp;<code>}</code>                        </td><td> -                                            </td><td>                                             </td><td>                                                          </td><td>                                                              </td></tr>
<tr><td><code>}</code>                                    </td><td>                                              </td><td>                                             </td><td>                                                          </td><td>                                                              </td></tr>
</table>

<sup>1</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors.

<sup>2</sup> `initializer` function is present only if the field is initialized into the class body: `field = 10`. Please, check if exist before call it.

<sup>3</sup> when `kind` is `field` don't include the value into the `descritor.value` and the value, if exist, is returned by `initializer` function.

<sup>4</sup> when the decorator is apply over a getter/setter `kind` is `method` and `descriptor.get` or `descriptor.set` has value. 

<sup>5</sup> when `descriptor.get` or `descriptor.set` has value, the property descriptor don't include `writable` value.

<sup>12</sup> `descriptor.enumerable` is `true` if `placement` is `"own"`.

<table>
<tr><td><b>return descriptor (optional)</b>               </td><td><b><code>class</code></b>                       </td><td><b><code>method()</code></b>                   </td><td><b><code>field</code></b>                      </td><td><b><code>getter/setter</code></b>              </td></tr>
<tr><td>`{`                                               </td><td>                                                </td><td>                                               </td><td>                                               </td><td>                                               </td></tr>
<tr><td>&nbsp;&nbsp;<code>kind:</code>                    </td><td><code>"class"</code>                            </td><td><code>"method"</code>                          </td><td><code>"field"</code>                           </td><td><code>"method"</code>                          </td></tr>
<tr><td>&nbsp;&nbsp;<code>elements:</code>                </td><td><i>Array of member descriptors</i> <sup>6</sup></td><td> -                                              </td><td> -                                             </td><td> -                                             </td></tr>
<tr><td>&nbsp;&nbsp;<code>key:</code>                     </td><td> -                                              </td><td><i>method name</i> or <code>decorators.PrivateName(name)</code> <sup>8</sup>                </td><td><i>field name</i> or <code>decorators.PrivateName(name)</code> <sup>8</sup>                 </td><td><i>field name</i> or <code>decorators.PrivateName(name)</code><sup>8</sup>                 </td></tr>
<tr><td>&nbsp;&nbsp;<code>placement:</code>               </td><td> -                                              </td><td><code>"prototype" || "static" || "own"</code>  </td><td><code>"prototype" || "static" || "own"</code>  </td><td><code>"prototype" || "static" || "own"</code>  </td></tr>
<tr><td>&nbsp;&nbsp;<code>extras:</code>                  </td><td> -                                              </td><td><i>Array of member descriptors</i> <sup>7</sup></td><td><i>Array of member descriptors</i> <sup>7</sup></td><td><i>Array of member descriptors</i> <sup>7</sup></td></tr>
<tr><td>&nbsp;&nbsp;<code>initializer:</code>             </td><td> -                                              </td><td>                                               </td><td><i>function than return the initial value</i>  </td><td> - <sup>10</sup>                               </td></tr>
<tr><td>&nbsp;&nbsp;<code>descriptor:{</code>             </td><td> -                                              </td><td> <sup>9</sup>                                  </td><td> <sup>9</sup>                                  </td><td> <sup>9</sup>                                  </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>value:</code>       </td><td> -                                              </td><td><i>method function</i>                         </td><td> -                                             </td><td> - <sup>10</sup>                               </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>get:</code>         </td><td> -                                              </td><td> -                                             </td><td> -                                             </td><td><i>getter</i>                                  </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>set:</code>         </td><td> -                                              </td><td> -                                             </td><td> -                                             </td><td><i>setter</i>                                  </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>writable:</code>    </td><td> -                                              </td><td><code>true || false</code>                     </td><td><code>true || false</code>                     </td><td> - <sup>10</sup>                               </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>configurable:</code></td><td> -                                              </td><td><code>true || false</code>                     </td><td><code>true || false</code>                     </td><td><code>true || false</code>                     </td></tr>
<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;<code>enumerable:</code>  </td><td> -                                              </td><td><code>false || true</code>                     </td><td><code>false || true</code>                     </td><td><code>false || true</code>                     </td></tr>
<tr><td>&nbsp;&nbsp;<code>}</code>                        </td><td> -                                              </td><td>                                               </td><td>                                               </td><td>                                               </td></tr>
<tr><td>&nbsp;&nbsp;<code>finisher:</code>                </td><td><i>callback</i> <sup>3</sup>                    </td><td><i>callback</i> <sup>3</sup>                   </td><td><i>callback</i> <sup>3</sup>                   </td><td><i>callback</i> <sup>3</sup>                   </td></tr>
<tr><td><code>}</code>                                    </td><td>                                                </td><td>                                               </td><td>                                               </td><td>                                               </td></tr>
</tbody>    
</table>

<sup>6</sup> `element` is an array of decorator descriptors, not to be confused with property descriptors. You can add (include new object descriptor in this array), remove elements (delete existed object descriptor from this array) or change elements (modify object descriptor elements).

<sup>7</sup> `extra` is an array of decorator descriptors, not to be confused with property descriptors. You can add new member when a method or field is decorated.

<sup>8</sup> `key` can be change from the original. It's a mandatory field. It the member is private (`#name`) a `decorators.PrivateName(name)` is included in this property.

<sup>9</sup> `descriptor` is a mandatory field, but can be an empty object.

<sup>10</sup> cannot include `initializaer`, `descriptor.value` or `descriptor.writable` when `descriptor.get` or `descriptor.set` are defined.

<sup>11</sup> `finisher` function is a callback that is called at the end of  class creation. It's optional.
