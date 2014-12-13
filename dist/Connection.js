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
  var ioHandlers = _.mapValues({
    handshake: regeneratorRuntime.mark(function _callee(_ref2) {
      var _this = this;
      var guid, session;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (true) switch (_context.prev = _context.next) {
          case 0: guid = _ref2.guid;
            _.dev(function () {
              return guid.should.be.a.String;
            });
            _context.next = 4;
            return _this.uplink.getSession(guid);
          case 4: session = _context.sent;
            session.attach(_this);
            _this._handshake.resolve(session);
            _this._handshake = null;
            _this.handshakeAck(_this.uplink.pid);
          case 9:
          case "end": return _context.stop();
        }
      }, _callee, this);
    }),

    // subscriptions and listeners are stateless from the connections' point of view.
    // its the responsibility of the underlying connection to handle and maintain state.

    subscribeTo: regeneratorRuntime.mark(function _callee2(_ref3) {
      var _this2 = this;
      var path;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (true) switch (_context2.prev = _context2.next) {
          case 0: path = _ref3.path;
            (function () {
              return path.should.be.a.String;
            })();
            _context2.next = 4;
            return _this2.handshake;
          case 4: return _context2.abrupt("return", _context2.sent.subscribeTo(path));
          case 5:
          case "end": return _context2.stop();
        }
      }, _callee2, this);
    }),

    unsubscribeFrom: regeneratorRuntime.mark(function _callee3(_ref4) {
      var _this3 = this;
      var path;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (true) switch (_context3.prev = _context3.next) {
          case 0: path = _ref4.path;
            (function () {
              return path.should.be.a.String;
            })();
            _context3.next = 4;
            return _this3.handshake;
          case 4: return _context3.abrupt("return", _context3.sent.unsubscribeFrom(path));
          case 5:
          case "end": return _context3.stop();
        }
      }, _callee3, this);
    }),

    listenTo: regeneratorRuntime.mark(function _callee4(_ref5) {
      var _this4 = this;
      var room;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (true) switch (_context4.prev = _context4.next) {
          case 0: room = _ref5.room;
            (function () {
              return room.should.be.a.String;
            })();
            _context4.next = 4;
            return _this4.handshake;
          case 4: return _context4.abrupt("return", _context4.sent.listenTo(room));
          case 5:
          case "end": return _context4.stop();
        }
      }, _callee4, this);
    }),

    unlistenFrom: regeneratorRuntime.mark(function _callee5(_ref6) {
      var _this5 = this;
      var room;
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (true) switch (_context5.prev = _context5.next) {
          case 0: room = _ref6.room;
            (function () {
              return room.should.be.a.String;
            })();
            _context5.next = 4;
            return _this5.handshake;
          case 4: return _context5.abrupt("return", _context5.sent.unlistenFrom(room));
          case 5:
          case "end": return _context5.stop();
        }
      }, _callee5, this);
    }) }, _.co.wrap);

  var Connection = (function () {
    var Connection = function Connection(_ref7) {
      var _this6 = this;
      var socket = _ref7.socket;
      var uplink = _ref7.uplink;
      _.dev(function () {
        return instanceOfEngineIOSocket(socket).should.be.ok && uplink.should.be.an.instanceOf(UplinkSimpleServer);
      });
      this._destroyed = false;
      this.socket = socket;
      this.uplink = uplink;
      // handshake should resolve to the session this connection will be attached to
      this.handshake = new Promise(function (resolve, reject) {
        return _this6._handshake = { resolve: resolve, reject: reject };
      }).timeout(HANDSHAKE_TIMEOUT, "Handshake timeout expired.").cancellable();
      socket.on("error", function (err) {
        return _this6.handleError(err);
      });
      socket.on("message", function (json) {
        return _this6.handleMessage(json);
      });
    };

    Connection.prototype.handleError = function (err) {
      var _this7 = this;
      _.dev(function () {
        return console.error("nexus-uplink-simple-server", _this7.socket.id, "<<", err.toString());
      });
    };

    Connection.prototype.handleMessage = function (json) {
      var _this8 = this;
      _.dev(function () {
        return json.should.be.a.String;
      });
      try {
        (function () {
          var message = JSON.parse(json);
          (function () {
            return (message.event !== void 0).should.be.ok && (message.params !== void 0).should.be.ok;
          })();
          var event = message.event;
          var params = message.params;
          (function () {
            return event.should.be.a.String && (ioHandlers[event] !== void 0).should.be.ok;
          })();
          (function () {
            return params.should.be.an.Object;
          })();
          ioHandlers[event].call(_this8, params)["catch"](function (err) {
            return _this8["throw"](err);
          });
        })();
      } catch (err) {
        return this["throw"](err);
      }
    };

    Connection.prototype["throw"] = function (err) {
      this.push("err", { err: err.toString(), stack: __DEV__ ? err.stack : void 0 });
    };

    Connection.prototype.push = function (event, params) {
      var _this9 = this;
      _.dev(function () {
        return event.should.be.a.String && (params === null || _.isObject(params)).should.be.ok && _this9.shouldNotBeDestroyed && _this9.shouldBeConnected;
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
        return _this10.shouldNotBeDestroyed;
      });
      if (this._handshake) {
        this.handshake.cancel(new Error("Connection destroyed."));
      } else {
        this.handshake.then(function (session) {
          return session.detach(_this10);
        });
      }
      if (this.isConnected) {
        this.socket.close();
      }
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", _this10.socket.id, "!!", "destroy");
      });
    };

    Connection.prototype.handshakeAck = function (pid) {
      this.push("handshakeAck", { pid: pid });
    };

    Connection.prototype.update = function (_ref8) {
      var path = _ref8.path;
      var diff = _ref8.diff;
      var hash = _ref8.hash;
      this.push("update", { path: path, diff: diff, hash: hash });
    };

    Connection.prototype.emit = function (_ref9) {
      var room = _ref9.room;
      var params = _ref9.params;
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
      shouldNotBeDestroyed: {
        get: function () {
          return this._destroyed.should.not.be.ok;
        }
      },
      shouldBeConnected: {
        get: function () {
          return this.isConnected.should.be.ok;
        }
      },
      isConnected: {
        get: function () {
          return this.socket.readyState === "open";
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
    socket: null,
    handshake: null,
    _handshake: null,
    _destroyed: null });

  return Connection;
};