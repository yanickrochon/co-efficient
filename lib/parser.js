
var fs = require('co-fs');
var Parser = module.exports;

Parser.parseFile = parseFile;
Parser.parseString = parseString;

Object.defineProperties(Parser, {
 'TOKEN_REGEXP': {
    enumerable: true,
    configurable: false,
    writable: false,
    // TODO : fix this : could mismatch on arg="}" (even change regex to a real processor...)
    value: /\{([#@?>+])?\{(?:([\w\.]+)|(\/)|("(?:[^"]+)"))(?::([\w\.]+))?(?:\s*([^}]*?)?)(\/)?\}([\w]*)?\}/g
  },
  'PARAMS_REGEXP': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: /(\w+)\s*=\s*(.*?)(?:\s+|$)/g
  }
});



function * parseFile(file) {
  return yield parseString(yield fs.readFile(file, 'utf-8'));
}


function * parseString2(str) {
  var len = str.length;
  var state = {
    depth: [],            // stack of blocks

    openBlock: false,     // is this a block opening?
    inBlock: false,       // are we scanning a block?
    inContext: false,     // are we scanning context?
    inParam: false,       // are we scanning params?
    inParamValue: false,  // are we scanning param value?
    closeBlock: false,    // is this a block closing?

    line: 1,              // current line
    col: 0,               // current column
    offset: 0             // current offset
  };
  var segment = {
    block: 'root',
    segments: []
  };
  var subSegment;

  while (offset < len) {






  }
}










function * parseString(str) {
  var re = new RegExp(Parser.TOKEN_REGEXP);
  var offset = 0;
  var m;
  var text;
  var stack = [];
  var segment = {
    block: 'root',
    segments: []
  };
  var subSegment;

  //console.log("Matching", str, str.length);

  while ((m = re.exec(str)) != null) {
    if (m.index === re.lastIndex) {
        re.lastIndex++;
    }

    text = str.substr(offset, m.index - offset);

    if (text.length) {
      //console.log("Text", offset, '"' + text + '"');
      segment.segments.push(text);
    }

    if (!m[3] || m[3].charAt(0) !== '/') {   // open block
      if (m[1]) {  // declared block
        //console.log("Open Match", m);

        subSegment = {
          block: {
            type: m[1],
            name: m[2],
            context: m[4] || '.',
            params: yield parseParams(m[6])
          },
          segments: []
        };

        segment.segments.push(subSegment);
        stack.push(segment);

        segment = subSegment;
      } else {    // context
        //console.log("context", m);

        segment.segments.push({
          context: m[4] || '.'
        });
      }
    } else {
      //console.log("Close Match", m);

      segment = stack.pop();
    }

    offset = m.index + m[0].length;
  }

  text = str.substr(offset);

  if (text.length) {
    //console.log("Text", offset, '"' + text + '"');
    segment.segments.push(text);
  }

  //console.log(segment);
  //console.log(stack);

}


/**
Convert a string like 'arg1="foo" arg2=bar' into { arg1: 'foo', arg2 = { context: 'bar' } }
*/
function * parseParams(paramStr) {
  var re = new RegExp(Parser.PARAMS_REGEXP);
  var m;
  var key;
  var value;
  var n;
  var params = {};

  //console.log("Parsing params", paramStr);

  while ((m = re.exec(paramStr)) != null) {
    if (m.index === re.lastIndex) {
        re.lastIndex++;
    }

    key = m[1];
    value = m[2];

    if (value.charAt(0) !== '"') {
      value = { context: value };
    } else {    // strip leading/trailing quotes
      value = value.replace(/^["\']/, '').replace(/["\']$/, '');

      n = parseFloat(value);
      if (!isNaN(n)) {
        value = n;
      }
    }

    if (params[key]) {
      if (!params[key] instanceof Array) {
        params[key] = [ params[key] ];
      }

      params[key].push(value);
    } else {
      params[m[1]] = value;
    }

  }

  //console.log("Param", params);

  return params;
}
