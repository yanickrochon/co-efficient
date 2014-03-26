/**
Template parser
*/

const VALID_BLOCK_IDENTIFIERS = /[a-zA-Z0-9_\-*^`´$%<"µ]/;
const BLOCK_RULES = {
  '&': {   // helper renderer
    openingContent: 'inName',
    validContent: { 'name': true, 'context': true, 'params': true },
    maxSiblings: Number.MAX_VALUE,
    selfClosing: true,
    closeBlock: true
  },
  '#': {   // inline block declaration
    openingContent: 'inName',
    validContent: { 'name': true, 'context': true },
    maxSiblings: false,
    selfClosing: true,
    closeBlock: true
  },
  '+': {   // inline block renderer
    openingContent: 'inName',
    validContent: { 'name': true, 'context': true },
    maxSiblings: false,
    selfClosing: true,
    closeBlock: false
  },
  '>': {   // partial renderer
    openingContent: 'inName',
    validContent: { 'literal': true, 'context': true },
    maxSiblings: false,
    selfClosing: true,
    closeBlock: false
  },
  '@': {   // iterator
    openingContent: 'inContext',
    validContent: { 'context': true },
    maxSiblings: false,
    selfClosing: false,
    closeBlock: true
  },
  '?': {   // conditionals
    openingContent: 'inContext',
    validContent: { 'context': true },
    maxSiblings: 2,
    selfClosing: false,
    closeBlock: true
  }
};

const VALID_FLAGS = {
  'e': true, 'E': true      // escaping / not Escaping
};

var fs = require('co-fs');
var Parser = module.exports;
var blockRules = {};

/**
Load a file and attempt to parse it's content
*/
Parser.parseFile = parseFile;

/**
Receive a string and parse it's content
*/
Parser.parseString = parseString;


/**
Register a new block identifier to the parser
*/
Parser.registerBlockRule = registerBlockRule;

/**
Unregister a block identifier from the parser
*/
Parser.unregisterBlockRule = unregisterBlockRule;


/**
Expose exceptions
*/
Parser.exceptions = {
  ParseException: ParseException
};

Object.freeze(Parser);


// push all block rules...
for (var id in BLOCK_RULES) {
  blockRules[id] = BLOCK_RULES[id];
}



/**
Register a new block identifier to the parser
*/
function registerBlockRule(id, options) {
  if (typeof id !== 'string' && id.length !== 1) {
    throw new Error('Invalid block identifier');
  }
  if (BLOCK_RULES[id]) {
    throw new Error('Illegal identifier');
  }

  blockRules[id] = options;
}

/**
Unregister a block identifier
*/
function unregisterBlockRule(id) {
  if (typeof id !== 'string' && id.length !== 1) {
    throw new Error('Invalid block identifier');
  }
  if (BLOCK_RULES[id] || !VALID_BLOCK_IDENTIFIERS.test(id)) {
    throw new Error('Illegal block identifier');
  }

  delete blockRules[id];
}



/**
Load a file and feed it to parseString
*/
function * parseFile(file) {
  return yield parseString(yield fs.readFile(file, 'utf-8'));
}

/**
Takes a string and parse it into tokens that can be compiled afterwards
*/
function * parseString(str) {
  var len = str.length;
  var buffer = '';
  var id = 0;
  var state = {
    segmentStack: [],     // stack of segments

    // The following strings represents the various block states
    //
    //   {openBlock{inName:inContext inParam=inParamValue inParam="inQuote"/}closeBlock}
    //   {openBlock{"inName+inQuote":inContext inParam=inParamValue inParam="inParamValue+inQuote"/}closeBlock}
    //

    openBlock: false,     // is this a block opening?
    closeBlock: false,    // is this a block closing?
    inName: false,        // are we scanning a block's name?
    inContext: false,     // are we scanning context?
    inParam: false,       // are we scanning params?
    inParamValue: false,  // are we scanning param value?
    inQuote: false,       // are we between quotes?
    escaped: false,       // is the current character escaped?

    line: 0,              // current line
    col: -1,              // current column
    offset: -1,           // current offset

    segment: {
      id: id,
      offset: 0,
      length: str.length,
      line: 1,
      col: 0,
      segments: {},
      type: 'root'
    }
  };

  Object.defineProperties(state, {
    'nextId': {
      get: function() {
        return ++id;
      }
    },

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
        this.segment.segments[segment.id] = segment;
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
          throw new ParseException('Unexpected closing block', this, true);
        }

        segment = this.segmentStack.pop();

        if (removeCurrent) {
          delete segment.segments[this.segment.id];
        }

        return this.segment = segment;
      }
    }
  });

  try {
    yield readText(state);
  } catch (e) {
    if (e instanceof ParseException) {
      throw e;  // resend above
    }
    //console.log(e.stack);
  }

  if (state.available) {
    // NOTE : fallback error, just in case something went wrong and parsing was
    //        aborted... somehow
    throw new ParseException('Parsing error', state, true);
  } else if (state.segmentStack.length) {
    if (state.inQuote) {
      throw new ParseException('Unclosed literal', state, true);
    } else {
      throw new ParseException('Missing closing block for ' + state.segment.type, state, true);
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
          state.segment.segments[state.nextId] = state.flushBuffer();
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
    state.segment.segments[state.nextId] = state.flushBuffer();
  }
}

/**
Read block segment
*/
function * readBlock(state) {
  function flushBlockType() {
    var blockType = state.flushBuffer();

    if (blockRules[blockType]) {
      state.segment.type = blockType;
    } else {
      throw new ParseException('Unknown block type `' + blockType + '`', state, true);
    }

    state[blockRules[blockType].openingContent] = true;
  }

  function flushName() {
    if (state.hasBufferContent) {  // ignore if no buffer content anyway
      if (blockRules[state.segment.type].validContent['name']) {
        state.segment.name = state.flushBuffer();
      } else {
        throw new ParseException('Unexpected block name', state, true);
      }
    }
    state.inName = false;
  }

  function flushFlags() {
    var flags = state.flushBuffer();

    for (var c, i = 0, len = flags.length; i < len; ++i) {
      if (!VALID_FLAGS[c = flags.charAt(i)]) {
        throw new ParseException('Unknown flag `' + c + '`', state, true);
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
      throw new ParseException('Mismatch closing block', state, true);
    }

    // cleanup up...
    if (!Object.keys(discardedSegment.segments).length) {
      delete discardedSegment.segments;
    }

    // note : state.segment is the discarded segment! We need to save it into the
    //        segmentStack!!
    state.segment.closingSegment = discardedSegment;
  }

  // The goal of this function is to make the current segment a next node to it's
  // parent segment instead, then continue reading on...
  //
  function joinSegment() {
    var segment = state.segment;
    var headSegment;
    var maxSiblings;
    var curSiblings = 0;
    var nextSibling;

    state.popSegment(true);  // pop and remove current segment from the tree

    if (!state.segment.type) {
      throw new ParseException('Cannot set next segment to a non block segment', state, true);
    } else if (state.segment.type !== segment.type) {
      throw new ParseException('Next block type mismatch', state, true);
    } else if ((maxSiblings = blockRules[state.segment.type].maxSiblings) === false) {
      throw new ParseException('Invalid sibling block', state, true);
    }

    headSegment = segment.headSegment = state.segment.headSegment || state.segment.id;
    state.segment.nextSegment = segment.id;
    segment.type = state.segment.type;  // copy properties
    saveSegmentLength();

    state.segment.context && (segment.context = state.segment.context);

    // push segment name to buffer so nothing breaks
    if (state.inName) {
      state.pushBuffer(state.segment.name);
    } else {
      state.pushBuffer(state.segment.context);
    }

    state.popSegment(); // get to the parent...

    // count siblings
    nextSibling = headSegment;
    //console.log("Next seg", nextSibling, !!state.segment.segments[nextSibling]);
    while (state.segment.segments[nextSibling] && (nextSibling = state.segment.segments[nextSibling].nextSegment)) {
      //console.log("Next seg", nextSibling, !!state.segment.segments[nextSibling]);
      ++curSiblings;
    }

    if (curSiblings >= maxSiblings) {
      throw new ParseException('Maximum number of siblings for block reached', state, true);
    }

    state.pushSegment(segment);  // finally, put it back, next to our prevSegment!
  }

  function finalizeSegment() {
    saveSegmentLength();
    if (state.segment.segments && !Object.keys(state.segment.segments).length) {
      delete state.segment.segments;
    }
  }

  function saveSegmentLength() {
    state.segment.length = state.offset - state.segment.offset + 1;
  }

  state.pushSegment({
    id: state.nextId,
    offset: state.offset,
    length: undefined,
    line: state.line,
    col: state.col,
    segments: {}
  });

  state.openBlock = true;

  while (state.available) {
    switch (c = state.nextChar) {
      case '\\':
        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (!state.inQuote && (state.openBlock || state.inName || state.inContext)) {
          throw new ParseException('Unexpected \\', state, true);
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
            if (state.inParam) {
              yield readBlockParams(state);
            }
          } else {
            state.inContext = true;
          }
        } else {
          throw new ParseException('Unexpected {', state, true);
        }
        break;
      case '~':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if ((state.inName || state.inContext) && !state.hasBufferContent) {
          saveSegmentLength();
          joinSegment();
        } else {
          throw new ParseException('Unexpected ~', state, true);
        }
        break;
      case '"':
        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inName) {
          //console.log("QUOTE(1)", state);
          if (state.inQuote && state.hasBufferContent) {
            state.inQuote = false;
            state.inName = false;
            state.segment.literal = state.flushBuffer();
          } else if (!(state.segment.literal || state.inQuote)) {
            state.inQuote = true;
          } else {
            throw new ParseException('Unexpected "', state, true);
          }
          //console.log("QUOTE(2)", state);
        } else {
          throw new ParseException('Unexpected "', state, true);
        }
        break;
      case ':':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inName || state.segment.literal) {
          flushName();
          state.inContext = true;
        } else {
          throw new ParseException('Unexpected :', state, true);
        }
        break;
      case ' ':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inName || state.inContext) {
          if (state.inName) {
            if (state.hasBufferContent) {
              flushName();
            } else {
              throw new ParseException('Missing block name', state, true);
            }
          } else {
            if (state.hasBufferContent) {
              state.inContext = false;
              state.segment.context = state.flushBuffer();
            } else {
              throw new ParseException('Missing context', state, true);
            }
          }

          yield readBlockParams(state);
        } else if (state.openBlock || state.closeBlock) {
          throw new ParseException('Unexpected whitespace', state, true);
        }
        // else ignore whitespace
        break;
      case '/':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.openBlock || state.closeBlock || state.segment.closing) {
          throw new ParseException('Unexpected /', state, true);
        } else {
          if (!(state.hasBufferContent || state.segment.literal || state.segment.name || state.segment.context)) {  // close block
            if (!blockRules[state.segment.type].closeBlock || state.nextChar !== '}' || state.nextChar !== '}') {
              throw new ParseException('Unexpected /', state, true);
            }
            discardSegment();
            finalizeSegment();
            state.popSegment();
            return;    // out of end block
          } else {
            if (!blockRules[state.segment.type].selfClosing) {
              throw new ParseException('Unexpected /', state, true);
            }
          }

          state.segment.closing = true;

          if (state.inName) {
            if (state.hasBufferContent) {
              flushName();
            } else {
              throw new ParseException('Missing name', state, true);
            }
          } else if (state.inContext) {
            if (state.hasBufferContent) {
              state.segment.context = state.flushBuffer();
            } else {
              throw new ParseException('Missing context', state, true);
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
            finalizeSegment();
            state.popSegment();
          }
          return;
        } else if (state.openBlock) {
          throw new ParseException('Unexpected }', state, true);
        } else {
          if (state.inContext) {
            if (state.hasBufferContent) {
              state.inContext = false;
              state.segment.context = state.flushBuffer();
            } else if (!state.segment.closing) {  // NOTE : we have read a `/` character before
              throw new ParseException('Unspecified context', state, true);
            }
            state.inContext = false;
          } else if (state.inName) {
            if (!state.segment.name) {
              if (state.hasBufferContent) {
                flushName();
              } else {
                throw new ParseException('Unnamed block', state, true);
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

/**
Read block params
*/
function * readBlockParams(state) {
  var paramName;

  if (!blockRules[state.segment.type].validContent['params']) {
    throw new ParseException('Block does not accept parameters', state, true);
  }

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
        throw new ParseException('Unexpected \\', state, true);
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
        throw new ParseException('Unexpected =', state, true);
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
            throw new ParseException('Unexpected end of template', state, true);
          default:
            throw new ParseException('Unexpected ' + c, state, true);
        }
      } else if (state.inParamValue) {
        if (state.hasBufferContent) {
          throw new ParseException('Unexpected "', state, true);
        } else {
          state.inQuote = true;
        }
      } else {
        throw new ParseException('Unexpected "', state, true);
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
          throw new ParseException('Missing param value', state, true);
        } else {
          flushParam();
        }
        state.inParam = false;
        state.inParamValue = false;
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
        state.inParam = false;
        state.inParamValue = false;
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
Parse Exception
*/
function ParseException(msg, state, longMsg) {
  msg && (this.message = msg);
  if (state) {
    this.line = state.line;
    this.column = state.col;

    longMsg && (this.message += ' near `' + state.nearText + '` at L' + state.line + ',C' + state.col + ',O' + state.offset);
  }
  Error.apply(this, arguments);
  Error.captureStackTrace(this, this.constructor);
};
require('util').inherits(ParseException, Error);
ParseException.prototype.name = ParseException.name;
