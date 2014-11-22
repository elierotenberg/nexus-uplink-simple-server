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

  var ioHandlers = {
    handshake: function (_ref2) {
      var _this = this;
      var guid = _ref2.guid;
      return Promise["try"](function () {
        // shadok assert
        (function () {
          return _this.handshake.isPending().should.not.be.ok && guid.should.be.a.String;
        })();
        _this.uplink.getSession(guid).then(function (session) {
          session.attach(_this);
          _this._handshake.resolve(session);
          return _this.handshakeAck(_this.uplink.pid);
        });
      });
    },

    // subscriptions and listeners are stateless from the connections' point of view.
    // its the responsibility of the underlying connection to handle and maintain state.

    subscribeTo: function (_ref3) {
      var path = _ref3.path;
      return this.handshake.then(function (session) {
        return session.subscribeTo(path);
      });
    },

    unsubscribeFrom: function (_ref4) {
      var path = _ref4.path;
      return this.handshake.then(function (session) {
        return session.unsubscribeFrom(path);
      });
    },

    listenTo: function (_ref5) {
      var room = _ref5.room;
      return this.handshake.then(function (session) {
        return session.listenTo(room);
      });
    },

    unlistenFrom: function (_ref6) {
      var room = _ref6.room;
      return this.handshake.then(function (session) {
        return session.listenTo(room);
      });
    } };

  var _Connection = (function () {
    var _Connection = function _Connection(_ref7) {
      var _this2 = this;
      var socket = _ref7.socket;
      var uplink = _ref7.uplink;
      _.dev(function () {
        return instanceOfSocketIO(socket).should.be.ok && uplink.should.be.an.instanceOf(UplinkSimpleServer);
      });
      this.socket = socket;
      // handshake should resolve to the session this connection will be attached to
      this.handshake = new Promise(function (resolve, reject) {
        return _this2._handshake = { resolve: resolve, reject: reject };
      }).cancellable();
      Object.keys(ioHandlers).forEach(function (event) {
        return socket.on(event, function (params) {
          _.dev(function () {
            return console.warn("nexus-uplink-simple-server", "<<", event, params);
          });
          return ioHandlers[event].call(_this2, params) // only 1 synthetic 'params' object should be enough
          // and it avoid reading from arguments.
          ["catch"](function (e) {
            var stack = null;
            var _err = e.toString();
            if (__DEV__) {
              stack = e.stack;
            }
            _this2.err({ err: err, event: event, params: params, stack: stack });
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
          var _this3 = this;
          if (this.handshake.isPending()) {
            this.handshake.cancel();
          } else {
            this.handshake.then(function (session) {
              return session.detach(_this3);
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
//# sourceMappingURL=data:application/json;base64,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QUUsTUFBTSxTQUFOLE1BQU07QUFDakIsY0FBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsQ0FBQyxDQUFDO1NBQ3JDOztBQUVELFdBQUs7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1gsY0FBSSxDQUFDLElBQUksTUFBQSxDQUFULElBQUksR0FBTSxPQUFPLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQzdCOztBQUVELFNBQUc7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1QsY0FBSSxDQUFDLElBQUksTUFBQSxDQUFULElBQUksR0FBTSxLQUFLLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQzNCOztBQUVELFVBQUk7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1YsY0FBSSxDQUFDLElBQUksTUFBQSxDQUFULElBQUksR0FBTSxNQUFNLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQzVCOztBQUVELFNBQUc7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1QsY0FBSSxDQUFDLElBQUksTUFBQSxDQUFULElBQUksR0FBTSxLQUFLLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQzNCOzs7O1dBOUVHLFdBQVU7OztBQWlGaEIsR0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFVLENBQUMsU0FBUyxFQUFFO0FBQzdCLFVBQU0sRUFBRSxJQUFJO0FBQ1osYUFBUyxFQUFFLElBQUk7QUFDZixjQUFVLEVBQUUsSUFBSSxFQUNqQixDQUFDLENBQUM7O0FBRUgsU0FBTyxXQUFVLENBQUM7Q0FDbkIsQ0FBQyIsImZpbGUiOiJDb25uZWN0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih7IFVwbGlua1NpbXBsZVNlcnZlciB9KSB7XG4gIGNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuICBjb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xuXG4gIGNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gICAgaGFuZHNoYWtlKHsgZ3VpZCB9KSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS50cnkoKCkgPT4ge1xuICAgICAgICAvLyBzaGFkb2sgYXNzZXJ0XG4gICAgICAgICgoKSA9PiB0aGlzLmhhbmRzaGFrZS5pc1BlbmRpbmcoKS5zaG91bGQubm90LmJlLm9rICYmIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKSgpO1xuICAgICAgICB0aGlzLnVwbGluay5nZXRTZXNzaW9uKGd1aWQpXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgc2Vzc2lvbi5hdHRhY2godGhpcyk7XG4gICAgICAgICAgdGhpcy5faGFuZHNoYWtlLnJlc29sdmUoc2Vzc2lvbik7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlQWNrKHRoaXMudXBsaW5rLnBpZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8vIHN1YnNjcmlwdGlvbnMgYW5kIGxpc3RlbmVycyBhcmUgc3RhdGVsZXNzIGZyb20gdGhlIGNvbm5lY3Rpb25zJyBwb2ludCBvZiB2aWV3LlxuICAgIC8vIGl0cyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbiB0byBoYW5kbGUgYW5kIG1haW50YWluIHN0YXRlLlxuXG4gICAgc3Vic2NyaWJlVG8oeyBwYXRoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24uc3Vic2NyaWJlVG8ocGF0aCkpO1xuICAgIH0sXG5cbiAgICB1bnN1YnNjcmliZUZyb20oeyBwYXRoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24udW5zdWJzY3JpYmVGcm9tKHBhdGgpKTtcbiAgICB9LFxuXG4gICAgbGlzdGVuVG8oeyByb29tIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24ubGlzdGVuVG8ocm9vbSkpO1xuICAgIH0sXG5cbiAgICB1bmxpc3RlbkZyb20oeyByb29tIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24ubGlzdGVuVG8ocm9vbSkpO1xuICAgIH0sXG4gIH07XG5cbiAgY2xhc3MgQ29ubmVjdGlvbiB7XG4gICAgY29uc3RydWN0b3IoeyBzb2NrZXQsIHVwbGluayB9KSB7XG4gICAgICBfLmRldigoKSA9PiBpbnN0YW5jZU9mU29ja2V0SU8oc29ja2V0KS5zaG91bGQuYmUub2sgJiZcbiAgICAgICAgdXBsaW5rLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFVwbGlua1NpbXBsZVNlcnZlcilcbiAgICAgICk7XG4gICAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcbiAgICAgIC8vIGhhbmRzaGFrZSBzaG91bGQgcmVzb2x2ZSB0byB0aGUgc2Vzc2lvbiB0aGlzIGNvbm5lY3Rpb24gd2lsbCBiZSBhdHRhY2hlZCB0b1xuICAgICAgdGhpcy5oYW5kc2hha2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB0aGlzLl9oYW5kc2hha2UgPSB7IHJlc29sdmUsIHJlamVjdCB9KS5jYW5jZWxsYWJsZSgpO1xuICAgICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAgIC5mb3JFYWNoKChldmVudCkgPT5cbiAgICAgICAgc29ja2V0Lm9uKGV2ZW50LCAocGFyYW1zKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstc2ltcGxlLXNlcnZlcicsICc8PCcsIGV2ZW50LCBwYXJhbXMpKTtcbiAgICAgICAgICByZXR1cm4gaW9IYW5kbGVyc1tldmVudF0uY2FsbCh0aGlzLCBwYXJhbXMpIC8vIG9ubHkgMSBzeW50aGV0aWMgJ3BhcmFtcycgb2JqZWN0IHNob3VsZCBiZSBlbm91Z2hcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBpdCBhdm9pZCByZWFkaW5nIGZyb20gYXJndW1lbnRzLlxuICAgICAgICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgbGV0IHN0YWNrID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlcnIgPSBlLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICBpZihfX0RFVl9fKSB7XG4gICAgICAgICAgICAgIHN0YWNrID0gZS5zdGFjaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZXJyKHsgZXJyLCBldmVudCwgcGFyYW1zLCBzdGFjayB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZ2V0IGlkKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc29ja2V0LmlkO1xuICAgIH1cblxuICAgIHB1c2goZXZlbnQsIHBhcmFtcykge1xuICAgICAgXy5kZXYoKCkgPT4gZXZlbnQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybignbmV4dXMtdXBsaW5rLXNpbXBsZS1zZXJ2ZXInLCAnPj4nLCBldmVudCwgcGFyYW1zKSk7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KGV2ZW50LCBwYXJhbXMpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICBpZih0aGlzLmhhbmRzaGFrZS5pc1BlbmRpbmcoKSkge1xuICAgICAgICB0aGlzLmhhbmRzaGFrZS5jYW5jZWwoKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmhhbmRzaGFrZVxuICAgICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5kZXRhY2godGhpcykpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbiAgICB9XG5cbiAgICBkZXRhY2goKSB7XG4gICAgICAvLyBJbXByb3ZlbWVudCBvcHBvcnR1bml0eTogYWxsb3cgY2xpZW50IHRvIHJlLWhhbmRzaGFrZS5cbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGhhbmRzaGFrZUFjayhwaWQpIHtcbiAgICAgIHRoaXMucHVzaCgnaGFuZHNoYWtlQWNrJywgeyBwaWQgfSk7XG4gICAgfVxuXG4gICAgdXBkYXRlKHsgcGF0aCwgZGlmZiwgaGFzaCB9KSB7XG4gICAgICB0aGlzLnB1c2goJ3VwZGF0ZScsIHsgcGF0aCwgZGlmZiwgaGFzaCB9KTtcbiAgICB9XG5cbiAgICBlbWl0KHsgcm9vbSwgcGFyYW1zIH0pIHtcbiAgICAgIHRoaXMucHVzaCgnZW1pdCcsIHsgcm9vbSwgcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIGRlYnVnKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMucHVzaCgnZGVidWcnLCAuLi5hcmdzKTtcbiAgICB9XG5cbiAgICBsb2coLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCdsb2cnLCAuLi5hcmdzKTtcbiAgICB9XG5cbiAgICB3YXJuKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMucHVzaCgnd2FybicsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGVyciguLi5hcmdzKSB7XG4gICAgICB0aGlzLnB1c2goJ2VycicsIC4uLmFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIF8uZXh0ZW5kKENvbm5lY3Rpb24ucHJvdG90eXBlLCB7XG4gICAgc29ja2V0OiBudWxsLFxuICAgIGhhbmRzaGFrZTogbnVsbCxcbiAgICBfaGFuZHNoYWtlOiBudWxsLFxuICB9KTtcblxuICByZXR1cm4gQ29ubmVjdGlvbjtcbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=