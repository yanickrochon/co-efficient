
var co = require('co');
var Parser = require('../../lib/parser');


describe('Test Parser', function () {

  it('should parse text only', function * () {
    var source = 'Hello world!';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.be.a.String;

    (yield (Parser.parseString('Hello}'))).segments[0].should.equal('Hello}');
  });

  it('should parse context', function * () {
    var source = '{{foo.bar}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.not.have.ownProperty('type');
    parsed.segments[0].should.have.ownProperty('context').and.equal('foo.bar');
  });

  it('should parse more contexts', function * () {
    var source = '{{hello}} {{foo.bar}}{{buz}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(4);
    parsed.segments[0].should.have.ownProperty('context').and.equal('hello');
    parsed.segments[1].should.be.a.String.and.equal(' ');
    parsed.segments[2].should.have.ownProperty('context').and.equal('foo.bar');
    parsed.segments[3].should.have.ownProperty('context').and.equal('buz');
  });

  it('should parse block', function * () {
    var source = '{#{block/}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('closing').and.be.true;
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.not.have.ownProperty('context');
  });

  it('should parse block with context', function * () {
    var source = '{#{block:foo.bar/}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('closing').and.be.true;
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.have.ownProperty('context').and.equal('foo.bar');
  });

  it('should parse block with 1 context param', function * () {
    var source = '{#{block arg=foo/}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('closing').and.be.true;
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.not.have.ownProperty('context');
    parsed.segments[0].should.have.ownProperty('params').and.be.an.Object;
    parsed.segments[0].params.should.have.ownProperty('arg').and.have.ownProperty('context').and.equal('foo');
  });

  it('should parse block with 1 literal param', function * () {
    var source = '{#{block arg="foo"/}}';
    var parsed = yield (Parser.parseString(source));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('closing').and.be.true;
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.not.have.ownProperty('context');
    parsed.segments[0].should.have.ownProperty('params').and.be.an.Object;
    parsed.segments[0].params.should.have.ownProperty('arg').and.equal('foo');
  });

  it('should parse more blocks', function * () {
    var source = '{#{block/}} {+{block/}}{+{block/}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(4);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.not.have.ownProperty('context');
    parsed.segments[1].should.be.a.String.and.equal(' ');
    parsed.segments[2].should.have.ownProperty('type').and.equal('+');
    parsed.segments[2].should.have.ownProperty('name').and.equal('block');
    parsed.segments[2].should.not.have.ownProperty('context');
    parsed.segments[3].should.have.ownProperty('type').and.equal('+');
    parsed.segments[3].should.have.ownProperty('name').and.equal('block');
    parsed.segments[3].should.not.have.ownProperty('context');
  });

  it('should parse nested blocks', function * () {
    var source = 'Hel{#{block}}lo {{name}} ?{#{/}} !';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(3);
    parsed.segments[0].should.be.a.String.and.equal('Hel');
    parsed.segments[1].should.have.ownProperty('type').and.equal('#');
    parsed.segments[1].should.have.ownProperty('name').and.equal('block');
    parsed.segments[1].should.not.have.ownProperty('context');
    parsed.segments[1].should.have.ownProperty('segments').and.have.lengthOf(3);
    parsed.segments[1].segments[0].should.be.a.String.and.equal('lo ');
    parsed.segments[1].segments[1].should.not.have.ownProperty('type');
    parsed.segments[1].segments[1].should.have.ownProperty('context').and.equal('name');
    parsed.segments[1].segments[2].should.be.a.String.and.equal(' ?');
    parsed.segments[2].should.be.a.String.and.equal(' !');
  });

  it('should parse multiline templates', function * () {
    var source = 'Hello world!\n  {#{block/}}';
    var parsed = yield (Parser.parseString(source));

    //console.log(JSON.stringify(parsed, null, 2));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(2);
    parsed.segments[0].should.be.a.String.and.equal('Hello world!\n  ');
    parsed.segments[1].should.have.ownProperty('type').and.equal('#');
    parsed.segments[1].should.have.ownProperty('name').and.equal('block');
    parsed.segments[1].should.have.ownProperty('line').and.equal(2);
    parsed.segments[1].should.have.ownProperty('col').and.equal(2);
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
    (yield (Parser.parseString('\\\\n'))).segments[0].should.equal('\\n');
    (yield (Parser.parseString('\\{'))).segments[0].should.equal('{');
  });

  it('should only parse valid blocks', function (done) {
    var sources = [
      '{&{block/}}',
      '{#{block/}}',
      '{+{block/}}',
      '{>{block/}}',
      '{@{block/}}',
      '{?{block/}}'
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
      '{#{foo:}}',
      '{{:foo}}',
      '{}{:foo}}',
      '{#{}}',
      '{{}}',
      '{#{block arg=foo"bar/}}',
      '{#{block arg"=foo/}}',
      '{#{block arg==foo/}}',
      '{#{block arg="foo"',
      '{#{block arg="foo"x',
      '{#{block arg5/}}'
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
        return yield (Parser.parseString(sources[i]));
      })(function (err, parsed) {
        err.should.be.an.Error;
        checkTestComplete();
      });
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
      co(function * () {
        return yield (Parser.parseString(sources[i]));
      })(function (err) {
        err.should.be.an.Error;
        checkTestComplete();
      });
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
      '{#{block arg1="\\\\"/}}',
      '{#{block arg2="\\/"/}}',
      '{#{block arg3="\\="/}}',
      '{#{block arg3="\\}"/}}',
      '{#{block arg3="\\}"}}{#{/}}',
      '{#{block arg4="/"/}}',
      '{#{block arg5="="/}}',
      '{#{block arg6="="   arg7=foo   arg8=""/}}'
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

  it('should parse inline block');

  it('should parse partial block');

  it('should parse loop block');

  it('should parse conditional block');


  it('should parse file', function * () {
    var source = __dirname + '/fixtures/template.coa.html';
    var parsed = yield (Parser.parseFile(source));

    console.log(JSON.stringify(parsed, null, 2));

  });

});
