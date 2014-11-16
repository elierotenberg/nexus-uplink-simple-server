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
          return ioHandlers[event].apply(_this2, args).catch(function (err) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9Db25uZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUFpQztNQUF0QixrQkFBa0IsUUFBbEIsa0JBQWtCO0FBQzVDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDOztBQUUzRCxNQUFNLFVBQVUsR0FBRztBQUNqQixhQUFTLEVBQUEsaUJBQVc7O1VBQVIsSUFBSSxTQUFKLElBQUk7QUFDZCxhQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBTTs7QUFFdkIsU0FBQztpQkFBTSxNQUFLLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU07U0FBQSxDQUFDLEVBQUUsQ0FBQztBQUNqRixjQUFLLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQzNCLElBQUksQ0FBQyxVQUFDLE9BQU8sRUFBSztBQUNqQixpQkFBTyxDQUFDLE1BQU0sT0FBTSxDQUFDO0FBQ3JCLGdCQUFLLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDakMsaUJBQU8sTUFBSyxZQUFZLENBQUMsTUFBSyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDM0MsQ0FBQyxDQUFDO09BQ0osQ0FBQyxDQUFDO0tBQ0o7Ozs7O0FBS0QsZUFBVyxFQUFBLGlCQUFXO1VBQVIsSUFBSSxTQUFKLElBQUk7QUFDaEIsYUFB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QyxJQUFJLE1BQUEsQ0FBaEIsSUFBSSxDQUFDLE1BQU0sR0FBTSxLQUFLLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQ2xDOzs7O1dBaEVHLFVBQVU7OztBQW1FaEIsR0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFO0FBQzdCLFVBQU0sRUFBRSxJQUFJO0FBQ1osYUFBUyxFQUFFLElBQUk7QUFDZixjQUFVLEVBQUUsSUFBSSxFQUNqQixDQUFDLENBQUM7O0FBRUgsU0FBTyxVQUFVLENBQUM7Q0FDbkIsQ0FBQyIsImZpbGUiOiJDb25uZWN0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih7IFVwbGlua1NpbXBsZVNlcnZlciB9KSB7XG4gIGNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuICBjb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xuXG4gIGNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gICAgaGFuZHNoYWtlKHsgZ3VpZCB9KSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS50cnkoKCkgPT4ge1xuICAgICAgICAvLyBzaGFkb2sgYXNzZXJ0XG4gICAgICAgICgoKSA9PiB0aGlzLmhhbmRzaGFrZS5pc1BlbmRpbmcoKS5zaG91bGQubm90LmJlLm9rICYmIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKSgpO1xuICAgICAgICB0aGlzLnVwbGluay5nZXRTZXNzaW9uKGd1aWQpXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiB7XG4gICAgICAgICAgc2Vzc2lvbi5hdHRhY2godGhpcyk7XG4gICAgICAgICAgdGhpcy5faGFuZHNoYWtlLnJlc29sdmUoc2Vzc2lvbik7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlQWNrKHRoaXMudXBsaW5rLnBpZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8vIHN1YnNjcmlwdGlvbnMgYW5kIGxpc3RlbmVycyBhcmUgc3RhdGVsZXNzIGZyb20gdGhlIGNvbm5lY3Rpb25zJyBwb2ludCBvZiB2aWV3LlxuICAgIC8vIGl0cyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbiB0byBoYW5kbGUgYW5kIG1haW50YWluIHN0YXRlLlxuXG4gICAgc3Vic2NyaWJlVG8oeyBwYXRoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24uc3Vic2NyaWJlVG8ocGF0aCkpO1xuICAgIH0sXG5cbiAgICB1bnN1YnNjcmliZUZyb20oeyBwYXRoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24udW5zdWJzY3JpYmVGcm9tKHBhdGgpKTtcbiAgICB9LFxuXG4gICAgbGlzdGVuVG8oeyByb29tIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24ubGlzdGVuVG8ocm9vbSkpO1xuICAgIH0sXG5cbiAgICB1bmxpc3RlbkZyb20oeyByb29tIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24ubGlzdGVuVG8ocm9vbSkpO1xuICAgIH0sXG4gIH07XG5cbiAgY2xhc3MgQ29ubmVjdGlvbiB7XG4gICAgY29uc3RydWN0b3IoeyBzb2NrZXQsIHVwbGluayB9KSB7XG4gICAgICBfLmRldigoKSA9PiBpbnN0YW5jZU9mU29ja2V0SU8oc29ja2V0KS5zaG91bGQuYmUub2sgJiZcbiAgICAgICAgdXBsaW5rLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFVwbGlua1NpbXBsZVNlcnZlcilcbiAgICAgICk7XG4gICAgICB0aGlzLnNvY2tldCA9IHNvY2tldDtcbiAgICAgIC8vIGhhbmRzaGFrZSBzaG91bGQgcmVzb2x2ZSB0byB0aGUgc2Vzc2lvbiB0aGlzIGNvbm5lY3Rpb24gd2lsbCBiZSBhdHRhY2hlZCB0b1xuICAgICAgdGhpcy5oYW5kc2hha2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB0aGlzLl9oYW5kc2hha2UgPSB7IHJlc29sdmUsIHJlamVjdCB9KS5jYW5jZWxsYWJsZSgpO1xuICAgICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAgIC5mb3JFYWNoKChldmVudCkgPT5cbiAgICAgICAgc29ja2V0Lm9uKGV2ZW50LCAoKSA9PiB7XG4gICAgICAgICAgbGV0IGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgcmV0dXJuIGlvSGFuZGxlcnNbZXZlbnRdLmFwcGx5KHRoaXMsIGFyZ3MpXG4gICAgICAgICAgLmNhdGNoKChlcnIpID0+IHRoaXMuZXJyKHsgZXJyOiBlcnIudG9TdHJpbmcsIGV2ZW50LCBhcmdzIH0pKTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZ2V0IGlkKCkge1xuICAgICAgcmV0dXJuIHRoaXMuc29ja2V0LmlkO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICBpZih0aGlzLmhhbmRzaGFrZS5pc1BlbmRpbmcoKSkge1xuICAgICAgICB0aGlzLmhhbmRzaGFrZS5jYW5jZWwoKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLmhhbmRzaGFrZVxuICAgICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi5kZXRhY2godGhpcykpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbiAgICB9XG5cbiAgICBkZXRhY2goKSB7XG4gICAgICAvLyBJbXByb3ZlbWVudCBvcHBvcnR1bml0eTogYWxsb3cgY2xpZW50IHRvIHJlLWhhbmRzaGFrZS5cbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGhhbmRzaGFrZUFjayhwaWQpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2hhbmRzaGFrZUFjaycsIHsgcGlkIH0pO1xuICAgIH1cblxuICAgIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgndXBkYXRlJywgeyBwYXRoLCBkaWZmLCBoYXNoIH0pO1xuICAgIH1cblxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnZW1pdCcsIHsgcm9vbSwgcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIGRlYnVnKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2RlYnVnJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2xvZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnd2FybicsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGVyciguLi5hcmdzKSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdlcnInLCAuLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBfLmV4dGVuZChDb25uZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIHNvY2tldDogbnVsbCxcbiAgICBoYW5kc2hha2U6IG51bGwsXG4gICAgX2hhbmRzaGFrZTogbnVsbCxcbiAgfSk7XG5cbiAgcmV0dXJuIENvbm5lY3Rpb247XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9