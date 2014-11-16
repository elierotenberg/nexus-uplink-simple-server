"use strict";

var _slice = Array.prototype.slice;
var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
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

  var Connection = (function () {
    var Connection = function Connection(_ref7) {
      var _this2 = this;
      var _arguments = arguments;
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
        return socket.on(event, function () {
          var args = _arguments;
          return ioHandlers[event].apply(_this2, args)["catch"](function (err) {
            return _this2.err({ err: err.toString, event: event, args: args });
          });
        });
      });
    };

    _classProps(Connection, null, {
      id: {
        get: function () {
          return this.socket.id;
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
          this.socket.emit("handshakeAck", { pid: pid });
        }
      },
      update: {
        writable: true,
        value: function (_ref8) {
          var path = _ref8.path;
          var diff = _ref8.diff;
          var hash = _ref8.hash;
          this.socket.emit("update", { path: path, diff: diff, hash: hash });
        }
      },
      emit: {
        writable: true,
        value: function (_ref9) {
          var room = _ref9.room;
          var params = _ref9.params;
          this.socket.emit("emit", { room: room, params: params });
        }
      },
      debug: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          this.socket.emit.apply(this.socket, ["debug"].concat(Array.from(args)));
        }
      },
      log: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          this.socket.emit.apply(this.socket, ["log"].concat(Array.from(args)));
        }
      },
      warn: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          this.socket.emit.apply(this.socket, ["warn"].concat(Array.from(args)));
        }
      },
      err: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          this.socket.emit.apply(this.socket, ["err"].concat(Array.from(args)));
        }
      }
    });

    return Connection;
  })();

  _.extend(Connection.prototype, {
    socket: null,
    handshake: null,
    _handshake: null });

  return Connection;
};
//# sourceMappingURL=data:application/json;base64,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QUMsQ0FBQztTQUNsQzs7OztXQWhFRyxVQUFVOzs7QUFtRWhCLEdBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRTtBQUM3QixVQUFNLEVBQUUsSUFBSTtBQUNaLGFBQVMsRUFBRSxJQUFJO0FBQ2YsY0FBVSxFQUFFLElBQUksRUFDakIsQ0FBQyxDQUFDOztBQUVILFNBQU8sVUFBVSxDQUFDO0NBQ25CLENBQUMiLCJmaWxlIjoiQ29ubmVjdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSkge1xuICBjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcbiAgY29uc3QgaW5zdGFuY2VPZlNvY2tldElPID0gcmVxdWlyZSgnLi9pbnN0YW5jZU9mU29ja2V0SU8nKTtcblxuICBjb25zdCBpb0hhbmRsZXJzID0ge1xuICAgIGhhbmRzaGFrZSh7IGd1aWQgfSkge1xuICAgICAgcmV0dXJuIFByb21pc2UudHJ5KCgpID0+IHtcbiAgICAgICAgLy8gc2hhZG9rIGFzc2VydFxuICAgICAgICAoKCkgPT4gdGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkuc2hvdWxkLm5vdC5iZS5vayAmJiBndWlkLnNob3VsZC5iZS5hLlN0cmluZykoKTtcbiAgICAgICAgdGhpcy51cGxpbmsuZ2V0U2Vzc2lvbihndWlkKVxuICAgICAgICAudGhlbigoc2Vzc2lvbikgPT4ge1xuICAgICAgICAgIHNlc3Npb24uYXR0YWNoKHRoaXMpO1xuICAgICAgICAgIHRoaXMuX2hhbmRzaGFrZS5yZXNvbHZlKHNlc3Npb24pO1xuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZUFjayh0aGlzLnVwbGluay5waWQpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvLyBzdWJzY3JpcHRpb25zIGFuZCBsaXN0ZW5lcnMgYXJlIHN0YXRlbGVzcyBmcm9tIHRoZSBjb25uZWN0aW9ucycgcG9pbnQgb2Ygdmlldy5cbiAgICAvLyBpdHMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSB1bmRlcmx5aW5nIGNvbm5lY3Rpb24gdG8gaGFuZGxlIGFuZCBtYWludGFpbiBzdGF0ZS5cblxuICAgIHN1YnNjcmliZVRvKHsgcGF0aCB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VcbiAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLnN1YnNjcmliZVRvKHBhdGgpKTtcbiAgICB9LFxuXG4gICAgdW5zdWJzY3JpYmVGcm9tKHsgcGF0aCB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VcbiAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLnVuc3Vic2NyaWJlRnJvbShwYXRoKSk7XG4gICAgfSxcblxuICAgIGxpc3RlblRvKHsgcm9vbSB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VcbiAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmxpc3RlblRvKHJvb20pKTtcbiAgICB9LFxuXG4gICAgdW5saXN0ZW5Gcm9tKHsgcm9vbSB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VcbiAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmxpc3RlblRvKHJvb20pKTtcbiAgICB9LFxuICB9O1xuXG4gIGNsYXNzIENvbm5lY3Rpb24ge1xuICAgIGNvbnN0cnVjdG9yKHsgc29ja2V0LCB1cGxpbmsgfSkge1xuICAgICAgXy5kZXYoKCkgPT4gaW5zdGFuY2VPZlNvY2tldElPKHNvY2tldCkuc2hvdWxkLmJlLm9rICYmXG4gICAgICAgIHVwbGluay5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihVcGxpbmtTaW1wbGVTZXJ2ZXIpXG4gICAgICApO1xuICAgICAgdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XG4gICAgICAvLyBoYW5kc2hha2Ugc2hvdWxkIHJlc29sdmUgdG8gdGhlIHNlc3Npb24gdGhpcyBjb25uZWN0aW9uIHdpbGwgYmUgYXR0YWNoZWQgdG9cbiAgICAgIHRoaXMuaGFuZHNoYWtlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gdGhpcy5faGFuZHNoYWtlID0geyByZXNvbHZlLCByZWplY3QgfSkuY2FuY2VsbGFibGUoKTtcbiAgICAgIE9iamVjdC5rZXlzKGlvSGFuZGxlcnMpXG4gICAgICAuZm9yRWFjaCgoZXZlbnQpID0+XG4gICAgICAgIHNvY2tldC5vbihldmVudCwgKCkgPT4ge1xuICAgICAgICAgIGxldCBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgICAgIHJldHVybiBpb0hhbmRsZXJzW2V2ZW50XS5hcHBseSh0aGlzLCBhcmdzKVxuICAgICAgICAgIC5jYXRjaCgoZXJyKSA9PiB0aGlzLmVycih7IGVycjogZXJyLnRvU3RyaW5nLCBldmVudCwgYXJncyB9KSk7XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIGdldCBpZCgpIHtcbiAgICAgIHJldHVybiB0aGlzLnNvY2tldC5pZDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgaWYodGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkpIHtcbiAgICAgICAgdGhpcy5oYW5kc2hha2UuY2FuY2VsKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5oYW5kc2hha2VcbiAgICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24uZGV0YWNoKHRoaXMpKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc29ja2V0LmNsb3NlKCk7XG4gICAgfVxuXG4gICAgZGV0YWNoKCkge1xuICAgICAgLy8gSW1wcm92ZW1lbnQgb3Bwb3J0dW5pdHk6IGFsbG93IGNsaWVudCB0byByZS1oYW5kc2hha2UuXG4gICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBoYW5kc2hha2VBY2socGlkKSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdoYW5kc2hha2VBY2snLCB7IHBpZCB9KTtcbiAgICB9XG5cbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ3VwZGF0ZScsIHsgcGF0aCwgZGlmZiwgaGFzaCB9KTtcbiAgICB9XG5cbiAgICBlbWl0KHsgcm9vbSwgcGFyYW1zIH0pIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2VtaXQnLCB7IHJvb20sIHBhcmFtcyB9KTtcbiAgICB9XG5cbiAgICBkZWJ1ZyguLi5hcmdzKSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdkZWJ1ZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGxvZyguLi5hcmdzKSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdsb2cnLCAuLi5hcmdzKTtcbiAgICB9XG5cbiAgICB3YXJuKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ3dhcm4nLCAuLi5hcmdzKTtcbiAgICB9XG5cbiAgICBlcnIoLi4uYXJncykge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnZXJyJywgLi4uYXJncyk7XG4gICAgfVxuICB9XG5cbiAgXy5leHRlbmQoQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgICBzb2NrZXQ6IG51bGwsXG4gICAgaGFuZHNoYWtlOiBudWxsLFxuICAgIF9oYW5kc2hha2U6IG51bGwsXG4gIH0pO1xuXG4gIHJldHVybiBDb25uZWN0aW9uO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==