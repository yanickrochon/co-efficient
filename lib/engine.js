
const VALID_MODIFIERS = /[a-zA-Z0-9_\-*^`´$&!?#%<>"µ@]/;
const DEFAULT_TEMPLATE_PATH = '.';
const DEFAULT_EXT = '.coeft, .coeft.html';
const EXT_SEP = ',';

const MODIFIERS = {
  'c': modifierEncodeURIComponent,
  'C': modifierDecodeURIComponent,
  'e': modifierEncodeURI,
  'E': modifierDecodeURI,
  'h': modifierEncodeHtmlEntities,
  'H': modifierDecodeHtmlEntities,
  'j': modifierJson,
  'U': modifierUpper,
  'l': modifierLower,
  'x': modifierEncodeXmlEntities,
  'X': modifierDecodeXmlEntities,
  '*': modifierMask,
  '@': modifierIteratorCount
};

/**
Tempalte headers
*/
const TEMPLATE_HEADER = [
  'var RenderException = function (msg) { return module.exports.RenderException(msg); };'
].join('');


var path = require('path');
//var fs = require('co-fs');
var fs = require('fs');
var util = require('util');
var entities = require('entities');
var Module = require('module');
var Writable = require('stream').Writable;
var Transform = require('stream').Transform;
var randomBytes = require('crypto').randomBytes;
var Context = require('./context');
var EventEmitter = require('events').EventEmitter;
var events = new EventEmitter;

var EngineException = require('./exceptions').EngineException;
var RenderException = require('./exceptions').RenderException;

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
  }
});



// instances

function Engine(options) {
  var inst = this;

  if (!(this instanceof Engine)) {
    return new Engine(options);
  }

  EventEmitter.call(this);

  options = options || {};

  function * _templateText(template, callback) {
    var tempName = randomBytes(128).toString('base64');
    var value;

    inst.cache[tempName] = template;

    value = yield callback(tempName);

    delete inst.cache[tempName];

    return value;
  }

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
        return yield resolveTemplate(name, inst);
      }
    },
    'render': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * render(name, data) {
        return yield renderTemplate(name, data, inst);
      }
    },
    'renderText': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * renderText(templateContent, data) {
        return yield _templateText(templateContent, function * (name) {
          return yield renderTemplate(name, data, inst);
        });
      }
    },
    'stream': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * stream(stream, name, data, autoClose) {
        return yield streamTemplate(stream, name, data, autoClose, inst);
      }
    },
    'streamText': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: function * streamText(stream, templateContent, data, autoClose) {
        return yield _templateText(templateContent, function * (name) {
          return yield streamTemplate(stream, name, data, autoClose, inst);
        });
      }
    }
  });

  events.emit('engineCreated', this);
};
util.inherits(Engine, EventEmitter);

Object.freeze(Engine);


// push all block rules...
for (var modifier in MODIFIERS) {
   modifiers[modifier] = MODIFIERS[modifier];
}


// do NOT keep initialData. We just need it when emitting an event so the
// listeners can have something to relate to
var InternalEngine = function InternalEngine(stream, engine, initialData) {
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

  engine.emit('internalEngineCreated', this, initialData);

  Object.freeze(this);
};



function registerModifier(modifier, callback) {
  var temp;

  if (typeof modifier !== 'string' || modifier.length !== 1) {
    throw EngineException('Invalid modifier');
  }
  if (MODIFIERS[modifier]) {
    throw EngineException('Illegal modifier');
  }
  if (!(callback instanceof Function)) {
    throw EngineException('Not a modifier function');
  }

  temp = modifiers;
  modifiers = {};

  for (var mKey in temp) {
    modifiers[mKey] = temp[mKey];
  }

  modifiers[modifier] = callback;

  Object.freeze(modifiers);

  events.emit('modifierRegistered', modifier);

  return true;
}

function unregisterModifier(modifier) {
  var oldModifiers;

  if (typeof modifier !== 'string' || modifier.length !== 1) {
    throw EngineException('Invalid modifier');
  }
  if (MODIFIERS[modifier]) {
    throw EngineException('Illegal modifier');
  }

  if (!modifiers[modifier]) {
    return false;
  }

  oldModifiers = modifiers;
  modifiers = {};

  for (var mKey in oldModifiers) {
    if (mKey !== modifier) {
      modifiers[mKey] = oldModifiers[mKey];
    }
  }

  Object.freeze(modifiers);

  events.emit('modifierUnregistered', modifier, oldModifiers[modifier]);

  return true;
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
        //found = yield fs.exists(file);
        found = fs.existsSync(file);
      }
    }

    if (found) {
      engine.emit('templateResolved', file);

      found = {
        filename: file
      };

      engine.cache[name] = found;
    }
  }

  return found;
}


function * renderTemplate(name, data, engine) {
  var stream = new DefaultRendererStream();

  yield streamTemplate(stream, name, data, true, engine);

  return stream.buffer;
}

function * streamTemplate(stream, name, data, autoClose, engine) {
  var transformStream = new EngineStream()
  var internalEngine = new InternalEngine(transformStream, engine, data);
  var ctx = new Context(null, data, name);
  var blocks = {};

  transformStream.pipe(stream);

  engine.emit('templateProcessing', { name: name, stream: stream, data: data });

  yield _streamTemplate(transformStream, name, ctx, blocks, engine, internalEngine);

  if (autoClose) {
    stream.end();
  }

  engine.emit('templateProcessed', { name: name, stream: stream, data: data });
}

function * _streamTemplate(stream, name, ctx, blocks, engine, internalEngine) {
  var template = yield resolveTemplate(name, engine);
  var parentTemplateName = ctx.templateName;
  var parser;
  var parsed;
  var compiler;
  var compiled;
  var module;

  if (!template) {
    engine.emit('templateNotFound', { name: name, context: ctx });
    throw EngineException('Template not found : `' + name + '`');
  } else if (!template.module) {
    parser = require('./parser');
    compiler = require('./compiler');

    if (typeof template === 'string') {
      parsed = yield parser.parseString(template);

      template = {
        filename: name,
        templateContent: template
      };
    } else {
      parsed = yield parser.parseFile(template.filename);
    }

    compiled = yield compiler.compile(parsed, engine);

    module = new Module(name, null);
    module._compile(TEMPLATE_HEADER + 'module.exports=' + compiled, template.filename);

    // inject stuff...
    module.exports.RenderException = RenderException;

    template.source = compiled;
    template.module = module.exports;

    //console.log("**TMPL", template.module.toString().length, '/', parsed.length, template.module.toString());
  }

  ctx.templateName = name;

  yield template.module(stream, ctx, internalEngine, blocks);

  if (ctx.templateName !== parentTemplateName) {
    ctx.templateName = parentTemplateName;
  }
}


function formatData(data) {
  //console.log("Data", data);
  //if (typeof data === 'string') {
  //  return String(data);
  //} else
  if (data === null || data === undefined) {
    return '';
  } else if (typeof data === 'object') {
    return JSON.stringify(data);
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
Modifier - c
*/
function modifierEncodeURIComponent(val) {
  return encodeURIComponent(String(val));
}

/**
Modifier - C
*/
function modifierDecodeURIComponent(val) {
  return decodeURIComponent(String(val));
}

/**
Modifier - e
*/
function modifierEncodeURI(val) {
  return encodeURI(String(val));
}

/**
Modifier - E
*/
function modifierDecodeURI(val) {
  return decodeURI(String(val));
}

/**
Modifier - j
*/
function modifierJson(val) {
  return JSON.stringify(val, null, 4);
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

/**
Modifier - *
*/
function modifierMask(val) {
  return String(val).replace(/./g, '*');
}

/**
Modifier - h
*/
function modifierEncodeHtmlEntities(val) {
  return entities.encodeHTML(String(val));
}

/**
Modifier - H
*/
function modifierDecodeHtmlEntities(val) {
  return entities.decodeHTML(String(val));
}

/**
Modifier - x
*/
function modifierEncodeXmlEntities(val) {
  return entities.encodeXML(String(val));
}

/**
Modifier - x
*/
function modifierDecodeXmlEntities(val) {
  return entities.decodeXML(String(val));
}

/**
Modifier - @
*/
function modifierIteratorCount(val) {
  if (val === null || val === undefined) {
    return 0;
  } else if (val instanceof Array || 'length' in val) {
    return val.length;
  } else if (val instanceof Object) {
    return Object.keys(val).length;
  } else if (!isNaN(parseFloat(val))) {
    return val;
  } else {
    return 1;
  }
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
      if (typeof chunk !== 'string') {
        chunk = formatData(chunk);
      }
      if (chunk.length) {
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
