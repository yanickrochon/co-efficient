
const DEFAULT_TEMPLATE_PATH = '.';
const DEFAULT_EXT = '.coa.html';
const EXT_SEP = ',';

var path = require('path');
var fs = require('co-fs');
var util = require('util');
var suspend = require('co-suspend');
var Module = require('module');
var Writable = require('stream').Writable;
var Context = require('./context');
var Engine = module.exports;



/**
Helpers
*/
Object.defineProperties(Engine, {
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
    value: {}
  },
  'helpers': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: {}
  },
  'resolve': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: resolveTemplate
  },
  'render': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: renderTemplate
  },
  'stream': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: streamTemplate
  },
  '_stream': {
    enumerable: false,
    configurable: false,
    writable: false,
    value: _streamTemplate
  },
  'formatData': {
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
  'chunkRenderer': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createChunkRenderer
  }
});

Engine.extSep = EXT_SEP;

Engine.exceptions = {
  EngineException: EngineException
};

Object.freeze(Engine);


function * resolveTemplate(name) {
  var paths;
  var ext;
  var file;
  var value;

  if (Engine.cache[name]) {
    value = Engine.cache[name];
  } else {
    paths = Engine.config.paths || DEFAULT_TEMPLATE_PATH;
    ext = Engine.config.ext || DEFAULT_EXT;

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
            source: file,
            module: null
          };
        }
      }
    }
  }

  return value;
}


function * renderTemplate(name, data, timeout) {
  var stream = new RendererStream();
  var marker = suspend();

  stream.on('finish', marker.resume);

  yield streamTemplate(stream, name, data);
  yield marker.wait(timeout);

  return stream.buffer;
}

function * streamTemplate(stream, name, data) {
  var ctx = new Context(null, data, name);
  var blocks = {};

  yield _streamTemplate(stream, name, ctx, blocks);

  stream.end();
}

function * _streamTemplate(stream, name, ctx, blocks) {
  var template = yield resolveTemplate(name);

  if (!template) {
    throw new EngineException('Template not found : `' + name + '`');
  } else if (!template.module) {

    var parser = require('./parser');
    var compiler = require('./compiler');

    var parsed = yield parser.parseFile(template.source);
    var compiled = yield compiler.compile(parsed, Engine);

    var module = new Module(name, null);
    module._compile('module.exports = ' + compiled, template.source);

    template.module = module.exports;

    //console.log("**TMPL", template.module.toString().length, '/', parsed.length, template.module.toString());
  }

  yield (template.module)(stream, ctx, Engine, blocks);
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
    iteratorCtx = ctx.push(data);
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
        prepareCtx({ value: i });
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
  //console.log("<<<" + chunk + ">>>");
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
require('util').inherits(EngineException, Error);
EngineException.prototype.name = EngineException.name;
