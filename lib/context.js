
const PATH_SEP = '.';


module.exports = Context;

function Context(parent, data, templateName,  blocks) {
  this.parent = parent;
  this.data = data || (parent && parent.data) || {};
  this.templateName = templateName || (parent && parent.templateName);
  this.blocks = blocks || (parent && parent.blocks) || {};
};

Context.prototype.push = function push(data) {
  return new Context(this, data);
};

Context.prototype.pop = function pop() {
  return this.parent || this;
};

Context.prototype.getContext = function getContext(path) {
  var ctx = this;
  var key;
  var data;

  if (path !== PATH_SEP) {
    path = path.split(PATH_SEP);

    for (var i = 0, len = path.length; i < len; ++i) {
      key = path[i];

      // if key is empty, we need to go up a parent....
      if (!key.length) {
        ctx = ctx.pop();
      } else {
        data = ctx.data;

        // if data is an array, we try to collect the array items' keys
        if (data instanceof Array) {
          var tempData = data;
          data = [];

          for (var j = 0, len2 = tempData.length; j < len2; ++j) {
            if (tempData[j] !== null && typeof tempData[j] === 'object' && tempData[j][key]) {
              data.push(tempData[j][key]);
            }
          }

          // no element in the collected array? Default to an object (we don't want empty arrays...)
          if (!data.length) {
            data = {};
          }
        } else {
          data = data[key];
        }

        ctx = new Context(ctx, data);
      }
    }
  }

  return ctx;
};
