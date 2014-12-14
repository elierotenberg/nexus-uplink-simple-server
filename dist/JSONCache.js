"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var LRUCache = require("lru-cache");
var sigmund = require("sigmund");

var JSONCache = (function () {
  var JSONCache = function JSONCache(_ref) {
    var maxSize = _ref.maxSize;
    var maxAge = _ref.maxAge;
    _.dev(function () {
      return maxSize.should.be.a.Number.not.below(0);
    });
    maxAge = maxAge || void 0;
    this.cache = new LRUCache({ max: maxSize, maxAge: maxAge });
  };

  JSONCache.prototype.stringify = function (object) {
    _.dev(function () {
      return object.should.be.an.Object;
    });
    var sig = sigmund(object);
    if (!this.cache.has(sig)) {
      this.cache.set(sig, JSON.stringify(object));
    }
    return this.cache.get(sig);
  };

  JSONCache.prototype.clear = function () {
    this.cache.reset();
    return this;
  };

  return JSONCache;
})();

_.extend(JSONCache.prototype, {
  cache: null });

module.exports = JSONCache;