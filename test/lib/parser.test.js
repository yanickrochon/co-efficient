
var Parser = require('../../lib/parser');


describe('Test Parser', function () {

  /*
  it('should match token patterns', function () {
    [
      '{{context}}',
      '{{context.path}}',
      '{#{block/}}',
      '{#{block}}',
      '{#{block:context.path}}',
      '{@{context/}}',
      '{+{context arg="foo"}}',
      '{+{context.path arg=foo/}}',
      '{>{"path/to/view"/}}',
      '{#{block:context.path.to.sub.context arg=foo}abc}',
      '{@{"foo":context arg1=1 arg2=2}}',
      '{@{/}}'
    ].forEach(function (str) {
      var matches = str.match(Parser.TOKEN_REGEXP);

      //console.log("** Match", str, "\n", matches);
      matches.should.be.an.Array;

    });
  });
  */

  it('should parse context', function * () {
    var parsed = yield (Parser.parseString('{{foo.bar}}'));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.not.have.ownProperty('type');
    parsed.segments[0].should.have.ownProperty('context').and.equal('foo.bar');
  });

  it('should parse block', function * () {
    var parsed = yield (Parser.parseString('{#{block/}}'));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('closing').and.be.true;
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.not.have.ownProperty('context');
  });

  it('should parse block with context', function * () {
    var parsed = yield (Parser.parseString('{#{block:foo.bar/}}'));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('closing').and.be.true;
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.have.ownProperty('context').and.equal('foo.bar');
  });

  it('should parse block with 1 context param', function * () {
    var parsed = yield (Parser.parseString('{#{block arg=foo/}}'));

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
    var parsed = yield (Parser.parseString('{#{block arg="foo"/}}'));

    parsed.should.have.ownProperty('type').and.equal('root');
    parsed.should.have.ownProperty('segments').and.have.lengthOf(1);
    parsed.segments[0].should.have.ownProperty('type').and.equal('#');
    parsed.segments[0].should.have.ownProperty('closing').and.be.true;
    parsed.segments[0].should.have.ownProperty('name').and.equal('block');
    parsed.segments[0].should.not.have.ownProperty('context');
    parsed.segments[0].should.have.ownProperty('params').and.be.an.Object;
    parsed.segments[0].params.should.have.ownProperty('arg').and.equal('foo');
  });

  /*
  it('should parse string', function * () {

    yield (Parser.parseString('Hello {#{span:foo class="bold" id="foo" index="2"}} {{name}} {#{/}} !'));
    // hello <span class="bole" id="foo" index=2> ?? </span> !
  });
  */


});
