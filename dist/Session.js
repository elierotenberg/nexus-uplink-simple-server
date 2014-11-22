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

  var _Session = (function () {
    var _Session = function _Session(_ref2) {
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

    _classProps(_Session, null, {
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


        // Just proxy the invocation to all attached connections, which implement the same APIs.
        value: function (method) {
          return _.scope(function () {
            var _this2 = this;
            var args = _slice.call(arguments);

            return Object.keys(this.connections).map(function (id) {
              return _this2.connections[id][method].apply(_this2.connections[id], Array.from(args));
            });
          }, this);
        }
      },
      attach: {
        writable: true,
        value: function (connection) {
          var _this3 = this;
          _.dev(function () {
            return connection.should.be.an.instanceOf(Connection) && _this3.connections.should.not.have.property(connection.id);
          });
          this.connections[connection.id] = connection;
          // If the session was paused (no connec attached)
          // then resume it
          if (this.paused) {
            this.resume();
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

    return _Session;
  })();

  _.extend(_Session.prototype, {
    guid: null,
    uplink: null,
    connections: null,
    timeout: null,
    expired: null,
    subscriptions: null,
    listeners: null });

  return _Session;
};
//# sourceMappingURL=data:application/json;base64,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LFdBQU8sRUFBRSxJQUFJO0FBQ2IsV0FBTyxFQUFFLElBQUk7QUFDYixpQkFBYSxFQUFFLElBQUk7QUFDbkIsYUFBUyxFQUFFLElBQUksRUFDaEIsQ0FBQyxDQUFDOztBQUVILFNBQU8sUUFBTyxDQUFDO0NBQ2hCLENBQUMiLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSkge1xuICBjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcblxuICBjb25zdCBFWFBJUkVfVElNRU9VVCA9IDMwMDAwO1xuXG4gIGNsYXNzIFNlc3Npb24ge1xuICAgIGNvbnN0cnVjdG9yKHsgZ3VpZCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHVwbGluay5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihVcGxpbmtTaW1wbGVTZXJ2ZXIpXG4gICAgICApO1xuICAgICAgXy5leHRlbmQodGhpcywgeyBndWlkLCB1cGxpbmsgfSk7XG4gICAgICB0aGlzLmNvbm5lY3Rpb25zID0ge307XG5cbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9ucyA9IHt9O1xuICAgICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcblxuICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcbiAgICAgIHRoaXMuZXhwaXJlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5wYXVzZSgpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICBpZih0aGlzLnRpbWVvdXQgIT09IG51bGwpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dCk7XG4gICAgICB9XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmNvbm5lY3Rpb25zKS5mb3JFYWNoKChpZCkgPT4gdGhpcy5kZXRhY2godGhpcy5jb25uZWN0aW9uc1tpZF0pKTtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgocGF0aCkgPT4gdGhpcy51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xuICAgICAgT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnMpLmZvckVhY2goKHJvb20pID0+IHRoaXMudW5saXN0ZW5Gcm9tKHJvb20pKTtcbiAgICB9XG5cbiAgICBnZXQgcGF1c2VkKCkge1xuICAgICAgcmV0dXJuICh0aGlzLnRpbWVvdXQgIT09IG51bGwpO1xuICAgIH1cblxuICAgIC8vIEp1c3QgcHJveHkgdGhlIGludm9jYXRpb24gdG8gYWxsIGF0dGFjaGVkIGNvbm5lY3Rpb25zLCB3aGljaCBpbXBsZW1lbnQgdGhlIHNhbWUgQVBJcy5cbiAgICBwcm94eShtZXRob2QpIHtcbiAgICAgIHJldHVybiBfLnNjb3BlKGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuY29ubmVjdGlvbnMpLm1hcCgoaWQpID0+IHRoaXMuY29ubmVjdGlvbnNbaWRdW21ldGhvZF0oLi4uYXJncykpO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgYXR0YWNoKGNvbm5lY3Rpb24pIHtcbiAgICAgIF8uZGV2KCgpID0+IGNvbm5lY3Rpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoQ29ubmVjdGlvbikgJiZcbiAgICAgICAgdGhpcy5jb25uZWN0aW9ucy5zaG91bGQubm90LmhhdmUucHJvcGVydHkoY29ubmVjdGlvbi5pZClcbiAgICAgICk7XG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdID0gY29ubmVjdGlvbjtcbiAgICAgIC8vIElmIHRoZSBzZXNzaW9uIHdhcyBwYXVzZWQgKG5vIGNvbm5lYyBhdHRhY2hlZClcbiAgICAgIC8vIHRoZW4gcmVzdW1lIGl0XG4gICAgICBpZih0aGlzLnBhdXNlZCkge1xuICAgICAgICB0aGlzLnJlc3VtZSgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgZXhwaXJlKCkge1xuICAgICAgdGhpcy5leHBpcmVkID0gdHJ1ZTtcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay5kZWxldGVTZXNzaW9uKHRoaXMpO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5wYXVzZWQuc2hvdWxkLm5vdC5iZS5vayk7XG4gICAgICB0aGlzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZXhwaXJlKCksIEVYUElSRV9USU1FT1VUKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuXG4gICAgcmVzdW1lKCkge1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5wYXVzZWQuc2hvdWxkLmJlLm9rKTtcbiAgICAgIC8vIFByZXZlbnQgdGhlIGV4cGlyYXRpb24gdGltZW91dFxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dCk7XG4gICAgICB0aGlzLnRpbWVvdXQgPSBudWxsO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgZGV0YWNoKGNvbm5lY3Rpb24pIHtcbiAgICAgIF8uZGV2KCgpID0+IGNvbm5lY3Rpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoQ29ubmVjdGlvbikgJiZcbiAgICAgICAgdGhpcy5jb25uZWN0aW9ucy5zaG91bGQuaGF2ZS5wcm9wZXJ0eShjb25uZWN0aW9uLmlkLCBjb25uZWN0aW9uKVxuICAgICAgKTtcbiAgICAgIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF0uZGV0YWNoKCk7XG4gICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXTtcbiAgICAgIC8vIElmIHRoaXMgd2FzIHRoZSBsYXN0IGNvbm5lY3Rpb24sIHBhdXNlIHRoZSBzZXNzaW9uXG4gICAgICAvLyBhbmQgc3RhcnQgdGhlIGV4cGlyZSBjb3VudGRvd25cbiAgICAgIGlmKE9iamVjdC5rZXlzKHRoaXMuY29ubmVjdGlvbnMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdXBkYXRlKHsgcGF0aCwgZGlmZiwgaGFzaCB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm94eSgndXBkYXRlJykoeyBwYXRoLCBkaWZmLCBoYXNoIH0pO1xuICAgIH1cblxuICAgIHN1YnNjcmliZVRvKHBhdGgpIHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5zaG91bGQubm90LmhhdmUucHJvcGVydHkocGF0aClcbiAgICAgICk7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0gPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnN1YnNjcmliZVRvKHBhdGgsIHRoaXMpO1xuICAgIH1cblxuICAgIHVuc3Vic2NyaWJlRnJvbShwYXRoKSB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvbnMuc2hvdWxkLmhhdmUucHJvcGVydHkocGF0aClcbiAgICAgICk7XG4gICAgICBkZWxldGUgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnVuc3Vic2NyaWJlRnJvbShwYXRoLCB0aGlzKTtcbiAgICB9XG5cbiAgICBlbWl0KHsgcm9vbSwgcGFyYW1zIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdlbWl0JykoeyByb29tLCBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgbGlzdGVuVG8ocm9vbSkge1xuICAgICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMuc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KHJvb20pXG4gICAgICApO1xuICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0gPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLmxpc3RlblRvKHJvb20sIHRoaXMpO1xuICAgIH1cblxuICAgIHVubGlzdGVuRnJvbShyb29tKSB7XG4gICAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICB0aGlzLmxpc3RlbmVycy5zaG91bGQuaGF2ZS5wcm9wZXJ0eShyb29tKVxuICAgICAgKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay51bmxpc3RlbkZyb20ocm9vbSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZGVidWcoLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2RlYnVnJykoLi4uYXJncyk7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdsb2cnKSguLi5hcmdzKTtcbiAgICB9XG5cbiAgICB3YXJuKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCd3YXJuJykoLi4uYXJncyk7XG4gICAgfVxuXG4gICAgZXJyKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdlcnInKSguLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBfLmV4dGVuZChTZXNzaW9uLnByb3RvdHlwZSwge1xuICAgIGd1aWQ6IG51bGwsXG4gICAgdXBsaW5rOiBudWxsLFxuICAgIGNvbm5lY3Rpb25zOiBudWxsLFxuICAgIHRpbWVvdXQ6IG51bGwsXG4gICAgZXhwaXJlZDogbnVsbCxcbiAgICBzdWJzY3JpcHRpb25zOiBudWxsLFxuICAgIGxpc3RlbmVyczogbnVsbCxcbiAgfSk7XG5cbiAgcmV0dXJuIFNlc3Npb247XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9