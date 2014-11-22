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
//# sourceMappingURL=data:application/json;base64,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RSxDQUFDLENBQUM7U0FDckM7O0FBRUQsV0FBSzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDWCxjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLE9BQU8sb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDN0I7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLEtBQUssb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDM0I7O0FBRUQsVUFBSTs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVixjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLE1BQU0sb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDNUI7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxjQUFJLENBQUMsSUFBSSxNQUFBLENBQVQsSUFBSSxHQUFNLEtBQUssb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDM0I7Ozs7V0F6RUcsV0FBVTs7O0FBNEVoQixHQUFDLENBQUMsTUFBTSxDQUFDLFdBQVUsQ0FBQyxTQUFTLEVBQUU7QUFDN0IsVUFBTSxFQUFFLElBQUk7QUFDWixhQUFTLEVBQUUsSUFBSTtBQUNmLGNBQVUsRUFBRSxJQUFJLEVBQ2pCLENBQUMsQ0FBQzs7QUFFSCxTQUFPLFdBQVUsQ0FBQztDQUNuQixDQUFDIiwiZmlsZSI6IkNvbm5lY3Rpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHsgVXBsaW5rU2ltcGxlU2VydmVyIH0pIHtcbiAgY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG4gIGNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5cbiAgY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgICBoYW5kc2hha2UoeyBndWlkIH0pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICAgIC8vIHNoYWRvayBhc3NlcnRcbiAgICAgICAgKCgpID0+IHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpLnNob3VsZC5ub3QuYmUub2sgJiYgZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpKCk7XG4gICAgICAgIHRoaXMudXBsaW5rLmdldFNlc3Npb24oZ3VpZClcbiAgICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHtcbiAgICAgICAgICBzZXNzaW9uLmF0dGFjaCh0aGlzKTtcbiAgICAgICAgICB0aGlzLl9oYW5kc2hha2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VBY2sodGhpcy51cGxpbmsucGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLy8gc3Vic2NyaXB0aW9ucyBhbmQgbGlzdGVuZXJzIGFyZSBzdGF0ZWxlc3MgZnJvbSB0aGUgY29ubmVjdGlvbnMnIHBvaW50IG9mIHZpZXcuXG4gICAgLy8gaXRzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uIHRvIGhhbmRsZSBhbmQgbWFpbnRhaW4gc3RhdGUuXG5cbiAgICBzdWJzY3JpYmVUbyh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5zdWJzY3JpYmVUbyhwYXRoKSk7XG4gICAgfSxcblxuICAgIHVuc3Vic2NyaWJlRnJvbSh7IHBhdGggfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xuICAgIH0sXG5cbiAgICBsaXN0ZW5Ubyh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcblxuICAgIHVubGlzdGVuRnJvbSh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5saXN0ZW5Ubyhyb29tKSk7XG4gICAgfSxcbiAgfTtcblxuICBjbGFzcyBDb25uZWN0aW9uIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNvY2tldCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgICB1cGxpbmsuc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoVXBsaW5rU2ltcGxlU2VydmVyKVxuICAgICAgKTtcbiAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgLy8gaGFuZHNoYWtlIHNob3VsZCByZXNvbHZlIHRvIHRoZSBzZXNzaW9uIHRoaXMgY29ubmVjdGlvbiB3aWxsIGJlIGF0dGFjaGVkIHRvXG4gICAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XG4gICAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgICAgLmZvckVhY2goKGV2ZW50KSA9PlxuICAgICAgICBzb2NrZXQub24oZXZlbnQsIChwYXJhbXMpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oJ25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyJywgJzw8JywgZXZlbnQsIHBhcmFtcykpO1xuICAgICAgICAgIHJldHVybiBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIHBhcmFtcykgLy8gb25seSAxIHN5bnRoZXRpYyAncGFyYW1zJyBvYmplY3Qgc2hvdWxkIGJlIGVub3VnaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGl0IGF2b2lkIHJlYWRpbmcgZnJvbSBhcmd1bWVudHMuXG4gICAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmVycih7IGVycjogZS50b1N0cmluZygpLCBldmVudCwgcGFyYW1zLCBzdGFjazogX19ERVZfXyA/IGUuc3RhY2sgOiBudWxsIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBnZXQgaWQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5zb2NrZXQuaWQ7XG4gICAgfVxuXG4gICAgcHVzaChldmVudCwgcGFyYW1zKSB7XG4gICAgICBfLmRldigoKSA9PiBldmVudC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKCduZXh1cy11cGxpbmstc2ltcGxlLXNlcnZlcicsICc+PicsIGV2ZW50LCBwYXJhbXMpKTtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoZXZlbnQsIHBhcmFtcyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgIGlmKHRoaXMuaGFuZHNoYWtlLmlzUGVuZGluZygpKSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlLmNhbmNlbCgpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMuaGFuZHNoYWtlXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmRldGFjaCh0aGlzKSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIH1cblxuICAgIGRldGFjaCgpIHtcbiAgICAgIC8vIEltcHJvdmVtZW50IG9wcG9ydHVuaXR5OiBhbGxvdyBjbGllbnQgdG8gcmUtaGFuZHNoYWtlLlxuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaGFuZHNoYWtlQWNrKHBpZCkge1xuICAgICAgdGhpcy5wdXNoKCdoYW5kc2hha2VBY2snLCB7IHBpZCB9KTtcbiAgICB9XG5cbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAgIHRoaXMucHVzaCgndXBkYXRlJywgeyBwYXRoLCBkaWZmLCBoYXNoIH0pO1xuICAgIH1cblxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgICAgdGhpcy5wdXNoKCdlbWl0JywgeyByb29tLCBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgZGVidWcoLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCdkZWJ1ZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGxvZyguLi5hcmdzKSB7XG4gICAgICB0aGlzLnB1c2goJ2xvZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgdGhpcy5wdXNoKCd3YXJuJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgZXJyKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMucHVzaCgnZXJyJywgLi4uYXJncyk7XG4gICAgfVxuICB9XG5cbiAgXy5leHRlbmQoQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgICBzb2NrZXQ6IG51bGwsXG4gICAgaGFuZHNoYWtlOiBudWxsLFxuICAgIF9oYW5kc2hha2U6IG51bGwsXG4gIH0pO1xuXG4gIHJldHVybiBDb25uZWN0aW9uO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==