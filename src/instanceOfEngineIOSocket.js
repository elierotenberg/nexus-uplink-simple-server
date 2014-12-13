const _ = require('lodash-next');

module.exports = function instanceOfEngineIOSocket(socket) {
  return _.every([
    _.isObject(socket),
    _.isString(socket.id),
    _.isFunction(socket.send),
    _.isFunction(socket.close),
    _.isString(socket.readyState),
  ]);
};
