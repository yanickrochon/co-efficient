
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
      }
    });

    //console.log(html);

  });

  it('should render file with no data', function * () {
    var html = yield engine.render('template');

    //console.log(html);
  });

});