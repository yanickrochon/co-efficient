
//var Engine = require('../../lib/engine');
var Compiler = require('../../lib/compiler');

describe('Test compiler', function () {

  var compiledSource = __dirname + '/fixtures/template.compiled.coa';
  var compiledData;

  before(function () {
    compiledData = require(compiledSource);
  });


  it('should compile texts', function * () {

    var template = yield (Compiler.compile)(compiledData);

    console.log("template", template.length, template);


  });


});
