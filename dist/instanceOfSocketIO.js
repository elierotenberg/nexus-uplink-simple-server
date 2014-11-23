"use strict";

var __NODE__ = !__BROWSER__;var __BROWSER__ = (typeof window === "object");var __PROD__ = !__DEV__;var __DEV__ = (process.env.NODE_ENV !== "production");var Promise = require("lodash-next").Promise;require("6to5/polyfill");var _ = require("lodash-next");
// ducktype-check for socket.io instance
module.exports = function (socket) {
  return _.isObject(socket) && _.isFunction(socket.on) && _.isFunction(socket.emit) && _.isString(socket.id);
};