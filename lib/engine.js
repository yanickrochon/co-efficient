
const DEFAULT_TEMPLATE_PATH = '.';
const DEFAULT_EXT = '.coa.html';
const EXT_SEP = ',';

var path = require('path');
var fs = require('co-fs');
var util = require('util');
var Wrtable = require('stream').Writable;
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
  'formatData': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: formatData
  },
  'createIterator': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: createIterator
  },
  'createChunkRenderer': {
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
        file = path.join(paths, name + ext[x]);
        if (yield fs.exists(file)) {
          value = {
            source: file,
            invokable: null
          };
        }
      }
    }
  }

  return value;
}


function * renderTemplate(name, data) {
  var template = yield resolveTemplate(name);
  var ctx = new Context(null, data, name);
  var stream

  if (!template) {
    throw new EngineException('Template not found : `' + name + '`');
  } else if (!template.invokable) {
    var parser = require('./parser');
    var compiler = require('./compiler');

    var parsed = yield parser.parseFile(template.source);
    template.invokable = yield compiler.compile(parsed, Engine);
  }


}




function * locateTemplate(templatePath) {


};


function RendererStream(options) {
  Writable.call(this, options); // init super
};
util.inherits(RendererStream, Writable);
WMStrm.prototype._write = function (chunk, enc, cb) {
  // our memory store stores things in buffers
  var buffer = (Buffer.isBuffer(chunk)) ?
    chunk :  // already is Buffer use it
    new Buffer(chunk, enc);  // string, convert

  // concat to the buffer already there
  memStore[this.key] = Buffer.concat([memStore[this.key], buffer]);
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
