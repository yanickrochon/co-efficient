/**
Template Context
*/

const PATH_SEP = '.';

/**
Expose Context constructor
*/
module.exports = Context;



/**
Private module definition below
*/


/**
Create a new Context

@param {Context} parent                     the parent context
@param {Object} data                        the context's data
@param {String} templateName     (optional) the template name
*/
function Context(parent, data, templateName) {
  this.parent = parent;
  this.data = data;
  this.templateName = templateName || (parent && parent.templateName);
};


Object.defineProperties(Context.prototype, {
  /**
  Returns true if the context has some data
  @return {Boolean}
  */
  'hasData': {
    enumerable: true,
    configurable: false,
    get: hasData
  },

  /**
  Push new data, create a new context and return it
  @param {Object} data
  @return {Context}
  */
  'push': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: pushContext
  },

  /**
  Pop the parent context and return it.
  @return {Context}
  */
  'pop': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: popContext
  },

  /**
  Return a relative context
  @param {String} path    the path to the relative context
  @return {Context}
  */
  'getContext': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: getContext
  }
});

Object.freeze(Context.prototype);


function hasData() {
  if (this.data === undefined || this.data === null) {
    return false;
  }
  if (typeof this.data === 'object') {
    for (var k in this.data) {
      return true;
    }
  }
  if (this.data) {
    return true;
  }
  return false;
}

function pushContext(data) {
  return new Context(this, data);
}

function popContext() {
  return this.parent || this;
}

function getContext(path) {
  var ctx = this;
  var key;
  var data;
  var tempData;
  var i, ilen;
  var j, jlen;

  if (path !== PATH_SEP) {
    path = path.split(PATH_SEP);

    //console.log("** CONTEXT PATH", path, JSON.stringify(ctx, null, 2));

    for (i = 0, ilen = path.length; i < ilen; ++i) {
      key = path[i];

      // if key is empty, we need to go up a parent....
      if (!key.length) {
        ctx = ctx.parent || ctx;  // ctx.pop();
      } else {
        data = ctx.data;

        // if data is an array, we try to collect the array items' keys
        if (data instanceof Array) {
          tempData = data;
          data = [];

          for (j = 0, jlen = tempData.length; j < jlen; ++j) {
            if (tempData[j] !== null && tempData[j] !== undefined) {
              data.push(tempData[j][key]);
            }
          }

          // no element in the collected array? Default to an object (we don't want empty arrays...)
          data.length || (data = null);
        } else if (data !== null && data !== undefined) {
          data = data[key];
        }

        ctx = new Context(ctx, data);
      }
    }
  }

  return ctx;
}
