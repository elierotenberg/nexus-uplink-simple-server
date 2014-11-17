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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9Db25uZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUFpQztNQUF0QixrQkFBa0IsUUFBbEIsa0JBQWtCO0FBQzVDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDOztBQUUzRCxNQUFNLFVBQVUsR0FBRztBQUNqQixhQUFTLEVBQUEsaUJBQVc7O1VBQVIsSUFBSSxTQUFKLElBQUk7QUFDZCxhQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBTTs7QUFFdkIsU0FBQztpQkFBTSxNQUFLLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU07U0FBQSxDQUFDLEVBQUUsQ0FBQztBQUNqRixjQUFLLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQzNCLElBQUksQ0FBQyxVQUFDLE9BQU8sRUFBSztBQUNqQixpQkFBTyxDQUFDLE1BQU0sT0FBTSxDQUFDO0FBQ3JCLGdCQUFLLFVBQVUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDakMsaUJBQU8sTUFBSyxZQUFZLENBQUMsTUFBSyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDM0MsQ0FBQyxDQUFDO09BQ0osQ0FBQyxDQUFDO0tBQ0o7Ozs7O0FBS0QsZUFBVyxFQUFBLGlCQUFXO1VBQVIsSUFBSSxTQUFKLElBQUk7QUFDaEIsYUFBTyxJQUFJLENBQUMsU0FBUyxDQUNwQixJQUFJLENBQUMsVUFBQyxPQUFPO2VBQUssT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7T0FBQSxDQUFDLENBQUM7S0FDL0M7O0FBRUQsbUJBQWUsRUFBQSxpQkFBVztVQUFSLElBQUksU0FBSixJQUFJO0FBQ3BCLGFBQU8sSUFBSSxDQUFDLFNBQVMsQ0FDcEIsSUFBSSxDQUFDLFVBQUMsT0FBTztlQUFLLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO09BQUEsQ0FBQyxDQUFDO0tBQ25EOztBQUVELFlBQVEsRUFBQSxpQkFBVztVQUFSLElBQUksU0FBSixJQUFJO0FBQ2IsYUFBTyxJQUFJLENBQUMsU0FBUyxDQUNwQixJQUFJLENBQUMsVUFBQyxPQUFPO2VBQUssT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7T0FBQSxDQUFDLENBQUM7S0FDNUM7O0FBRUQsZ0JBQVksRUFBQSxpQkFBVztVQUFSLElBQUksU0FBSixJQUFJO0FBQ2pCLGFBQU8sSUFBSSxDQUFDLFNBQVMsQ0FDcEIsSUFBSSxDQUFDLFVBQUMsT0FBTztlQUFLLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO09BQUEsQ0FBQyxDQUFDO0tBQzVDLEVBQ0YsQ0FBQzs7TUFFSSxVQUFVO1FBQVYsVUFBVSxHQUNILFNBRFAsVUFBVSxRQUNrQjs7O1VBQWxCLE1BQU0sU0FBTixNQUFNO1VBQUUsTUFBTSxTQUFOLE1BQU07QUFDMUIsT0FBQyxDQUFDLEdBQUcsQ0FBQztlQUFNLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUNqRCxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLGtCQUFrQixDQUFDO09BQUEsQ0FDbkQsQ0FBQztBQUNGLFVBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDOztBQUVyQixVQUFJLENBQUMsU0FBUyxHQUFHLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07ZUFBSyxPQUFLLFVBQVUsR0FBRyxFQUFFLE9BQU8sRUFBUCxPQUFPLEVBQUUsTUFBTSxFQUFOLE1BQU0sRUFBRTtPQUFBLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUN2RyxZQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUN0QixPQUFPLENBQUMsVUFBQyxLQUFLO2VBQ2IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsWUFBTTtBQUNyQixjQUFJLElBQUksYUFBWSxDQUFDO0FBQ3JCLGlCQUFPLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLFNBQU8sSUFBSSxDQUFDLENBQ3pDLEtBQUssQ0FBQyxVQUFDLEdBQUc7bUJBQUssT0FBSyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUwsS0FBSyxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsQ0FBQztXQUFBLENBQUMsQ0FBQztTQUMvRCxDQUFDO09BQUEsQ0FDSCxDQUFDO0tBQ0g7O2dCQWhCRyxVQUFVO0FBa0JWLFFBQUU7YUFBQSxZQUFHO0FBQ1AsaUJBQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7U0FDdkI7O0FBRUQsYUFBTzs7ZUFBQSxZQUFHOztBQUNSLGNBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsRUFBRTtBQUM3QixnQkFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztXQUN6QixNQUNJO0FBQ0gsZ0JBQUksQ0FBQyxTQUFTLENBQ2IsSUFBSSxDQUFDLFVBQUMsT0FBTztxQkFBSyxPQUFPLENBQUMsTUFBTSxRQUFNO2FBQUEsQ0FBQyxDQUFDO1dBQzFDO0FBQ0QsY0FBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztTQUNyQjs7QUFFRCxZQUFNOztlQUFBLFlBQUc7O0FBRVAsY0FBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1NBQ2hCOztBQUVELGtCQUFZOztlQUFBLFVBQUMsR0FBRyxFQUFFO0FBQ2hCLGNBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUFFLEdBQUcsRUFBSCxHQUFHLEVBQUUsQ0FBQyxDQUFDO1NBQzNDOztBQUVELFlBQU07O2VBQUEsaUJBQXVCO2NBQXBCLElBQUksU0FBSixJQUFJO2NBQUUsSUFBSSxTQUFKLElBQUk7Y0FBRSxJQUFJLFNBQUosSUFBSTtBQUN2QixjQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxDQUFDLENBQUM7U0FDbEQ7O0FBRUQsVUFBSTs7ZUFBQSxpQkFBbUI7Y0FBaEIsSUFBSSxTQUFKLElBQUk7Y0FBRSxNQUFNLFNBQU4sTUFBTTtBQUNqQixjQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsQ0FBQyxDQUFDO1NBQzVDOztBQUVELFdBQUs7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1gsY0FBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQUEsQ0FBaEIsSUFBSSxDQUFDLE1BQU0sR0FBTSxPQUFPLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQ3BDOztBQUVELFNBQUc7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1QsY0FBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQUEsQ0FBaEIsSUFBSSxDQUFDLE1BQU0sR0FBTSxLQUFLLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQ2xDOztBQUVELFVBQUk7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1YsY0FBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQUEsQ0FBaEIsSUFBSSxDQUFDLE1BQU0sR0FBTSxNQUFNLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQ25DOztBQUVELFNBQUc7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1QsY0FBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQUEsQ0FBaEIsSUFBSSxDQUFDLE1BQU0sR0FBTSxLQUFLLG9CQUFLLElBQUksR0FBQyxDQUFDO1NBQ2xDOzs7O1dBaEVHLFVBQVU7OztBQW1FaEIsR0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFO0FBQzdCLFVBQU0sRUFBRSxJQUFJO0FBQ1osYUFBUyxFQUFFLElBQUk7QUFDZixjQUFVLEVBQUUsSUFBSSxFQUNqQixDQUFDLENBQUM7O0FBRUgsU0FBTyxVQUFVLENBQUM7Q0FDbkIsQ0FBQyIsImZpbGUiOiJDb25uZWN0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih7IFVwbGlua1NpbXBsZVNlcnZlciB9KSB7XHJcbiAgY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XHJcbiAgY29uc3QgaW5zdGFuY2VPZlNvY2tldElPID0gcmVxdWlyZSgnLi9pbnN0YW5jZU9mU29ja2V0SU8nKTtcclxuXHJcbiAgY29uc3QgaW9IYW5kbGVycyA9IHtcclxuICAgIGhhbmRzaGFrZSh7IGd1aWQgfSkge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS50cnkoKCkgPT4ge1xyXG4gICAgICAgIC8vIHNoYWRvayBhc3NlcnRcclxuICAgICAgICAoKCkgPT4gdGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkuc2hvdWxkLm5vdC5iZS5vayAmJiBndWlkLnNob3VsZC5iZS5hLlN0cmluZykoKTtcclxuICAgICAgICB0aGlzLnVwbGluay5nZXRTZXNzaW9uKGd1aWQpXHJcbiAgICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHtcclxuICAgICAgICAgIHNlc3Npb24uYXR0YWNoKHRoaXMpO1xyXG4gICAgICAgICAgdGhpcy5faGFuZHNoYWtlLnJlc29sdmUoc2Vzc2lvbik7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VBY2sodGhpcy51cGxpbmsucGlkKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8vIHN1YnNjcmlwdGlvbnMgYW5kIGxpc3RlbmVycyBhcmUgc3RhdGVsZXNzIGZyb20gdGhlIGNvbm5lY3Rpb25zJyBwb2ludCBvZiB2aWV3LlxyXG4gICAgLy8gaXRzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgdW5kZXJseWluZyBjb25uZWN0aW9uIHRvIGhhbmRsZSBhbmQgbWFpbnRhaW4gc3RhdGUuXHJcblxyXG4gICAgc3Vic2NyaWJlVG8oeyBwYXRoIH0pIHtcclxuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXHJcbiAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLnN1YnNjcmliZVRvKHBhdGgpKTtcclxuICAgIH0sXHJcblxyXG4gICAgdW5zdWJzY3JpYmVGcm9tKHsgcGF0aCB9KSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZVxyXG4gICAgICAudGhlbigoc2Vzc2lvbikgPT4gc2Vzc2lvbi51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xyXG4gICAgfSxcclxuXHJcbiAgICBsaXN0ZW5Ubyh7IHJvb20gfSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2VcclxuICAgICAgLnRoZW4oKHNlc3Npb24pID0+IHNlc3Npb24ubGlzdGVuVG8ocm9vbSkpO1xyXG4gICAgfSxcclxuXHJcbiAgICB1bmxpc3RlbkZyb20oeyByb29tIH0pIHtcclxuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlXHJcbiAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmxpc3RlblRvKHJvb20pKTtcclxuICAgIH0sXHJcbiAgfTtcclxuXHJcbiAgY2xhc3MgQ29ubmVjdGlvbiB7XHJcbiAgICBjb25zdHJ1Y3Rvcih7IHNvY2tldCwgdXBsaW5rIH0pIHtcclxuICAgICAgXy5kZXYoKCkgPT4gaW5zdGFuY2VPZlNvY2tldElPKHNvY2tldCkuc2hvdWxkLmJlLm9rICYmXHJcbiAgICAgICAgdXBsaW5rLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFVwbGlua1NpbXBsZVNlcnZlcilcclxuICAgICAgKTtcclxuICAgICAgdGhpcy5zb2NrZXQgPSBzb2NrZXQ7XHJcbiAgICAgIC8vIGhhbmRzaGFrZSBzaG91bGQgcmVzb2x2ZSB0byB0aGUgc2Vzc2lvbiB0aGlzIGNvbm5lY3Rpb24gd2lsbCBiZSBhdHRhY2hlZCB0b1xyXG4gICAgICB0aGlzLmhhbmRzaGFrZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHRoaXMuX2hhbmRzaGFrZSA9IHsgcmVzb2x2ZSwgcmVqZWN0IH0pLmNhbmNlbGxhYmxlKCk7XHJcbiAgICAgIE9iamVjdC5rZXlzKGlvSGFuZGxlcnMpXHJcbiAgICAgIC5mb3JFYWNoKChldmVudCkgPT5cclxuICAgICAgICBzb2NrZXQub24oZXZlbnQsICgpID0+IHtcclxuICAgICAgICAgIGxldCBhcmdzID0gYXJndW1lbnRzO1xyXG4gICAgICAgICAgcmV0dXJuIGlvSGFuZGxlcnNbZXZlbnRdLmFwcGx5KHRoaXMsIGFyZ3MpXHJcbiAgICAgICAgICAuY2F0Y2goKGVycikgPT4gdGhpcy5lcnIoeyBlcnI6IGVyci50b1N0cmluZywgZXZlbnQsIGFyZ3MgfSkpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0IGlkKCkge1xyXG4gICAgICByZXR1cm4gdGhpcy5zb2NrZXQuaWQ7XHJcbiAgICB9XHJcblxyXG4gICAgZGVzdHJveSgpIHtcclxuICAgICAgaWYodGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkpIHtcclxuICAgICAgICB0aGlzLmhhbmRzaGFrZS5jYW5jZWwoKTtcclxuICAgICAgfVxyXG4gICAgICBlbHNlIHtcclxuICAgICAgICB0aGlzLmhhbmRzaGFrZVxyXG4gICAgICAgIC50aGVuKChzZXNzaW9uKSA9PiBzZXNzaW9uLmRldGFjaCh0aGlzKSk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcclxuICAgIH1cclxuXHJcbiAgICBkZXRhY2goKSB7XHJcbiAgICAgIC8vIEltcHJvdmVtZW50IG9wcG9ydHVuaXR5OiBhbGxvdyBjbGllbnQgdG8gcmUtaGFuZHNoYWtlLlxyXG4gICAgICB0aGlzLmRlc3Ryb3koKTtcclxuICAgIH1cclxuXHJcbiAgICBoYW5kc2hha2VBY2socGlkKSB7XHJcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2hhbmRzaGFrZUFjaycsIHsgcGlkIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xyXG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCd1cGRhdGUnLCB7IHBhdGgsIGRpZmYsIGhhc2ggfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XHJcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2VtaXQnLCB7IHJvb20sIHBhcmFtcyB9KTtcclxuICAgIH1cclxuXHJcbiAgICBkZWJ1ZyguLi5hcmdzKSB7XHJcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2RlYnVnJywgLi4uYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgbG9nKC4uLmFyZ3MpIHtcclxuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnbG9nJywgLi4uYXJncyk7XHJcbiAgICB9XHJcblxyXG4gICAgd2FybiguLi5hcmdzKSB7XHJcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ3dhcm4nLCAuLi5hcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBlcnIoLi4uYXJncykge1xyXG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdlcnInLCAuLi5hcmdzKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIF8uZXh0ZW5kKENvbm5lY3Rpb24ucHJvdG90eXBlLCB7XHJcbiAgICBzb2NrZXQ6IG51bGwsXHJcbiAgICBoYW5kc2hha2U6IG51bGwsXHJcbiAgICBfaGFuZHNoYWtlOiBudWxsLFxyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gQ29ubmVjdGlvbjtcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9