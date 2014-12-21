"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");

var DirtyMarker = (function () {
  var DirtyMarker = function DirtyMarker() {
    _.extend(this, {
      _dirty: {} });
  };

  DirtyMarker.prototype.mark = function (key) {
    this._dirty[key] = true;
  };

  DirtyMarker.prototype.unmarkAll = function () {
    this._dirty = {};
  };

  DirtyMarker.prototype.flush = function () {
    var _marked = this.marked;
    this.unmarkAll();
    return _marked;
  };

  _classProps(DirtyMarker, null, {
    marked: {
      get: function () {
        return Object.keys(this._dirty);
      }
    }
  });

  return DirtyMarker;
})();

_.extend(DirtyMarker.prototype, {
  _dirty: null });

module.exports = DirtyMarker;