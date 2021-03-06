
/**
Module dependencies and declarations
*/

const VALID_BLOCK_IDENTIFIERS = /[a-zA-Z0-9_\-*^`´$%<"µ]/;
const BLOCK_RULES = {
  '/': {   // comments
    openingContent: 'inLiteral',
    validContent: { 'literal': true },
    maxSiblings: 1,
    selfClosing: true,
    closeBlock: true
  },
  '&': {   // helper renderer
    openingContent: 'inName',
    validContent: { 'name': true, 'context': true, 'params': true },
    maxSiblings: Infinity,
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
    openingContent: 'inLiteral',
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
    openingContent: 'inLiteral',
    validContent: { 'literal': true, 'context': true },
    maxSiblings: 2,
    selfClosing: false,
    closeBlock: true
  }
};

const VALID_MODIFIERS = /[a-zA-Z0-9_\-*^`´$&!?#%<>"µ]/;
const MODIFIERS = {
  'c': true,
  'C': true,
  'e': true,
  'E': true,
  'h': true,
  'H': true,
  'j': true,
  'U': true,
  'l': true,
  'x': true,
  'X': true,
  '*': true,
  '@': true
};

var fs = require('co-fs');
var ParserException = require('./exceptions').ParserException;
var Parser = module.exports;
var blockRules = {};
var availableModifiers = {};

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
Register a modifier
*/
Parser.registerBlockModifier = registerBlockModifier;

/**
Unregister a modifier
*/
Parser.unregisterBlockModifier = unregisterBlockModifier;


Object.freeze(Parser);


// push all block rules and modifiers
for (var id in BLOCK_RULES) {
  blockRules[id] = BLOCK_RULES[id];
}
for (var id in MODIFIERS) {
  availableModifiers[id] = MODIFIERS[id];
}



/**
Register a new block identifier to the parser
*/
function registerBlockRule(id, options) {
  if (typeof id !== 'string' && id.length !== 1) {
    throw ParserException('Invalid block identifier `{{id}}`', { id: id });
  }
  if (BLOCK_RULES[id] || !VALID_BLOCK_IDENTIFIERS.test(id)) {
    throw ParserException('Illegal identifier `{{id}}', { id: id });
  }

  blockRules[id] = options;
}

/**
Unregister a block identifier
*/
function unregisterBlockRule(id) {
  if (typeof id !== 'string' && id.length !== 1) {
    throw ParserException('Invalid block identifier `{{id}}`', { id: id });
  }
  if (BLOCK_RULES[id] || !VALID_BLOCK_IDENTIFIERS.test(id)) {
    throw ParserException('Illegal block identifier `{{id}}`', { id: id });
  }

  delete blockRules[id];
}


/**
Register a new block modifier to the parser
*/
function registerBlockModifier(modifier) {
  if (typeof modifier !== 'string' && modifier.length !== 1) {
    throw ParserException('Invalid block modifier `{{id}}`', { id: id });
  }
  if (MODIFIERS[modifier] || !VALID_MODIFIERS.test(modifier)) {
    throw ParserException('Illegal block modifier `{{id}}`', { id: id });
  }

  availableModifiers[modifier] = true;
}

/**
Unregister a block modifier
*/
function unregisterBlockModifier(modifier) {
  if (typeof modifier !== 'string' && modifier.length !== 1) {
    throw ParserException('Invalid block modifier `{{id}}`', { id: id });
  }
  if (MODIFIERS[modifier] || !VALID_MODIFIERS.test(modifier)) {
    throw ParserException('Illegal block modifier `{{id}}`', { id: id });
  }

  delete availableModifiers[modifier];
}



/**
Load a file and feed it to parseString
*/
function * parseFile(file) {
  return yield parseString(yield fs.readFile(file, 'utf-8'), file);
}

/**
Takes a string and parse it into tokens that can be compiled afterwards
*/
function * parseString(str, name) {
  var len = str.length;
  var buffer = '';
  var id = 0;
  var state = {
    name: name || 'text',
    segmentStack: [],     // stack of segments

    // The following strings represents the various block states
    //
    //   {openBlock{inName:inContext inParams=inParamValue inParams="inQuote"/}closeBlock}
    //   {openBlock{"inName+inQuote":inContext inParams=inParamValue inParams="inParamValue+inQuote"/}closeBlock}
    //

    openBlock: false,     // is this a block opening?
    closeBlock: false,    // is this a block closing?
    inName: false,        // are we scanning a block's name?
    inLiteral: false,     // are we scanning a literal value?
    inContext: false,     // are we scanning context?
    inParams: false,      // are we scanning params?
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
      enumerable: false,
      get: function() {
        return ++id;
      }
    },

    'available': {
      enumerable: false,
      get: function () { return this.offset < len; }
    },

    'prevChar': {
      enumerable: false,
      get: function () {
        this.offset = Math.max(--this.offset, -1);
        return this.offset < 0 ? undefined : str.charAt(this.offset);
      }
    },

    'peekChar': {  // like nextChar, but do not advance offset
      enumerable: false,
      get: function () {
        var c;
        var offset = this.offset + 1;
        return offset >= len ? undefined : str.charAt(offset);
      }
    },

    'nextChar': {
      enumerable: false,
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
      enumerable: false,
      value: function (c) {
        if (c !== undefined) {
          buffer += c;
          //console.log("#PUSHING", this.offset - 1, c, '(buffer =', buffer, ')');
        }
      }
    },

    'hasBufferContent': {
      enumerable: false,
      get: function () {
        return buffer.length;
      }
    },

    'flushBuffer': {
      enumerable: false,
      value: function () {
        var buf = buffer;
        buffer = '';
        //console.log("#FLUSHING", buf);
        return buf;
      }
    },

    'nearText': {
      enumerable: false,
      get: function () {
        return str.substr(Math.max(this.offset - 10, 0), 24);
      }
    },

    'pushSegment': {
      enumerable: false,
      value: function (segment) {
        //console.log("#PUSHSEG", segment, this.segment);
        this.segment.segments[segment.id] = segment;
        this.segmentStack.push(this.segment);

        return this.segment = segment;
      }
    },

    'popSegment': {
      enumerable: false,
      value: function (removeCurrent) {
        var segment;
        var segIndex;

        if (!this.segmentStack.length) {
          // FIXME : NOT in coverage.... is there even a test case that can
          //         prove this, with only a template source text?
          throwErr('Unexpected closing block', this);
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
    if (e instanceof ParserException) {
      throw e;  // resend above
    }
    //console.log(e.stack);
  }

  if (state.available) {
    // NOTE : fallback error, just in case something went wrong and parsing was
    //        aborted... somehow
    //console.error("CHARS STILL AVAILABLE!!!", state);
    throwErr('Parsing error', state);
  } else if (state.segmentStack.length) {
    if (state.inQuote) {
      throwErr('Unclosed literal', state);
    } else {
      throwErr('Missing closing block for ' + state.segment.type, state);
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

  function nextInContent() {
    var blockRule = BLOCK_RULES[state.segment.type];

    if (blockRule) {
      var validContentKeys = Object.keys(blockRule.validContent);
      var validContentKey;
      var stateKey;
      var inContent = false;

      for (var i = 0, ilen = validContentKeys.length; i < ilen; ++i) {
        validContentKey = validContentKeys[i];
        stateKey = 'in' + validContentKey.charAt(0).toUpperCase() + validContentKey.substring(1);

        if (blockRule.validContent[validContentKey]) {

          if (state[stateKey]) {
            state[stateKey] = false;
            inContent = true;
          } else if (inContent) {
            state[stateKey] = true;
            inContent = false;
          } else {
            state[stateKey] = false;
          }
        }
      }
    }
  }

  function flushBlockType() {
    var blockType = state.flushBuffer();

    if (blockRules[blockType]) {
      state.segment.type = blockType;
    } else {
      throwErr('Unknown block type `' + blockType + '`', state);
    }

    state[blockRules[blockType].openingContent] = true;
  }

  function flushName() {
    if (state.hasBufferContent) {  // ignore if no buffer content anyway
      if (blockRules[state.segment.type].validContent['name']) {
        state.segment.name = state.flushBuffer();
      } else {
        throwErr('Unexpected block name', state);
      }
    }
    state.inName = false;
  }

  function flushModifiers() {
    var modifiers = state.flushBuffer();

    for (var c, i = 0, len = modifiers.length; i < len; ++i) {
      if (!availableModifiers[c = modifiers.charAt(i)]) {
        throwErr('Unknown flag `' + c + '`', state);
      }
    }

    state.segment.modifiers = modifiers;
  }

  function discardSegment() {
    var discardedSegment;

    saveSegmentLength();
    discardedSegment = state.segment;

    if (!(discardedSegment.params)) {
      state.popSegment(true);  // discard this block

      if (state.segment.type !== discardedSegment.type) {
        throwErr('Mismatch closing block', state);
      }

      // note : state.segment is the discarded segment! We need to save it into the
      //        segmentStack!!
      state.segment.closingSegment = discardedSegment;
    }

    // cleanup up...
    if (!Object.keys(discardedSegment.segments).length) {
      delete discardedSegment.segments;
    }
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
      throwErr('Cannot set next segment to a non block segment', state);
    } else if (state.segment.type !== segment.type) {
      throwErr('Next block type mismatch', state);
    } else if ((maxSiblings = blockRules[state.segment.type].maxSiblings) === false) {
      throwErr('Invalid sibling block', state);
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
      throwErr('Maximum number of siblings for block reached', state);
    }

    state.pushSegment(segment);  // finally, put it back, next to our prevSegment!
  }

  function finalizeSegment() {
    saveSegmentLength();
    if (state.segment.segments && !Object.keys(state.segment.segments).length) {
      delete state.segment.segments;
    }
  }

  function resetBlockState() {
    state.openBlock = false;
    state.inName = false;
    state.inLiteral = false;
    state.inContext = false;
    state.inParams = false;
    state.closeBlock = false;
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
          throwErr('Unexpected \\', state);
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
          } else {
            state.inContext = true;
          }
        } else {
          throwErr('Unexpected {', state);
        }
        break;
      case '~':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if ((state.inName || state.inLiteral || state.inContext || state.inParams) && !state.hasBufferContent) {
          saveSegmentLength();
          joinSegment();
        } else {
          throwErr('Unexpected ~', state);
        }
        break;
      case '"':
        if (state.escaped) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inLiteral) {
          //console.log("QUOTE(1)", state);
          if (state.inQuote && state.hasBufferContent) {
            state.inQuote = false;
            state.inName = false;
            state.segment.literal = state.flushBuffer();
          } else if (!(state.segment.literal || state.inQuote)) {
            state.inQuote = true;
          } else {
            throwErr('Unexpected "', state);
          }
          //console.log("QUOTE(2)", state);
        } else if (state.closeBlock) {
          state.pushBuffer(c);
        } else {
          throwErr('Unexpected "', state);
        }
        break;
      case ':':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.inName || state.inLiteral) {
          if (state.inName) {
            flushName();
          } else {
            state.inLiteral = false;
          }
          state.inContext = true;
        } else {
          throwErr('Unexpected :', state);
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
              throwErr('Missing block name', state);
            }
          } else {
            if (state.hasBufferContent) {
              state.inContext = false;
              state.segment.context = state.flushBuffer();
            } else {
              throwErr('Missing context', state);
            }
          }

          yield readBlockParams(state);
        } else if (state.openBlock || state.closeBlock) {
          throwErr('Unexpected whitespace', state);
        }
        // else ignore whitespace
        break;
      case '/':
        if (state.escaped || state.openBlock || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.openBlock || state.closeBlock || state.segment.closing) {
          throwErr('Unexpected /', state);
        } else {
          if (!(state.hasBufferContent || state.segment.literal || state.segment.name || state.segment.context)) {  // close block
            if (!blockRules[state.segment.type].closeBlock || state.nextChar !== '}' || state.nextChar !== '}') {
              throwErr('Unexpected /', state);
            }
            discardSegment();
            finalizeSegment();
            state.popSegment();
            resetBlockState();
            return;    // out of end block
          } else {
            if (!blockRules[state.segment.type].selfClosing) {
              throwErr('Unexpected /', state);
            }
          }

          state.segment.closing = true;

          if (state.inName) {
            if (state.hasBufferContent) {
              flushName();
            } else {
              throwErr('Missing name', state);
            }
          } else if (state.inContext) {
            if (state.hasBufferContent) {
              state.segment.context = state.flushBuffer();
            } else {
              throwErr('Missing context', state);
            }
          } else if (state.hasBufferContent) {
            //console.error(state);
            throwErr('Invalid block', state);
          }
        }
        break;
      case '}':
        if (state.escaped || state.inQuote) {
          state.escaped = false;
          state.pushBuffer(c);
        } else if (state.closeBlock) {
          if (state.hasBufferContent) {
            flushModifiers();
          }

          // cleanup if no segment type
          if (!state.segment.type) {
            delete state.segment.segments;
          }

          //if (!state.segment.closing && state.segment.type) {
          //  yield readText(state);
          //} else {
          //  finalizeSegment();
          //  state.popSegment();
          //}
          if (state.segment.closing || !state.segment.type) {
            finalizeSegment();
            state.popSegment();
          }
          resetBlockState();
          return;
        } else if (state.openBlock) {
          throwErr('Unexpected }', state);
        } else {
          if (state.inContext) {
            if (state.hasBufferContent) {
              state.segment.context = state.flushBuffer();
            } else if (!state.segment.closing) {  // NOTE : we have read a `/` character before
              throwErr('Unspecified context', state);
            }
            state.inContext = false;
          } else if (state.inName) {
            if (!state.segment.name) {
              if (state.hasBufferContent) {
                flushName();
              } else {
                //console.log(state);
                throwErr('Unnamed block', state);
              }
            }
          }
          state.closeBlock = true;
          state.flushBuffer();
        }
        break;
      default:
        if (state.inLiteral && !state.inQuote) {
          // we're in an invalid content... so move to the next one
          nextInContent();
        } 

        if (!state.openBlock && state.inParams) {
          state.prevChar;
          yield readBlockParams(state);

          //console.log("RESTORE FROM PARAMS", state);
        } else {
          state.escaped = false;
          state.pushBuffer(c);
        }
        break;
    }
  }
}

/**
Read block params
*/
function * readBlockParams(state) {
  var paramName;

  function flushParam() {
    var paramValue;

    if (!blockRules[state.segment.type].validContent['params']) {
      throwErr('Block does not accept parameters', state);
    }

    if (paramName) {
      state.inParamValue = false;
      //state.inParams = true;
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

  function resetParamState(stepBack) {
    state.inParams = false;
    state.inParamValue = false;
    stepBack && state.prevChar;
  }

  //console.log("#STATE", JSON.stringify(state, null, 2));
  state.inParams = true;

  while (state.available) {
    switch (c = state.nextChar) {
    case '\\':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (!state.inQuote) {
        throwErr('Unexpected \\', state);
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
      } else if (state.inParams) {
        //state.inParams = false;
        state.inParamValue = true;
        paramName = state.flushBuffer();
      } else {
        throwErr('Unexpected =', state);
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
            //state.inParams = true;
            break;
          case undefined:
            throwErr('Unexpected end of template', state);
          default:
            throwErr('Unexpected ' + c, state);
        }
      } else if (state.inParamValue) {
        if (state.hasBufferContent) {
          throwErr('Unexpected "', state);
        } else {
          state.inQuote = true;
        }
      } else {
        throwErr('Unexpected "', state);
      }
      break;
    case '/':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (state.inQuote) {
        state.pushBuffer(c);
      } else {
        if (state.hasBufferContent) {
          flushParam();
        }
        return resetParamState(true);;  // shortcut, we're not parsing params anymore
      }
      break;
    case '}':
      if (state.escaped) {
        state.escaped = false;
        state.pushBuffer(c);
      } else if (state.inQuote) {
        state.pushBuffer(c);
      } else {
        if (state.hasBufferContent) {
          flushParam();
        }
        return resetParamState(true);  // shortcut, we're not parsing params anymore
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

  resetParamState();
}

function throwErr(msg, state) {
  throw ParserException(msg + ' near `{{nearText}}` at {{name}} L{{line}},C{{col}},O{{offset}}', state);
}
