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
          return ioHandlers[event].call(_this2, params) // only 1 synthetic 'params' object should be enough
          // and it avoid reading from arguments.
          .catch(function (e) {
            var stack = null;
            var err = e.toString();
            _.dev(function () {
              return stack = e.stack;
            });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9Db25uZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUFpQztNQUF0QixrQkFBa0IsUUFBbEIsa0JBQWtCO0FBQzVDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDOztBQUUzRCxNQUFNLFVBQVUsR0FBRztBQUNqQixhQUFTLEVBQUEsaUJBQVc7O1VBQVIsSUFBSSxTQUFKLElBQUk7QUFDZCxhQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBTTs7QUFFdkIsU0FBQztpQkFBTSxNQUFLLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU07U0FBQSxDQUFDLEVBQUUsQ0FBQztBQUNqRixjQUFLLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQzNCLElBQUksQ0FBQyxVQUFDLE9BQU8sRUFBSztBQUNqQixpQkFBTyxDQUFDLE1BQU0sT0FBTSxDQUFDO0FBQ3JCLGdCQUFLLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDakMsaUJBQU8sTUFBSyxZQUFZLENBQUMsTUFBSyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDM0MsQ0FBQyxDQUFDO09BQ0osQ0FBQyxDQUFDO0tBQ0o7Ozs7O0FBS0QsZUFBVyxFQUFBLGlCQUFXO1VBQVIsSUFBSSxTQUFKLElBQUk7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QUFVO2NBQU4sSUFBSTs7QUFDVixjQUFJLENBQUMsTUFBTSxDQUFDLElBQUksTUFBQSxDQUFoQixJQUFJLENBQUMsTUFBTSxHQUFNLE1BQU0sb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDbkM7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxjQUFJLENBQUMsTUFBTSxDQUFDLElBQUksTUFBQSxDQUFoQixJQUFJLENBQUMsTUFBTSxHQUFNLEtBQUssb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDbEM7Ozs7V0FyRUcsVUFBVTs7O0FBd0VoQixHQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUU7QUFDN0IsVUFBTSxFQUFFLElBQUk7QUFDWixhQUFTLEVBQUUsSUFBSTtBQUNmLGNBQVUsRUFBRSxJQUFJLEVBQ2pCLENBQUMsQ0FBQzs7QUFFSCxTQUFPLFVBQVUsQ0FBQztDQUNuQixDQUFDIiwiZmlsZSI6IkNvbm5lY3Rpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHsgVXBsaW5rU2ltcGxlU2VydmVyIH0pIHtcbiAgY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG4gIGNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5cbiAgY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgICBoYW5kc2hha2UoeyBndWlkIH0pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICAgIC8vIHNoYWRvayBhc3NlcnRcbiAgICAgICAgKCgpID0+IHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpLnNob3VsZC5ub3QuYmUub2sgJiYgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpKCk7XG4gICAgICAgIHRoaXMudXBsaW5rLmdldFNlc3Npb24oZ3VpZClcbiAgICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHtcbiAgICAgICAgICBzZXNzaW9uLmF0dGFjaCh0aGlzKTtcbiAgICAgICAgICB0aGlzLl9oYW5kc2hha2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VBY2sodGhpcy51cGxpbmsucGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLy8gc3Vic2NyaXB0aW9ucyBhbmQgbGlzdGVuZXJzIGFyZSBzdGF0ZWxlc3MgZnJvbSB0aGUgY29ubmVjdGlvbnMnIHBvaW50IG9mIHZpZXcuXG4gICAgLy8gaXRzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uIHRvIGhhbmRsZSBhbmQgbWFpbnRhaW4gc3RhdGUuXG5cbiAgICBzdWJzY3JpYmVUbyh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5zdWJzY3JpYmVUbyhwYXRoKSk7XG4gICAgfSxcblxuICAgIHVuc3Vic2NyaWJlRnJvbSh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xuICAgIH0sXG5cbiAgICBsaXN0ZW5Ubyh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcblxuICAgIHVubGlzdGVuRnJvbSh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcbiAgfTtcblxuICBjbGFzcyBDb25uZWN0aW9uIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNvY2tldCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgICB1cGxpbmsuc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoVXBsaW5rU2ltcGxlU2VydmVyKVxuICAgICAgKTtcbiAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgLy8gaGFuZHNoYWtlIHNob3VsZCByZXNvbHZlIHRvIHRoZSBzZXNzaW9uIHRoaXMgY29ubmVjdGlvbiB3aWxsIGJlIGF0dGFjaGVkIHRvXG4gICAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgICAgLmZvckVhY2goKGV2ZW50KSA9PlxuICAgICAgICBzb2NrZXQub24oZXZlbnQsIChwYXJhbXMpID0+IHtcbiAgICAgICAgICByZXR1cm4gaW9IYW5kbGVyc1tldmVudF0uY2FsbCh0aGlzLCBwYXJhbXMpIC8vIG9ubHkgMSBzeW50aGV0aWMgJ3BhcmFtcycgb2JqZWN0IHNob3VsZCBiZSBlbm91Z2hcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFuZCBpdCBhdm9pZCByZWFkaW5nIGZyb20gYXJndW1lbnRzLlxuICAgICAgICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgICAgbGV0IHN0YWNrID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlcnIgPSBlLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICBfLmRldigoKSA9PiBzdGFjayA9IGUuc3RhY2spO1xuICAgICAgICAgICAgdGhpcy5lcnIoeyBlcnIsIGV2ZW50LCBwYXJhbXMsIHN0YWNrIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBnZXQgaWQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5zb2NrZXQuaWQ7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgIGlmKHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpKSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlLmNhbmNlbCgpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmRldGFjaCh0aGlzKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIH1cblxuICAgIGRldGFjaCgpIHtcbiAgICAgIC8vIEltcHJvdmVtZW50IG9wcG9ydHVuaXR5OiBhbGxvdyBjbGllbnQgdG8gcmUtaGFuZHNoYWtlLlxuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaGFuZHNoYWtlQWNrKHBpZCkge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnaGFuZHNoYWtlQWNrJywgeyBwaWQgfSk7XG4gICAgfVxuXG4gICAgdXBkYXRlKHsgcGF0aCwgZGlmZiwgaGFzaCB9KSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCd1cGRhdGUnLCB7IHBhdGgsIGRpZmYsIGhhc2ggfSk7XG4gICAgfVxuXG4gICAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdlbWl0JywgeyByb29tLCBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgZGVidWcoLi4uYXJncykge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnZGVidWcnLCAuLi5hcmdzKTtcbiAgICB9XG5cbiAgICBsb2coLi4uYXJncykge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnbG9nJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgd2FybiguLi5hcmdzKSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCd3YXJuJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgZXJyKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2VycicsIC4uLmFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIF8uZXh0ZW5kKENvbm5lY3Rpb24ucHJvdG90eXBlLCB7XG4gICAgc29ja2V0OiBudWxsLFxuICAgIGhhbmRzaGFrZTogbnVsbCxcbiAgICBfaGFuZHNoYWtlOiBudWxsLFxuICB9KTtcblxuICByZXR1cm4gQ29ubmVjdGlvbjtcbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=