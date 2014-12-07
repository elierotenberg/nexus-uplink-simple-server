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
  var UplinkSimpleServer = _ref.UplinkSimpleServer;
  var _ = require("lodash-next");

  var EXPIRE_TIMEOUT = 30000;

  var Session = (function () {
    var Session = function Session(_ref2) {
      var guid = _ref2.guid;
      var uplink = _ref2.uplink;
      _.dev(function () {
        return guid.should.be.a.String && uplink.should.be.an.instanceOf(UplinkSimpleServer);
      });
      _.extend(this, { guid: guid, uplink: uplink });
      this.connections = {};

      this.subscriptions = {};
      this.listeners = {};

      this.timeout = null;
      this.expired = false;
      this.pause();
    };

    Session.prototype.destroy = function () {
      var _this = this;
      if (this.timeout !== null) {
        clearTimeout(this.timeout);
      }
      Object.keys(this.connections).forEach(function (id) {
        return _this.detach(_this.connections[id]);
      });
      Object.keys(this.subscriptions).forEach(function (path) {
        return _this.unsubscribeFrom(path);
      });
      Object.keys(this.listeners).forEach(function (room) {
        return _this.unlistenFrom(room);
      });
    };

    Session.prototype.proxy = function (method) {
      return _.scope(function () {
        var _this2 = this;
        var args = _slice.call(arguments);

        return Object.keys(this.connections).map(function (id) {
          return _this2.connections[id][method].apply(_this2.connections[id], _toArray(args));
        });
      }, this);
    };

    Session.prototype.attach = function (connection) {
      var _this3 = this;
      _.dev(function () {
        return connection.should.be.an.instanceOf(Connection) && (_this3.connections[connection.id] === void 0).should.be.ok;
      });
      this.connections[connection.id] = connection;
      // If the session was paused (no connec attached)
      // then resume it
      if (this.paused) {
        this.resume();
      }
      return this;
    };

    Session.prototype.expire = function () {
      var _this4 = this;
      this.expired = true;
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", "!!", "expire", _this4.guid);
      });
      return this.uplink.deleteSession(this.guid);
    };

    Session.prototype.pause = function () {
      var _this5 = this;
      _.dev(function () {
        return _this5.paused.should.not.be.ok;
      });
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", "!!", "pause", _this5.guid);
      });
      this.timeout = setTimeout(function () {
        return _this5.expire();
      }, EXPIRE_TIMEOUT);
      return this;
    };

    Session.prototype.resume = function () {
      var _this6 = this;
      _.dev(function () {
        return _this6.paused.should.be.ok;
      });
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", "!!", "resume", _this6.guid);
      });
      // Prevent the expiration timeout
      clearTimeout(this.timeout);
      this.timeout = null;
      return this;
    };

    Session.prototype.detach = function (connection) {
      var _this7 = this;
      _.dev(function () {
        return connection.should.be.an.instanceOf(Connection) && (_this7.connections[connection.id] !== void 0).should.be.ok && _this7.connections[connection.id].should.be.exactly(connection);
      });
      delete this.connections[connection.id];
      // If this was the last connection, pause the session
      // and start the expire countdown
      if (Object.keys(this.connections).length === 0) {
        this.pause();
      }
      return this;
    };

    Session.prototype.update = function (_ref3) {
      var path = _ref3.path;
      var diff = _ref3.diff;
      var hash = _ref3.hash;
      return this.proxy("update")({ path: path, diff: diff, hash: hash });
    };

    Session.prototype.subscribeTo = function (path) {
      var _this8 = this;
      _.dev(function () {
        return path.should.be.a.String && (_this8.subscriptions[path] === void 0).should.be.ok;
      });
      this.subscriptions[path] = true;
      return this.uplink.subscribeTo(path, this);
    };

    Session.prototype.unsubscribeFrom = function (path) {
      var _this9 = this;
      _.dev(function () {
        return path.should.be.a.String && (_this9.subscriptions[path] !== void 0).should.be.ok;
      });
      delete this.subscriptions[path];
      return this.uplink.unsubscribeFrom(path, this);
    };

    Session.prototype.emit = function (_ref4) {
      var room = _ref4.room;
      var params = _ref4.params;
      return this.proxy("emit")({ room: room, params: params });
    };

    Session.prototype.listenTo = function (room) {
      var _this10 = this;
      _.dev(function () {
        return room.should.be.a.String && (_this10.listeners[room] === void 0).should.be.ok;
      });
      this.listeners[room] = true;
      return this.uplink.listenTo(room, this);
    };

    Session.prototype.unlistenFrom = function (room) {
      var _this11 = this;
      _.dev(function () {
        return room.should.be.a.String && (_this11.listeners[room] !== void 0).should.be.ok;
      });
      delete this.listeners[room];
      return this.uplink.unlistenFrom(room, this);
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
      paused: {
        get: function () {
          return (this.timeout !== null);
        }
      }
    });

    return Session;
  })();

  _.extend(Session.prototype, {
    guid: null,
    uplink: null,
    connections: null,
    timeout: null,
    expired: null,
    subscriptions: null,
    listeners: null });

  return Session;
};