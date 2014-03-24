
//var Engine = require('../../lib/engine');
var Compiler = require('../../lib/compiler');

describe('Test compiler', function () {

  var compiledSource = __dirname + '/fixtures/template.compiled.coeft';
  var compiledData;

  before(function () {
    compiledData = require(compiledSource);
  });


  it('should compile texts', function * () {
    var compiled = yield (Compiler.compile)(compiledData);


  });


});
