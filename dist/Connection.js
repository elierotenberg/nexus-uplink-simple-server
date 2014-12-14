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
  var UplinkSimpleServer = _ref.UplinkSimpleServer;
  var _ = require("lodash-next");
  var instanceOfEngineIOSocket = require("./instanceOfEngineIOSocket");

  var HANDSHAKE_TIMEOUT = 5000;

  var Connection = (function () {
    var Connection = function Connection(_ref2) {
      var _this = this;
      var socket = _ref2.socket;
      var uplink = _ref2.uplink;
      _.dev(function () {
        return instanceOfEngineIOSocket(socket).should.be.ok && uplink.should.be.an.instanceOf(UplinkSimpleServer);
      });
      this._handshake = new Promise(function (resolve, reject) {
        _this._handshakeResolve = resolve;
        _this._handshakeReject = reject;
      }).timeout(HANDSHAKE_TIMEOUT).cancellable();
      _.extend(this, {
        _isDestroyed: false,
        _isConnected: false,
        _guid: null,
        _session: null,
        socket: socket,
        uplink: uplink });
      socket.on("error", function (err) {
        return _this.handleError(err);
      });
      socket.on("message", function (json) {
        return _this.handleMessage(json);
      });

      ["handleMessageHanshake", "handleMessageSubscribeTo", "handleMessageUnsubscribeFrom", "handleMessageListenTo", "handleMessageUnlistenFrom"].forEach(function (method) {
        return _this[method] = Promise.coroutine(_this[method]);
      });
    };

    Connection.prototype.handleError = function (err) {
      var _this2 = this;
      _.dev(function () {
        return console.error("nexus-uplink-simple-server", _this2.socket.id, "<<", err.toString());
      });
    };

    Connection.prototype.handleMessage = function (json) {
      var _this3 = this;
      _.dev(function () {
        return json.should.be.a.String;
      });
      return Promise["try"](function () {
        var _ref3 = JSON.parse(json);

        var event = _ref3.event;
        var params = _ref3.params;
        event.should.be.a.String;
        (params === null || _.isObject(params)).should.be.ok;
        if (event === "handshake") {
          return _this3.handleMessageHanshake(params);
        }
        if (event === "subscribeTo") {
          return _this3.handleMessageSubscribeTo(params);
        }
        if (event === "unsubscribeFrom") {
          return _this3.handleMessageUnsubscribeFrom(params);
        }
        if (event === "listenTo") {
          return _this3.handleMessageListenTo(params);
        }
        if (event === "unlistenFrom") {
          return _this3.handleMessageUnlistenFrom(params);
        }
        throw new Error("Unknown event type: " + event);
      })["catch"](function (err) {
        return _this3["throw"](err);
      });
    };

    Connection.prototype.handleMessageHanshake = regeneratorRuntime.mark(function _callee(_ref4) {
      var _this4 = this;
      var guid, session;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (true) switch (_context.prev = _context.next) {
          case 0: guid = _ref4.guid;
            // jshint ignore:line
            _this4.isConnected.should.not.be.ok;
            guid.should.be.a.String;
            _context.next = 5;
            return _this4.uplink.getSession(guid);
          case 5: session = _context.sent;
            // jshint ignore:line
            // Check that we are still not connected (since yield is async)
            _this4.isConnected.should.not.be.ok;
            session.attach(_this4);
            _this4._isConnected = true;
            _this4._guid = guid;
            _this4._session = session;
            _this4._handshakeResolve(session);
            _this4.handshakeAck({ pid: _this4.uplink.pid });
          case 13:
          case "end": return _context.stop();
        }
      }, _callee, this);
    });
    Connection.prototype.handleMessageSubscribeTo = regeneratorRuntime.mark(function _callee2(_ref5) {
      var _this5 = this;
      var path, session;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (true) switch (_context2.prev = _context2.next) {
          case 0: path = _ref5.path;
            // jshint ignore:line
            path.should.be.a.String;
            _context2.next = 4;
            return _this5._handshake;
          case 4: session = _context2.sent;
            // jshint ignore:line
            session.subscribeTo(path);
          case 6:
          case "end": return _context2.stop();
        }
      }, _callee2, this);
    });
    Connection.prototype.handleMessageUnsubscribeFrom = regeneratorRuntime.mark(function _callee3(_ref6) {
      var _this6 = this;
      var path, session;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (true) switch (_context3.prev = _context3.next) {
          case 0: path = _ref6.path;
            // jshint ignore:line
            path.should.be.a.String;
            _context3.next = 4;
            return _this6._handshake;
          case 4: session = _context3.sent;
            // jshint ignore:line
            session.unsubscribeFrom(path);
          case 6:
          case "end": return _context3.stop();
        }
      }, _callee3, this);
    });
    Connection.prototype.handleMessageListenTo = regeneratorRuntime.mark(function _callee4(_ref7) {
      var _this7 = this;
      var room, session;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (true) switch (_context4.prev = _context4.next) {
          case 0: room = _ref7.room;
            // jshint ignore:line
            room.should.be.a.String;
            _context4.next = 4;
            return _this7._handshake;
          case 4: session = _context4.sent;
            // jshint ignore:line
            session.listenTo(room);
          case 6:
          case "end": return _context4.stop();
        }
      }, _callee4, this);
    });
    Connection.prototype.handleMessageUnlistenFrom = regeneratorRuntime.mark(function _callee5(_ref8) {
      var _this8 = this;
      var room, session;
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (true) switch (_context5.prev = _context5.next) {
          case 0: room = _ref8.room;
            // jshint ignore:line
            room.should.be.a.String;
            _context5.next = 4;
            return _this8._handshake;
          case 4: session = _context5.sent;
            // jshint ignore:line
            session.unlistenFrom(room);
          case 6:
          case "end": return _context5.stop();
        }
      }, _callee5, this);
    });
    Connection.prototype["throw"] = function (err) {
      this.push("err", { err: err.toString(), stack: __DEV__ ? err.stack : void 0 });
    };

    Connection.prototype.push = function (event, params) {
      var _this9 = this;
      _.dev(function () {
        return event.should.be.a.String && (params === null || _.isObject(params)).should.be.ok && _this9.isDestroyed.should.not.be.ok;
      });
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", _this9.socket.id, ">>", event, params);
      });
      var message = { event: event, params: params };
      var json = this.uplink.stringify(message);
      this.socket.send(json);
    };

    Connection.prototype.destroy = function () {
      var _this10 = this;
      _.dev(function () {
        return _this10.isDestroyed.should.not.be.ok;
      });
      if (this._session) {
        this._session.detach(this);
      }
      this._handshake.cancel(new Error("Connection destroyed"));
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", _this10.socket.id, "!!", "destroy");
      });
    };

    Connection.prototype.handshakeAck = function (_ref9) {
      var pid = _ref9.pid;
      _.dev(function () {
        return pid.should.be.a.String;
      });
      this.push("handshakeAck", { pid: pid });
    };

    Connection.prototype.update = function (_ref10) {
      var path = _ref10.path;
      var diff = _ref10.diff;
      var hash = _ref10.hash;
      _.dev(function () {
        return path.should.be.a.String && diff.should.be.an.Object && (hash === null || _.isString(hash)).should.be.ok;
      });
      this.push("update", { path: path, diff: diff, hash: hash });
    };

    Connection.prototype.emit = function (_ref11) {
      var room = _ref11.room;
      var params = _ref11.params;
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

    _classProps(Connection, null, {
      isDestroyed: {
        get: function () {
          return !!this._isDestroyed;
        }
      },
      isConnected: {
        get: function () {
          return !!this._isConnected;
        }
      },
      id: {
        get: function () {
          return this.socket.id;
        }
      }
    });

    return Connection;
  })();

  _.extend(Connection.prototype, {
    _isDestroyed: null,
    _isConnected: null,
    _guid: null,
    _session: null,
    socket: null,
    uplink: null,
    _handshake: null,
    _handshakeResolve: null,
    _handshakeReject: null });

  return Connection;
};