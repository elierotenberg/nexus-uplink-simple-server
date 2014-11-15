"use strict";

var _slice = Array.prototype.slice;
var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
module.exports = function (_ref) {
  var Connection = _ref.Connection;
  var UplinkSimpleServer = _ref.UplinkSimpleServer;
  var _ = require("lodash-next");
  var should = _.should;

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
          return function () {
            var args = _slice.call(arguments);

            return Object.keys(_this2.connections).map(function (id) {
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
      resume: {
        writable: true,
        value: function () {
          var _this4 = this;
          _.dev(function () {
            return _this4.paused.should.be.ok;
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
          var _this5 = this;
          _.dev(function () {
            return connection.should.be.an.instanceOf(Connection) && _this5.connections[connection.id].should.be.exactly(connection);
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
      pause: {
        writable: true,
        value: function () {
          var _this6 = this;
          _.dev(function () {
            return _this6.paused.should.not.be.ok;
          });
          this.timeout = setTimeout(function () {
            return _this6.expire();
          }, EXPIRE_TIMEOUT);
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
    timeout: null });

  return Session;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9TZXNzaW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUE2QztNQUFsQyxVQUFVLFFBQVYsVUFBVTtNQUFFLGtCQUFrQixRQUFsQixrQkFBa0I7QUFDeEQsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7O0FBRXhCLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQzs7TUFFdkIsT0FBTztRQUFQLE9BQU8sR0FDQSxTQURQLE9BQU8sUUFDbUI7VUFBaEIsSUFBSSxTQUFKLElBQUk7VUFBRSxNQUFNLFNBQU4sTUFBTTtBQUN4QixPQUFDLENBQUMsR0FBRyxDQUFDO2VBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQztPQUFBLENBQ25ELENBQUM7QUFDRixPQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsTUFBTSxFQUFOLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDakMsVUFBSSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7O0FBRXRCLFVBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFDO0FBQ3hCLFVBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDOztBQUVwQixVQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztBQUNwQixVQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7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SUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1dBQUEsQ0FDbEMsQ0FBQztBQUNGLGlCQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDNUIsaUJBQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzdDOztBQUVELFdBQUs7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1gsaUJBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsd0JBQUksSUFBSSxFQUFDLENBQUM7U0FDckM7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxpQkFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyx3QkFBSSxJQUFJLEVBQUMsQ0FBQztTQUNuQzs7QUFFRCxVQUFJOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNWLGlCQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLHdCQUFJLElBQUksRUFBQyxDQUFDO1NBQ3BDOztBQUVELFNBQUc7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1QsaUJBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsd0JBQUksSUFBSSxFQUFDLENBQUM7U0FDbkM7Ozs7V0FoSUcsT0FBTzs7O0FBbUliLEdBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRTtBQUMxQixRQUFJLEVBQUUsSUFBSTtBQUNWLFVBQU0sRUFBRSxJQUFJO0FBQ1osZUFBVyxFQUFFLElBQUk7QUFDakIsV0FBTyxFQUFFLElBQUksRUFDZCxDQUFDLENBQUM7O0FBRUgsU0FBTyxPQUFPLENBQUM7Q0FDaEIsQ0FBQyIsImZpbGUiOiJTZXNzaW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih7IENvbm5lY3Rpb24sIFVwbGlua1NpbXBsZVNlcnZlciB9KSB7XG4gIGNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuICBjb25zdCBzaG91bGQgPSBfLnNob3VsZDtcblxuICBjb25zdCBFWFBJUkVfVElNRU9VVCA9IDMwMDAwO1xuXG4gIGNsYXNzIFNlc3Npb24ge1xuICAgIGNvbnN0cnVjdG9yKHsgZ3VpZCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHVwbGluay5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihVcGxpbmtTaW1wbGVTZXJ2ZXIpXG4gICAgICApO1xuICAgICAgXy5leHRlbmQodGhpcywgeyBndWlkLCB1cGxpbmsgfSk7XG4gICAgICB0aGlzLmNvbm5lY3Rpb25zID0ge307XG5cbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9ucyA9IHt9O1xuICAgICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcblxuICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcbiAgICAgIHRoaXMucGF1c2UoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgaWYodGhpcy50aW1lb3V0ICE9PSBudWxsKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpO1xuICAgICAgfVxuICAgICAgT2JqZWN0LmtleXModGhpcy5jb25uZWN0aW9ucykuZm9yRWFjaCgoaWQpID0+IHRoaXMuZGV0YWNoKHRoaXMuY29ubmVjdGlvbnNbaWRdKSk7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmlwdGlvbnMpLmZvckVhY2goKHBhdGgpID0+IHRoaXMudW5zdWJzY3JpYmVGcm9tKHBhdGgpKTtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzKS5mb3JFYWNoKChyb29tKSA9PiB0aGlzLnVubGlzdGVuRnJvbShyb29tKSk7XG4gICAgfVxuXG4gICAgZ2V0IHBhdXNlZCgpIHtcbiAgICAgIHJldHVybiAodGhpcy50aW1lb3V0ICE9PSBudWxsKTtcbiAgICB9XG5cbiAgICAvLyBKdXN0IHByb3h5IHRoZSBpbnZvY2F0aW9uIHRvIGFsbCBhdHRhY2hlZCBjb25uZWN0aW9ucywgd2hpY2ggaW1wbGVtZW50IHRoZSBzYW1lIEFQSXMuXG4gICAgcHJveHkobWV0aG9kKSB7XG4gICAgICByZXR1cm4gKC4uLmFyZ3MpID0+IE9iamVjdC5rZXlzKHRoaXMuY29ubmVjdGlvbnMpLm1hcCgoaWQpID0+IHRoaXMuY29ubmVjdGlvbnNbaWRdW21ldGhvZF0oLi4uYXJncykpO1xuICAgIH1cblxuICAgIGF0dGFjaChjb25uZWN0aW9uKSB7XG4gICAgICBfLmRldigoKSA9PiBjb25uZWN0aW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKENvbm5lY3Rpb24pICYmXG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF0uc2hvdWxkLm5vdC5iZS5va1xuICAgICAgKTtcbiAgICAgIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF0gPSBjb25uZWN0aW9uO1xuICAgICAgLy8gSWYgdGhlIHNlc3Npb24gd2FzIHBhdXNlZCAobm8gY29ubmVjIGF0dGFjaGVkKVxuICAgICAgLy8gdGhlbiByZXN1bWUgaXRcbiAgICAgIGlmKHRoaXMucGF1c2VkKSB7XG4gICAgICAgIHRoaXMucmVzdW1zZSgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcmVzdW1lKCkge1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5wYXVzZWQuc2hvdWxkLmJlLm9rKTtcbiAgICAgIC8vIFByZXZlbnQgdGhlIGV4cGlyYXRpb24gdGltZW91dFxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dCk7XG4gICAgICB0aGlzLnRpbWVvdXQgPSBudWxsO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgZGV0YWNoKGNvbm5lY3Rpb24pIHtcbiAgICAgIF8uZGV2KCgpID0+IGNvbm5lY3Rpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoQ29ubmVjdGlvbikgJiZcbiAgICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShjb25uZWN0aW9uKVxuICAgICAgKTtcbiAgICAgIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF0uZGV0YWNoKCk7XG4gICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXTtcbiAgICAgIC8vIElmIHRoaXMgd2FzIHRoZSBsYXN0IGNvbm5lY3Rpb24sIHBhdXNlIHRoZSBzZXNzaW9uXG4gICAgICAvLyBhbmQgc3RhcnQgdGhlIGV4cGlyZSBjb3VudGRvd25cbiAgICAgIGlmKE9iamVjdC5rZXlzKHRoaXMuY29ubmVjdGlvbnMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMucGF1c2VkLnNob3VsZC5ub3QuYmUub2spO1xuICAgICAgdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLmV4cGlyZSgpLCBFWFBJUkVfVElNRU9VVCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCd1cGRhdGUnKSh7IHBhdGgsIGRpZmYsIGhhc2ggfSk7XG4gICAgfVxuXG4gICAgc3Vic2NyaWJlVG8ocGF0aCkge1xuICAgICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdLnNob3VsZC5ub3QuYmUub2tcbiAgICAgICk7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0gPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnN1YnNjcmliZVRvKHBhdGgsIHRoaXMpO1xuICAgIH1cblxuICAgIHVuc3Vic2NyaWJlRnJvbShwYXRoKSB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0uc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgZGVsZXRlIHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXTtcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay51bnN1YnNjcmliZUZyb20ocGF0aCwgdGhpcyk7XG4gICAgfVxuXG4gICAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm94eSgnZW1pdCcpKHsgcm9vbSwgcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIGxpc3RlblRvKHJvb20pIHtcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dLnNob3VsZC5ub3QuYmUub2tcbiAgICAgICk7XG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXSA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsubGlzdGVuVG8ocm9vbSwgdGhpcyk7XG4gICAgfVxuXG4gICAgdW5saXN0ZW5Gcm9tKHJvb20pIHtcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay51bmxpc3RlbkZyb20ocm9vbSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZGVidWcoLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2RlYnVnJykoLi4uYXJncyk7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdsb2cnKSguLi5hcmdzKTtcbiAgICB9XG5cbiAgICB3YXJuKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCd3YXJuJykoLi4uYXJncyk7XG4gICAgfVxuXG4gICAgZXJyKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdlcnInKSguLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBfLmV4dGVuZChTZXNzaW9uLnByb3RvdHlwZSwge1xuICAgIGd1aWQ6IG51bGwsXG4gICAgdXBsaW5rOiBudWxsLFxuICAgIGNvbm5lY3Rpb25zOiBudWxsLFxuICAgIHRpbWVvdXQ6IG51bGwsXG4gIH0pO1xuXG4gIHJldHVybiBTZXNzaW9uO1xufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==