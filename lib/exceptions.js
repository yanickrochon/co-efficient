/**
Exceptions module
*/

var errorFactory = require('error-factory');

/**
Parser exception
*/
module.exports.ParserException = errorFactory('coefficient.ParserException', ['message', 'messageData']);

/**
Compiler exception
*/
module.exports.CompilerException = errorFactory('coefficient.CompilerException', ['message', 'segment']);

/**
Engine exception
*/
module.exports.EngineException = errorFactory('coefficient.EngineException');



/**
RenderException
*/
module.exports.RenderException = errorFactory('coefficient.RenderException');