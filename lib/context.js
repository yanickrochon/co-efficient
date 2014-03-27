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


function Context(parent, data, templateName) {
  this.parent = parent;
  this.data = data;
  this.templateName = templateName || (parent && parent.templateName);
};


Object.defineProperties(Context.prototype, {
  'hasData': {
    enumerable: true,
    configurable: false,
    get: hasData
  },
  'push': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: pushContext
  },
  'pop': {
    enumerable: true,
    configurable: false,
    writable: false,
    value: popContext
  },
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

  if (path !== PATH_SEP) {
    path = path.split(PATH_SEP);

    //console.log("** CONTEXT PATH", path, JSON.stringify(ctx, null, 2));

    for (var i = 0, len = path.length; i < len; ++i) {
      key = path[i];

      // if key is empty, we need to go up a parent....
      if (!key.length) {
        ctx = ctx.pop();
        //console.log("** CONTEXT POP", ctx);
      } else {
        data = ctx.data;

        // if data is an array, we try to collect the array items' keys
        if (data instanceof Array) {
          var tempData = data;
          data = [];

          for (var j = 0, len2 = tempData.length; j < len2; ++j) {
            //if ((tempData[j] !== null) && (typeof tempData[j] === 'object') && tempData[j].hasOwnProperty(key)) {
            if (tempData[j] !== null && tempData[j] !== undefined) {
              data.push(tempData[j][key]);
            }
          }

          // no element in the collected array? Default to an object (we don't want empty arrays...)
          data.length || (data = null);
        } else if (data !== null && data !== undefined) {
          data = data[key];
        }

        //console.log("** CONTEXT", key, data);

        ctx = new Context(ctx, data);
      }
    }

    //console.log("** CONTEXT RES", ctx);
  }

  return ctx;
}
