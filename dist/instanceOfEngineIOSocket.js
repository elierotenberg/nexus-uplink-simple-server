"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");

module.exports = function instanceOfEngineIOSocket(socket) {
  return _.every([_.isObject(socket), _.isString(socket.id), _.isFunction(socket.send), _.isFunction(socket.close), _.isString(socket.readyState)]);
};