
var Engine = require('../../lib/engine');

describe('Test engine', function () {

  this.timeout(500);

  before(function () {

    Engine.config.paths = [__dirname + '/fixtures'];
    Engine.helpers.pageHeader = function * (stream, ctx, chunk, params) {
      stream.write('**HEADER** : ');
      stream.write(params.prefix || '');
      stream.write(' - ');
      stream.write(params.title || '');
    };

  });


  it('should render files', function * () {

    var html = yield Engine.render('template', {
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
    var html = yield Engine.render('template');

    //console.log(html);
  });

});
