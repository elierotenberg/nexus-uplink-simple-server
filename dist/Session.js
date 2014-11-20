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
            return connection.should.be.an.instanceOf(Connection) && _this3.connections[connection.id].should.not.be.ok;
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
            return connection.should.be.an.instanceOf(Connection) && _this6.connections[connection.id].should.be.exactly(connection);
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
            return path.should.be.a.String && _this7.subscriptions[path].should.not.be.ok;
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
            return path.should.be.a.String && _this8.subscriptions[path].should.be.ok;
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
            return room.should.be.a.String && _this9.listeners[room].should.not.be.ok;
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
            return room.should.be.a.String && _this10.listeners[room].should.be.ok;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9TZXNzaW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLEFBQUMsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEFBQUMsSUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLENBQUMsQ0FBQztBQUN2SCxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUE2QztNQUFsQyxVQUFVLFFBQVYsVUFBVTtNQUFFLGtCQUFrQixRQUFsQixrQkFBa0I7QUFDeEQsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUM7O01BRXZCLE9BQU87UUFBUCxPQUFPLEdBQ0EsU0FEUCxPQUFPLFFBQ21CO1VBQWhCLElBQUksU0FBSixJQUFJO1VBQUUsTUFBTSxTQUFOLE1BQU07QUFDeEIsT0FBQyxDQUFDLEdBQUcsQ0FBQztlQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ2pDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUM7T0FBQSxDQUNuRCxDQUFDO0FBQ0YsT0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2pDLFVBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDOztBQUV0QixVQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN4QixVQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQzs7QUFFcEIsVUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJ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SUFBSTtBQUNaLGVBQVcsRUFBRSxJQUFJO0FBQ2pCLFdBQU8sRUFBRSxJQUFJO0FBQ2IsV0FBTyxFQUFFLElBQUk7QUFDYixpQkFBYSxFQUFFLElBQUk7QUFDbkIsYUFBUyxFQUFFLElBQUksRUFDaEIsQ0FBQyxDQUFDOztBQUVILFNBQU8sT0FBTyxDQUFDO0NBQ2hCLENBQUMiLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTsgY29uc3QgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7IGNvbnN0IF9fREVWX18gPSAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHsgQ29ubmVjdGlvbiwgVXBsaW5rU2ltcGxlU2VydmVyIH0pIHtcclxuICBjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcclxuXHJcbiAgY29uc3QgRVhQSVJFX1RJTUVPVVQgPSAzMDAwMDtcclxuXHJcbiAgY2xhc3MgU2Vzc2lvbiB7XHJcbiAgICBjb25zdHJ1Y3Rvcih7IGd1aWQsIHVwbGluayB9KSB7XHJcbiAgICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXHJcbiAgICAgICAgdXBsaW5rLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFVwbGlua1NpbXBsZVNlcnZlcilcclxuICAgICAgKTtcclxuICAgICAgXy5leHRlbmQodGhpcywgeyBndWlkLCB1cGxpbmsgfSk7XHJcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fTtcclxuXHJcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9ucyA9IHt9O1xyXG4gICAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xyXG5cclxuICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcclxuICAgICAgdGhpcy5leHBpcmVkID0gZmFsc2U7XHJcbiAgICAgIHRoaXMucGF1c2UoKTtcclxuICAgIH1cclxuXHJcbiAgICBkZXN0cm95KCkge1xyXG4gICAgICBpZih0aGlzLnRpbWVvdXQgIT09IG51bGwpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcclxuICAgICAgfVxyXG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmNvbm5lY3Rpb25zKS5mb3JFYWNoKChpZCkgPT4gdGhpcy5kZXRhY2godGhpcy5jb25uZWN0aW9uc1tpZF0pKTtcclxuICAgICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChwYXRoKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbShwYXRoKSk7XHJcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzKS5mb3JFYWNoKChyb29tKSA9PiB0aGlzLnVubGlzdGVuRnJvbShyb29tKSk7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0IHBhdXNlZCgpIHtcclxuICAgICAgcmV0dXJuICh0aGlzLnRpbWVvdXQgIT09IG51bGwpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEp1c3QgcHJveHkgdGhlIGludm9jYXRpb24gdG8gYWxsIGF0dGFjaGVkIGNvbm5lY3Rpb25zLCB3aGljaCBpbXBsZW1lbnQgdGhlIHNhbWUgQVBJcy5cclxuICAgIHByb3h5KG1ldGhvZCkge1xyXG4gICAgICByZXR1cm4gKCkgPT4geyBsZXQgYXJncyA9IGFyZ3VtZW50czsgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuY29ubmVjdGlvbnMpLm1hcCgoaWQpID0+IHRoaXMuY29ubmVjdGlvbnNbaWRdW21ldGhvZF0oLi4uYXJncykpOyB9O1xyXG4gICAgfVxyXG5cclxuICAgIGF0dGFjaChjb25uZWN0aW9uKSB7XHJcbiAgICAgIF8uZGV2KCgpID0+IGNvbm5lY3Rpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoQ29ubmVjdGlvbikgJiZcclxuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdLnNob3VsZC5ub3QuYmUub2tcclxuICAgICAgKTtcclxuICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSA9IGNvbm5lY3Rpb247XHJcbiAgICAgIC8vIElmIHRoZSBzZXNzaW9uIHdhcyBwYXVzZWQgKG5vIGNvbm5lYyBhdHRhY2hlZClcclxuICAgICAgLy8gdGhlbiByZXN1bWUgaXRcclxuICAgICAgaWYodGhpcy5wYXVzZWQpIHtcclxuICAgICAgICB0aGlzLnJlc3Vtc2UoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBleHBpcmUoKSB7XHJcbiAgICAgIHRoaXMuZXhwaXJlZCA9IHRydWU7XHJcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay5kZWxldGVTZXNzaW9uKHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHBhdXNlKCkge1xyXG4gICAgICBfLmRldigoKSA9PiB0aGlzLnBhdXNlZC5zaG91bGQubm90LmJlLm9rKTtcclxuICAgICAgdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLmV4cGlyZSgpLCBFWFBJUkVfVElNRU9VVCk7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuXHJcbiAgICByZXN1bWUoKSB7XHJcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMucGF1c2VkLnNob3VsZC5iZS5vayk7XHJcbiAgICAgIC8vIFByZXZlbnQgdGhlIGV4cGlyYXRpb24gdGltZW91dFxyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcclxuICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgZGV0YWNoKGNvbm5lY3Rpb24pIHtcclxuICAgICAgXy5kZXYoKCkgPT4gY29ubmVjdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihDb25uZWN0aW9uKSAmJlxyXG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF0uc2hvdWxkLmJlLmV4YWN0bHkoY29ubmVjdGlvbilcclxuICAgICAgKTtcclxuICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXS5kZXRhY2goKTtcclxuICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF07XHJcbiAgICAgIC8vIElmIHRoaXMgd2FzIHRoZSBsYXN0IGNvbm5lY3Rpb24sIHBhdXNlIHRoZSBzZXNzaW9uXHJcbiAgICAgIC8vIGFuZCBzdGFydCB0aGUgZXhwaXJlIGNvdW50ZG93blxyXG4gICAgICBpZihPYmplY3Qua2V5cyh0aGlzLmNvbm5lY3Rpb25zKS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aGlzLnBhdXNlKCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcclxuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ3VwZGF0ZScpKHsgcGF0aCwgZGlmZiwgaGFzaCB9KTtcclxuICAgIH1cclxuXHJcbiAgICBzdWJzY3JpYmVUbyhwYXRoKSB7XHJcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXHJcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdLnNob3VsZC5ub3QuYmUub2tcclxuICAgICAgKTtcclxuICAgICAgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdID0gdHJ1ZTtcclxuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnN1YnNjcmliZVRvKHBhdGgsIHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHVuc3Vic2NyaWJlRnJvbShwYXRoKSB7XHJcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXHJcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdLnNob3VsZC5iZS5va1xyXG4gICAgICApO1xyXG4gICAgICBkZWxldGUgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdO1xyXG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsudW5zdWJzY3JpYmVGcm9tKHBhdGgsIHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5wcm94eSgnZW1pdCcpKHsgcm9vbSwgcGFyYW1zIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGxpc3RlblRvKHJvb20pIHtcclxuICAgICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcclxuICAgICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXS5zaG91bGQubm90LmJlLm9rXHJcbiAgICAgICk7XHJcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dID0gdHJ1ZTtcclxuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLmxpc3RlblRvKHJvb20sIHRoaXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHVubGlzdGVuRnJvbShyb29tKSB7XHJcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXHJcbiAgICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0uc2hvdWxkLmJlLm9rXHJcbiAgICAgICk7XHJcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcclxuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnVubGlzdGVuRnJvbShyb29tLCB0aGlzKTtcclxuICAgIH1cclxuXHJcbiAgICBkZWJ1ZyguLi5hcmdzKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdkZWJ1ZycpKC4uLmFyZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIGxvZyguLi5hcmdzKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdsb2cnKSguLi5hcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICB3YXJuKC4uLmFyZ3MpIHtcclxuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ3dhcm4nKSguLi5hcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBlcnIoLi4uYXJncykge1xyXG4gICAgICByZXR1cm4gdGhpcy5wcm94eSgnZXJyJykoLi4uYXJncyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBfLmV4dGVuZChTZXNzaW9uLnByb3RvdHlwZSwge1xyXG4gICAgZ3VpZDogbnVsbCxcclxuICAgIHVwbGluazogbnVsbCxcclxuICAgIGNvbm5lY3Rpb25zOiBudWxsLFxyXG4gICAgdGltZW91dDogbnVsbCxcclxuICAgIGV4cGlyZWQ6IG51bGwsXHJcbiAgICBzdWJzY3JpcHRpb25zOiBudWxsLFxyXG4gICAgbGlzdGVuZXJzOiBudWxsLFxyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gU2Vzc2lvbjtcclxufTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9