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
      return Promise.try(function () {
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
          .catch(function (e) {
            var stack = null;
            var err = e.toString();
            if (__DEV__) {
              stack = e.stack;
            }
            _this2.err({ err: err, event: event, params: params, stack: stack });
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

    return Connection;
  })();

  _.extend(Connection.prototype, {
    socket: null,
    handshake: null,
    _handshake: null });

  return Connection;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9Db25uZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLEFBQUMsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEFBQUMsSUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLENBQUMsQ0FBQztBQUN2SCxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUFpQztNQUF0QixrQkFBa0IsUUFBbEIsa0JBQWtCO0FBQzVDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDOztBQUUzRCxNQUFNLFVBQVUsR0FBRztBQUNqQixhQUFTLEVBQUEsaUJBQVc7O1VBQVIsSUFBSSxTQUFKLElBQUk7QUFDZCxhQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBTTs7QUFFdkIsU0FBQztpQkFBTSxNQUFLLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU07U0FBQSxDQUFDLEVBQUUsQ0FBQztBQUNqRixjQUFLLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQzNCLElBQUksQ0FBQyxVQUFDLE9BQU8sRUFBSztBQUNqQixpQkFBTyxDQUFDLE1BQU0sT0FBTSxDQUFDO0FBQ3JCLGdCQUFLLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDakMsaUJBQU8sTUFBSyxZQUFZLENBQUMsTUFBSyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDM0MsQ0FBQyxD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LENBQUMsQ0FBQztTQUMzQzs7QUFFRCxVQUFJOztlQUFBLGlCQUFtQjtjQUFoQixJQUFJLFNBQUosSUFBSTtjQUFFLE1BQU0sU0FBTixNQUFNO0FBQ2pCLGNBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxNQUFNLEVBQU4sTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNyQzs7QUFFRCxXQUFLOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNYLGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sT0FBTyxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUM3Qjs7QUFFRCxTQUFHOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNULGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sS0FBSyxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUMzQjs7QUFFRCxVQUFJOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNWLGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sTUFBTSxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUM1Qjs7QUFFRCxTQUFHOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNULGNBQUksQ0FBQyxJQUFJLE1BQUEsQ0FBVCxJQUFJLEdBQU0sS0FBSyxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUMzQjs7OztXQTlFRyxVQUFVOzs7QUFpRmhCLEdBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRTtBQUM3QixVQUFNLEVBQUUsSUFBSTtBQUNaLGFBQVMsRUFBRSxJQUFJO0FBQ2YsY0FBVSxFQUFFLElBQUksRUFDakIsQ0FBQyxDQUFDOztBQUVILFNBQU8sVUFBVSxDQUFDO0NBQ25CLENBQUMiLCJmaWxlIjoiQ29ubmVjdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTsgY29uc3QgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7IGNvbnN0IF9fREVWX18gPSAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHsgVXBsaW5rU2ltcGxlU2VydmVyIH0pIHtcbiAgY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG4gIGNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5cbiAgY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgICBoYW5kc2hha2UoeyBndWlkIH0pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICAgIC8vIHNoYWRvayBhc3NlcnRcbiAgICAgICAgKCgpID0+IHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpLnNob3VsZC5ub3QuYmUub2sgJiYgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpKCk7XG4gICAgICAgIHRoaXMudXBsaW5rLmdldFNlc3Npb24oZ3VpZClcbiAgICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHtcbiAgICAgICAgICBzZXNzaW9uLmF0dGFjaCh0aGlzKTtcbiAgICAgICAgICB0aGlzLl9oYW5kc2hha2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VBY2sodGhpcy51cGxpbmsucGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLy8gc3Vic2NyaXB0aW9ucyBhbmQgbGlzdGVuZXJzIGFyZSBzdGF0ZWxlc3MgZnJvbSB0aGUgY29ubmVjdGlvbnMnIHBvaW50IG9mIHZpZXcuXG4gICAgLy8gaXRzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uIHRvIGhhbmRsZSBhbmQgbWFpbnRhaW4gc3RhdGUuXG5cbiAgICBzdWJzY3JpYmVUbyh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5zdWJzY3JpYmVUbyhwYXRoKSk7XG4gICAgfSxcblxuICAgIHVuc3Vic2NyaWJlRnJvbSh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xuICAgIH0sXG5cbiAgICBsaXN0ZW5Ubyh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcblxuICAgIHVubGlzdGVuRnJvbSh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcbiAgfTtcblxuICBjbGFzcyBDb25uZWN0aW9uIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNvY2tldCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgICB1cGxpbmsuc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoVXBsaW5rU2ltcGxlU2VydmVyKVxuICAgICAgKTtcbiAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgLy8gaGFuZHNoYWtlIHNob3VsZCByZXNvbHZlIHRvIHRoZSBzZXNzaW9uIHRoaXMgY29ubmVjdGlvbiB3aWxsIGJlIGF0dGFjaGVkIHRvXG4gICAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgICAgLmZvckVhY2goKGV2ZW50KSA9PlxuICAgICAgICBzb2NrZXQub24oZXZlbnQsIChwYXJhbXMpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oJ25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyJywgJzw8JywgZXZlbnQsIHBhcmFtcykpO1xuICAgICAgICAgIHJldHVybiBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIHBhcmFtcykgLy8gb25seSAxIHN5bnRoZXRpYyAncGFyYW1zJyBvYmplY3Qgc2hvdWxkIGJlIGVub3VnaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGl0IGF2b2lkIHJlYWRpbmcgZnJvbSBhcmd1bWVudHMuXG4gICAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICBsZXQgc3RhY2sgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGVyciA9IGUudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIGlmKF9fREVWX18pIHtcbiAgICAgICAgICAgICAgc3RhY2sgPSBlLnN0YWNrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5lcnIoeyBlcnIsIGV2ZW50LCBwYXJhbXMsIHN0YWNrIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBnZXQgaWQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5zb2NrZXQuaWQ7XG4gICAgfVxuXG4gICAgcHVzaChldmVudCwgcGFyYW1zKSB7XG4gICAgICBfLmRldigoKSA9PiBldmVudC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstc2ltcGxlLXNlcnZlcicsICc+PicsIGV2ZW50LCBwYXJhbXMpKTtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoZXZlbnQsIHBhcmFtcyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgIGlmKHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpKSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlLmNhbmNlbCgpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmRldGFjaCh0aGlzKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIH1cblxuICAgIGRldGFjaCgpIHtcbiAgICAgIC8vIEltcHJvdmVtZW50IG9wcG9ydHVuaXR5OiBhbGxvdyBjbGllbnQgdG8gcmUtaGFuZHNoYWtlLlxuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaGFuZHNoYWtlQWNrKHBpZCkge1xuICAgICAgdGhpcy5wdXNoKCdoYW5kc2hha2VBY2snLCB7IHBpZCB9KTtcbiAgICB9XG5cbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAgIHRoaXMucHVzaCgndXBkYXRlJywgeyBwYXRoLCBkaWZmLCBoYXNoIH0pO1xuICAgIH1cblxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgICAgdGhpcy5wdXNoKCdlbWl0JywgeyByb29tLCBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgZGVidWcoLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCdkZWJ1ZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGxvZyguLi5hcmdzKSB7XG4gICAgICB0aGlzLnB1c2goJ2xvZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCd3YXJuJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgZXJyKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMucHVzaCgnZXJyJywgLi4uYXJncyk7XG4gICAgfVxuICB9XG5cbiAgXy5leHRlbmQoQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgICBzb2NrZXQ6IG51bGwsXG4gICAgaGFuZHNoYWtlOiBudWxsLFxuICAgIF9oYW5kc2hha2U6IG51bGwsXG4gIH0pO1xuXG4gIHJldHVybiBDb25uZWN0aW9uO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==