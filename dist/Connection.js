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
          return _this.handshake.isPending().should.be.ok && guid.should.be.a.String;
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
      this.uplink = uplink;
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
            _this2.err({ err: e.toString(), event: event, params: params, stack: __DEV__ ? e.stack : null });
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
//# sourceMappingURL=data:application/json;base64,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QUksRUFBRSxNQUFNLEVBQU4sTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNyQzs7QUFFRCxXQUFLOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNYLGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sT0FBTyxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUM3Qjs7QUFFRCxTQUFHOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNULGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sS0FBSyxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUMzQjs7QUFFRCxVQUFJOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNWLGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sTUFBTSxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUM1Qjs7QUFFRCxTQUFHOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNULGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sS0FBSyxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUMzQjs7OztXQTFFRyxXQUFVOzs7QUE2RWhCLEdBQUMsQ0FBQyxNQUFNLENBQUMsV0FBVSxDQUFDLFNBQVMsRUFBRTtBQUM3QixVQUFNLEVBQUUsSUFBSTtBQUNaLGFBQVMsRUFBRSxJQUFJO0FBQ2YsY0FBVSxFQUFFLElBQUksRUFDakIsQ0FBQyxDQUFDOztBQUVILFNBQU8sV0FBVSxDQUFDO0NBQ25CLENBQUMiLCJmaWxlIjoiQ29ubmVjdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSkge1xuICBjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcbiAgY29uc3QgaW5zdGFuY2VPZlNvY2tldElPID0gcmVxdWlyZSgnLi9pbnN0YW5jZU9mU29ja2V0SU8nKTtcblxuICBjb25zdCBpb0hhbmRsZXJzID0ge1xuICAgIGhhbmRzaGFrZSh7IGd1aWQgfSkge1xuICAgICAgcmV0dXJuIFByb21pc2UudHJ5KCgpID0+IHtcbiAgICAgICAgLy8gc2hhZG9rIGFzc2VydFxuICAgICAgICAoKCkgPT4gdGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkuc2hvdWxkLmJlLm9rICYmIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKSgpO1xuICAgICAgICB0aGlzLnVwbGluay5nZXRTZXNzaW9uKGd1aWQpXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgc2Vzc2lvbi5hdHRhY2godGhpcyk7XG4gICAgICAgICAgdGhpcy5faGFuZHNoYWtlLnJlc29sdmUoc2Vzc2lvbik7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlQWNrKHRoaXMudXBsaW5rLnBpZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8vIHN1YnNjcmlwdGlvbnMgYW5kIGxpc3RlbmVycyBhcmUgc3RhdGVsZXNzIGZyb20gdGhlIGNvbm5lY3Rpb25zJyBwb2ludCBvZiB2aWV3LlxuICAgIC8vIGl0cyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbiB0byBoYW5kbGUgYW5kIG1haW50YWluIHN0YXRlLlxuXG4gICAgc3Vic2NyaWJlVG8oeyBwYXRoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24uc3Vic2NyaWJlVG8ocGF0aCkpO1xuICAgIH0sXG5cbiAgICB1bnN1YnNjcmliZUZyb20oeyBwYXRoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24udW5zdWJzY3JpYmVGcm9tKHBhdGgpKTtcbiAgICB9LFxuXG4gICAgbGlzdGVuVG8oeyByb29tIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24ubGlzdGVuVG8ocm9vbSkpO1xuICAgIH0sXG5cbiAgICB1bmxpc3RlbkZyb20oeyByb29tIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24ubGlzdGVuVG8ocm9vbSkpO1xuICAgIH0sXG4gIH07XG5cbiAgY2xhc3MgQ29ubmVjdGlvbiB7XG4gICAgY29uc3RydWN0b3IoeyBzb2NrZXQsIHVwbGluayB9KSB7XG4gICAgICBfLmRldigoKSA9PiBpbnN0YW5jZU9mU29ja2V0SU8oc29ja2V0KS5zaG91bGQuYmUub2sgJiZcbiAgICAgICAgdXBsaW5rLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFVwbGlua1NpbXBsZVNlcnZlcilcbiAgICAgICk7XG4gICAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcbiAgICAgIHRoaXMudXBsaW5rID0gdXBsaW5rO1xuICAgICAgLy8gaGFuZHNoYWtlIHNob3VsZCByZXNvbHZlIHRvIHRoZSBzZXNzaW9uIHRoaXMgY29ubmVjdGlvbiB3aWxsIGJlIGF0dGFjaGVkIHRvXG4gICAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgICAgLmZvckVhY2goKGV2ZW50KSA9PlxuICAgICAgICBzb2NrZXQub24oZXZlbnQsIChwYXJhbXMpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oJ25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyJywgJzw8JywgZXZlbnQsIHBhcmFtcykpO1xuICAgICAgICAgIHJldHVybiBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIHBhcmFtcykgLy8gb25seSAxIHN5bnRoZXRpYyAncGFyYW1zJyBvYmplY3Qgc2hvdWxkIGJlIGVub3VnaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGl0IGF2b2lkIHJlYWRpbmcgZnJvbSBhcmd1bWVudHMuXG4gICAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmVycih7IGVycjogZS50b1N0cmluZygpLCBldmVudCwgcGFyYW1zLCBzdGFjazogX19ERVZfXyA/IGUuc3RhY2sgOiBudWxsIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBnZXQgaWQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5zb2NrZXQuaWQ7XG4gICAgfVxuXG4gICAgcHVzaChldmVudCwgcGFyYW1zKSB7XG4gICAgICBfLmRldigoKSA9PiBldmVudC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstc2ltcGxlLXNlcnZlcicsICc+PicsIGV2ZW50LCBwYXJhbXMpKTtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoZXZlbnQsIHBhcmFtcyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgIGlmKHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpKSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlLmNhbmNlbCgpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmRldGFjaCh0aGlzKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIH1cblxuICAgIGRldGFjaCgpIHtcbiAgICAgIC8vIEltcHJvdmVtZW50IG9wcG9ydHVuaXR5OiBhbGxvdyBjbGllbnQgdG8gcmUtaGFuZHNoYWtlLlxuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaGFuZHNoYWtlQWNrKHBpZCkge1xuICAgICAgdGhpcy5wdXNoKCdoYW5kc2hha2VBY2snLCB7IHBpZCB9KTtcbiAgICB9XG5cbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAgIHRoaXMucHVzaCgndXBkYXRlJywgeyBwYXRoLCBkaWZmLCBoYXNoIH0pO1xuICAgIH1cblxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgICAgdGhpcy5wdXNoKCdlbWl0JywgeyByb29tLCBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgZGVidWcoLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCdkZWJ1ZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGxvZyguLi5hcmdzKSB7XG4gICAgICB0aGlzLnB1c2goJ2xvZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCd3YXJuJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgZXJyKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMucHVzaCgnZXJyJywgLi4uYXJncyk7XG4gICAgfVxuICB9XG5cbiAgXy5leHRlbmQoQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgICBzb2NrZXQ6IG51bGwsXG4gICAgaGFuZHNoYWtlOiBudWxsLFxuICAgIF9oYW5kc2hha2U6IG51bGwsXG4gIH0pO1xuXG4gIHJldHVybiBDb25uZWN0aW9uO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==