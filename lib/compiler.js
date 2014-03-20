

const BLOCK_TYPES = [
  '&',          // helpers
  '#', '+',     // inline blocks : declare, render
  '>',          // partial
  '@',          // iterator : for, loop/while
  '?'           // conditionals
];

const VALID_FLAGS = [
  'e', 'E'      // escaping / not Escaping
];

const NEWLINE = "\n";


var Compiler = module.exports;



Compiler.compile = function * (segment, engine) {
  return 'function * (stream, ctx, engine, blocks) {' + NEWLINE +
           (yield processSegment(segment, engine)) + NEWLINE +
         '}';
};

Object.defineProperties(Compiler, {
  'BLOCK_TYPES': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: BLOCK_TYPES
  },
  'VALID_FLAGS': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: VALID_FLAGS
  }
});



function * processSegment(segment, engine) {
  var segs = segment.segments;
  var segValue;
  var fnBody = '';

  for (var i = 0, len = segs.length; i < len; i++) {
    segValue = segs[i];

    fnBody += (
         (yield processTextBlock(segValue, engine))
      || (yield processBlock(segValue, engine))
      || (yield processContext(segValue, engine))
      || '') + NEWLINE;
  }

  return fnBody;
};



function * processTextBlock(segment, engine) {
  return typeof segment === 'string' ? 'stream.write(' + quote(segment) + ');' : false;
}

function * processBlock(segment, engine) {
  if (segment.type) {

    return '// TODO : block';
  } else {
    return false;
  }
}

function * processContext(segment, engine) {
  return segment.context ? 'stream.write(ctx.getContext(' + quote(segment.context) + '));' : false;
}




//function * blockIf



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
