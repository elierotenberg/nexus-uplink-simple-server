"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");

function isDifferent(prev, next) {
  if (_.isObject(prev) && _.isObject(next)) {
    return !_.isEqual(prev, next);
  }
  return prev !== next;
}

var AtomiclyFlushable = (function () {
  var AtomiclyFlushable = function AtomiclyFlushable() {
    _.extend(this, {
      _store: {},
      _dirty: {} });
  };

  AtomiclyFlushable.prototype.get = function (key) {
    return this._store[key];
  };

  AtomiclyFlushable.prototype.set = function (key, value) {
    _.dev(function () {
      return (value === null || _.isObject(value)).should.be.ok;
    });
    if (isDifferent(this._store[key], value)) {
      this._dirty[key] = true;
    }
    this._store[key] = value;
    return this;
  };

  AtomiclyFlushable.prototype.mutations = function () {
    var _this = this;
    var _mutations = {};
    Object.keys(this._dirty).forEach(function (key) {
      return _mutations[key] = _this._store[key];
    });
    return _mutations;
  };

  AtomiclyFlushable.prototype.flush = function () {
    var _mutations2 = this.mutations();
    this._dirty = {};
    return _mutations2;
  };

  return AtomiclyFlushable;
})();

_.extend(AtomiclyFlushable.prototype, {
  _currentStore: null,
  _previousStore: null });

module.exports = AtomiclyFlushable;