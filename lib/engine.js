

var Context = require('./context');
var Engine = module.exports;


/**
Helpers
*/
Object.defineProperties(Engine, {
  'cache': {
    enumerable: true,
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
  'render': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: render
  }
});




function * render(templatePath, data) {
  var ctx = new Context(null, data, templatePath);
  var template = Engine.cache[templatePath];
  var parser;
  var compiler;

  if (!template) {
    parser = require('./parser');
    compiler = require('./compiler');

    template = parser.parseFile(yield locateTemplate(templatePath));
    template = compiler.compile(template, Engine);

    Engine.cache[templatePath] = template;
  }

  // TODO : stream template!

  //yield template(stream, ctx, Engine);
}


function * locateTemplate(templatePath) {


};
