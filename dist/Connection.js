"use strict";

var _argumentsToArray = function (args) {
  var target = new Array(args.length);
  for (var i = 0; i < args.length; i++) {
    target[i] = args[i];
  }

  return target;
};

var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var __NODE__ = !__BROWSER__;var __BROWSER__ = (typeof window === "object");var __PROD__ = !__DEV__;var __DEV__ = (process.env.NODE_ENV !== "production");var Promise = require("lodash-next").Promise;require("6to5/polyfill");module.exports = function (_ref) {
  var UplinkSimpleServer = _ref.UplinkSimpleServer;
  var _ = require("lodash-next");
  var instanceOfSocketIO = require("./instanceOfSocketIO");

  var ioHandlers = _.mapValues({
    handshake: regeneratorRuntime.mark(function _callee(_ref2) {
      var _this = this;
      var guid, session;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (true) switch (_context.prev = _context.next) {
          case 0: guid = _ref2.guid;
            (function () {
              return _this.handshake.isPending().should.be.ok && guid.should.be.a.String;
            })();
            _context.next = 4;
            return _this.uplink.getSession(guid);
          case 4: session = _context.sent;
            session.attach(_this);
            _this._handshake.resolve(session);
            _this.handshakeAck(_this.uplink.pid);
          case 8:
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

  var _Connection = (function () {
    var _Connection = function _Connection(_ref7) {
      var _this6 = this;
      var socket = _ref7.socket;
      var uplink = _ref7.uplink;
      _.dev(function () {
        return instanceOfSocketIO(socket).should.be.ok && uplink.should.be.an.instanceOf(UplinkSimpleServer);
      });
      this.socket = socket;
      this.uplink = uplink;
      // handshake should resolve to the session this connection will be attached to
      this.handshake = new Promise(function (resolve, reject) {
        return _this6._handshake = { resolve: resolve, reject: reject };
      }).cancellable();
      Object.keys(ioHandlers).forEach(function (event) {
        return socket.on(event, function (params) {
          _.dev(function () {
            return console.warn("nexus-uplink-simple-server", _this6.socket.id, "<<", event, params);
          });
          ioHandlers[event].call(_this6, params)["catch"](function (e) {
            return _this6.err({ err: e.toString(), event: event, params: params, stack: __DEV__ ? e.stack : null });
          });
        });
      });
    };

    _classProps(_Connection, null, {
      id: {
        get: function () {
          return this.socket.id;
        }
      },
      push: {
        writable: true,
        value: function (event, params) {
          _.dev(function () {
            return event.should.be.a.String;
          });
          _.dev(function () {
            return console.warn("nexus-uplink-simple-server", ">>", event, params);
          });
          this.socket.emit(event, params);
        }
      },
      destroy: {
        writable: true,
        value: function () {
          var _this7 = this;
          if (this.handshake.isPending()) {
            this.handshake.cancel();
          } else {
            this.handshake.then(function (session) {
              return session.detach(_this7);
            });
          }
          this.socket.close();
        }
      },
      detach: {
        writable: true,
        value: function () {
          // Improvement opportunity: allow client to re-handshake.
          this.destroy();
        }
      },
      handshakeAck: {
        writable: true,
        value: function (pid) {
          this.push("handshakeAck", { pid: pid });
        }
      },
      update: {
        writable: true,
        value: function (_ref8) {
          var path = _ref8.path;
          var diff = _ref8.diff;
          var hash = _ref8.hash;
          this.push("update", { path: path, diff: diff, hash: hash });
        }
      },
      emit: {
        writable: true,
        value: function (_ref9) {
          var room = _ref9.room;
          var params = _ref9.params;
          this.push("emit", { room: room, params: params });
        }
      },
      debug: {
        writable: true,
        value: function () {
          var args = _argumentsToArray(arguments);

          this.push.apply(this, ["debug"].concat(_toArray(args)));
        }
      },
      log: {
        writable: true,
        value: function () {
          var args = _argumentsToArray(arguments);

          this.push.apply(this, ["log"].concat(_toArray(args)));
        }
      },
      warn: {
        writable: true,
        value: function () {
          var args = _argumentsToArray(arguments);

          this.push.apply(this, ["warn"].concat(_toArray(args)));
        }
      },
      err: {
        writable: true,
        value: function () {
          var args = _argumentsToArray(arguments);

          this.push.apply(this, ["err"].concat(_toArray(args)));
        }
      }
    });

    return _Connection;
  })();

  _.extend(_Connection.prototype, {
    socket: null,
    handshake: null,
    _handshake: null });

  return _Connection;
};