
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


  function testParseAllAsync(success, failures, done) {
    var testComplete = 0;
    var templateCount = 0;

    function checkTestComplete() {
      testComplete++;
      if (testComplete >= templateCount) {
        done();
      }
    }

    function runTests(templates, shouldThrow) {
      for (var i = 0; i < templates.length; ++i) {
        (function (template) {
          co(function * () {
            return yield (Parser.parseString(template));
          })(function (err, parsed) {
            if (shouldThrow) {
              if (!err) console.log("FAIL", template, parsed);
              err.should.be.an.Error;
            } else {
              if (err) console.log("FAIL", template, JSON.stringify(err, null, 2));
              assert.equal(err, null);
            }
            checkTestComplete();
          });
        })(templates[i]);
      }
    }

    if (success && success.length) {
      templateCount += success.length;
      runTests(success, false);
    }

    if (failures && failures.length) {
      templateCount += failures.length;
      runTests(failures, true);
    }

    if (!templateCount) {
      done();
    }

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
    testParseAllAsync(null, [
      '{#{/}}',
      '{#{block/}}{#{/}}',
      '{#{block}}{#{/}}{#{/}}'
    ], done);

    this.timeout(500);
  });

  it('should fail with invalid next block segment', function (done) {
    testParseAllAsync(null, [
      '{#{block}}{?{~}}{#{/}}',
      '{#{block}}{#{"foo"~}}{#{/}}'
    ], done);

    this.timeout(500);
  });

  it('should fail because of missing, or invalid closing block', function (done) {
    testParseAllAsync(null, [
      '{#{block}}',
      '{#{block}}{+{block}}',
      '{#{block}} {{name}} {@{otherblock}}',
      '{#{block}}{@{/}}'
    ], done);

    this.timeout(500);
  });

  it('should escape text', function * () {
    collectValues((yield (Parser.parseString('\\\\n'))).segments)[0].should.equal('\\n');
    collectValues((yield (Parser.parseString('\\{'))).segments)[0].should.equal('{');
  });

  it('should fail parsing invalid blocks', function (done) {
    testParseAllAsync(null, [
      '{a{block/}}',
      '{.{block/}}',
      '{"{block/}}',
      '{ab{block/}}',
      '{,{block/}}',
      '{"{block/}}',
      '{ {block/}}',
      '{*{block/}}',
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
      '{?{"',
      '{/{foo/}}',
      '{¼{/}}',
      '{}'
    ], done);

    this.timeout(500);
  });

  it('should fail with invalid escaping', function (done) {
    testParseAllAsync(null, [
      '{\\{block/}}',
      '{#\\{block/}}',
      '{#{b\\lock/}}',
      '{#b{block\\:/}}',
      '{#{block:\\/}}',
      '{#{block:foo\\/}}',
      '{#{block arg\\=foo/}}',
      '{#{block:foo arg\\=foo/}}',
      '{#{block:foo arg="foo\\"/}}'
    ], done);

    this.timeout(500);
  });

  it('should escape quoted text', function (done) {
    testParseAllAsync([
      '{>{"part\\ial"/}}',
      '{>{"part\\\\ial"/}}',
      '{>{"part\\{ial"/}}',
      '{>{"part\\"ial"/}}',
      '{>{"part\\:ial"/}}',
      '{>{"part\\ ial"/}}',
      '{>{"part\\/ial"/}}',
      '{>{"part\\~ial"/}}',
      '{&{helper arg1="\\\\"/}}',
      '{&{helper arg2="\\/"/}}',
      '{&{helper arg3="\\="/}}',
      '{&{helper arg3="\\}"/}}',
      '{&{helper arg3="\\}"}}{&{/}}',
      '{&{helper arg4="/"/}}',
      '{&{helper arg5="="/}}',
      '{&{helper arg6="="   arg7=foo   arg8=""/}}'
    ], null, done);

    this.timeout(500);
  });

  it('should parse flags', function (done) {
    testParseAllAsync([
      '{#{block/}e}',
      '{#{block/}x}',
      '{#{block/}eU}',
    ], null, done);

    this.timeout(500);
  });

  it('should fail with invalid flags', function (done) {
    testParseAllAsync(null, [
      '{#{block/}T}',
      '{#{block/}eO}',
    ], done);

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
    yield (Parser.parseString('{?{"[.] == true"}e}{?{~}}{?{/}}'));
    yield (Parser.parseString('{?{"[..foo.bar] === \'bar\'":.}e}{?{~}}{?{/}}'));
  });

  it('should parse comments block', function * () {
    yield (Parser.parseString('{/{"Literal comments with \\" quotes"/}}'));
    yield (Parser.parseString('{/{}}Multiline\nComments\nare\nice{/{/}}'));
  });

  it('should parse file', function * () {
    var source = __dirname + '/fixtures/template.coeft.html';
    var parsed = yield (Parser.parseFile(source));

    //console.log(JSON.stringify(parsed, null, 2));

    // NOTE : by now, if it doesn't explode, we can assume with a certain
    //        degree of certainty, that it has parsed successfully

  });

  describe('custom blocks', function () {

    it('should (un)register self closing, no close block', function (done) {

      Parser.registerBlockRule('t', { 
        openingContent: 'inName',
        validContent: { 'name': true },
        maxSiblings: false,
        selfClosing: true,
        closeBlock: false
      });

      testParseAllAsync([
        '{t{foo /}}',
        '{t{_ /}}'
      ], [
        '{t{foo}}{t{/}}',
        '{t{}}',
        '{t{/}}',
        '{t{}}{t{/}}',
        '{t{foo}}{t{~}}{t{/}}'
      ], function () {
        Parser.unregisterBlockRule('t');
        done();
      });

    });

    it('should (un)register with close block, non self closing', function (done) {

      Parser.registerBlockRule('t', { 
        openingContent: 'inName',
        validContent: { 'name': true },
        maxSiblings: false,
        selfClosing: false,
        closeBlock: true
      });

      testParseAllAsync([
        '{t{foo}}{t{/}}',
        '{t{_   }}{t{/}}'
      ], [
        '{t{foo/}}',
        '{t{}}',
        '{t{foo     /}}',
        '{t{foo}}{t{~}}{t{/}}'
      ], function () {
        Parser.unregisterBlockRule('t');
        done();
      });

    });

    it('should (un)register with close block, max 2 siblings', function (done) {

      Parser.registerBlockRule('t', { 
        openingContent: 'inName',
        validContent: { 'name': true },
        maxSiblings: 2,
        selfClosing: true,
        closeBlock: true
      });

      testParseAllAsync([
        '{t{foo /}}',
        '{t{foo}}{t{/}}',
        '{t{_   }}{t{/}}',
        '{t{foo}}{t{~}}{t{/}}'
      ], [
        '{t{foo}}{t{~}}{t{~}}{t{/}}',
        '{t{foo}}{t{~}}{t{~}}{t{~}}{t{/}}'
      ], function () {
        Parser.unregisterBlockRule('t');
        done();
      });

    });



    it('should fail with invalid block identifier', function () {

      [
        undefined, null, true, false, {}, [], function () {}, -1, 0, 1, /./,
        '{', '(', '\\'
      ].forEach(function (block) {

        +function () {
          Parser.registerBlockRule(block, {});
        }.should.throw();

        +function () {
          Parser.unregisterBlockRule(block, {});
        }.should.throw();

      });

    });

  });

  describe('custom modifiers', function () {

    it('should (un)register custom modifier', function () {

      [
        't', 'T', 't', 'T'   // repeat to make sure we clean up properly

      ].forEach(function (modifier) {
        Parser.registerBlockModifier(modifier);
        Parser.unregisterBlockModifier(modifier);
      });
      
    });

    it('should fail', function () {

      [
        undefined, null, true, false, {}, [], function () {}, -1, 0, 1, /./,
        '{', '}'
      ].forEach(function (modifier) {
        +function () {
          Parser.registerBlockModifier(modifier);
        }.should.throw();        
        +function () {
          Parser.unregisterBlockModifier(modifier);
        }.should.throw();        
      });

    });

  });

});
