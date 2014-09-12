
describe('Test Custom block rendering', function () {

  var Engine = require('../../lib/engine');
  var Parser = require('../../lib/parser');
  var Compiler = require('../../lib/compiler');

  it('should render self-closing block' /*, function * () {
    var engine;
    var text;

    function * blockCompiler(cData, sValue, sKey, segments) {
      var sContext = this.context(sValue.context);
      var paramsKey = yield this.processParams(cData, sValue, sKey);
      var jsStr = this.OBJ_STREAM + '.write(yield ' + this.OBJ_ENGINE + '.m(' + sContext  + (paramsKey && (',' + paramsKey + '(' + sContext + ')') || '') + '));'

      return this.modifier(jsStr, segments[sKey]);
    }

    function block(ctx, options) {
      return function * m(ctx, params) {
        //console.log("**** PARAMS", params, "OPTIONS", options, "VALUE", ctx.data);
        return params && params.foo || 'NOVAL';
      };
    }
    Parser.registerBlockRule('m', {
      openingContent: 'inParams',
      validContent: { 'params': true },
      maxSiblings: 0,
      selfClosing: true,
      closeBlock: true
    });
    Compiler.registerBlockRenderer('m', blockCompiler);

    Engine.once('engineCreated', function (engine) {
      engine.on('internalEngineCreated', function internalEngineCreated(internalEngine, data) {
        // If traslateOptions is set when passing data to the render function of the
        // engine, then it will be used as moment default options for the locale
        internalEngine.m = block(data && data.translateOptions);
      });
    });

    engine = new Engine();

    text = yield engine.renderText('{m{foo="bar" /}}');
    text.should.equal('bar');

    text = yield engine.renderText('{m{/}}');
    text.should.equal('NOVAL');

    text = yield engine.renderText('{m{}}{m{/}}');
    text.should.equal('NOVAL');

    text = yield engine.renderText('{m{/}}{m{/}}');
    text.should.equal('NOVALNOVAL');

    //try {
    //} catch (e) {
    //  text = e;
    //} finally {
    //  text.should.be.an.Error;
    //  console.log(text);
    //}

  }*/);

});
