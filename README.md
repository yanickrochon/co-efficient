# co-coa

An asynchronous template engine for `co`.


## Configuration

* **sourcePaths** *{String|Array}* : a list of paths where sources may be found.
Each source template will be fetched from bottom to top (last array item down to
the first). If a string, must be separated by `path.delimiter`.
*(default: `['.']`)*
* **ext** *{String|Array}* : a comma separated list of source extensions if none
specified. Each extension should start with the comma. *(default `'.coa, .coa.html'`)*
* **cachePath** *{String}* : if specified, compiled templates will be stored there.
Otherwise, source templates will always be parsed and compiled at run-time. This
value should not be the system's temp directory, and should be in the project's
path. *(default: null)*


## Public API

* **helpers** *{Object}* : an object of view helpers. Each value should be a
`GeneratorFunction` accepting a `Context` object, a `body` string and a `params`
object, and should return the string to render. See [Helpers](#helpers) for more
information.


## Syntax

The syntax is very simplistic and minimalistic. All addons should be made through
helpers. All template control flow sections follow this pattern :

```
{type{name|literal[:context] [args][/]}[modifiers]}[content][{type{/}}]
```


### Helpers

A helpers are async functions callable from the view script. They are only declared
from JavaScript and cannot be declared inline. They are composed of an identifier,
an optional context, optional arguments, and a view segment.

The helper function's second argument, the view segment, is the helper's body passed
as a sub view renderer. The content has been parsed, but not rendered, yet, and
it's `render` function should be called to retrieve the content. A helper may also
choose to ignore segment content, too.

Helpers are rendered via `{&{helperName:context.path arg=value/}}`. Where `:context.path`
and `arg=value` are optional.


#### Example

```javascript
{
  "hello": function * (stream, ctx, chunk, params) {
    stream.write('<span id="' + params['id'] + '" class="' + params['class'] + '">');
    stream.write('Hello ');
    yield chunk.render() +
    stream.write('!</span>');
  }
}
```

called from the view script

```
<div>{&{hello:user id="user" class="bold"}}{{name}}{&{/}}</div>
```

Would output, for example : `<span id="user" class="bold">Hello John!</span>`.


### Inline Blocks

An inline block is a reusable chunk of compiled template. A block is declared with
the `{#{block/}}` instruction. It is composed of an identifier, a context and a
content body. Unlike helpers, blocks cannot have multiple content bodies.

Inline blocks are declared globally, therefore they are accessible within all views
and partials. Also, they may be overridden.

An inline block may be rendered using the `{+{block/}}` instruction. Undeclared
blocks will be replaced with a warning message in the template. A self closing block
(empty block) will be rendered as an empty string.

By default, the current context is transferred to the inline block when rendering.
However, a block may define it's own context using `{#{block:path.to.context/}}`.
Also, when rendering a block, the specified block context may be adjusted, too,
via `{+block:relative.context/}`.


#### Example

```
{#{header}}
  <tr><th>Col 1</th><th>Col 2</th><th>Col 3</th></tr>
{#{/}}

<table>
  <thead>{+{header/}}</thead>
  <tbody>
    <tr><td>Val 1</td><td>Val 2</td><td>Val 3</td></tr>
  </tbody>
  <tfoot>{+{header/}}</thead>
</table>
```

### Partials

`{>{"path/to/partial"/}}`, and `{>{"path/to/partial":path.to.context/}}`


### Array iterations

`{@{context.array}}...{@{/}}`, and `{{%}}`.


**Note**: the `%` symbol can echoed (i.e. `{{%}}`) or be assigned to helpers'
argument. (ex: `{&{helper index=%/}}`)


### Loops countdown

`{@{"n"}}..{@{/}}`, and `{{%}}`


**Note**: the `%` symbol is a built-in context and can be echoed (i.e. `{{%}}`)
or be assigned to helpers' argument. (i.e. `{&{helper index=%/}}`)


### Conditionals

`{?{context.condition}}...{?{~}}...{?{/}}`


## Contribution

All contributions welcome! Every PR **must** be accompanied by their associated
unit tests!


## License

The MIT License (MIT)

Copyright (c) 2014 Mind2Soft <yanick.rochon@mind2soft.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
