
var Engine = require('../../lib/engine');

describe('Test engine', function () {

  var engine;

  this.timeout(500);

  before(function () {
    engine = Engine({
      config: {
        paths: [__dirname + '/fixtures'],
      },
      helpers: {
        pageHeader: function * (stream, ctx, chunk, params) {
          stream.write('**HEADER** : ');
          stream.write(params.prefix || '');
          stream.write(' - ');
          stream.write(params.title || '');
        }
      }
    });
  });


  it('should expose events', function () {
    [
      'on', 'once',
      'addListener', 'removeListener', 'removeAllListeners',
      'listeners'
    ].forEach(function (fnName) {
      Engine[fnName].should.be.a.function;
    });
  });

  it('should emit engineCreated', function () {
    var instTest; 
    var engineTest;

    function engineCreated(engine) {
      instTest = engine;
    }

    Engine.on('engineCreated', engineCreated);
    Engine.listeners('engineCreated').should.not.be.empty;

    engineTest = Engine();

    engineTest.should.equal(instTest);

    Engine.removeListener('engineCreated', engineCreated);
    Engine.listeners('engineCreated').should.be.empty;
  });


  it('should render files', function * () {

    var html = yield engine.render('template', {
      title: 'Hello world!',
      listObj: {
        'good': 'Good',
        'avg': 'Average',
        'bad': 'Not Good'
      },
      listArr: [
        'Cold', 'Warm', 'Hot'
      ],
      counter: 4,
      foo: {
        bar: {
          paragraph: 'This is a paragraph content'
        }
      },
      test: {
        value: 11
      }
    });

    /<li>index=0, key=good, value=Good, context=Good<\/li>/.test(html).should.be.true;
    /<li>index=1, key=avg, value=Average, context=Average<\/li>/.test(html).should.be.true;
    /<li>index=2, key=bad, value=Not Good, context=Not Good<\/li>/.test(html).should.be.true;
    /<li>index=0, key=, value=Cold, context=Cold<\/li>/.test(html).should.be.true;
    /<li>index=1, key=, value=Warm, context=Warm<\/li>/.test(html).should.be.true;
    /<li>index=2, key=, value=Hot, context=Hot<\/li>/.test(html).should.be.true;
    /<li>index=, key=, value=, context=4<\/li>/.test(html).should.be.true;
    /Empty list/.test(html).should.be.false;
    /Greater than 10/.test(html).should.be.true;

    //console.log(html);

  });

  it('should render file with no data', function * () {
    var html = yield engine.render('template');

    /<li>index=0, key=good, value=Good, context=Good<\/li>/.test(html).should.be.false;
    /<li>index=1, key=avg, value=Average, context=Average<\/li>/.test(html).should.be.false;
    /<li>index=2, key=bad, value=Not Good, context=Not Good<\/li>/.test(html).should.be.false;
    /<li>index=0, key=, value=Cold, context=Cold<\/li>/.test(html).should.be.false;
    /<li>index=1, key=, value=Warm, context=Warm<\/li>/.test(html).should.be.false;
    /<li>index=2, key=, value=Hot, context=Hot<\/li>/.test(html).should.be.false;
    /<li>index=, key=, value=, context=4<\/li>/.test(html).should.be.false;
    /Empty list/.test(html).should.be.true;
    /Less or equal to 10/.test(html).should.be.true;

    //console.log(html);
  });

  it('should render types correctly', function * () {
    var text = yield engine.render('types', {
      zero: 0,
      text: 'Hello world!',
      obj: { foo: 'bar' },
      fn: function hello() { console.log('World'); }
    });

    /Integer: 0/.test(text).should.be.true;
    /String: Hello world!/.test(text).should.be.true;
    /Object: \{"foo":"bar"\}/.test(text).should.be.true;
    /Function: function hello\(\) \{ console.log\('World'\); \}/.test(text).should.be.true;

    //console.log(text);
  });


  it('should render conditional with context correctly', function * () {
    var text;

    text = yield engine.render('if-context', {
      foo: 'foo',
      bar: 'bar'
    });
    text.should.equal('foo\n');

    text = yield engine.render('if-context', {
      bar: 'bar'
    });
    text.should.equal('bar\n');

  });

  it('should stream template', function * () {
    var stream = new (require('stream').PassThrough)();
    var retVal;
    var text = '';

    stream.on('data', function (buffer) {
      text += buffer.toString();
    });

    retVal = yield engine.stream(stream, 'if-context', {
      foo: 'foo',
      bar: 'bar'
    });

    assert.equal(undefined, retVal);

    text.should.equal('foo\n');
  });


  describe('Modifiers', function () {

    it('should register modifier', function () {
      var modifierId = '_';
      var modifierCallback = function () { };

      assert.equal(Engine.modifiers[modifierId], undefined);

      Engine.registerModifier(modifierId, modifierCallback);
      Engine.modifiers[modifierId].should.equal(modifierCallback);

      Engine.unregisterModifier(modifierId);
      assert.equal(Engine.modifiers[modifierId], undefined);
    });

    it('should register valid modifiers', function () {
      var currentModifiers = Object.keys(Engine.modifiers);
      var callback = function () { };

      [

      ].forEach(function (modifier) {
        Engine.registerModifier(invalidModifier, callback);
        Engine.modifiers[modifier].should.equal(callback);
        Engine.unregisterModifier(modifier);
      });

      Object.keys(Engine.modifiers).should.eql(currentModifiers);
    });

    it('should fail with invalid modifiers', function () {
      var currentModifiers = Object.keys(Engine.modifiers);
      var modifier = '0';
      var callback = function () { };

      [
        '',     // too short
        'tt',   // too long
        '@',    // illegal override
        null, false, true, undefined,
        -1, 0, 1,
        {}, [], function () {}, /./
      ].forEach(function (invalidModifier) {
        +function () { Engine.registerModifier(invalidModifier, callback); }.should.throw();
        +function () { Engine.unregisterModifier(invalidModifier, callback); }.should.throw();
      });

      [
        undefined, null, false, true,
        -1, 0, 1,
        {}, [], /./, "", "test"
      ].forEach(function (invalidCallback) {
        +function () { Engine.registerModifier(modifier, invalidCallback); }.should.throw();
      });

      Object.keys(Engine.modifiers).should.eql(currentModifiers);
    });

    it('should ignore unregistering valid unknown validator', function () {
      Engine.unregisterModifier('0');
    });

  });


  describe('inline templates', function () {

    it('should render inline templates', function * () {
      var template = '{?{foo}}bar{?{~}}null{?{/}}';
      var text;

      text = yield engine.renderText(template);
      text.should.equal('null');

      text = yield engine.renderText(template, { foo: true });
      text.should.equal('bar');

    });

    it('should stream inline templates', function * () {
      var template = '{?{foo}}bar{?{~}}null{?{/}}';
      var stream = new (require('stream').PassThrough)();
      var retVal;
      var text;

      stream.on('data', function (buffer) {
        text += buffer.toString();
      });

      text = '';
      retVal = yield engine.streamText(stream, template);
      assert.equal(undefined, retVal);
      text.should.equal('null');

      text = '';
      retVal = yield engine.streamText(stream, template, { foo: true });
      assert.equal(undefined, retVal);
      text.should.equal('bar');
    });

  });

});
