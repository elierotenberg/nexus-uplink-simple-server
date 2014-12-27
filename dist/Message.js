"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");

var TYPES = {
  HANDSHAKE_ACK: "h",
  UPDATE: "u",
  EMIT: "e",
  DISPATCH: "d" };

var Message = (function () {
  var Message = function Message(_ref) {
    var type = _ref.type;
    var payload = _ref.payload;
    _.extend(this, {
      _type: type,
      _payload: payload,
      _json: JSON.stringify({ t: type, p: payload }) });
  };

  Message.unserialize = function (str) {
    var m = JSON.parse(str);
    _.dev(function () {
      return m.should.be.an.Object && m.t.should.be.a.String && m.p.should.be.an.Object;
    });
    return new Message({ type: m.t, payload: m.p });
  };

  _classProps(Message, null, {
    json: {
      get: function () {
        return this._json;
      }
    }
  });

  return Message;
})();

_.extend(Message.prototype, {
  _type: null,
  _payload: null,
  _json: null });

_.extend(Message, { TYPES: TYPES });

module.exports = Message;