
//var Engine = require('../../lib/engine');
var Compiler = require('../../lib/compiler');

describe('Test compiler', function () {

  var allTextSegment = {
    block: 'root',
    segments: [
      'Hello', ' ', { context: 'name' }, ' !'
    ]
  };


  it('should compile texts', function * () {

    var template = yield (Compiler.compile)(allTextSegment);

    console.log("template", template);


  });


});
