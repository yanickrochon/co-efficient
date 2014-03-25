
const DEFAULT_TEMPLATE_PATH = '.';
const DEFAULT_EXT = '.coeft.html';
const EXT_SEP = ',';

var path = require('path');
var fs = require('co-fs');
var util = require('util');
var Module = require('module');
var Writable = require('stream').Writable;
var Context = require('./context');
var EventEmitter = require('events').EventEmitter;

module.exports = Engine;


function Engine(options) {
  if (!(this instanceof Engine)) {
    return new Engine(options);
  }

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
};
util.inherits(Engine, EventEmitter);


Engine.extSep = EXT_SEP;

Engine.exceptions = {
  EngineException: EngineException
};

Object.freeze(Engine);


var InternalEngine = function InternalEngine(engine) {
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
      value: function * (stream, name, ctx, blocks) {
        return yield _streamTemplate(stream, name, ctx, blocks, engine, this);
      }
    },
    'format': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: formatData
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
};



function * resolveTemplate(name, engine) {
  var paths;
  var ext;
  var file;
  var value;

  if (engine.cache[name]) {
    value = engine.cache[name];
  } else {
    paths = engine.config.paths || DEFAULT_TEMPLATE_PATH;
    ext = engine.config.ext || DEFAULT_EXT;

    if (typeof paths === 'string') {
      paths = paths.split(path.delimiter);
    }

    if (typeof ext === 'string') {
      ext = ext.split(EXT_SEP);
    }
    if (ext.indexOf('') === -1) {
      ext.push('');  // try without extension
    }

    for (var i = 0, len = paths.length; i < len && !value; ++i) {
      for (var x = 0, xlen = ext.length; x < xlen && !value; ++x) {
        file = path.join(paths[i], name + ext[x]);
        if (yield fs.exists(file)) {
          value = {
            filename: file
          };
        }
      }
    }

    if (value) {
      engine.emit('templateResolved', file);
    }
  }

  return value;
}


function * renderTemplate(name, data, engine) {
  var stream = new RendererStream();

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
  var internalEngine = new InternalEngine(engine);
  var ctx = new Context(null, data, name);
  var blocks = {};

  yield _streamTemplate(stream, name, ctx, blocks, engine, internalEngine);

  if (autoClose) {
    stream.end();
  }

  engine.emit('templateProcessed', { name: name, stream: stream, data: data, engine: engine });
}

function * _streamTemplate(stream, name, ctx, blocks, engine, internalEngine) {
  var template = yield resolveTemplate(name, engine);
  var parentTemplateName = ctx.templateName;

  if (!template) {
    engine.emit('templateNotFound', { name: name, context: ctx, engine: engine });
    throw new EngineException('Template not found : `' + name + '`');
  } else if (!template.module) {

    var parser = require('./parser');
    var compiler = require('./compiler');

    var parsed = yield parser.parseFile(template.filename);
    var compiled = yield compiler.compile(parsed, engine);

    var module = new Module(name, null);
    module._compile('module.exports = ' + compiled, template.filename);

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


function * formatData(data) {
  if (data !== null && typeof data === 'object') {
    return JSON.stringify(data);
  } else if (!isNaN(parseFloat(data))) {
    return String(data);
  } else {
    return String(data || '');  // TODO implement formatters per data type
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



function RendererStream() {
  Writable.call(this, { decodeStrings: false }); // init super
  this.buffer = '';
};
util.inherits(RendererStream, Writable);
RendererStream.prototype._write = function (chunk, enc, cb) {
  this.buffer += chunk;
  cb();
};



/**
Parse Exception
*/
function EngineException(msg) {
  msg && (this.message = msg);
  Error.apply(this, arguments);
  Error.captureStackTrace(this, this.constructor);
};
util.inherits(EngineException, Error);
EngineException.prototype.name = EngineException.name;
