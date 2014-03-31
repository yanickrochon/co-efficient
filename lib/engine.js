
const VALID_MODIFIERS = /[a-zA-Z0-9_\-*^`´$&!?#%<>"µ]/;
const DEFAULT_TEMPLATE_PATH = '.';
const DEFAULT_EXT = '.coeft, .coeft.html';
const EXT_SEP = ',';

const MODIFIERS = {
  'e': modifierEscape,
  'u': modifierEncodeURIComponent,
  'j': modifierJson,
  'U': modifierUpper,
  'l': modifierLower
};

var path = require('path');
var fs = require('co-fs');
var util = require('util');
var Module = require('module');
var Writable = require('stream').Writable;
var Transform = require('stream').Transform;
var Context = require('./context');
var EventEmitter = require('events').EventEmitter;
var events = new EventEmitter;

var modifiers = {};


module.exports = Engine;


// static methods

[
  'on', 'once',
  'addListener', 'removeListener', 'removeAllListeners',
  'listeners'
].forEach(function(method) {
  Object.defineProperty(Engine, method, {
    enumerable: true,
    configurable: false,
    writable: false,
    value: function () {
      return events[method].apply(events, arguments);
    }
  });
});

Object.defineProperties(Engine, {
  /**
  Expose extension separator constant
  */
  extSep: {
    enumerable: true,
    configurable: false,
    writable: false,
    value: EXT_SEP
  },

  /**
  Register a new template output modifier
  */
  registerModifier: {
    enumerable: true,
    configurable: false,
    writable: false,
    value: registerModifier
  },

  /**
  Unregister a template modifier
  */
  unregisterModifier: {
    enumerable: true,
    configurable: false,
    writable: false,
    value: unregisterModifier
  },

  /**
  List available template modifiers
  */
  modifiers: {
    enumerable: true,
    configurable: false,
    get: function getModifiers() {
      return modifiers;
    }
  },

  /**
  Exposes exceptions
  */
  exceptions: {
    enumerable: true,
    configurable: false,
    writable: false,
    value: {
      EngineException: EngineException
    }
  }
});



// instances

function Engine(options) {
  if (!(this instanceof Engine)) {
    return new Engine(options);
  }

  EventEmitter.call(this);

  options = options || {};

  /**
  Helpers
  */
  Object.defineProperties(this, {
    'cache': {
      enumerable: false,
      configurable: false,
      writable: false,
      value: {}
    },
    'config': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: options.config || {}
    },
    'helpers': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: options.helpers || {}
    },
    'resolve': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * resolve(name) {
        return yield resolveTemplate(name, this);
      }
    },
    'render': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * render(name, data) {
        return yield * renderTemplate(name, data, this);
      }
    },
    //'renderText': {
    //  enumerable: true,
    //  configurable: false,
    //  writable: false,
    //  value: renderText
    //},
    'stream': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * streamTemplate(stream, name, data, autoClose) {
        return yield streamTemplate(stream, name, data, autoClose, this);
      }
    }
    //'streamText': {
    //  enumerable: true,
    //  configurable: false,
    //  writable: false,
    //  value: streamText
    //}
  });

  events.emit('engineCreated', this);
};
util.inherits(Engine, EventEmitter);

Object.freeze(Engine);


// push all block rules...
for (var modifier in MODIFIERS) {
   modifiers[modifier] = MODIFIERS[modifier];
}


var InternalEngine = function InternalEngine(stream, engine) {
  Object.defineProperties(this, {
    'helpers': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: engine.helpers
    },
    'stream': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * (name, ctx, blocks) {
        return yield _streamTemplate(stream, name, ctx, blocks, engine, this);
      }
    },
    'iterator': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: createIterator
    },
    'renderer': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: createChunkRenderer
    }
  });

  engine.emit('internalEngineCreated', this);

  Object.freeze(this);
};



function registerModifier(modifier, callback) {
  var temp;

  if (typeof modifier !== 'string' && id.length !== 1) {
    throw new EngineException('Invalid modifier');
  }
  if (MODIFIERS[modifier]) {
    throw new EngineException('Illegal modifier');
  }
  if (!(callback instanceof Function)) {
    throw new EngineException('Not a modifier function');
  }

  temp = modifiers;
  modifiers = {};

  for (var mKey in temp) {
    modifiers[mKey] = temp[mKey];
  }

  modifiers[modifier] = callback;

  Object.freeze(modifiers);
}

function unregisterModifier(modifier) {
  if (typeof modifier !== 'string' && id.length !== 1) {
    throw new EngineException('Invalid modifier');
  }
  if (MODIFIERS[modifier]) {
    throw new EngineException('Illegal modifier');
  }

  temp = modifiers;
  modifiers = {};

  for (var mKey in temp) {
    if (mKey !== modifier) {
      modifiers[modifier] = temp[modifier];
    }
  }

  Object.freeze(modifiers);
}


function * resolveTemplate(name, engine) {
  var paths;
  var ext;
  var file;
  var found = false;

  if (engine.cache[name]) {
    found = engine.cache[name];
  } else {
    paths = engine.config.paths || DEFAULT_TEMPLATE_PATH;
    ext = engine.config.ext || DEFAULT_EXT;

    if (typeof paths === 'string') {
      paths = paths.split(path.delimiter);
    }

    if (typeof ext === 'string') {
      ext = ext.replace(' ', '').split(EXT_SEP);
    }
    if (ext.indexOf('') === -1) {
      ext.push('');  // try without extension
    }

    for (var x = 0, xlen = ext.length; x < xlen && !found; ++x) {
      for (var i = 0, len = paths.length; i < len && !found; ++i) {
        file = path.join(paths[i], name + ext[x]);
        found = yield fs.exists(file);
      }
    }

    if (found) {
      engine.emit('templateResolved', file);

      found = {
        filename: file
      };
    }
  }

  return found;
}


function * renderTemplate(name, data, engine) {
  var stream = new DefaultRendererStream();

  yield streamTemplate(stream, name, data, true, engine);

  return stream.buffer;
}

//function * renderText(text, data, timeout) {
//  var stream = new RendererStream();
//  var marker = suspend();
//
//  stream.on('finish', marker.resume);
//
//  yield streamText(stream, text, data);
//  yield marker.wait(timeout);
//
//  return stream.buffer;
//}

function * streamTemplate(stream, name, data, autoClose, engine) {
  var transformStream = new EngineStream()
  var internalEngine = new InternalEngine(transformStream, engine);
  var ctx = new Context(null, data, name);
  var blocks = {};

  transformStream.pipe(stream);

  yield _streamTemplate(transformStream, name, ctx, blocks, engine, internalEngine);

  if (autoClose) {
    stream.end();
  }

  engine.emit('templateProcessed', { name: name, stream: stream, data: data });
}

function * _streamTemplate(stream, name, ctx, blocks, engine, internalEngine) {
  var template = yield resolveTemplate(name, engine);
  var parentTemplateName = ctx.templateName;

  if (!template) {
    engine.emit('templateNotFound', { name: name, context: ctx });
    throw new EngineException('Template not found : `' + name + '`');
  } else if (!template.module) {

    var parser = require('./parser');
    var compiler = require('./compiler');

    var parsed = yield parser.parseFile(template.filename);
    var compiled = yield compiler.compile(parsed, engine);

    var module = new Module(name, null);
    module._compile('module.exports=' + compiled, template.filename);

    template.source = compiled;
    template.module = module.exports;

    //console.log("**TMPL", template.module.toString().length, '/', parsed.length, template.module.toString());
  }

  ctx.templateName = name;

  yield (template.module)(stream, ctx, internalEngine, blocks);

  if (ctx.templateName !== parentTemplateName) {
    ctx.templateName = parentTemplateName;
  }
}


function formatData(data) {
  if (typeof data === 'string') {
    return String(data);
  } else if (data === null || data === undefined) {
    return '';
  } else if (typeof data === 'object') {
    return JSON.stringify(data, null, 2);
  } else {
    return data.toLocaleString();
  }
}


function createIterator(n, ctx) {
  var iteratorCtx = ctx;
  var next;
  var data = ctx.data;
  var keys;
  var i = 0;
  n = n || parseFloat(data);

  function prepareCtx(data) {
    //console.log("** ITERATOR PUSH", data, JSON.stringify(ctx, null, 2));
    iteratorCtx = ctx.push(data).push(data.value);
    //console.log("** ITERATOR PUSH", data, JSON.stringify(iteratorCtx, null, 2));
  }

  if (isNaN(n)) {
    if (data instanceof Array) {
      n = data.length;

      next = function next() {
        if (i < n) {
          prepareCtx({ index: i, value: data[i] });
          return ++i;
        }
        return undefined;
      };

    } else if (data !== null && typeof data === 'object') {
      keys = Object.keys(data);
      n = keys.length;

      next = function () {
        if (i < n) {
          prepareCtx({ index: i, key: keys[i], value: data[keys[i]] });
          return ++i;
        }
        return undefined;
      }
    } else {
      n = 0;
    }
  }

  if (!next) {  // let's assume n is a literal number....
    next = function () {
      if (i < n) {
        prepareCtx = ctx.push(i);
        return ++i;
      }
      return undefined;
    };
  }

  return Object.create(null, {
    'context': {
      enumerable: true,
      configurable: false,
      get: function () {
        return iteratorCtx;
      }
    },
    'next': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: next
    }
  });
}

function createChunkRenderer(segmentRenderers) {
  return Object.create(null, {
    'render': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * (index) {
        if (index < segmentRenderers.length) {
          yield segmentRenderers[index];
        }
      }
    },
    'length': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: segmentRenderers.length
    }
  });
}


/**
Modifier - e
*/
function modifierEscape(val) {
  return escape(String(val));
}

/**
Modifier - u
*/
function modifierEncodeURIComponent(val) {
  return encodeURIComponent(String(val));
}

/**
Modifier - j
*/
function modifierJson(val) {
  return JSON.stringify(val);
}

/**
Modifier - U
*/
function modifierUpper(val) {
  return String(val).toLocaleUpperCase();
}

/**
Modifier - l
*/
function modifierLower(val) {
  return String(val).toLocaleLowerCase();
}



function EngineStream() {
  Transform.call(this, { decodeStrings: false, objectMode: true });
  this._modifierStack = [];
  this._modifierCount = 0;
  this._modifiers = [];
}
util.inherits(EngineStream, Transform);
Object.defineProperties(EngineStream.prototype, {
  m: {
    enumerable: true,
    configurable: false,
    get: function getModifiers() {
      return this._modifiers;
    },
    set: function setModifier(modifiers) {
      if (modifiers) {
        this._modifierStack.push(this._modifiers);
        this._modifiers = this._modifiers + modifiers;
      } else if (this._modifierStack.length) {
        this._modifiers = this._modifierStack.pop();
      }

      this._modifierCount = this._modifiers.length;
    }
  },
  _transform: {
    value: function transform(chunk, encoding, done) {
      for (var i = 0; i < this._modifierCount; ++i) {
        chunk = modifiers[this._modifiers.charAt(i)](chunk);
      }
      if (chunk) {
        if (!(typeof chunk === 'string')) {
          chunk = formatData(chunk);
        }
        this.push(chunk, encoding);
      }
      done();
    }
  }
});


/**
The default template render stream
*/
function DefaultRendererStream() {
  Writable.call(this, { decodeStrings: false }); // init super
  this.buffer = '';
};
util.inherits(DefaultRendererStream, Writable);
DefaultRendererStream.prototype._write = function (chunk, encoding, cb) {
  this.buffer += chunk;
  cb();
};


/**
Engine Exception
*/
function EngineException(msg) {
  msg && (this.message = msg);
  Error.apply(this, arguments);
  Error.captureStackTrace(this, this.constructor);
};
util.inherits(EngineException, Error);
EngineException.prototype.name = EngineException.name;
