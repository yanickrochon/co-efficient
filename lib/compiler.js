

const NEWLINE = "\n";

const FN_PARAMS = 'params';
const FN_RENDERER = 'renderer';

const OBJ_STREAM = 's';
const OBJ_CONTEXT = 'c';
const OBJ_ENGINE = 'e';


var Compiler = module.exports;

var blockRenderer = {
  '&': processHelperRenderer,
  '#': processInlineBlockDeclare,
  '+': processInlineBlockRenderer,
  '>': processPartialRenderer,
  '@': processIteratorRenderer,
  '?': processConditionalRenderer
};


Compiler.compile = function * (segment, engine) {
  var compiledData = {
    segmentCount: 0,
    params: {},
    segments: {},
    renderers: {},
    inlineBlocks: {}
  };

  yield processSegment(compiledData, segment, engine);

  //console.log(JSON.stringify(compiledData, null, 2));

  return 'function*_(' + OBJ_STREAM + ',' + OBJ_CONTEXT + ',' + OBJ_ENGINE + '){' +
           stringify(compiledData.params) +
           stringify(compiledData.renderers) +
           stringify(compiledData.segments) +
         '}';
};


//function * optimize(compiledData, engine) {
//  return '';
//}


function * processSegment(compiledData, segment, engine) {
  var segKeys;
  var segKey;
  var segValue;
  var i;
  var len;

  if (segment.segments) {
    segKeys = Object.keys(segment.segments);
    for (i = 0, len = segKeys.length; i < len; ++i) {
      segKey = segKeys[i];
      segValue = segment.segments[segKey];

      if (!segValue.headSegment) {  // only process headSegments
        //console.log("**Segment", typeof segValue, segValue, '**');
        compiledData.segments[segKey] = (
             (yield processTextBlock(compiledData, segValue, segKey, segment.segments, engine))
          || (yield processBlock(compiledData, segValue, segKey, segment.segments, engine))
          || (yield processContext(compiledData, segValue, segKey, segment.segments, engine))
          || '');
        ++compiledData.segmentCount;
      }
    }
  }
};



function * processTextBlock(compiledData, segValue, segKey, segments, engine) {
  if (typeof segValue === 'string') {
    return OBJ_STREAM + '.write(' + quote(segValue) + ');'
  }

  return false;
}

function * processBlock(compiledData, segValue, segKey, segments, engine) {
  if (blockRenderer[segValue.type]) {
    return yield blockRenderer[segValue.type](compiledData, segValue, segKey, segments, engine);
  } else {
    return false;
  }
}

function * processContext(compiledData, segValue, segKey, segments, engine) {
  if (!segValue.type && segValue.context) {
    return OBJ_STREAM + '.write(yield(' + OBJ_ENGINE + '.formatData)(' + OBJ_CONTEXT + '.getContext(' + quote(segValue.context) + ').data));';
  }
  return false;
}




function * processHelperRenderer(compiledData, segValue, segKey, segments, engine) {
  var paramsKey;
  var paramsStr;
  var rendererKey;

  if (segValue.params) {
    paramsStr = '';
    paramsKey = FN_PARAMS + segKey;

    Object.keys(segValue.params).forEach(function (param) {
      if (paramsStr.length) {
        paramsStr = paramsStr + ',';
      }

      if (typeof segValue.params[param] === 'string') {
        paramsStr = paramsStr + quote(param) + ':' + quote(segValue.params[param]);
      } else {
        paramsStr = paramsStr + quote(param) + ':' + OBJ_CONTEXT + '.getContext(' + quote(segValue.params[param].context) + ')'
      }
    });

    compiledData.params[segKey] = 'function ' + paramsKey + '(' + OBJ_CONTEXT + '){return{' + paramsStr + '};}';
  }


  rendererKey = yield processRenderer(compiledData, segValue, segKey, segments, engine);

  return 'yield(' + OBJ_ENGINE + '.helpers[' + quote(segValue.name) + '])(' +
    '' + OBJ_CONTEXT + '.getContext(' + quote(segValue.context || '.') + '),' +
    (rendererKey && (rendererKey + '(' + OBJ_CONTEXT + ')') || 'null') + ',' +
    (paramsKey && (paramsKey + '(' + OBJ_CONTEXT + ')') || 'null') +
    ');'
}
function * processInlineBlockDeclare(compiledData, segValue, segKey, segments, engine) {
  compiledData.inlineBlocks[segValue.name] = yield processRenderer(compiledData, segValue, segKey, segments, engine);
}
function * processInlineBlockRenderer(compiledData, segValue, segKey, segments, engine) {
  return 'yield(' + compiledData.inlineBlocks[segValue.name] +
    '(' + OBJ_CONTEXT + '.getContext(' + quote(segValue.context || '.') + ')).render)(0);';
}
function * processPartialRenderer(compiledData, segValue, segKey, segments, engine) {
  return 'yield(' + OBJ_ENGINE + '.stream)(' + OBJ_STREAM + ',' + quote(segValue.literal) +
    ',' + OBJ_CONTEXT + '.getContext(' + quote(segValue.context || '.') + '));';
}
function * processIteratorRenderer(compiledData, segValue, segKey, segments, engine) {
  var rendererKey = yield processRenderer(compiledData, segValue, segKey, segments, engine);

  return 'yield(function*(' + OBJ_CONTEXT + '){' +
    'var iterator=' + OBJ_ENGINE + '.getIterator(' + (segValue.literal && quote(segValue.literal) || 'null') + ',' + OBJ_CONTEXT + ');' +
    'while(iterator.next()){' +
      'yield ' + rendererKey + '(iterator.context);' +
    '}' +
  '})(' + OBJ_CONTEXT + '.getContext(' + quote(segValue.context || '.') + '));';
}
function * processConditionalRenderer(compiledData, segValue, segKey, segments, engine) {
  var rendererKey = yield processRenderer(compiledData, segValue, segKey, segments, engine);

  return 'yield(function*(' + OBJ_CONTEXT + '){' +
      'yield(' + rendererKey + '(' + OBJ_CONTEXT + ').render)(~~' + OBJ_CONTEXT + '.data);' +
    '});';
}



function * processRenderer(compiledData, segValue, segKey, segments, engine) {
  var rendererKey;
  var rendererCompiledData;
  var rendererStrArr = [];

  yield (function * (segValue) {
    var moreRendererData = true
    while (moreRendererData) {
      if (segValue.segments) {
        rendererKey = rendererKey || (FN_RENDERER + segKey);

        rendererCompiledData = {
          segmentCount: 0,
          params: compiledData.params,
          segments: {},
          renderers: compiledData.renderers,
          inlineBlocks: compiledData.inlineBlocks
        };

        yield processSegment(rendererCompiledData, segValue, engine);

        rendererStrArr.push(stringify(rendererCompiledData.segments));
      }

      if (segValue.nextSegment) {
        segValue = segments[segValue.nextSegment];
      } else {
        moreRendererData = false;
      }
    }
  })(segValue);

  if (rendererStrArr.length) {
    compiledData.renderers[segKey] = 'function ' + rendererKey + '(' + OBJ_CONTEXT + '){' +
      'return ' + OBJ_ENGINE + '.createChunkRenderer([function*(){' +
        rendererStrArr.join('},function*(){') + '}]);' +
    '}';
  }

  return rendererKey;
}



/**
Convert an object into a string. Iterate over all values and concatenate
them with new line characters, ignoring all empty strings.
*/
function stringify(obj, lineLength) {
  var str = '';
  var c = 0;
  lineLength = lineLength || 80;
  for (var key in obj) {
    if (obj[key]) {
      c = c + obj[key].length;
      str = str + obj[key];
      if (c > lineLength && obj[key].length > (lineLength / 3)) {
        str = str + NEWLINE;
        c = 0;
      }
    }
  }
  return str;
}

function quote(s) {
  /*
   * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
   * string literal except for the closing quote character, backslash,
   * carriage return, line separator, paragraph separator, and line feed.
   * Any character may appear in the form of an escape sequence.
   *
   * For portability, we also escape escape all control and non-ASCII
   * characters. Note that "\0" and "\v" escape sequences are not used
   * because JSHint does not like the first and IE the second.
   */
  return '"' + s
    .replace(/\\/g, '\\\\')  // backslash
    .replace(/"/g, '\\"')    // closing quote character
    .replace(/\x08/g, '\\b') // backspace
    .replace(/\t/g, '\\t')   // horizontal tab
    .replace(/\n/g, '\\n')   // line feed
    .replace(/\f/g, '\\f')   // form feed
    .replace(/\r/g, '\\r')   // carriage return
    .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
    + '"';
}
