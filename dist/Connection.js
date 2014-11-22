"use strict";

var _slice = Array.prototype.slice;
var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = require("bluebird");var __DEV__ = (process.env.NODE_ENV !== "production");
module.exports = function (_ref) {
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
            return console.warn("nexus-uplink-simple-server", "<<", event, params);
          });
          ioHandlers[event].call(_this6, params)["catch"](function (e) {
            _this6.err({ err: e.toString(), event: event, params: params, stack: __DEV__ ? e.stack : null });
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
          var args = _slice.call(arguments);

          this.push.apply(this, ["debug"].concat(Array.from(args)));
        }
      },
      log: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          this.push.apply(this, ["log"].concat(Array.from(args)));
        }
      },
      warn: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          this.push.apply(this, ["warn"].concat(Array.from(args)));
        }
      },
      err: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          this.push.apply(this, ["err"].concat(Array.from(args)));
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
//# sourceMappingURL=data:application/json;base64,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QUFJLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxDQUFDLENBQUM7U0FDM0M7O0FBRUQsVUFBSTs7ZUFBQSxpQkFBbUI7Y0FBaEIsSUFBSSxTQUFKLElBQUk7Y0FBRSxNQUFNLFNBQU4sTUFBTTtBQUNqQixjQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsTUFBTSxFQUFOLE1BQU0sRUFBRSxDQUFDLENBQUM7U0FDckM7O0FBRUQsV0FBSzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDWCxjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLE9BQU8sb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDN0I7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLEtBQUssb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDM0I7O0FBRUQsVUFBSTs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVixjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLE1BQU0sb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDNUI7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLEtBQUssb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDM0I7Ozs7V0F6RUcsV0FBVTs7O0FBNEVoQixHQUFDLENBQUMsTUFBTSxDQUFDLFdBQVUsQ0FBQyxTQUFTLEVBQUU7QUFDN0IsVUFBTSxFQUFFLElBQUk7QUFDWixhQUFTLEVBQUUsSUFBSTtBQUNmLGNBQVUsRUFBRSxJQUFJLEVBQ2pCLENBQUMsQ0FBQzs7QUFFSCxTQUFPLFdBQVUsQ0FBQztDQUNuQixDQUFDIiwiZmlsZSI6IkNvbm5lY3Rpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHsgVXBsaW5rU2ltcGxlU2VydmVyIH0pIHtcbiAgY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG4gIGNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5cbiAgY29uc3QgaW9IYW5kbGVycyA9IF8ubWFwVmFsdWVzKHtcbiAgICAqaGFuZHNoYWtlKHsgZ3VpZCB9KSB7XG4gICAgICAoKCkgPT4gdGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkuc2hvdWxkLmJlLm9rICYmIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKSgpO1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IHlpZWxkIHRoaXMudXBsaW5rLmdldFNlc3Npb24oZ3VpZCk7XG4gICAgICBzZXNzaW9uLmF0dGFjaCh0aGlzKTtcbiAgICAgIHRoaXMuX2hhbmRzaGFrZS5yZXNvbHZlKHNlc3Npb24pO1xuICAgICAgdGhpcy5oYW5kc2hha2VBY2sodGhpcy51cGxpbmsucGlkKTtcbiAgICB9LFxuXG4gICAgLy8gc3Vic2NyaXB0aW9ucyBhbmQgbGlzdGVuZXJzIGFyZSBzdGF0ZWxlc3MgZnJvbSB0aGUgY29ubmVjdGlvbnMnIHBvaW50IG9mIHZpZXcuXG4gICAgLy8gaXRzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uIHRvIGhhbmRsZSBhbmQgbWFpbnRhaW4gc3RhdGUuXG5cbiAgICAqc3Vic2NyaWJlVG8oeyBwYXRoIH0pIHtcbiAgICAgICgoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZykoKTtcbiAgICAgIHJldHVybiAoeWllbGQgdGhpcy5oYW5kc2hha2UpLnN1YnNjcmliZVRvKHBhdGgpO1xuICAgIH0sXG5cbiAgICAqdW5zdWJzY3JpYmVGcm9tKHsgcGF0aCB9KSB7XG4gICAgICAoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcpKCk7XG4gICAgICByZXR1cm4gKHlpZWxkIHRoaXMuaGFuZHNoYWtlKS51bnN1YnNjcmliZUZyb20ocGF0aCk7XG4gICAgfSxcblxuICAgICpsaXN0ZW5Ubyh7IHJvb20gfSkge1xuICAgICAgKCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nKSgpO1xuICAgICAgcmV0dXJuICh5aWVsZCB0aGlzLmhhbmRzaGFrZSkubGlzdGVuVG8ocm9vbSk7XG4gICAgfSxcblxuICAgICp1bmxpc3RlbkZyb20oeyByb29tIH0pIHtcbiAgICAgICgoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZykoKTtcbiAgICAgIHJldHVybiAoeWllbGQgdGhpcy5oYW5kc2hha2UpLnVubGlzdGVuRnJvbShyb29tKTtcbiAgICB9LFxuICB9LCBfLmNvLndyYXApO1xuXG4gIGNsYXNzIENvbm5lY3Rpb24ge1xuICAgIGNvbnN0cnVjdG9yKHsgc29ja2V0LCB1cGxpbmsgfSkge1xuICAgICAgXy5kZXYoKCkgPT4gaW5zdGFuY2VPZlNvY2tldElPKHNvY2tldCkuc2hvdWxkLmJlLm9rICYmXG4gICAgICAgIHVwbGluay5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihVcGxpbmtTaW1wbGVTZXJ2ZXIpXG4gICAgICApO1xuICAgICAgdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG4gICAgICB0aGlzLnVwbGluayA9IHVwbGluaztcbiAgICAgIC8vIGhhbmRzaGFrZSBzaG91bGQgcmVzb2x2ZSB0byB0aGUgc2Vzc2lvbiB0aGlzIGNvbm5lY3Rpb24gd2lsbCBiZSBhdHRhY2hlZCB0b1xuICAgICAgdGhpcy5oYW5kc2hha2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB0aGlzLl9oYW5kc2hha2UgPSB7IHJlc29sdmUsIHJlamVjdCB9KS5jYW5jZWxsYWJsZSgpO1xuICAgICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAgIC5mb3JFYWNoKChldmVudCkgPT5cbiAgICAgICAgc29ja2V0Lm9uKGV2ZW50LCAocGFyYW1zKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstc2ltcGxlLXNlcnZlcicsICc8PCcsIGV2ZW50LCBwYXJhbXMpKTtcbiAgICAgICAgICBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIHBhcmFtcylcbiAgICAgICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZXJyKHsgZXJyOiBlLnRvU3RyaW5nKCksIGV2ZW50LCBwYXJhbXMsIHN0YWNrOiBfX0RFVl9fID8gZS5zdGFjayA6IG51bGwgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIGdldCBpZCgpIHtcbiAgICAgIHJldHVybiB0aGlzLnNvY2tldC5pZDtcbiAgICB9XG5cbiAgICBwdXNoKGV2ZW50LCBwYXJhbXMpIHtcbiAgICAgIF8uZGV2KCgpID0+IGV2ZW50LnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oJ25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyJywgJz4+JywgZXZlbnQsIHBhcmFtcykpO1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdChldmVudCwgcGFyYW1zKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgaWYodGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkpIHtcbiAgICAgICAgdGhpcy5oYW5kc2hha2UuY2FuY2VsKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5oYW5kc2hha2VcbiAgICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24uZGV0YWNoKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc29ja2V0LmNsb3NlKCk7XG4gICAgfVxuXG4gICAgZGV0YWNoKCkge1xuICAgICAgLy8gSW1wcm92ZW1lbnQgb3Bwb3J0dW5pdHk6IGFsbG93IGNsaWVudCB0byByZS1oYW5kc2hha2UuXG4gICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBoYW5kc2hha2VBY2socGlkKSB7XG4gICAgICB0aGlzLnB1c2goJ2hhbmRzaGFrZUFjaycsIHsgcGlkIH0pO1xuICAgIH1cblxuICAgIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgICAgdGhpcy5wdXNoKCd1cGRhdGUnLCB7IHBhdGgsIGRpZmYsIGhhc2ggfSk7XG4gICAgfVxuXG4gICAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XG4gICAgICB0aGlzLnB1c2goJ2VtaXQnLCB7IHJvb20sIHBhcmFtcyB9KTtcbiAgICB9XG5cbiAgICBkZWJ1ZyguLi5hcmdzKSB7XG4gICAgICB0aGlzLnB1c2goJ2RlYnVnJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMucHVzaCgnbG9nJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgd2FybiguLi5hcmdzKSB7XG4gICAgICB0aGlzLnB1c2goJ3dhcm4nLCAuLi5hcmdzKTtcbiAgICB9XG5cbiAgICBlcnIoLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCdlcnInLCAuLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBfLmV4dGVuZChDb25uZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIHNvY2tldDogbnVsbCxcbiAgICBoYW5kc2hha2U6IG51bGwsXG4gICAgX2hhbmRzaGFrZTogbnVsbCxcbiAgfSk7XG5cbiAgcmV0dXJuIENvbm5lY3Rpb247XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9