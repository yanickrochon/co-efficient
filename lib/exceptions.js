/**
Exceptions module
*/

var errorFactory = require('error-factory');

/**
Parser exception
*/
module.exports.ParseException = errorFactory('coefficient.ParseException', ['message', 'messageData']);

/**
Compiler exception
*/
module.exports.CompilerException = errorFactory('coefficient.CompilerException', ['message', 'segment']);

/**
Engine exception
*/
module.exports.EngineException = errorFactory('coefficient.EngineException');
