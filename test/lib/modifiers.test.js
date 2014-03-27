

var Module = require('module');

var Parser = require('../../lib/parser');
var Compiler = require('../../lib/compiler');
var Engine = require('../../lib/engine');


describe('Template Modifiers Test', function () {

  var engine;

  function * compileTemplateText(name, templateStr) {
    var module = new Module(name, null);
    var parsed = yield Parser.parseString(templateStr);
    var compiled = yield Compiler.compile(parsed);
    var template;

    module._compile('module.exports=' + compiled, name);

    template = {
      filename: name,
      source: compiled,
      module: module.exports
    };

    engine.cache[name] = template;
  }

  before(function () {
    engine = new Engine();
  });

  after(function () {
    var keys = Object.keys(engine.cache);

    // empty cache
    keys.forEach(function (key) {
      delete engine.cache[key];
    });
  });


  it('should escape - e', function * () {
    var templateName = 'test.escape';
    var templateStr = '<div class="{{class}e}"></div>';

    yield compileTemplateText(templateName, templateStr);

    var text = yield engine.render(templateName, { 'class': 'foo"bar' });

    text.should.equal('<div class="foo%22bar"></div>');
  });

  it('should combine - eU', function * () {
    var templateName = 'test.escape';
    var templateStr = '<div class="{{class}eU}"></div>';

    yield compileTemplateText(templateName, templateStr);

    var text = yield engine.render(templateName, { 'class': 'foo"bar' });

    text.should.equal('<div class="FOO%22BAR"></div>');
  });

  it('should modify in correct order', function * () {
    var templateName = 'test.escape';
    var templateStrArr = {
      '{{text}lU}': 'FOO',
      '{{text}Ul}': 'foo'
    };
    var text;
    var keys = Object.keys(templateStrArr);
    var key;

    for (var i = 0; i < keys.length; i++) {
      key = keys[i];

      yield compileTemplateText(templateName, key);

      text = yield engine.render(templateName, { 'text': 'foo' });

      text.should.equal(templateStrArr[key]);
    }
  });

  it('should not leak modifiers', function * () {
    var templateName = 'test.escape';
    var templateStr = '<div class="{{class}eU}">{{hello}}</div>';

    yield compileTemplateText(templateName, templateStr);

    var text = yield engine.render(templateName, { 'class': 'foo"bar', hello: '"World"' });

    text.should.equal('<div class="FOO%22BAR">"World"</div>');
  });


  it('should apply to block segments', function * () {
    var templateName = 'test.escape';
    var templateStr = '{#{block}U}foo{#{/}}{+{block/}}';

    yield compileTemplateText(templateName, templateStr);

    var text = yield engine.render(templateName);

    text.should.equal('FOO');
  });

  it('should combine modifiers', function * () {
    var templateName = 'test.escape';
    var templateStr = '{#{block}U}"foo"{#{/}}{+{block/}e}';

    yield compileTemplateText(templateName, templateStr);

    var text = yield engine.render(templateName);

    text.should.equal('%22FOO%22');
  });

  it('should register new modifiers', function * () {
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

    var templateName = 'test.escape';
    var templateStr = '<div>{{user.pass}*}</div>';

    yield compileTemplateText(templateName, templateStr);

    var text = yield engine.render(templateName, { user: { pass: 'foobar' } });

    text.should.equal('<div>******</div>');

    Parser.unregisterBlockModifier('*');
    Engine.unregisterModifier('*');
  });

});
