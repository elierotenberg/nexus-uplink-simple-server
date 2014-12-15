"use strict";

var _slice = Array.prototype.slice;
var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;module.exports = function (_ref) {
  var Connection = _ref.Connection;
  var _ = require("lodash-next");
  var EventEmitter = require("event").EventEmitter;

  var DEFAULT_ACTIVITY_TIMEOUT = 10000;

  var actions = ["subscribeTo", "unsubscribeFrom", "listenTo", "unlistenFrom"];

  var Session = (function () {
    var Session = function Session(_ref2) {
      var _this = this;
      var guid = _ref2.guid;
      var activityTimeout = _ref2.activityTimeout;
      activityTimeout = activityTimeout || DEFAULT_ACTIVITY_TIMEOUT;
      _.dev(function () {
        return guid.should.be.a.String && activityTimeout.should.be.a.Number.and.not.be.below(0);
      });
      _.extend(this, {
        events: new EventEmitter(),
        _guid: guid,
        _activityTimeout: activityTimeout,
        _connections: {},
        _subscriptions: {},
        _listeners: {},
        _expireTimeout: null });
      this._isDestroyed = false;
      this.pause();
      actions.forEach(function (action) {
        return _this["_" + action] = _.scope(_this["_" + action], _this);
      });
    };

    Session.prototype.destroy = function () {
      var _this2 = this;
      if (this._expireTimeout !== null) {
        clearTimeout(this._expireTimeout);
        this._expireTimeout = null;
      }
      Object.keys(this._connections).forEach(function (id) {
        return _this2.detachConnection(_this2._connections[id]);
      });
      this._connections = null;
      Object.keys(this._subscriptions).forEach(this._unsubscribeFrom);
      this._subscriptions = null;
      Object.keys(this._listeners).forEach(this._unlistenFrom);
      this._listeners = null;
      this.events.emit("destroy");
      this.events.removeAllListeners();
      this.events = null;
    };

    Session.prototype.proxy = function (method) {
      return _.scope(function () {
        var _this3 = this;
        var args = _slice.call(arguments);

        return Object.keys(this._connections).map(function (id) {
          return _this3.connections[id][method].apply(_this3.connections[id], _toArray(args));
        });
      }, this);
    };

    Session.prototype.attachConnection = function (connection) {
      var _this4 = this;
      _.dev(function () {
        return connection.should.be.an.instanceOf(Connection) && (_this4._connections[connection.id] === void 0).should.be.ok;
      });
      this._connections[connection.id] = connection;
      actions.forEach(function (action) {
        return connection.addListener(action, _this4["_" + action]);
      });
      if (this.isPaused) {
        this.resume();
      }
      return this;
    };

    Session.prototype.detachConnection = function (connection) {
      var _this5 = this;
      _.dev(function () {
        return connection.should.be.an.instanceOf(Connection) && (_this5._connections[connection.id] !== void 0).should.be.ok && _this5._connections[connection.id].should.be.exactly(connection);
      });
      delete this._connections[connection.id];
      actions.forEach(function (action) {
        return connection.removeListener(action, _this5["_" + action]);
      });
      if (Object.keys(this._connections).length === 0) {
        this.pause();
      }
      return this;
    };

    Session.prototype.pause = function () {
      var _this6 = this;
      this.isPaused.should.not.be.ok;
      _.dev(function () {
        return Object.keys(_this6._connections).length.should.be.exactly(0);
      });
      this._expireTimeout = setTimeout(function () {
        return _this6._handleExpire();
      }, this._activityTimeout);
      this.events.emit("pause");
      return this;
    };

    Session.prototype.resume = function () {
      var _this7 = this;
      this.isPaused.should.be.ok;
      _.dev(function () {
        return Object.keys(_this7._connections).length.should.be.above(0);
      });
      clearTimeout(this._expireTimeout);
      this._expireTimeout = null;
      this.events.emit("resume");
      return this;
    };

    Session.prototype._handleExpire = function () {
      this.events.emit("expire");
    };

    Session.prototype.update = function (_ref3) {
      var path = _ref3.path;
      var diff = _ref3.diff;
      var hash = _ref3.hash;
      _.dev(function () {
        return path.should.be.a.String;
      });
      if (this._subscriptions[path] !== void 0) {
        this.proxy("update")({ path: path, diff: diff, hash: hash });
      }
      return this;
    };

    Session.prototype.emit = function (_ref4) {
      var room = _ref4.room;
      var params = _ref4.params;
      _.dev(function () {
        return room.should.be.a.String && (params === null || _.isObject(params)).should.be.ok;
      });
      if (this._listeners[room] !== void 0) {
        this.proxy("emit")({ room: room, params: params });
      }
      return this;
    };

    Session.prototype._subscribeTo = function (path) {
      _.dev(function () {
        return path.should.be.a.String;
      });
      if (this._subscriptions[path] !== void 0) {
        return this;
      }
      this._subscriptions[path] = true;
      this.events.emit("subscribeTo", path);
      return this;
    };

    Session.prototype._unsubscribeFrom = function (path) {
      var _this8 = this;
      _.dev(function () {
        return path.should.be.a.String && (_this8._subscriptions[path] !== void 0).should.be.ok;
      });
      delete this._subscriptions[path];
      this.events.emit("unsubscribeFrom", path);
      return this;
    };

    Session.prototype._listenTo = function (room) {
      _.dev(function () {
        return room.should.be.a.String;
      });
      if (this._listeners[room] !== void 0) {
        return this;
      }
      this._listeners[room] = true;
      this.events.emit("listenTo", room);
      return this;
    };

    Session.prototype._unlistenFrom = function (room) {
      var _this9 = this;
      _.dev(function () {
        return room.should.be.a.String && (_this9._listeners[room] !== void 0).should.be.ok;
      });
      delete this._listeners[room];
      this.events.emit("unlistenFrom", room);
      return this;
    };

    Session.prototype.debug = function () {
      var args = _slice.call(arguments);

      return this.proxy("debug").apply(null, _toArray(args));
    };

    Session.prototype.log = function () {
      var args = _slice.call(arguments);

      return this.proxy("log").apply(null, _toArray(args));
    };

    Session.prototype.warn = function () {
      var args = _slice.call(arguments);

      return this.proxy("warn").apply(null, _toArray(args));
    };

    Session.prototype.err = function () {
      var args = _slice.call(arguments);

      return this.proxy("err").apply(null, _toArray(args));
    };

    _classProps(Session, null, {
      guid: {
        get: function () {
          return this._guid;
        }
      },
      isPaused: {
        get: function () {
          return (this._expireTimeout !== null);
        }
      }
    });

    return Session;
  })();

  _.extend(Session.prototype, {
    events: null,
    _guid: null,
    _activityTimeout: null,
    _connections: null,
    _subscriptions: null,
    _listeners: null,
    _expireTimeout: null });

  return Session;
};