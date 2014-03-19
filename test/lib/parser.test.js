
var Parser = require('../../lib/parser');


describe('Test Parser', function () {

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

  it('should parse string', function * () {
    yield (Parser.parseString('Hello {#{span:foo class="bold" id="foo" index="2"}} {{name}} {#{/}} !'));
    // hello <span class="bole" id="foo" index=2> ?? </span> !
  });


});
