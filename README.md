# co-efficient

[![NPM](https://nodei.co/npm/co-efficient.png?compact=true)](https://nodei.co/npm/co-efficient/)

An Efficient and lightweight asynchronous template Engine using `co`.


## Preamble

In my search for a suitable templating engine, I came across many great projects.
Some promising, some inspiring, and some featuring very good ideas. However, none
of them had all that I was looking for, or some even rejected some of the requirements
that I had. So, instead of taking an existing project and transforming it into an
aberration, I started this one, at first, as a personal exercise. I believe that
`co-efficient` is a potential templating engine, and tests are pretty concluant
about it. The project was born on March 17, 2014, but it is already working quite well!

### TODO

* **More testing!** : There is a 96% branch coverage, however it is not as solid as I'd like
it to be. For example, there *may* be use cases that are not convered in the tests that
could make the parser, or the compiler fail, or make the renderer engine behave abnormally.
* **Optimizations** : The compiler is trying to optimize the template as best as it can,
and the result is quite good so far. But it *can* be improved! Also, rendering the template
rely a lot on data contexts and some shortcuts can be made to improve performance there also.
* **More Events** : Add events to the parser and compiler.
* **Features** : Even though this project is meant to be lightweight and extendable, some
features may still be missing. Since this project belongs is open source, new features will
come as needed from the user base. For example, a rendering/streaming timeout could be useful.
Or perhaps built-in support for rendering any given templates as string instead of files.


## Features

* Compiled templates into callable JavaScript functions
* COmpiled templates are cached, much like `require`'s behaviour
* 100% Asynchronous using `co` and `--harmony-generators`
* Templates are streamable using standard `stream.Writable` interfaces
* Extendable through [`helpers`](#helpers), and [custom blocks](#custom-blocks).
* Template includes through [partials](#partials)
* Most blocks support context switching for increased template reusability
* Shared reusable blocks declarations across
* Intuitive template language (see [Syntax](#syntax).)
* Well separated clean code


## Installation

`npm install co-efficient --save`


## Public API

### Engine

The engine is the core of this module. It is the module that will actually render
the template. If the tempalte is not compiled, it will automatically invoke the
`Parser` and `Compiler` to perform the task.

A typical use of the template engine is

```javascript
var Engine = require('co-efficient').Engine;

var engine = new Engine({
  config: {
    paths: [ 'path/to/view/tempaltes' ]
  }
});

// render 'path/to/view/tempaltes/foo/bar.coeft.html'
var html = yield engine.render('foo/bar', { foo: 'bar' });
```


#### Engine API

* *[static]* **extSep**:*{String}* - the extension separator character used to split
extensions when resolving a template, if specified as a string. (See [
* *[static]* **registerModifier** *(modifier:String, callback:Function)* - register a
template's block segment modifier. A modifier will transform the output of that block
at render-time. See [Block Modifiers](#block-modifiers).
* *[static]* **unregisterModifier** *(modifier:String)* - unregister a template's block
modifier.
* *[static]* **modifiers**:*{Object}* - returns the registered modifiers. This object
is readonly and cannot be modified directly.
* *[static]* **exceptions.EngineException**:*{EngineException}* - the exception type
thrown when an exception occurs inside the engine.
* **cache**:*{Object}* - the actual template cache. To force template re-loading,
simply remove it from this object.
* **config**:*{Object}* - the configuration object. See [Configuration](#engine-configuration).
* **helpers**:*{Object}* - an object of view helpers. Each value should be a
`GeneratorFunction` accepting a `Context` object, a `body` string and a `params`
object, and should return the string to render. See [Helpers](#helpers) for more
information.
* **resolve** *(name:String)*:*{GeneratorFunction}* - locate a template from the
specified configuration. The function is called asynchronously as it performs disk NIO
while searching for the file. The function accepts a single argument, the template
`name`, and returns the template info or `undefined` if nothing found.
* **render** *(name:String, data:Object)*:*{GeneratorFunction}* - render the given template
name using `data` as context root. The function returns the rendered template as a `String`.
* **stream** *(stream:stream.Writable, name:String, data:Object, autoClose:boolean)*:
*{GeneratorFunction}* - stream the given template name using the specified stream writer,
and `data` as context root. If `autoClose` is set to true, the stream will be closed
automatically once the template is done processing. Otherwise, it is left opened, and it
 is the caller's responsibility to close it. The function does not return anything.

**NOTE**: `Engine` extends `EventEmitter`, therefore inherits all events methods. It also
allows *static* events registration through the methods : `on`, `once`, `addListener`,
`removeListener`, `removeAllListeners`, and `listeners`. See [Engine Events](#engine-events).

**NOTE**: the public API is frozen and you cannot assigned new objects to the `Engine`
object. (i.e. `Engine.config = { foo: true };` will not do anything.)


#### Engine Configuration

Engine configuration is done only through `Engine` instances. For example, it can
be defined with :

```javascript
var engine = new Engine({ config: configurationObject });
```

* **paths**:*{String|Array}* - a list of paths where sources may be found. Each
source template will be fetched from first to last, until a file exists. If a string
is specified, eath path must be separated with a `path.delimiter`. *(default: `['.']`)*
* **ext**:*{String|Array}* - a list of source extensions to be appended at the end
a the template name. Note that the engine will also try to look for an extensionless
file as well, as a last resort, if nothing else is found first. Each extension should
start with the dot. If a string is specified, it must be comme delimited.
*(default `'.cooft, .coeft.html'`)*


#### Engine Events

* **internalEngineCreated** *(InternalEngine)* - when rendering a template, the engine will
create an instance of an internal engine to wrap and expose some methods to the template and
helpers. This event is called so extensions may add custom properties to the instance before
it is frozen and send to the template renderer.
* **templateResolved** *(String)* - when rendering a template that has not been compiled, this
event is emitted when a tempalte file has been successfully resolved. Useful for debugging and
logging.
* **templateProcessing** *(Object)* - emitted when a template is being processed. The `object`
sent contains the keys : `name` the name of the template, `stream` the stream writer used to
render the tempalte, and `data` the data fed to the template.
* **templateProcessed** *(Object)* - emitted when a template has been processed. The `object`
sent contains the keys : `name` the name of the template, `stream` the stream writer used to
render the tempalte, and `data` the data fed to the template.
* **templateNotFound** *{Object}* - emitted when a template could not be found. This event is
also emitted when a template is rendering a partial. Useful for debugging and logging. The
`object` sent contains the keys : `name` the name of the template, and `context` the actual
context received. (See [Context](#context))
* *[static]* **engineCreated** *[Object)* - emitted when an engine instance is created. Works
only when listening for this event on the `Engine` object class directly, not an instance.


### Context

A context is the equivalent of the `this` keyword in many programming languages; it
indicates the current "active" data within the data object passed to the template renderer.
However, the `Context` API is very friendly and allows also the template to walk up and
down the context path.

For example, given the following data structure :

```
{
  "company": {
    "departments": [
      "IT", "Management", "Sales", "Marketing", "Support"
    ],
    "employees": {
      "smithj": { "firstName": "John", "lastName": "Smith", "email": "john.smith@email.com" },
      ...
      }
    }
  }
}
```

and given that we current have a `ctx` instance to the with this structure. The following
are all true assertions.

```javascript
ctx.getContext('.').data;
// -> (the data tree same as reported above)

ctx.getContext('company.departments').data;
// -> [ "IT", "Management", "Sales", "Marketing", "Support" ]

ctx.getContext('company.employees').getContext('..');
// -> pointing at the 'company' node. Same as : ctx.getContext('company');

ctx.push({ foo: 'bar' });
// -> { foo: 'bar' } . Also, doing ctx.push({ foo: 'bar' }).getContext('..');
//    brings back to the previous data, completely discarding the data we just pushed.

ctx.push('foo!!').getContext('.company.employees.smithj.firstName').data;
// -> John
```

**NOTE**: the context `ctx.getContext('..........')` (or however many dots there is) will
*always* point to the root of the data tree. That is, assume that the context is already
pointing at the root, it is not possible to point any lower and the context will simply
return itself.

**NOTE**: the assertion `ctx.getContext('.') === ctx` for all contexts. However, doing
`ctx.getContext('.foo')` will get the context `foo` *from* the parent (sibling to the
current context).

**NOTE**: to get the parent context, simply use `ctx.getContext('..')`.

#### Context API

* **parent**:*{Context}* - the parent context, or null if context is root.
* **data**:*{mixed}* - just about any type of data. If `undefined`, will be set to `null`.
* **templateName**:*{String}* - for debugging purpose only, indicate the template name
whose context is associated with. Note that the value follows the template being rendered,
and rendering a partial will change the context's `templateName` value.
* **hasData**:*{boolean}* - returns true if an only if `data` is not empty.
* **push** *(mixed)*:*{Function}* - push some data into a new context whose parent is the
current context and return it.
* **pop** *()*:*{Function}* - return the parent context. If the context has no parent, return
itself.
* **getContext** *(path)*:*{Function}* - return a context relative to the current context.


### Parser

Compiling a template requires two steps. The parser is the first step. The parser will
simply tokenize the template into segments. These segments will allow the compiler to link
and organise these segment in a more optimal fashion. In the process, the parser will
also validate that each segment is well formatted and contains the necessary information
to be transformed into an executable template.

When providing a file or some text, the parser will tokenize it and return a hierarchical
object containing the template's segment tree structure. Nothing much can be done with
a parsed template, but to analyze and validate it's structure.


#### Parser API

* *[static]* **parseFile** *(file:String)*:*{GeneratorFunction}* - takes a file name and return it's
tokenized segment structure as an hierarchical object.
* *[static]* **parseString** *(str:String)*:*{GeneratorFunction}* - takes a string and return it's
tokenized segment structure as an hierarchical object.
* *[static]* **registerBlockRule** *(id:String, options:Object)* - register a new parsing block rule
See [Custom Blocks](#custom-blocks).
* *[static]* **unregisterBlockRule** *(id:String)* - register a new parsing block rule
See [Custom Blocks](#custom-blocks).
* *[static]* **exceptions.ParseException**:*{ParseException}* - the exception being thrown when the parser
encounters an error. The instances of this object inherits from `Error`.


### Compiler

Compiling a template requires two steps. The compiler is the second step. It takes a hierarchical
segment tree object and transforms it into an executable JavaScript function. The compiler's
output is the string value of the generated code and needs to be compiled (again) by Node to
be fully callable. See [Engine's source code](#lib/engine.js] on how it is typically done.

The reason the compiler does not return a real function is to allow implementation to save the
compiled template to a file. Calling a template function's `.toString()` method does not return
exactly the same string as the compiler's generated string. Besides, the `COmpiler`'s purpose
is to generate JavaScript, not a callable function. The [Engine](#engine) has this contract.


#### Compiler API

* *[static]* **compile** *(rootSegment:Object)*:*{GeneratorFunction}* - compiles the hierarchical
segment tree into an executable JavaScript function and return the generated string. The `rootSegment`
should be an object compatible with the returned value of `Parser.parseString` or `Parser.parseFile`.
* *[static]* **registerBlockRenderer** *(id:String, callback:Function)* - register a new block renderer.
See [Custom Blocks](#custom-blocks).
* *[static]* **unregisterBlockRenderer** *(id:String)* - register a block renderer.
See [Custom Blocks](#custom-blocks).
* *[static]* **exceptions.CompilerException**:*{CompilerException}* - the exception being thrown when
the parser encounters an error. The instances of this object inherits from `Error`.


## Syntax

The syntax is very simplistic and minimalistic. All addons should be made through
helpers. All template control flow sections follow this pattern :

```
{type{name|literal:context args/}modifiers}content{type{/}}
```

Where each part may or may not be optional, depending the sgement. A template is
composed of segments:

* **Block Segments** are blocks declared using the pattern above. They are parsed and compiled
as dynamic template instructions.
* **Text Segments** are static string contents and are written as as in the compiled templates.


### Context Output

The most basic thing a template needs is token replacements. These are not actual
block segments, but will simply output any given context, as string, using the
`Engine`'s data formatter system and optional [modifiers](#modifiers).

#### Example

```
{{.}}      -> output the current context
{{foo}}    -> output 'foo' from the current context
{{..}}     -> output the parent context
{{.foo}}   -> output the context 'foo' from the parent context
{{foo}U}   -> output 'foo', modified using the uppercase (`U`) modifier
```

Context output may be used anywhere within text segments.


### Helpers

Helpers are async functions callable from the template. They are only declared from
JavaScript and cannot be declared inline, use [inline blocks](#inline-blocks) instead.
They are composed of an identifier, and may optionally include an optional context,
parameters, and one or more content bodies.

The helper function's third argument, the chunk renderer, is the helper's bodies passed
as a renderer. The content has been parsed, but not rendered, yet, and
it's `render` function should be called to retrieve the content. A helper may also
choose to ignore segment content, too. Also, helpers support many segment content bodies,
which may be rendered however many times and whenever within the helper function. For
example :

```javascript
// render first content body (default if no argument is specified)
yield chunk.render(0);

// render second content body...
yield chunk.render(1);
```

**NOTE**: if a chunk body does not exist, an empty string is rendered.

In templates, helpers are rendered with the `{&{helper/}}` instruction. For example :
`{&{helperName:context.path arg=value/}}`. Where `context.path` and `arg=value` are optional.

**NOTE**: helper functions **must** be `GeneratorFunction` or return a `thunk`!


#### Example

```javascript
{
  "hello": function * (stream, ctx, chunk, params) {
    stream.write('<span');
    for (var attr in params) {
      stream.write(' ' + attr + '="' + params[attr] + '"');
    }
    stream.write('>');
    stream.write('Hello, ');
    yield chunk.render();   // same as : yield chunk.render(0);
    stream.write('!</span>');
  }
}
```

called from the view script

```
<div>{&{hello:user id="user" class="bold"}}{{name}}{&{/}}</div>
```

Would output, for example : `<div><span id="user" class="bold">Hello, John!</span></div>`.

**NOTE**: data can be injected directly into the context (`ctx`) before rendering chunks
by modifying it's `data` attribute. For example :
`ctx.data = 'replaced data with a single string!';` or `ctx.data['key'] = 'Some Value';`
(assuming `ctx.data` is an object).

Content bodies are unspecified and may or may not be defined in the template for a given
helper call. To define one or more content bodies within a helper, the instruction must be
closed with the `{&{/}}` instruction, and more bodies be defined using the `{&{~}}`
instruction. The special `~` is like the special `/` for closing the block segment, but it
specifies that the block has more content bodies to be associated with. For example :

```
{&{helper}}Content 1{&{~}}Content 2{&{~}}Content 3{&{/}}
```

```javascript
{
  "hello": function * (stream, ctx, chunk, params) {
    yield chunk.render(0);  // renders : "Content 1" (same as chunk.render())
    yield chunk.render(1);  // renders : "Content 2"
    yield chunk.render(2);  // renders : "Content 3"
    yield chunk.render(3);  // renders : "" (no content body)
  }
}
```

#### Helper Function Arguments

* **stream**:*{stream.Writable}* - the template's writable stream. This stream
render the template in the same order data are written to it. Therefore, all
non-generator async functions (node style callbacks) must be converted into a
thunk or a generator function, and `yield` their result before returning from
the helper function. Any data written to the stream after returning from the
helper function may cause an exception or unpredictable rendered template.
* **ctx**:*{Context}* - a context is equivalent to the `this` in many programming
languages. It indicate the data that can be accessed within the helper. See [Context](#context).
* **chunk**:*{Renderer}* - an object with only two properties; `length`, the number of
available content bodies and `render`, a `GeneratorFunction` receiving an optinal `index`
argument, specifying which content body to render. (Ex: `yield chunk.render(0);`)
* **params**:*{Object|null}* - an optional argument passing any helper's argument into the
helper function as an object. See [Block Parameters](#block-parameters).


### Inline Blocks

Inline blocks are reusable chunks of segments. They are part of the template, but are never
rendered until they are used. Inline blocks are declared with the `{#{block/}}` instruction.
It is composed of an identifier, and may also optionally include a context and a content
body. Unlike helpers, inline blocks may not have multiple content bodies, but only one.

Inline blocks are declared globally, therefore they are accessible within all views
and partials. Also, they may be overridden.

An inline block may be rendered using the `{+{block/}}` instruction. Undeclared
blocks will be replaced with a warning message in the template. If an inline block was
declared with as self closing (i.e. `{#{block/}}`, an empty block), it will be rendered as
an empty string.

By default, the current context is transferred to the inline block when rendering.
However, a block may define it's own context using `{#{block:path.to.context/}}`.
Also, when rendering a block, the specified block context may be adjusted, too,
via `{+block:relative.context/}`. **Note**: the relative context is relative to the current
context (at rendering time) and not relative to the context of the defined block! However,
the context inside of the block will have a parent equals to the defined context. For
example:

```
{#{withoutContext}}{{.}}{#{/}}
{#{withContext:foo.bar}}{{.}}{#{/}}

{&{withoutContext/}}
{&{withoutContext:context/}}
{&{withContext/}}
{&{withContext:context/}}
```


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

Partials are basically rendering an external template and stream it's output
to the current `stream.Writable`. Optionally, the partial's initial context
may be specified. Partials are rendered with the `{>{"path/to/partial":context/}}`
instruction (`context` optional).

Rendering the partial from a template is the equivalent of calling
`engine.stream(writer, name, ctx.data, false, engine)`. Any declared inline blocks
within the partials will be available at the next call in the template.

**NOTE**: wherever inline blocks are declared, they are globally available across
any rendered partial and template at render-time, but only as they are encountered
by at render-time.


### Iterators

Generating lists and chunks of text by processing collections of data is one of the
essence of templates. The Efficient engine supports three kinds of data iterators.

#### Numerical Iterators

Numerical iterators is like any standard `for (i=0...n)` block. They are de rendered
using the `{@{"number"}}{@{/}}` instruction, where `"number"` should be a numeric
literal, and the iterations will be from `0` to `number - 1`. The context inside the
block segment is the iterator's current value. For example :
`<div>{@{"3"}}{{.}}{@{/}}</div>`, will render : `<div>012</div>`.

**NOTE**: inside the iterator block, getting the parent context (i.e. `{{..}}` will
return the previous context (before entering the iterator).


#### Array Iterators

Array iterators are rendered using the `{@{context}}{@{/}}` instruction, where
`context` should be an array, and the iteration will be for each element of the
array. The context inside the block segment is the array's element currently
being processed. Also, a parant context will be inserted, containing the current
element's value and index within the array. For example, given a context's value
of `{ states: ['On', 'Off', 'Undefined'] }` : `* {@{states}}{{.index}}={{.}} * {@{/}}`
will output : `* 0=On * 1=Off * 2=Undefined * `.

**NOTE**: inside the iterator block, getting the parent context (i.e. `{{..}}` will
return the iterator's current state; inside the iterator block, `{{.index}}` is the
iterator index and `{{.value}} === {{.}}`. The parent context of this parent context
(i.e. `{{...}}`) returns the previous context (before entering the iterator).


#### Object iterators

Object iterators are like array iterators, but adds a `{{.key}}` to the iterator's
parent context, to retrieve the current object's key being processed. For example,
given a context's value of `{ states: { 'on':1, 'off':2, 'undefined':3 } }` :
`* {@{states}}{{.key}}={{.}}({{.index}}) * {@{/}}` will output
`* on=1(0) * off=2(1) * undefined=3(2) *`.

**NOTE**: inside the iterator block, getting the parent context (i.e. `{{..}}` will
return the iterator's current state; inside the iterator block, `{{.index}}` is the
iterator index, `{{.key}} is the iterator's current object's key, and `{{.value}} === {{.}}`.
The parent context of this parent context (i.e. `{{...}}`) returns the previous context
(before entering the iterator).


### Conditionals

Conditional blocks are rendered using the `{?{context}}{?{~}}{?{/}}` instruction,
where `context` is evaluated into a truthy or falsy value. This block is equivalent
to the programmatic `if (context) ... else ... endif` statement. If `context` is
true, then the first block segment`s content body is rendered, otherwise the second
(if provided) is rendered.


#### Example

```
{?{authUser}}
  <div>Welcom {{authUser.identify}} !</div>
{?{/}}

<ul>
  {?{tags}}
    {@{tags}}
      <li>{{.}}
    {@{/}}
  {?{~}}
    <li>No tags</li>
  {?{/}}
</ul>
```

**NOTE**: conditional blocks are the only ones that do not change context. This
is so to avoid confusion within the "else" (`{?{~}}`) block, and because they
do not semantically encapsulate a different context and because they don't
requiert modifying the context to push additional information as the iteration
block does.


### Block Parameters

Block parameters are only used whith [block helpers](#helpers). They allow passing
arguments to the helper function callback from the template.

A block may contain as many parameters as needed. Each are declared using the pattern
`paramName=paramValue` and `paramValue` may be a literal or a context.

#### Example

The following example illustrate a helper retrieving an external page from the
template :

```javascript
{
  "http": function * (stream, ctx, chunk, params) {
    var html;

    try {
      html = yield httpRequest(params.method || 'GET', params.url);
    } catch (e) {
      html = e.message || e;
    }

    stream.write(html);
  }
}
```

```
{&{http method="GET" url=page.url/}}
```

The block segment will be replaced by the helper's result; some HTML content or
an error message.


### Block Modifiers

Modifiers are text transformer. They are applied as text is sent through the
`stream.Writable` instance. They are applied in the order they are declared.

For example : `Hello {{name}leU}!` might be rendered as `Hello D%27OH!' (lowercase,
escape, then uppercase).


### Custom Blocks

**DISCLAIMER** : This section is for advanced tempalte usage!

When [Helpers](#helpers) are just not enough, it is possible to extend the template
compiler to include custom block compilation. Unlike helpers, however, these
extensions are global as they are defined directly with the parser and compiler.

Custom blocks may not override built-in blocks, and must be defined using a single
valid block identifier. Block identifiers are case-sensitive within a template! This
means that one could register `a` and `A` and be two completely different blocks.

#### Custom Blocks, Step 1 : Parser Rules

Compiling a template requires two steps. The parser is the first step. To register
a new block, it must be registered with the parser or the template will generate
an error at parse-time. Parser rules are simple, but must be followed strictly,
unless you know what you're doing! A typical rule looks like this :

```
{
  openingContent: 'inName',
  validContent: { 'name': true, 'context': true, 'params': true },
  maxSiblings: Number.MAX_VALUE,
  selfClosing: true,
  closeBlock: true
}
```

* **openingContent**:*{String}* - tells in what state the parser should be when
parsing the block's segment identifier. The possible values are `inName`, `inContext`
or `inParam`. Since all blocks follow the same syntax (see [Syntax](#syntax)), once
a block state is `inContext`, it means that the block has no `inName` state.
* **validContent**:*{Object}* - enables content states for the given block. There
should be at least one content enabled.
* **maxSiblings**:*{Numeric}* - how many content bodies, max, the block can have?
To disable this feature and prevent a template from declaring a content body for
the block, set this value to a `false` (or any falsy value).
* **selfClosing**:*{boolean}* - whether or not the block can be self closing (i.e.
`{#{block/}}`) or not. If `closeBlock` is `false`, this value **must** be `true`.
* **closeBlock**:*{boolean}* - whether or not the block can have an external closing
block (i.e. `{#{block}}{#{/}}`) or not. If `selfClosing` is `false, this value **must**
be `true`.

```javascript
Parser.registerBlockRule(id, options);
Parser.unregisterBlockRule(id);
```

Where `id` is the block identifier and `options` an object as described above. The
value for the block identifier should match this pattern : `[a-zA-Z0-9_\-*^$%<"µ]`.


#### Custom Blocks, Step 2 : Compiler Renderers

To actually compile the template into an executable one, all blocks are rendered
by a block segment renderer. Each renderer should match a parser rule, or an
`CompilerException` will be thrown at compile-time.

```javascript
Compiler.registerBlockRenderer(id, renderer);
Compiler.unregisterBlockRenderer(id);
```

Where `id` is the block identifier and `renderer` a `thunk` or `GeneratorFunction`.

The renderer function's signature should be `(compiledData, segValue, segKey, segments)`,
and each argument is defined as :

* **compiledData**:*{Object}* - an object of compiled data so far. The object contains different
sections that will be concatenated by the compiler at finishing time.
* **segValue**:*{Object}* - the current segment block being processed. Content bodies can be
processed from the `segment.segments` array.
* **segKey**:*{Numeric}* - the segment id, where `segments[segKey] === segValue`.
* **segments**:*{numeric}* - the object containing the current `segValue` object and all it's
siblings. Some segments have multiple content bodies, which can be fetched using, for example,
`segments[segValue.nextSegment]` or `segments[segValue.headSegment]`.

**NOTE**: more details on these arguments will be documented soon.

#### Example

```javascript
// register the new parser rule
Parser.registerBlockRule('b', {
  openingContent: 'inParam',
  validContent: { 'params': true },
  maxSiblings: false,
  selfClosing: true
});

// tell the compiler to delegate rendering for this block type
Compiler.registerBlockRenderer('b', bookRenderer);

// create a new engine instance
var engine = new Engine(options);

// bind the internal engine (the engine used while rendering templates)
engine.on('internalEngineCreated', function init(internalEngine) {
  internalEngine.b = getBookJson;
});

/**
Block : {b{isbn="value"/}}
*/
function * bookRenderer(cData, sValue, sKey, segments) {
  // note : the use of this.OBJ_ENGINE + '.b'

  if (typeof segValue.params['isbn'] === 'string') {
    return 'stream.write(yield(' + this.OBJ_ENGINE + '.b)(' +
      this.quote(segValue.params['isbn']) + '));';
  } else if (segValue.params['isbn'] && segValue.params['isbn'].context) {
    return 'stream.write(yield(' + this.OBJ_ENGINE + '.b)(' +
      this.OBJ_CONTEXT + '.getContext(' + quote(segValue.params['isbn'].context) + ').data));';
  } else {
    return 'stream.write("No ISBN# in template");';
  }
}

/**
Called by the template at render-time
*/
function * getBookJson(isbn) {
  var book;

  /* get book data */

  if (book) {
    return '<span class="title">' + book.title + '</span> ' +
           '<span class="author">by ' + book.author + '</span>';
  } else {
    return 'Unknown book!';
  }
}
```

Now, a template such as

```
<div>{b{isbn="ISBN-13: 978-1-937785-73-4"/}}</div>
<div>{b{isbn="foo!"/}}</div>
```

Might render something like

```
<div><span class="title">Node.js the Right Way: Practical, Server-Side JavaScript That Scales</span> <span class="author">by Jim R. Wilson</span></div>
<div>Unknown book!</span>
```

#### InternalEngine API

Since this object is not really used, except when customizing the Efficient Engine,
this API is given as reference only.

* **helpers**:*{Object}* - a direct reference to the `engine`'s declared helpers object.
* **stream** *(name:String, ctx:Context, blocks:Object)* - this
generator function will render any template given by name using the underlaying engine
and stream, using the specified options.
* **iterator** *(value:mixed)*:*{Iterator}* - returns an iterator object for the given
value. The value may be a literal (numeric), an array or an object. See [Iterators](#iterators)
for a documented behaviour of the iterator.
* **renderer** *(Array)*:*{Renderer}* - the name is solely syntactic as it is merely an
adapter for the given array, and is primarily used when rendering content bodies. The
argument must be an array of genarator functions, and the returned renderer object contains
two properties; `length` the actual length of the provided array and, `render` a generator
function receiving an `index` as argument and yielding the renderer's provided array (a
generator function) to `co`.

**NOTE**: instances of `InternalEngine` are not extendable after they are created.
However, to add custom properties to an instance, the `engine`'s `internalEngineCreated`
event must be listened to, which receives the instance before it is frozen.


### Custom Modifiers

Like custom blocks, custom modifiers can be used to transform the chunks of data before
it is sent to the `stream.Writable`. Registering modifiers is slightly easier than
block segments!


#### Custom Modifiers, Step 1 : Parser Registration

The `Parser` validates very modifiers it encounters. Even if the engine also validates
for invalid modifiers, this is to prevent applications that would simply cache templates
and render them at a later time.

Simply call `Parser.registerBlockModifier(char);` or `Parser.unregisterBlockModifier(char);`
with the modifier desired value. A modifier must be a single character and must match
the following pattern : `[a-zA-Z0-9_\-*^$&!?#%<>"µ]`.


#### Custom Modifiers, Step 2 : Engine Registration

A modifier simply convert a given value into a string. For this reason, there is no
need for a generator function or any other async callback. Simply register a
function to the `Engine` with the same modifier `char` registered at step 1.

```javascript
Engine.registerModifier(char, fn);
Engine.unregisterModifier(char);
```

Where `char` should match the exact same value as registered to the `Parser` and
`fn` is a function receiving a single argument, and should return a string.

**NOTE**: because modifiers may be composed with other modifiers, expect the received
value to be something else than a string! The modifier function might simply return
the value if it's already a string, for example.


#### Example

Registering a mask modifier that will transform any chunk of text into `*` chars.

```javascript
Parser.registerBlockModifier('*');
Engine.registerModifier('*', function mask(value) {
  var len;
  var maskedValue = '';

  value = String(value);
  len = value.length;

  while (len-- > 0) {
    maskedValue += '*';
  }

  return maskedValue;
});
```

Now, a template like : `<div>{{user.pass}*}</div>` might render like `<div>*********</div>`.


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
