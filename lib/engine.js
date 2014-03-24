
const DEFAULT_TEMPLATE_PATH = '.';
const DEFAULT_EXT = '.coeft.html';
const EXT_SEP = ',';

var path = require('path');
var fs = require('co-fs');
var util = require('util');
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
    value: streamTemplate
  }
  //'streamText': {
  //  enumerable: true,
  //  configurable: false,
  //  writable: false,
  //  value: streamText
  //}
});

Engine.extSep = EXT_SEP;

Engine.exceptions = {
  EngineException: EngineException
};

Object.freeze(Engine);


var InternalEngine = new function InternalEngine() {
  Object.defineProperties(this, {
    'helpers': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: Engine.helpers
    },
    'stream': {
      enumerable: true,
      configurable: false,
      writable: false,
      value: _streamTemplate
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
};



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
            filename: file
          };
        }
      }
    }
  }

  return value;
}


function * renderTemplate(name, data) {
  var stream = new RendererStream();

  yield streamTemplate(stream, name, data, true);

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

function * streamTemplate(stream, name, data, autoClose) {
  var ctx = new Context(null, data, name);
  var blocks = {};

  yield _streamTemplate(stream, name, ctx, blocks);

  if (autoClose) {
    stream.end();
  }
}

function * _streamTemplate(stream, name, ctx, blocks) {
  var template = yield resolveTemplate(name);
  var parentTemplateName = ctx.templateName;

  if (!template) {
    throw new EngineException('Template not found : `' + name + '`');
  } else if (!template.module) {

    var parser = require('./parser');
    var compiler = require('./compiler');

    var parsed = yield parser.parseFile(template.filename);
    var compiled = yield compiler.compile(parsed, Engine);

    var module = new Module(name, null);
    module._compile('module.exports = ' + compiled, template.filename);

    template.source = compiled;
    template.module = module.exports;

    //console.log("**TMPL", template.module.toString().length, '/', parsed.length, template.module.toString());
  }

  ctx.templateName = name;

  yield (template.module)(stream, ctx, InternalEngine, blocks);

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
