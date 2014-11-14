// ducktype-check for socket.io instance
module.exports = (socket) =>
  _.isObject(socket) &&
  _.isFunction(socket.on) &&
  _.isFunction(socket.emit) &&
  _.isString(socket.id)
;
