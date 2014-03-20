
var fs = require('co-fs');
var Parser = module.exports;

Parser.parseFile = parseFile;
Parser.parseString = parseString2;

Parser.exceptions = {
  ParseError: ParseError
};


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
    col: -1,              // current column
    offset: -1,           // current offset

    segment: {
      type: 'root',
      line: 1,
      col: 0,
      segments: []
    }
  };

  Object.defineProperties(state, {
   'available': {
      get: function () { return this.offset < len; }
    },

    'peekChar': {  // like nextChar, but do not advance offset
      get: function () {
        var c;
        var offset = this.offset;
        // skip \r
        while ((offset < len) && (c = str.charAt(offset)) === "\r") {
          ++offset;
        }
        while ((offset < len) && (c = str.charAt(++offset)) === "\n");
        return offset >= len ? undefined : c;
      }
    },

    'nextChar': {
      get: function () {
        var c;
        this.col++;
        // skip \r
        while ((this.offset < len) && (c = str.charAt(this.offset)) === "\r") {
          ++this.offset;
          ++this.col;
        }
        while ((this.offset < len) && (c = str.charAt(++this.offset)) === "\n") {
          ++this.line;
          this.col = 0;
        }
        return this.offset >= len ? undefined : c;
      }
    },

    'pushBuffer': {
      value: function (c) {
        if (c !== undefined) {
          buffer += c;
          //console.log("#PUSHING", this.offset - 1, c, '(buffer =', buffer, ')');
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
        //console.log("#FLUSHING", buf);
        return buf;
      }
    },

    'nearText': {
      get: function () {
        return str.substr(Math.max(this.offset - 10, 0), 24);
      }
    },

    'pushSegment': {
      value: function (segment) {
        //console.log("#PUSHSEG", segment, this.segment);
        this.segment.segments.push(segment);
        this.segmentStack.push(this.segment);

        return this.segment = segment;
      }
    },

    'popSegment': {
      value: function () {
        if (!this.segmentStack.length) {
          throw new ParseError('Unexpected closing block', this, true);
        }

        return this.segment = this.segmentStack.pop();
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

  return state.segment;
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
  state.pushSegment({
    line: state.line,
    col: state.col,
    segments: []
  });

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

          if (state.hasBufferContent) {
            state.segment.type = state.flushBuffer();
            state.inBlock = true;
          } else {
            state.inContext = true;
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
            state.segment.literal = state.flushBuffer();
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
          state.segment.name = state.flushBuffer();
        } else {
          throw new ParseError('Unexpected :', state, true);
        }
        break;
      case ' ':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inBlock || state.inContext) {
          if (state.inBlock) {
            if (state.hasBufferContent) {
              state.inBlock = false;
              state.segment.name = state.flushBuffer();
            } else {
              throw new ParseError('Missing block name', state, true);
            }
          } else {
            if (state.hasBufferContent) {
              state.inContext = false;
              state.segment.context = state.flushBuffer();
            } else {
              throw new ParseError('Missing context', state, true);
            }
          }

          yield readBlockArguments(state);
        } else if (state.openBlock || state.closeBlock) {
          throw new ParseError('Unexpected whitespace', state, true);
        }
        // else ignore whitespace
        break;
      case '/':
        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.openBlock || state.closeBlock || state.segment.closing) {
          throw new ParseError('Unexpected /', state, true);
        } else {
          state.segment.closing = true;

          if (state.inBlock) {
            if (state.hasBufferContent) {
              state.segment.name = state.flushBuffer();
            } else {
              throw new ParseError('Missing block name');
            }
          } else if (state.inContext) {
            if (state.hasBufferContent) {
              state.segment.context = state.flushBuffer();
            } else {
              throw new ParseError('Missing context');
            }
          }
        }
        break;
      case '}':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.closeBlock) {
          state.closeBlock = false;

          if (state.hasBufferContent) {
            state.segment.flags = state.flushBuffer();
          }

          // cleanup if no segment type
          if (!state.segment.type) {
            delete state.segment.segments;
          }

          state.popSegment();
          return;
        } else if (state.openBlock) {
          throw new ParseError('Unexpected }', state, true);
        } else {
          if (state.inContext) {
            if (state.hasBufferContent) {
              state.inContext = false;
              state.segment.context = state.flushBuffer();
            }
            state.inContext = false;
          } else if (state.inBlock) {
            if (!state.segment.name) {
              if (state.hasBufferContent) {
                state.segment.name = state.flushBuffer();
              } else {
                throw new ParseError('Unnamed block', state, true);
              }
            }
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


function * readBlockArguments(state) {
  var paramName;

  function flushParam() {
    var paramValue;

    if (paramName) {
      state.inParamValue = false;
      state.inParam = true;
      state.segment.params = state.segment.params || {};

      paramValue = state.flushBuffer();

      if (state.inQuote) {
        // litterals don't need validatio
        state.segment.params[paramName] = paramValue;
      } else {

        // TODO : add context validation

        state.segment.params[paramName] = { context: paramValue };
      }
      paramName = undefined;
      state.inQuote = false;
    }
  }

  //console.log("#STATE", JSON.stringify(state, null, 2));
  state.inParam = true;

  while (state.available) {
    switch (c = state.nextChar) {
    case '\\':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (!state.inQuote) {
        throw new ParseError('Unexpected \\', state, true);
      } else {
        state.escaped = true;
      }
      break;
    case '=':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (state.inParam) {
        state.inParam = false;
        state.inParamValue = true;
        paramName = state.flushBuffer();
      } else {
        throw new ParseError('Unexpected =', state, true);
      }
      break;
    case '"':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (state.inQuote) {
        flushParam();
        switch (c = state.peekChar) {
          case ' ':
          case '/':
          case '}':
            state.inParam = true;
            break;
          case undefined:
            throw new ParseError('Unexpected end of template', state, true);
          default:
            throw new ParseError('Unexpected ' + c, state, true);
        }
      } else if (state.inParamValue) {
        state.inQuote = true;
      } else {
        throw new ParseError('Unexpected "', state, true);
      }
      break;
    case '/':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else {
        if (state.inParam && paramName) {
          throw new ParseError('Missing param value', state, true);
        } else {
          flushParam();
        }
        --state.offset;
        return;  // shortcut, we're not parsing params anymore
      }
    case '}':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else {
        return;  // shortcut, we're not parsing params anymore
      }
    case ' ':
      if (state.escaped || state.inQuote) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (state.inParamValue) {
        flushParam();
      }
      // else ignore whitespace
      break;
    default:
      state.pushBuffer(c);
    }
  }
}






/**
Parse Error
*/
function ParseError(msg, state, longMsg) {
  msg && (this.message = msg);
  if (state) {
    this.line = state.line;
    this.column = state.col;

    longMsg && (this.message += ' near `' + state.nearText + '` at L' + state.line + ',C' + state.col + ',O' + state.offset);
  }
  Error.apply(this, arguments);
};
require('util').inherits(ParseError, Error);
ParseError.prototype.name = ParseError.name;
