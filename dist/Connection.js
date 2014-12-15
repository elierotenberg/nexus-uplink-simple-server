"use strict";

var _slice = Array.prototype.slice;
var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;
var _ = require("lodash-next");
var instanceOfEngineIOSocket = require("./instanceOfEngineIOSocket");
var EventEmitter = require("events").EventEmitter;

var HANDSHAKE_TIMEOUT = 5000;

var Connection = (function () {
  var Connection = function Connection(_ref) {
    var _this = this;
    var pid = _ref.pid;
    var socket = _ref.socket;
    var stringify = _ref.stringify;
    var handshakeTimeout = _ref.handshakeTimeout;
    handshakeTimeout = handshakeTimeout || HANDSHAKE_TIMEOUT;
    _.dev(function () {
      return pid.should.be.a.String && instanceOfEngineIOSocket(socket).should.be.ok && stringify.should.be.a.Function && handshakeTimeout.should.be.a.Number.and.not.be.below(0);
    });
    _.extend(this, {
      events: new EventEmitter(),
      _isDestroyed: false,
      _pid: pid,
      _guid: null,
      _session: null,
      _socket: socket,
      _stringify: stringify });
    this._handshakeTimeout = setTimeout(function () {
      return _this._handshakeTimeoutExpire();
    }, handshakeTimeout);
    ["_handleClose", "_handleError", "_handleMessage"].forEach(function (method) {
      return _this[method] = _.scope(_this[method], _this);
    });
    this._socket.addListener("close", this._handleClose);
    this._socket.addListener("error", this._handleError);
    this._socket.addListener("message", this._handleMessage);
  };

  Connection.prototype.push = function (event, params) {
    var _this2 = this;
    this.isDestroyed.should.not.be.ok;
    _.dev(function () {
      return event.should.be.a.String && (params === null || _.isObject(params)).should.be.ok;
    });
    _.dev(function () {
      return console.warn("nexus-uplink-simple-server", _this2._socket.id, ">>", event, params);
    });
    this._socket.send(this._stringify({ event: event, params: params }));
  };

  Connection.prototype.destroy = function () {
    var _this3 = this;
    this.isDestroyed.should.not.be.ok;
    _.dev(function () {
      return console.warn("nexus-uplink-simple-server", _this3._socket.id, "!!", "destroy");
    });
    this.events.removeAllListeners();
    this.events = null;
    this._socket.removeListener("close", this._handleClose);
    this._socket.removeListener("error", this._handleError);
    this._socket.removeListener("message", this._handleMessage);
    this._socket = null;
  };

  Connection.prototype.update = function (_ref2) {
    var path = _ref2.path;
    var diff = _ref2.diff;
    var hash = _ref2.hash;
    _.dev(function () {
      return path.should.be.a.String && diff.should.be.an.Object && (hash === null || _.isString(hash)).should.be.ok;
    });
    this.push("update", { path: path, diff: diff, hash: hash });
  };

  Connection.prototype.emit = function (_ref3) {
    var room = _ref3.room;
    var params = _ref3.params;
    _.dev(function () {
      return room.should.be.a.String && (params === null || _.isObject(params)).should.be.ok;
    });
    this.push("emit", { room: room, params: params });
  };

  Connection.prototype.debug = function () {
    var args = _slice.call(arguments);

    this.push.apply(this, ["debug"].concat(_toArray(args)));
  };

  Connection.prototype.log = function () {
    var args = _slice.call(arguments);

    this.push.apply(this, ["log"].concat(_toArray(args)));
  };

  Connection.prototype.warn = function () {
    var args = _slice.call(arguments);

    this.push.apply(this, ["warn"].concat(_toArray(args)));
  };

  Connection.prototype.err = function () {
    var args = _slice.call(arguments);

    this.push.apply(this, ["err"].concat(_toArray(args)));
  };

  Connection.prototype._handshakeTimeoutExpire = function () {
    var _this4 = this;
    _.dev(function () {
      return console.warn("nexus-uplink-simple-server", _this4._socket.id, "handshakeTimeout");
    });
    this._socket.close();
  };

  Connection.prototype._handleClose = function () {
    this.events.emit("close");
  };

  Connection.prototype._handleError = function (err) {
    var _this5 = this;
    _.dev(function () {
      return console.error("nexus-uplink-simple-server", _this5._socket.id, "<<", err.toString());
    });
  };

  Connection.prototype._handleMessage = function (json) {
    var _this6 = this;
    _.dev(function () {
      return console.warn("nexus-uplink-simple-server", _this6._socket.id, "<<", json);
    });
    _.dev(function () {
      return json.should.be.a.String;
    });
    return Promise["try"](function () {
      var _ref4 = JSON.parse(json);

      var event = _ref4.event;
      var params = _ref4.params;
      event.should.be.a.String;
      (params === null || _.isObject(params)).should.be.ok;
      if (event === "handshake") {
        return _this6._handleMessageHanshake(params);
      }
      if (event === "subscribeTo") {
        return _this6._handleMessageSubscribeTo(params);
      }
      if (event === "unsubscribeFrom") {
        return _this6._handleMessageUnsubscribeFrom(params);
      }
      if (event === "listenTo") {
        return _this6._handleMessageListenTo(params);
      }
      if (event === "unlistenFrom") {
        return _this6._handleMessageUnlistenFrom(params);
      }
      throw new Error("Unknown event type: " + event);
    })["catch"](function (err) {
      return _this6._throw(err);
    });
  };

  Connection.prototype._handleMessageHanshake = function (_ref5) {
    var _this7 = this;
    var guid = _ref5.guid;
    this.isConnected.should.not.be.ok;
    guid.should.be.a.String;
    clearTimeout(this._handshakeTimeout);
    this._handshakeTimeout = null;
    _.dev(function () {
      return _this7.isConnected.should.be.ok;
    });
    this.events.emit("handshake", { guid: guid });
    this._handshakeAck({ pid: this._pid });
  };

  Connection.prototype._handleMessageSubscribeTo = function (_ref6) {
    var path = _ref6.path;
    path.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit("subscribeTo", { path: path });
  };

  Connection.prototype._handleMessageUnsubscribeFrom = function (_ref7) {
    var path = _ref7.path;
    path.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit("unsubscribeFrom", { path: path });
  };

  Connection.prototype._handleMessageListenTo = function (_ref8) {
    var room = _ref8.room;
    room.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit("listenTo", { room: room });
  };

  Connection.prototype._handleMessageUnlistenFrom = function (_ref9) {
    var room = _ref9.room;
    room.should.be.a.String;
    this.isConnected.should.be.ok;
    this.events.emit("unlistenFrom", { room: room });
  };

  Connection.prototype._throw = function (err) {
    this.push("err", { err: err.toString(), stack: __DEV__ ? err.stack : void 0 });
  };

  Connection.prototype._handshakeAck = function (_ref10) {
    var pid = _ref10.pid;
    _.dev(function () {
      return pid.should.be.a.String;
    });
    this.push("handshakeAck", { pid: pid });
  };

  _classProps(Connection, null, {
    isDestroyed: {
      get: function () {
        return !!this._isDestroyed;
      }
    },
    isConnected: {
      get: function () {
        return (this._handshakeTimeout === null);
      }
    },
    id: {
      get: function () {
        return this._socket.id;
      }
    }
  });

  return Connection;
})();

_.extend(Connection.prototype, {
  events: null,
  _isDestroyed: null,
  _handshakeTimeout: null,
  _socket: null,
  _stringify: null });

module.exports = Connection;