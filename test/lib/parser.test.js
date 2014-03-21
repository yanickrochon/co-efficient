
var co = require('co');
var Parser = require('../../lib/parser');


describe('Test Parser', function () {

  function collectValues(obj) {
    var values = [];
    for (var key in obj) {
      values.push(obj[key]);
    }
    return values;
  }

  it('should parse text only', function * () {
    var source = 'Hello world!';
    var parsed = yield (Parser.parseString(source));
    var segValues;

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.be.a.String;

    collectValues((yield (Parser.parseString('Hello}'))).segments)[0].should.equal('Hello}');
  });

  it('should parse context', function * () {
    var source = '{{foo.bar}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.not.have.ownProperty('type');
    segValues[0].should.have.ownProperty('context').and.equal('foo.bar');
  });

  it('should parse more contexts', function * () {
    var source = '{{hello}} {{foo.bar}}{{buz}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.not.have.ownProperty('type');
    segValues[0].should.have.ownProperty('context').and.equal('hello');
    segValues[1].should.be.a.String.and.equal(' ');
    segValues[2].should.have.ownProperty('context').and.equal('foo.bar');
    segValues[3].should.have.ownProperty('context').and.equal('buz');
  });

  it('should parse block', function * () {
    var source = '{#{block/}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.have.ownProperty('type').and.equal('#');
    segValues[0].should.have.ownProperty('closing').and.be.true;
    segValues[0].should.have.ownProperty('name').and.equal('block');
    segValues[0].should.not.have.ownProperty('context');
  });

  it('should parse block with context', function * () {
    var source = '{#{block:foo.bar/}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.have.ownProperty('type').and.equal('#');
    segValues[0].should.have.ownProperty('closing').and.be.true;
    segValues[0].should.have.ownProperty('name').and.equal('block');
    segValues[0].should.have.ownProperty('context').and.equal('foo.bar');
  });

  it('should parse block with 1 context param', function * () {
    var source = '{&{helper arg=foo/}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.have.ownProperty('type').and.equal('&');
    segValues[0].should.have.ownProperty('closing').and.be.true;
    segValues[0].should.not.have.ownProperty('context');
    segValues[0].should.have.ownProperty('params').and.be.an.Object;
    segValues[0].params.should.have.ownProperty('arg').and.have.ownProperty('context').and.equal('foo');
  });

  it('should parse block with 1 literal param', function * () {
    var source = '{&{helper arg="foo"/}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.have.ownProperty('type').and.equal('&');
    segValues[0].should.have.ownProperty('closing').and.be.true;
    segValues[0].should.have.ownProperty('name').and.equal('helper');
    segValues[0].should.not.have.ownProperty('context');
    segValues[0].should.have.ownProperty('params').and.be.an.Object;
    segValues[0].params.should.have.ownProperty('arg').and.equal('foo');
  });

  it('should parse more blocks', function * () {
    var source = '{#{block/}} {+{block/}}{+{block/}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.have.ownProperty('type').and.equal('#');
    segValues[0].should.have.ownProperty('name').and.equal('block');
    segValues[0].should.not.have.ownProperty('context');
    segValues[1].should.be.a.String.and.equal(' ');
    segValues[2].should.have.ownProperty('type').and.equal('+');
    segValues[2].should.have.ownProperty('name').and.equal('block');
    segValues[2].should.not.have.ownProperty('context');
    segValues[3].should.have.ownProperty('type').and.equal('+');
    segValues[3].should.have.ownProperty('name').and.equal('block');
    segValues[3].should.not.have.ownProperty('context');
  });

  it('should parse nested blocks', function * () {
    var source = 'Hel{#{block}}lo {{name}} ?{#{/}} !';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.be.a.String.and.equal('Hel');
    segValues[1].should.have.ownProperty('type').and.equal('#');
    segValues[1].should.have.ownProperty('name').and.equal('block');
    segValues[1].should.not.have.ownProperty('context');
    segValues[1].should.have.ownProperty('segments').and.be.an.Object;
    segValues[2].should.be.a.String.and.equal(' !');

    segValues = collectValues(segValues[1].segments);
    segValues[0].should.be.a.String.and.equal('lo ');
    segValues[1].should.not.have.ownProperty('type');
    segValues[1].should.have.ownProperty('context').and.equal('name');
    segValues[2].should.be.a.String.and.equal(' ?');
  });

  it('should parse multiline templates', function * () {
    var source = 'Hello world!\n  {#{block/}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.be.an.Object;
    segValues = collectValues(parsed.segments);
    segValues[0].should.be.a.String.and.equal('Hello world!\n  ');
    segValues[1].should.have.ownProperty('type').and.equal('#');
    segValues[1].should.have.ownProperty('name').and.equal('block');
    segValues[1].should.have.ownProperty('line').and.equal(2);
    segValues[1].should.have.ownProperty('col').and.equal(2);
  });

  it('should fail with too many closing blocks', function (done) {
    var sources = [
      '{#{/}}',
      '{#{block/}}{#{/}}',
      '{#{block}}{#{/}}{#{/}}'
    ];
    var testComplete = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= sources.length) {
        done();
      }
    }

    for (var i = 0; i < sources.length; ++i) {
      co(function * () {
        yield (Parser.parseString(sources[i]));
      })(function (err) {
        err.should.be.an.Error;
        checkTestComplete();
      });
    }

    this.timeout(500);
  });

  it('should fail because of missing closing block', function (done) {
    var sources = [
      '{#{block}}',
      '{#{block}}{+{block}}',
      '{#{block}} {{name}} {@{otherblock}}'
    ];
    var testComplete = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= sources.length) {
        done();
      }
    }

    for (var i = 0; i < sources.length; ++i) {
      co(function * () {
        yield (Parser.parseString(sources[i]));
      })(function (err) {
        err.should.be.an.Error;
        checkTestComplete();
      });
    }

    this.timeout(500);
  });

  it('should escape text', function * () {
    collectValues((yield (Parser.parseString('\\\\n'))).segments)[0].should.equal('\\n');
    collectValues((yield (Parser.parseString('\\{'))).segments)[0].should.equal('{');
  });

  it('should fail parsing invalid blocks', function (done) {
    var sources = [
      '{a{block/}}',
      '{.{block/}}',
      '{"{block/}}',
      '{ab{block/}}',
      '{,{block/}}',
      '{"{block/}}',
      '{ {block/}}',
      '{/{block/}}',
      '{#{block arg=foo/}}',      // inline block cannot have parameters
      '{@{context.foo.bar/}e}',   // self closing iteration not allowed
      '{?{context.foo.bar/}e}',   // self closing conditionals not allowed
      '{>{"path/to/partial":context.foo.bar arg1=1 arg2="2"/}}',  // partials cannot have parameters
      '{>{"path/to/partial":context.foo.bar}e}{>{/}}',  // partials cannot have closing blocks
      '{#{block}/}',
      '{#{/}/}',
      '{{{foo/}}',
      '{{"foo"}}',
      '{>{""/}}',
      '{>{"""/}}',
      '{>{"":"/}}',
      '{>{"foo""/}}',
      '{>{"foo/}}',
      '{#{ foo/}}',
      '{#{foo//}}',
      '{{ foo}}',
      '{#{:foo}}',
      '{#{foo:/}}',
      '{#{foo: /}}',
      '{#{ /}}',
      '{#{foo:}}',
      '{{:foo}}',
      '{}{:foo}}',
      '{#{}}',
      '{{}}{{~}}',
      '{{~}}',
      '{{foo~}}',
      '{{~foo~}}',
      '{{foo}}{?{~}}',
      '{#{block arg=foo"bar/}}',
      '{#{block arg"=foo/}}',
      '{#{block arg==foo/}}',
      '{#{block arg="foo"',
      '{#{block arg="foo"x',
      '{#{block arg5/}}',
      '{#{block}}{@{/}}',
      '{#{block}}{#{~}}{#{/}}',
      '{?{test}}{?{~}}{?{~}}{?{/}}',
    ];
    var testComplete = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= sources.length) {
        done();
      }
    }

    for (var i = 0; i < sources.length; ++i) {
      (function (source) {
        co(function * () {
          return yield (Parser.parseString(source));
        })(function (err, parsed) {
          if (!err) console.log("FAIL", source, parsed);
          err.should.be.an.Error;
          checkTestComplete();
        });
      })(sources[i]);
    }

    this.timeout(500);
  });

  it('should fail with invalid escaping', function (done) {
    var sources = [
      '{\\{block/}}',
      '{#\\{block/}}',
      '{#{b\\lock/}}',
      '{#b{block\\:/}}',
      '{#{block:\\/}}',
      '{#{block:foo\\/}}',
      '{#{block arg\\=foo/}}',
      '{#{block:foo arg\\=foo/}}',
      '{#{block:foo arg="foo\\"/}}'
    ];
    var testComplete = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= sources.length) {
        done();
      }
    }

    for (var i = 0; i < sources.length; ++i) {
      (function (source) {
        co(function * () {
          return yield (Parser.parseString(source));
        })(function (err) {
          err.should.be.an.Error;
          checkTestComplete();
        });
      })(sources[i]);
    }

    this.timeout(500);
  });

  it('should escape quoted text', function (done) {
    var sources = [
      '{&{"blo\\ck"/}}',
      '{&{"blo\\\\ck"/}}',
      '{&{"blo\\{ck"/}}',
      '{&{"blo\\"ck"/}}',
      '{&{"blo\\:ck"/}}',
      '{&{"blo\\ ck"/}}',
      '{&{"blo\\/ck"/}}',
      '{&{"blo\\~ck"/}}',
      '{&{helper arg1="\\\\"/}}',
      '{&{helper arg2="\\/"/}}',
      '{&{helper arg3="\\="/}}',
      '{&{helper arg3="\\}"/}}',
      '{&{helper arg3="\\}"}}{&{/}}',
      '{&{helper arg4="/"/}}',
      '{&{helper arg5="="/}}',
      '{&{helper arg6="="   arg7=foo   arg8=""/}}'
    ];
    var testComplete = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= sources.length) {
        done();
      }
    }

    for (var i = 0; i < sources.length; ++i) {
      (function (source) {
        co(function * () {
          yield (Parser.parseString(source));
        })(function (err) {
          if (err) console.log("FAIL", source, err);
          assert.equal(err, null);
          checkTestComplete();
        });
      })(sources[i]);
    }

    this.timeout(500);
  });

  it('should parse flags', function (done) {
    var sources = [
      '{#{block/}e}',
      '{#{block/}E}',
      '{#{block/}eE}',
    ];
    var testComplete = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= sources.length) {
        done();
      }
    }

    for (var i = 0; i < sources.length; ++i) {
      co(function * () {
        yield (Parser.parseString(sources[i]));
      })(function (err) {
        assert.equal(err, null);
        checkTestComplete();
      });
    }

    this.timeout(500);
  });

  it('should fail with invalid flags', function (done) {
    var sources = [
      '{#{block/}x}',
      '{#{block/}ex}',
    ];
    var testComplete = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= sources.length) {
        done();
      }
    }

    for (var i = 0; i < sources.length; ++i) {
      co(function * () {
        yield (Parser.parseString(sources[i]));
      })(function (err) {
        err.should.be.an.Error;
        checkTestComplete();
      });
    }

    this.timeout(500);
  });

  it('should parse helper block', function * () {
    yield (Parser.parseString('{&{helper/}e}'));
    yield (Parser.parseString('{&{helper}e}{&{/}}'));
    yield (Parser.parseString('{&{helper}e}{&{~}}{&{~}}{&{~}}{&{/}}'));
    yield (Parser.parseString('{&{helper:context.foo.bar arg1=1 arg2="2"/}e}'));
    yield (Parser.parseString('{&{helper:context.foo.bar arg1=1 arg2="2"}e}{&{/}}'));
    yield (Parser.parseString('{&{helper:context.foo.bar arg1=1 arg2="2"}e}{&{~}}{&{/}}'));
    yield (Parser.parseString('{&{helper:context.foo.bar arg1=1 arg2="2"}e}{&{~}}{&{~}}{&{/}}'));
  });

  it('should parse inline block', function * () {
    yield (Parser.parseString('{#{block:context.foo.bar/}e}'));
    yield (Parser.parseString('{#{block:context.foo.bar}e}{#{/}}'));
  });

  it('should parse partial block', function * () {
    yield (Parser.parseString('{>{"path/to/partial":context.foo.bar/}e}'));
  });

  it('should parse loop block', function * () {
    yield (Parser.parseString('{@{context.foo.bar}e}{@{/}}'));
  });

  it('should parse conditional block', function * () {
    yield (Parser.parseString('{?{context.foo.bar}e}{?{~}}{?{/}}'));
  });

  it('should parse file', function * () {
    var source = __dirname + '/fixtures/template.coa.html';
    var parsed = yield (Parser.parseFile(source));

    //console.log(JSON.stringify(parsed, null, 2));

    // NOTE : by now, if it doesn't explode, we can assume with a certain
    //        degree of certainty, by now, that it has parsed successfully!

  });

});
