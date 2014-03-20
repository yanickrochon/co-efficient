
const BLOCK_TYPES = require('./compiler').BLOCK_TYPES;
const VALID_FLAGS = require('./compiler').VALID_FLAGS;

var fs = require('co-fs');
var Parser = module.exports;


Parser.parseFile = parseFile;
Parser.parseString = parseString;

Parser.exceptions = {
  ParseError: ParseError
};


function * parseFile(file) {
  return yield parseString(yield fs.readFile(file, 'utf-8'));
}


function * parseString(str) {
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

    line: 0,              // current line
    col: -1,              // current column
    offset: -1,           // current offset

    segment: {
      offset: 0,
      length: str.length,
      line: 1,
      col: 0,
      segments: [],
      type: 'root'
    }
  };

  Object.defineProperties(state, {
   'available': {
      get: function () { return this.offset < len; }
    },

    'prevChar': {
      get: function () {
        this.offset = Math.max(--this.offset, -1);
        return this.offset < 0 ? undefined : str.charAt(this.offset);
      }
    },

    'peekChar': {  // like nextChar, but do not advance offset
      get: function () {
        var c;
        var offset = this.offset + 1;
        return offset >= len ? undefined : str.charAt(offset);
      }
    },

    'nextChar': {
      get: function () {
        var c;
        if (this.offset < 0) {
          this.offset = -1;
          this.line = 1;
          this.col = 0;
        } else if (str.charAt(this.offset) === "\n") {
          ++this.line;
          this.col = 0;
        } else {
          ++this.col;
        }

        return ++this.offset >= len ? undefined : str.charAt(this.offset);
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
      value: function (removeCurrent) {
        var segment;
        var segIndex;

        if (!this.segmentStack.length) {
          // FIXME : NOT in coverage.... is there even a test case that can
          //         prove this, with only a template source text?
          throw new ParseError('Unexpected closing block', this, true);
        }

        segment = this.segmentStack.pop();

        if (removeCurrent) {
          segIndex = segment.segments.indexOf(this.segment);
          //console.log("#REMOVE", segIndex);
          if (segIndex >= 0) {
            segment.segments.splice(segIndex, 1);
          }
        }

        return this.segment = segment;
      }
    }
  });

  yield readText(state);

  if (state.available) {
    // NOTE : fallback error, just in case something went wrong and parsing was
    //        aborted... somehow
    throw new ParseError('Parsing error', state, true);
  } else if (state.segmentStack.length) {
    if (state.inQuote) {
      throw new ParseError('Unclosed literal', state, true);
    } else {
      throw new ParseError('Missing closing block for ' + state.segment.type, state, true);
    }
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
  function flushBlockType() {
    var blockType = state.flushBuffer();

    if (BLOCK_TYPES.indexOf(blockType) > -1) {
      state.segment.type = blockType;
    } else {
      throw new ParseError('Unknown block type `' + blockType + '`', state, true);
    }
  }

  function flushFlags() {
    var flags = state.flushBuffer();

    for (var c, i = 0, len = flags.length; i < len; ++i) {
      if (VALID_FLAGS.indexOf(c = flags.charAt(i)) === -1) {
        throw new ParseError('Unknown flag `' + c + '`', state, true);
      }
    }

    state.segment.flags = flags;
  }

  function discardSegment() {
    var discardedSegment;

    saveSegmentLength();
    discardedSegment = state.segment;
    state.popSegment(true);  // discard this block

    if (state.segment.type !== discardedSegment.type) {
      throw new ParseError('Mismatch closing block', state, true);
    }

    // cleanup up...
    if (!discardedSegment.segments.length) {
      delete discardedSegment.segments;
    }

    // note : state.segment is the discarded segment! We need to save it into the
    //        segmentStack!!
    state.segment.closingSegment = discardedSegment;
  }

  function saveSegmentLength() {
    state.segment.length = state.offset - state.segment.offset + 1;
  }

  state.pushSegment({
    offset: state.offset,
    length: undefined,
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
        } else if (!state.inQuote && (state.openBlock || state.inBlock || state.inContext)) {
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
            flushBlockType();
            state.inBlock = true;
          } else {
            state.inContext = true;
          }
        } else {
          throw new ParseError('Unexpected {', state, true);
        }
        break;
      case '~':

        // TODO : next block....

        break;
      case '"':
        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inBlock) {
          if (state.inQuote && state.hasBufferContent) {
            state.inQuote = false;
            state.inBlock = false;
            state.segment.literal = state.flushBuffer();
          } else if (!(state.segment.literal || state.inQuote)) {
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
              if (state.nextChar !== '}' || state.nextChar !== '}') {
                throw new ParseError('Unexpected /', state, true);
              }
              discardSegment();
              saveSegmentLength();
              state.popSegment();
              return;    // out of end block
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
            flushFlags();
          }

          // cleanup if no segment type
          if (!state.segment.type) {
            delete state.segment.segments;
          }

          if (!state.segment.closing && state.segment.type) {
            yield readText(state);
          } else {
            saveSegmentLength();
            state.popSegment();
          }
          return;
        } else if (state.openBlock) {
          throw new ParseError('Unexpected }', state, true);
        } else {
          if (state.inContext) {
            if (state.hasBufferContent) {
              state.inContext = false;
              state.segment.context = state.flushBuffer();
            } else if (!state.segment.closing) {  // NOTE : we have read a `/` character before
              throw new ParseError('Unspecified context', state, true);
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

        // TODO : add context validation ?

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
      } else if (state.inQuote) {
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
        if (state.hasBufferContent) {
          throw new ParseError('Unexpected "', state, true);
        } else {
          state.inQuote = true;
        }
      } else {
        throw new ParseError('Unexpected "', state, true);
      }
      break;
    case '/':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (state.inQuote) {
        state.pushBuffer(c);
      } else {
        if (state.inParam && state.hasBufferContent) {
          throw new ParseError('Missing param value', state, true);
        } else {
          flushParam();
        }
        state.prevChar;
        return;  // shortcut, we're not parsing params anymore
      }
      break;
    case '}':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (state.inQuote) {
        state.pushBuffer(c);
      } else {
        state.prevChar;
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
  Error.captureStackTrace(this, this.constructor);
};
require('util').inherits(ParseError, Error);
ParseError.prototype.name = ParseError.name;
