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
  var should = _.should;
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
        return _this2._handshake = resolve;
      }).cancellable();
      Object.keys(ioHandlers).forEach(function (event) {
        return socket.on(event, function () {
          var args = _slice.call(arguments);

          return ioHandlers[event].call.apply(ioHandlers[event], [_this2].concat(Array.from(args))).catch(function (err) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9Db25uZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUFpQztNQUF0QixrQkFBa0IsUUFBbEIsa0JBQWtCO0FBQzVDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ3hCLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7O0FBRTNELE1BQU0sVUFBVSxHQUFHO0FBQ2pCLGFBQVMsRUFBQSxpQkFBVzs7VUFBUixJQUFJLFNBQUosSUFBSTtBQUNkLGFBQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFNOztBQUV2QixTQUFDO2lCQUFNLE1BQUssU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtTQUFBLENBQUMsRUFBRSxDQUFDO0FBQ2pGLGNBQUssTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FDM0IsSUFBSSxDQUFDLFVBQUMsT0FBTyxFQUFLO0FBQ2pCLGlCQUFPLENBQUMsTUFBTSxPQUFNLENBQUM7QUFDckIsZ0JBQUssVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNqQyxpQkFBTyxNQUFLLFlBQVksQ0FBQyxNQUFLLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUMzQyxDQUFDLENBQUM7T0FDSixDQUFDLENBQUM7S0FDSjs7Ozs7QUFLRCxlQUFX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QUMsSUFBSSxNQUFBLENBQWhCLElBQUksQ0FBQyxNQUFNLEdBQU0sS0FBSyxvQkFBSyxJQUFJLEdBQUMsQ0FBQztTQUNsQzs7OztXQS9ERyxVQUFVOzs7QUFrRWhCLEdBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRTtBQUM3QixVQUFNLEVBQUUsSUFBSTtBQUNaLGFBQVMsRUFBRSxJQUFJO0FBQ2YsY0FBVSxFQUFFLElBQUksRUFDakIsQ0FBQyxDQUFDOztBQUVILFNBQU8sVUFBVSxDQUFDO0NBQ25CLENBQUMiLCJmaWxlIjoiQ29ubmVjdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSkge1xuICBjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcbiAgY29uc3Qgc2hvdWxkID0gXy5zaG91bGQ7XG4gIGNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5cbiAgY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgICBoYW5kc2hha2UoeyBndWlkIH0pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICAgIC8vIHNoYWRvayBhc3NlcnRcbiAgICAgICAgKCgpID0+IHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpLnNob3VsZC5ub3QuYmUub2sgJiYgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpKCk7XG4gICAgICAgIHRoaXMudXBsaW5rLmdldFNlc3Npb24oZ3VpZClcbiAgICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHtcbiAgICAgICAgICBzZXNzaW9uLmF0dGFjaCh0aGlzKTtcbiAgICAgICAgICB0aGlzLl9oYW5kc2hha2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VBY2sodGhpcy51cGxpbmsucGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLy8gc3Vic2NyaXB0aW9ucyBhbmQgbGlzdGVuZXJzIGFyZSBzdGF0ZWxlc3MgZnJvbSB0aGUgY29ubmVjdGlvbnMnIHBvaW50IG9mIHZpZXcuXG4gICAgLy8gaXRzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uIHRvIGhhbmRsZSBhbmQgbWFpbnRhaW4gc3RhdGUuXG5cbiAgICBzdWJzY3JpYmVUbyh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5zdWJzY3JpYmVUbyhwYXRoKSk7XG4gICAgfSxcblxuICAgIHVuc3Vic2NyaWJlRnJvbSh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xuICAgIH0sXG5cbiAgICBsaXN0ZW5Ubyh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcblxuICAgIHVubGlzdGVuRnJvbSh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcbiAgfTtcblxuICBjbGFzcyBDb25uZWN0aW9uIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNvY2tldCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgICB1cGxpbmsuc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoVXBsaW5rU2ltcGxlU2VydmVyKVxuICAgICAgKTtcbiAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgLy8gaGFuZHNoYWtlIHNob3VsZCByZXNvbHZlIHRvIHRoZSBzZXNzaW9uIHRoaXMgY29ubmVjdGlvbiB3aWxsIGJlIGF0dGFjaGVkIHRvXG4gICAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHJlc29sdmUpLmNhbmNlbGxhYmxlKCk7XG4gICAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgICAgLmZvckVhY2goKGV2ZW50KSA9PlxuICAgICAgICBzb2NrZXQub24oZXZlbnQsICguLi5hcmdzKSA9PlxuICAgICAgICAgIGlvSGFuZGxlcnNbZXZlbnRdLmNhbGwodGhpcywgLi4uYXJncylcbiAgICAgICAgICAuY2F0Y2goKGVycikgPT4gdGhpcy5lcnIoeyBlcnI6IGVyci50b1N0cmluZywgZXZlbnQsIGFyZ3MgfSkpXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZ2V0IGlkKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc29ja2V0LmlkO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICBpZih0aGlzLmhhbmRzaGFrZS5pc1BlbmRpbmcoKSkge1xuICAgICAgICB0aGlzLmhhbmRzaGFrZS5jYW5jZWwoKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmhhbmRzaGFrZVxuICAgICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5kZXRhY2godGhpcykpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbiAgICB9XG5cbiAgICBkZXRhY2goKSB7XG4gICAgICAvLyBJbXByb3ZlbWVudCBvcHBvcnR1bml0eTogYWxsb3cgY2xpZW50IHRvIHJlLWhhbmRzaGFrZS5cbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGhhbmRzaGFrZUFjayhwaWQpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2hhbmRzaGFrZUFjaycsIHsgcGlkIH0pO1xuICAgIH1cblxuICAgIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgndXBkYXRlJywgeyBwYXRoLCBkaWZmLCBoYXNoIH0pO1xuICAgIH1cblxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnZW1pdCcsIHsgcm9vbSwgcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIGRlYnVnKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2RlYnVnJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2xvZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnd2FybicsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGVyciguLi5hcmdzKSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdlcnInLCAuLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBfLmV4dGVuZChDb25uZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIHNvY2tldDogbnVsbCxcbiAgICBoYW5kc2hha2U6IG51bGwsXG4gICAgX2hhbmRzaGFrZTogbnVsbCxcbiAgfSk7XG5cbiAgcmV0dXJuIENvbm5lY3Rpb247XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9