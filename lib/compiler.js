

const NEWLINE = "\n";

const FN_PARAMS = 'p';
const FN_RENDERER = 'r';

const OBJ_STREAM = 's';
const OBJ_CONTEXT = 'c';
const OBJ_ENGINE = 'e';
const OBJ_BLOCKS = 'b';


var Compiler = module.exports;

var blockRenderer = {
  '&': processHelperRenderer,
  '#': processInlineBlockDeclare,
  '+': processInlineBlockRenderer,
  '>': processPartialRenderer,
  '@': processIteratorRenderer,
  '?': processConditionalRenderer
};


Compiler.compile = compile;

Object.freeze(Compiler);


function * compile(segment) {
  var compiledData = {
    segmentCount: 0,
    params: {},
    segments: {},
    renderers: {},
    inlineBlocks: {}
  };

  yield processSegment(compiledData, segment);

  //console.log(JSON.stringify(compiledData, null, 2));

  return 'function*_(' + OBJ_STREAM + ',' + OBJ_CONTEXT + ',' + OBJ_ENGINE + ',' + OBJ_BLOCKS + '){' +
           stringify(compiledData.params) +
           stringify(compiledData.renderers) +
           stringify(compiledData.inlineBlocks) +
           stringify(compiledData.segments) +
         '}';
};


function * processSegment(compiledData, segment) {
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
             (yield processTextBlock(compiledData, segValue, segKey, segment.segments))
          || (yield processBlock(compiledData, segValue, segKey, segment.segments))
          || (yield processContext(compiledData, segValue, segKey, segment.segments))
          || '');
        ++compiledData.segmentCount;
      }
    }
  }
};



function * processTextBlock(compiledData, segValue, segKey, segments) {
  if (typeof segValue === 'string') {
    return OBJ_STREAM + '.write(' + quote(segValue) + ');'
  }

  return false;
}

function * processBlock(compiledData, segValue, segKey, segments) {
  if (blockRenderer[segValue.type]) {
    return yield blockRenderer[segValue.type](compiledData, segValue, segKey, segments);
  } else {
    return false;
  }
}

function * processContext(compiledData, segValue, segKey, segments) {
  if (!segValue.type && segValue.context) {
    return OBJ_STREAM + '.write(yield(' + OBJ_ENGINE + '.format)(' + context(segValue) + '.data));';
  }
  return false;
}




function * processHelperRenderer(compiledData, segValue, segKey, segments) {
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
        paramsStr = paramsStr + quote(param) + ':' + OBJ_CONTEXT + '.getContext(' + quote(segValue.params[param].context) + ').data'
      }
    });

    compiledData.params[segKey] = 'function ' + paramsKey + '(' + OBJ_CONTEXT + '){return{' + paramsStr + '};}';
  }

  rendererKey = yield processRenderer(compiledData, segValue, segKey, segments, false);

  return 'yield(' + OBJ_ENGINE + '.helpers[' + quote(segValue.name) + '])(' +
    OBJ_STREAM + ',' + context(segValue) + ',' +
    (rendererKey && (rendererKey + '(' + OBJ_CONTEXT + ')') || 'null') + ',' +
    (paramsKey && (paramsKey + '(' + OBJ_CONTEXT + ')') || 'null') +
    ');'
}
function * processInlineBlockDeclare(compiledData, segValue, segKey, segments) {
  compiledData.inlineBlocks[segValue.name] = 'b[' + quote(segValue.name) + ']=' + (yield processRenderer(compiledData, segValue, segKey, segments, true)) + ';';
}
function * processInlineBlockRenderer(compiledData, segValue, segKey, segments) {
  return 'yield(b[' + quote(segValue.name) + ']' +
    '(' + context(segValue) + ').render)(0);';
}
function * processPartialRenderer(compiledData, segValue, segKey, segments) {
  return 'yield(' + OBJ_ENGINE + '.stream)(' + OBJ_STREAM + ',' + quote(segValue.literal) +
    ',' + context(segValue) + ',b);';
}
function * processIteratorRenderer(compiledData, segValue, segKey, segments) {
  var rendererKey = yield processRenderer(compiledData, segValue, segKey, segments, false);

  return 'yield(function(' + OBJ_CONTEXT + '){return function*(){' +
    'var i=' + OBJ_ENGINE + '.iterator(' + (segValue.literal && quote(segValue.literal) || 'null') + ',' + OBJ_CONTEXT + ');' +
    'while(i.next()){' +
      'yield(' + rendererKey + '(i.context)).render(0);' +
    '}' +
  '};})(' + context(segValue) + ');';
}
function * processConditionalRenderer(compiledData, segValue, segKey, segments) {
  var rendererKey = yield processRenderer(compiledData, segValue, segKey, segments, false);

  return 'yield(' + rendererKey + '(' + OBJ_CONTEXT + ').render)(' + context(segValue) + '.hasData?0:1);';
}



function * processRenderer(compiledData, segValue, segKey, segments, contextSwitchable) {
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

        yield processSegment(rendererCompiledData, segValue);

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
    if (contextSwitchable && segValue.context) {
      compiledData.renderers[segKey] = 'var ' + rendererKey + '=(function(_' + OBJ_CONTEXT + '){' +
        //'console.log("Current context:",JSON.stringify(_' + OBJ_CONTEXT + ',null,2));' +
        'return function(' + OBJ_CONTEXT + '){' +
          OBJ_CONTEXT + '=_' + OBJ_CONTEXT + '.push(' + OBJ_CONTEXT + '.data);' +
          //'console.log("Inner context:",JSON.stringify(' + OBJ_CONTEXT + ',null,2));' +
          'return ' + OBJ_ENGINE + '.renderer([function*(){' +
            rendererStrArr.join('},function*(){') + '}]);' +
          '}' +
        '})(' + context(segValue) + ');';
    } else {
      compiledData.renderers[segKey] = 'function ' + rendererKey + '(' + OBJ_CONTEXT + '){' +
        'return ' + OBJ_ENGINE + '.renderer([function*(){' +
          rendererStrArr.join('},function*(){') + '}]);' +
        '}';
    }
  }

  return rendererKey;
}


function context(segValue) {
  return OBJ_CONTEXT + (segValue.context && segValue.context !== '.' ? '.getContext(' + quote(segValue.context || '.') + ')' : '');
}


/**
Convert an object into a string. Iterate over all values and concatenate
them with new line characters, ignoring all empty strings.
*/
function stringify(obj, lineLength) {
  var str = '';
  var c = 0;
  lineLength = lineLength || 10;
  for (var key in obj) {
    if (obj[key]) {
      c = c + obj[key].length;
      //console.log("```" + obj[key] + "```");
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
