
var fs = require('co-fs');
var Parser = module.exports;

Parser.parseFile = parseFile;
Parser.parseString = parseString2;

Parser.exceptions = {
  ParseError: ParseError
};


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
  var buffer = '';
  var state = {
    segmentStack: [],     // stack of segments

    // The following string represents the various state flags
    //
    //   {openBlock{inBlock:inContext inParam=inParamValue inParam="inQuote"}closeBlock}
    //

    openBlock: false,     // is this a block opening?
    closeBlock: false,    // is this a block closing?
    inBlock: false,       // are we scanning a block's name?
    inContext: false,     // are we scanning context?
    inParam: false,       // are we scanning params?
    inParamValue: false,  // are we scanning param value?
    inQuote: false,       // are we between quotes?
    escaped: false,       // is the current character escaped?

    line: 1,              // current line
    col: 0,               // current column
    offset: 0,            // current offset

    segment: {
      block: 'root',
      line: 1,
      col: 0,
      segments: []
    }
  };

  Object.defineProperties(state, {
   'available': {
      get: function () { return this.offset < len; }
    },

    'nextChar': {
      get: function () {
        var c;
        this.col++;
        while ((c = str.charAt(this.offset++)) === "\r") {
          this.col++;
        }
        while ((c = str.charAt(this.offset++)) === "\n") {
          this.line++;
          this.col = 0;
        }
        return c;
      }
    },

    'pushBuffer': {
      value: function (c) {
        if (c !== undefined) {
          buffer += c;
          console.log("#PUSHING", c, '(buffer =', buffer, ') from segment', this.segment.name);
        }
      }
    },

    'hasBufferContent': {
      get: function () {
        return buffer.length;
      }
    },

    'flushBuffer': {
      value: function () {
        var buf = buffer;
        buffer = '';
        console.log("#FLUSHING", buf);
        return buf;
      }
    },

    'nearText': {
      get: function () {
        return str.substr(Math.max(this.offset - 10, 0), 24);
      }
    }
  });

  yield readText(state);

  if (state.available) {
    throw new ParseError('Parsing error', state, true);
  } else if (state.segmentStack.length) {
    var lastSegment = state.segmentStack[state.segmentStack.length - 1];
    throw new ParseError('Missing closing block for ' + lastSegment.type, state);
  }
}

/**
Read text segment
*/
function * readText(state) {
  var c;

  while (state.available) {
    switch (c = state.nextChar) {
    case '\\':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else {
        state.escaped = true;
      }
      break;
    case '{':
      if (!state.escaped) {
        if (state.hasBufferContent) {
          state.segment.segments.push(state.flushBuffer());
        }
        yield readBlock(state);
      } else {
        state.escaped = false;
        state.pushBuffer(c);
      }
      break;
    default:
      state.escaped = false;
      state.pushBuffer(c);
      break;
    }
  }

  if (state.hasBufferContent) {
    state.segment.segments.push(state.flushBuffer());
  }
}


function * readBlock(state) {
  var segment = {
    line: state.line,
    col: state.col
  };

  state.openBlock = true;

  while (state.available) {
    switch (c = state.nextChar) {
      case '\\':
        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (!state.inQuote || state.openBlock || state.inBlock || state.inContext) {
          throw new ParseError('Unexpected \\', state, true);
        } else {
          state.escaped = true;
        }
        break;
      case '{':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.openBlock) {
          state.openBlock = false;
          state.inBlock = true;

          if (state.hasBufferContent) {
            segment.type = state.flushBuffer();
          }
        } else {
          throw new ParseError('Unexpected {', state, true);
        }
        break;
      case '"':
        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inBlock) {
          if (state.inQuote) {
            state.inQuote = false;
            state.inBlock = false;
            segment.literal = state.flushBuffer();
          } else if (!state.hasBufferContent) {
            state.inQuote = true;
          } else {
            throw new ParseError('Unexpected "', state, true);
          }
        } else {
          throw new ParseError('Unexpected "', state, true);
        }
        break;
      case ':':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inBlock) {
          state.inBlock = false;
          state.inContext = true;
          segment.name = state.flushBuffer();
        } else {
          throw new ParseError('Unexpected :', state, true);
        }
        break;
      case ' ':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inContext || state.inBlock) {
          state.inContext = false;
          segment.context = state.flushBuffer();

          yield readBlockArguments(state, segment);
        } else if (state.openBlock || state.closeBlock) {
          throw new ParseError('Unexpected whitespace', state, true);
        }
        // else ignore whitespace
        break;
      case '/':
        // TODO : handle `/` in closing {?{/}} blocks

        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.openBlock || state.closeBlock || segment.closing) {
          throw new ParseError('Unexpected /', state, true);
        } else {
          segment.closing = true;
          state.flushBuffer();
        }
        break;
      case '}':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.closeBlock) {
          state.closeBlock = false;
          state.flushBuffer();
          return;
        } else if (state.openBlock) {
          throw new ParseError('Unexpected }', state, true);
        } else {
          if (state.inContext) {
            if (state.hasBufferContent) {
              state.inContext = false;
              segment.context = state.flushBuffer();
            }
            state.inContext = false;
          }

          state.closeBlock = true;
          state.flushBuffer();
        }
        break;
      default:
        state.escaped = false;
        state.pushBuffer(c);
        break;
    }
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




/**
Parse Error
*/
function ParseError(msg, state, longMsg) {
  msg && (this.message = msg);
  if (state) {
    this.line = state.line;
    this.column = state.col;

    longMsg && (this.message += ' near "' + state.nearText + '" at L' + state.line + ',C' + state.col + ',O' + state.offset + '');
  }
  Error.apply(this, arguments);
};
require('util').inherits(ParseError, Error);
ParseError.prototype.name = ParseError.name;
