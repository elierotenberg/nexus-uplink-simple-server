"use strict";

var _slice = Array.prototype.slice;
var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = require("bluebird");var __DEV__ = (process.env.NODE_ENV !== "production");
module.exports = function (_ref) {
  var Connection = _ref.Connection;
  var UplinkSimpleServer = _ref.UplinkSimpleServer;
  var _ = require("lodash-next");

  var EXPIRE_TIMEOUT = 30000;

  var Session = (function () {
    var Session = function Session(_ref2) {
      var guid = _ref2.guid;
      var uplink = _ref2.uplink;
      _.dev(function () {
        return guid.should.be.a.String && uplink.should.be.an.instanceOf(UplinkSimpleServer);
      });
      _.extend(this, { guid: guid, uplink: uplink });
      this.connections = {};

      this.subscriptions = {};
      this.listeners = {};

      this.timeout = null;
      this.expired = false;
      this.pause();
    };

    _classProps(Session, null, {
      destroy: {
        writable: true,
        value: function () {
          var _this = this;
          if (this.timeout !== null) {
            clearTimeout(this.timeout);
          }
          Object.keys(this.connections).forEach(function (id) {
            return _this.detach(_this.connections[id]);
          });
          Object.keys(this.subscriptions).forEach(function (path) {
            return _this.unsubscribeFrom(path);
          });
          Object.keys(this.listeners).forEach(function (room) {
            return _this.unlistenFrom(room);
          });
        }
      },
      paused: {
        get: function () {
          return (this.timeout !== null);
        }
      },
      proxy: {
        writable: true,
        value: function (method) {
          var _this2 = this;
          var _arguments = arguments;
          return function () {
            var args = _arguments;return Object.keys(_this2.connections).map(function (id) {
              return _this2.connections[id][method].apply(_this2.connections[id], Array.from(args));
            });
          };
        }
      },
      attach: {
        writable: true,
        value: function (connection) {
          var _this3 = this;
          _.dev(function () {
            return connection.should.be.an.instanceOf(Connection) && _this3.connection.should.not.have.property(connection.id);
          });
          this.connections[connection.id] = connection;
          // If the session was paused (no connec attached)
          // then resume it
          if (this.paused) {
            this.resumse();
          }
          return this;
        }
      },
      expire: {
        writable: true,
        value: function () {
          this.expired = true;
          return this.uplink.deleteSession(this);
        }
      },
      pause: {
        writable: true,
        value: function () {
          var _this4 = this;
          _.dev(function () {
            return _this4.paused.should.not.be.ok;
          });
          this.timeout = setTimeout(function () {
            return _this4.expire();
          }, EXPIRE_TIMEOUT);
          return this;
        }
      },
      resume: {
        writable: true,
        value: function () {
          var _this5 = this;
          _.dev(function () {
            return _this5.paused.should.be.ok;
          });
          // Prevent the expiration timeout
          clearTimeout(this.timeout);
          this.timeout = null;
          return this;
        }
      },
      detach: {
        writable: true,
        value: function (connection) {
          var _this6 = this;
          _.dev(function () {
            return connection.should.be.an.instanceOf(Connection) && _this6.connections.should.have.property(connection.id, connection);
          });
          this.connections[connection.id].detach();
          delete this.connections[connection.id];
          // If this was the last connection, pause the session
          // and start the expire countdown
          if (Object.keys(this.connections).length === 0) {
            this.pause();
          }
          return this;
        }
      },
      update: {
        writable: true,
        value: function (_ref3) {
          var path = _ref3.path;
          var diff = _ref3.diff;
          var hash = _ref3.hash;
          return this.proxy("update")({ path: path, diff: diff, hash: hash });
        }
      },
      subscribeTo: {
        writable: true,
        value: function (path) {
          var _this7 = this;
          _.dev(function () {
            return path.should.be.a.String && _this7.subscriptions.should.not.have.property(path);
          });
          this.subscriptions[path] = true;
          return this.uplink.subscribeTo(path, this);
        }
      },
      unsubscribeFrom: {
        writable: true,
        value: function (path) {
          var _this8 = this;
          _.dev(function () {
            return path.should.be.a.String && _this8.subscriptions.should.have.property(path);
          });
          delete this.subscriptions[path];
          return this.uplink.unsubscribeFrom(path, this);
        }
      },
      emit: {
        writable: true,
        value: function (_ref4) {
          var room = _ref4.room;
          var params = _ref4.params;
          return this.proxy("emit")({ room: room, params: params });
        }
      },
      listenTo: {
        writable: true,
        value: function (room) {
          var _this9 = this;
          _.dev(function () {
            return room.should.be.a.String && _this9.listeners.should.not.have.property(room);
          });
          this.listeners[room] = true;
          return this.uplink.listenTo(room, this);
        }
      },
      unlistenFrom: {
        writable: true,
        value: function (room) {
          var _this10 = this;
          _.dev(function () {
            return room.should.be.a.String && _this10.listeners.should.have.property(room);
          });
          delete this.listeners[room];
          return this.uplink.unlistenFrom(room, this);
        }
      },
      debug: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          return this.proxy("debug").apply(null, Array.from(args));
        }
      },
      log: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          return this.proxy("log").apply(null, Array.from(args));
        }
      },
      warn: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          return this.proxy("warn").apply(null, Array.from(args));
        }
      },
      err: {
        writable: true,
        value: function () {
          var args = _slice.call(arguments);

          return this.proxy("err").apply(null, Array.from(args));
        }
      }
    });

    return Session;
  })();

  _.extend(Session.prototype, {
    guid: null,
    uplink: null,
    connections: null,
    timeout: null,
    expired: null,
    subscriptions: null,
    listeners: null });

  return Session;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9TZXNzaW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLEFBQUMsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEFBQUMsSUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLENBQUMsQ0FBQztBQUN2SCxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUE2QztNQUFsQyxVQUFVLFFBQVYsVUFBVTtNQUFFLGtCQUFrQixRQUFsQixrQkFBa0I7QUFDeEQsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUM7O01BRXZCLE9BQU87UUFBUCxPQUFPLEdBQ0EsU0FEUCxPQUFPLFFBQ21CO1VBQWhCLElBQUksU0FBSixJQUFJO1VBQUUsTUFBTSxTQUFOLE1BQU07QUFDeEIsT0FBQyxDQUFDLEdBQUcsQ0FBQztlQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ2pDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUM7T0FBQSxDQUNuRCxDQUFDO0FBQ0YsT0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2pDLFVBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDOztBQUV0QixVQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN4QixVQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQzs7QUFFcEIsVUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJ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QUFDWixlQUFXLEVBQUUsSUFBSTtBQUNqQixXQUFPLEVBQUUsSUFBSTtBQUNiLFdBQU8sRUFBRSxJQUFJO0FBQ2IsaUJBQWEsRUFBRSxJQUFJO0FBQ25CLGFBQVMsRUFBRSxJQUFJLEVBQ2hCLENBQUMsQ0FBQzs7QUFFSCxTQUFPLE9BQU8sQ0FBQztDQUNoQixDQUFDIiwiZmlsZSI6IlNlc3Npb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7IGNvbnN0IFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpOyBjb25zdCBfX0RFVl9fID0gKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih7IENvbm5lY3Rpb24sIFVwbGlua1NpbXBsZVNlcnZlciB9KSB7XG4gIGNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuXG4gIGNvbnN0IEVYUElSRV9USU1FT1VUID0gMzAwMDA7XG5cbiAgY2xhc3MgU2Vzc2lvbiB7XG4gICAgY29uc3RydWN0b3IoeyBndWlkLCB1cGxpbmsgfSkge1xuICAgICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdXBsaW5rLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFVwbGlua1NpbXBsZVNlcnZlcilcbiAgICAgICk7XG4gICAgICBfLmV4dGVuZCh0aGlzLCB7IGd1aWQsIHVwbGluayB9KTtcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fTtcblxuICAgICAgdGhpcy5zdWJzY3JpcHRpb25zID0ge307XG4gICAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuXG4gICAgICB0aGlzLnRpbWVvdXQgPSBudWxsO1xuICAgICAgdGhpcy5leHBpcmVkID0gZmFsc2U7XG4gICAgICB0aGlzLnBhdXNlKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgIGlmKHRoaXMudGltZW91dCAhPT0gbnVsbCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcbiAgICAgIH1cbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuY29ubmVjdGlvbnMpLmZvckVhY2goKGlkKSA9PiB0aGlzLmRldGFjaCh0aGlzLmNvbm5lY3Rpb25zW2lkXSkpO1xuICAgICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChwYXRoKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbShwYXRoKSk7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVycykuZm9yRWFjaCgocm9vbSkgPT4gdGhpcy51bmxpc3RlbkZyb20ocm9vbSkpO1xuICAgIH1cblxuICAgIGdldCBwYXVzZWQoKSB7XG4gICAgICByZXR1cm4gKHRoaXMudGltZW91dCAhPT0gbnVsbCk7XG4gICAgfVxuXG4gICAgLy8gSnVzdCBwcm94eSB0aGUgaW52b2NhdGlvbiB0byBhbGwgYXR0YWNoZWQgY29ubmVjdGlvbnMsIHdoaWNoIGltcGxlbWVudCB0aGUgc2FtZSBBUElzLlxuICAgIHByb3h5KG1ldGhvZCkge1xuICAgICAgcmV0dXJuICgpID0+IHsgbGV0IGFyZ3MgPSBhcmd1bWVudHM7IHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmNvbm5lY3Rpb25zKS5tYXAoKGlkKSA9PiB0aGlzLmNvbm5lY3Rpb25zW2lkXVttZXRob2RdKC4uLmFyZ3MpKTsgfTtcbiAgICB9XG5cbiAgICBhdHRhY2goY29ubmVjdGlvbikge1xuICAgICAgXy5kZXYoKCkgPT4gY29ubmVjdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihDb25uZWN0aW9uKSAmJlxuICAgICAgICB0aGlzLmNvbm5lY3Rpb24uc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KGNvbm5lY3Rpb24uaWQpXG4gICAgICApO1xuICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSA9IGNvbm5lY3Rpb247XG4gICAgICAvLyBJZiB0aGUgc2Vzc2lvbiB3YXMgcGF1c2VkIChubyBjb25uZWMgYXR0YWNoZWQpXG4gICAgICAvLyB0aGVuIHJlc3VtZSBpdFxuICAgICAgaWYodGhpcy5wYXVzZWQpIHtcbiAgICAgICAgdGhpcy5yZXN1bXNlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBleHBpcmUoKSB7XG4gICAgICB0aGlzLmV4cGlyZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLmRlbGV0ZVNlc3Npb24odGhpcyk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICBfLmRldigoKSA9PiB0aGlzLnBhdXNlZC5zaG91bGQubm90LmJlLm9rKTtcbiAgICAgIHRoaXMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5leHBpcmUoKSwgRVhQSVJFX1RJTUVPVVQpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG5cbiAgICByZXN1bWUoKSB7XG4gICAgICBfLmRldigoKSA9PiB0aGlzLnBhdXNlZC5zaG91bGQuYmUub2spO1xuICAgICAgLy8gUHJldmVudCB0aGUgZXhwaXJhdGlvbiB0aW1lb3V0XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcbiAgICAgIHRoaXMudGltZW91dCA9IG51bGw7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBkZXRhY2goY29ubmVjdGlvbikge1xuICAgICAgXy5kZXYoKCkgPT4gY29ubmVjdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihDb25uZWN0aW9uKSAmJlxuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zLnNob3VsZC5oYXZlLnByb3BlcnR5KGNvbm5lY3Rpb24uaWQsIGNvbm5lY3Rpb24pXG4gICAgICApO1xuICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXS5kZXRhY2goKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdO1xuICAgICAgLy8gSWYgdGhpcyB3YXMgdGhlIGxhc3QgY29ubmVjdGlvbiwgcGF1c2UgdGhlIHNlc3Npb25cbiAgICAgIC8vIGFuZCBzdGFydCB0aGUgZXhwaXJlIGNvdW50ZG93blxuICAgICAgaWYoT2JqZWN0LmtleXModGhpcy5jb25uZWN0aW9ucykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCd1cGRhdGUnKSh7IHBhdGgsIGRpZmYsIGhhc2ggfSk7XG4gICAgfVxuXG4gICAgc3Vic2NyaWJlVG8ocGF0aCkge1xuICAgICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zLnNob3VsZC5ub3QuaGF2ZS5wcm9wZXJ0eShwYXRoKVxuICAgICAgKTtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsuc3Vic2NyaWJlVG8ocGF0aCwgdGhpcyk7XG4gICAgfVxuXG4gICAgdW5zdWJzY3JpYmVGcm9tKHBhdGgpIHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5zaG91bGQuaGF2ZS5wcm9wZXJ0eShwYXRoKVxuICAgICAgKTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF07XG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsudW5zdWJzY3JpYmVGcm9tKHBhdGgsIHRoaXMpO1xuICAgIH1cblxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2VtaXQnKSh7IHJvb20sIHBhcmFtcyB9KTtcbiAgICB9XG5cbiAgICBsaXN0ZW5Ubyhyb29tKSB7XG4gICAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICB0aGlzLmxpc3RlbmVycy5zaG91bGQubm90LmhhdmUucHJvcGVydHkocm9vbSlcbiAgICAgICk7XG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXSA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsubGlzdGVuVG8ocm9vbSwgdGhpcyk7XG4gICAgfVxuXG4gICAgdW5saXN0ZW5Gcm9tKHJvb20pIHtcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMubGlzdGVuZXJzLnNob3VsZC5oYXZlLnByb3BlcnR5KHJvb20pXG4gICAgICApO1xuICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnVubGlzdGVuRnJvbShyb29tLCB0aGlzKTtcbiAgICB9XG5cbiAgICBkZWJ1ZyguLi5hcmdzKSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm94eSgnZGVidWcnKSguLi5hcmdzKTtcbiAgICB9XG5cbiAgICBsb2coLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2xvZycpKC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ3dhcm4nKSguLi5hcmdzKTtcbiAgICB9XG5cbiAgICBlcnIoLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2VycicpKC4uLmFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIF8uZXh0ZW5kKFNlc3Npb24ucHJvdG90eXBlLCB7XG4gICAgZ3VpZDogbnVsbCxcbiAgICB1cGxpbms6IG51bGwsXG4gICAgY29ubmVjdGlvbnM6IG51bGwsXG4gICAgdGltZW91dDogbnVsbCxcbiAgICBleHBpcmVkOiBudWxsLFxuICAgIHN1YnNjcmlwdGlvbnM6IG51bGwsXG4gICAgbGlzdGVuZXJzOiBudWxsLFxuICB9KTtcblxuICByZXR1cm4gU2Vzc2lvbjtcbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=