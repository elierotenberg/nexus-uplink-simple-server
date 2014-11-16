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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9TZXNzaW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUE2QztNQUFsQyxVQUFVLFFBQVYsVUFBVTtNQUFFLGtCQUFrQixRQUFsQixrQkFBa0I7QUFDeEQsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDOztBQUVqQyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUM7O01BRXZCLE9BQU87UUFBUCxPQUFPLEdBQ0EsU0FEUCxPQUFPLFFBQ21CO1VBQWhCLElBQUksU0FBSixJQUFJO1VBQUUsTUFBTSxTQUFOLE1BQU07QUFDeEIsT0FBQyxDQUFDLEdBQUcsQ0FBQztlQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ2pDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUM7T0FBQSxDQUNuRCxDQUFDO0FBQ0YsT0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2pDLFVBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDOztBQUV0QixVQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN4QixVQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQzs7QUFFcEIsVUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDcEIsVUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7QUFDckIsVUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0tBQ2Q7O2dCQWRHLE9BQU87QUFnQlgsYUFBTzs7ZUFBQSxZQUFHOztBQUNSLGNBQUcsSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLEVBQUU7QUFDeEIsd0JBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7V0FDNUI7QUFDRCxnQkFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsRUFBRTttQkFBSyxNQUFLLE1BQU0sQ0FBQyxNQUFLLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztXQUFBLENBQUMsQ0FBQztBQUNqRixnQkFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBSTttQkFBSyxNQUFLLGVBQWUsQ0FBQyxJQUFJLENBQUM7V0FBQSxDQUFDLENBQUM7QUFDOUUsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLElBQUk7bUJBQUssTUFBSyxZQUFZLENBQUMsSUFBSSxDQUFDO1dBQUEsQ0FBQyxDQUFDO1NBQ3hFOztBQUVHLFlBQU07YUFBQSxZQUFHO0FBQ1gsaUJBQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxDQUFDO1NBQ2hDOztBQUdELFdBQUs7O2VBQUEsVUFBQyxNQUFNLEVBQUU7OztBQUNaLGlCQUFPLFlBQU07QUFBRSxnQkFBSSxJQUFJLGFBQVksQ0FBQyxBQUFDLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFLLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFDLEVBQUU7cUJBQUssT0FBSyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxPQUFDLENBQTVCLE9BQUssV0FBVyxDQUFDLEVBQUUsQ0FBQyxhQUFZLElBQUksRUFBQzthQUFBLENBQUMsQ0FBQztXQUFFLENBQUM7U0FDakk7O0FBRUQsWUFBTTs7ZUFBQSxVQUFDLFVBQVUsRUFBRTs7QUFDakIsV0FBQyxDQUFDLEdBQUcsQ0FBQzttQkFBTSxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUN4RCxPQUFLLFdBQVcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtXQUFBLENBQ2pELENBQUM7QUFDRixjQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUM7OztBQUc3QyxjQUFHLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDZCxnQkFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1dBQ2hCO0FBQ0QsaUJBQU8sSUFBSSxDQUFDO1NBQ2I7O0FBRUQsWUFBTTs7ZUFBQSxZQUFHO0FBQ1AsY0FBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDcEIsaUJBQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEM7O0FBRUQsV0FBSzs7ZUFBQSxZQUFHOztBQUNOLFdBQUMsQ0FBQyxHQUFHLENBQUM7bUJBQU0sT0FBSyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtXQUFBLENBQUMsQ0FBQztBQUMxQyxjQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQzttQkFBTSxPQUFLLE1BQU0sRUFBRTtXQUFBLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFDL0QsaUJBQU8sSUFBSSxDQUFDO1NBQ2I7O0FBR0QsWUFBTTs7ZUFBQSxZQUFHOztBQUNQLFdBQUMsQ0FBQyxHQUFHLENBQUM7bUJBQU0sT0FBSyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1dBQUEsQ0FBQyxDQUFDOztBQUV0QyxzQkFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMzQixjQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztBQUNwQixpQkFBTyxJQUFJLENBQUM7U0FDYjs7QUFFRCxZQUFNOztlQUFBLFVBQUMsVUFBVSxFQUFFOztBQUNqQixXQUFDLENBQUMsR0FBRyxDQUFDO21CQUFNLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQ3hELE9BQUssV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7V0FBQSxDQUM5RCxDQUFDO0FBQ0YsY0FBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDekMsaUJBQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7OztBQUd2QyxjQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDN0MsZ0JBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztXQUNkO0FBQ0QsaUJBQU8sSUFBSSxDQUFDO1NBQ2I7O0FBQ0QsWUFBTTs7ZUFBQSxpQkFBdUI7Y0FBcEIsSUFBSSxTQUFKLElBQUk7Y0FBRSxJQUFJLFNBQUosSUFBSTtjQUFFLElBQUksU0FBSixJQUFJO0FBQ3ZCLGlCQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxDQUFDLENBQUM7U0FDbkQ7O0FBRUQsaUJBQVc7O2VBQUEsVUFBQyxJQUFJLEVBQUU7O0FBQ2hCLFdBQUMsQ0FBQyxHQUFHLENBQUM7bUJBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsT0FBSyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtXQUFBLENBQzFDLENBQUM7QUFDRixjQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztBQUNoQyxpQkFBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDNUM7O0FBRUQscUJBQWU7O2VBQUEsVUFBQyxJQUFJLEVBQUU7O0FBQ3BCLFdBQUMsQ0FBQyxHQUFHLENBQUM7bUJBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsT0FBSyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1dBQUEsQ0FDdEMsQ0FBQztBQUNGLGlCQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEMsaUJBQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ2hEOztBQUVELFVBQUk7O2VBQUEsaUJBQW1CO2NBQWhCLElBQUksU0FBSixJQUFJO2NBQUUsTUFBTSxTQUFOLE1BQU07QUFDakIsaUJBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsTUFBTSxFQUFOLE1BQU0sRUFBRSxDQUFDLENBQUM7U0FDN0M7O0FBRUQsY0FBUTs7ZUFBQSxVQUFDLElBQUksRUFBRTs7QUFDYixXQUFDLENBQUMsR0FBRyxDQUFDO21CQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ2pDLE9BQUssU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUU7V0FBQSxDQUN0QyxDQUFDO0FBQ0YsY0FBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDNUIsaUJBQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3pDOztBQUVELGtCQUFZOztlQUFBLFVBQUMsSUFBSSxFQUFFOztBQUNqQixXQUFDLENBQUMsR0FBRyxDQUFDO21CQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLElBQ2pDLFFBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRTtXQUFBLENBQ2xDLENBQUM7QUFDRixpQkFBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzVCLGlCQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUM3Qzs7QUFFRCxXQUFLOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNYLGlCQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLHdCQUFJLElBQUksRUFBQyxDQUFDO1NBQ3JDOztBQUVELFNBQUc7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1QsaUJBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsd0JBQUksSUFBSSxFQUFDLENBQUM7U0FDbkM7O0FBRUQsVUFBSTs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVixpQkFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyx3QkFBSSxJQUFJLEVBQUMsQ0FBQztTQUNwQzs7QUFFRCxTQUFHOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNULGlCQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLHdCQUFJLElBQUksRUFBQyxDQUFDO1NBQ25DOzs7O1dBdElHLE9BQU87OztBQXlJYixHQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUU7QUFDMUIsUUFBSSxFQUFFLElBQUk7QUFDVixVQUFNLEVBQUUsSUFBSTtBQUNaLGVBQVcsRUFBRSxJQUFJO0FBQ2pCLFdBQU8sRUFBRSxJQUFJO0FBQ2IsV0FBTyxFQUFFLElBQUk7QUFDYixpQkFBYSxFQUFFLElBQUk7QUFDbkIsYUFBUyxFQUFFLElBQUksRUFDaEIsQ0FBQyxDQUFDOztBQUVILFNBQU8sT0FBTyxDQUFDO0NBQ2hCLENBQUMiLCJmaWxlIjoiU2Vzc2lvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSkge1xuICBjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcblxuICBjb25zdCBFWFBJUkVfVElNRU9VVCA9IDMwMDAwO1xuXG4gIGNsYXNzIFNlc3Npb24ge1xuICAgIGNvbnN0cnVjdG9yKHsgZ3VpZCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHVwbGluay5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihVcGxpbmtTaW1wbGVTZXJ2ZXIpXG4gICAgICApO1xuICAgICAgXy5leHRlbmQodGhpcywgeyBndWlkLCB1cGxpbmsgfSk7XG4gICAgICB0aGlzLmNvbm5lY3Rpb25zID0ge307XG5cbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9ucyA9IHt9O1xuICAgICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcblxuICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcbiAgICAgIHRoaXMuZXhwaXJlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5wYXVzZSgpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICBpZih0aGlzLnRpbWVvdXQgIT09IG51bGwpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dCk7XG4gICAgICB9XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmNvbm5lY3Rpb25zKS5mb3JFYWNoKChpZCkgPT4gdGhpcy5kZXRhY2godGhpcy5jb25uZWN0aW9uc1tpZF0pKTtcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaXB0aW9ucykuZm9yRWFjaCgocGF0aCkgPT4gdGhpcy51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xuICAgICAgT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnMpLmZvckVhY2goKHJvb20pID0+IHRoaXMudW5saXN0ZW5Gcm9tKHJvb20pKTtcbiAgICB9XG5cbiAgICBnZXQgcGF1c2VkKCkge1xuICAgICAgcmV0dXJuICh0aGlzLnRpbWVvdXQgIT09IG51bGwpO1xuICAgIH1cblxuICAgIC8vIEp1c3QgcHJveHkgdGhlIGludm9jYXRpb24gdG8gYWxsIGF0dGFjaGVkIGNvbm5lY3Rpb25zLCB3aGljaCBpbXBsZW1lbnQgdGhlIHNhbWUgQVBJcy5cbiAgICBwcm94eShtZXRob2QpIHtcbiAgICAgIHJldHVybiAoKSA9PiB7IGxldCBhcmdzID0gYXJndW1lbnRzOyByZXR1cm4gT2JqZWN0LmtleXModGhpcy5jb25uZWN0aW9ucykubWFwKChpZCkgPT4gdGhpcy5jb25uZWN0aW9uc1tpZF1bbWV0aG9kXSguLi5hcmdzKSk7IH07XG4gICAgfVxuXG4gICAgYXR0YWNoKGNvbm5lY3Rpb24pIHtcbiAgICAgIF8uZGV2KCgpID0+IGNvbm5lY3Rpb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoQ29ubmVjdGlvbikgJiZcbiAgICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXS5zaG91bGQubm90LmJlLm9rXG4gICAgICApO1xuICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSA9IGNvbm5lY3Rpb247XG4gICAgICAvLyBJZiB0aGUgc2Vzc2lvbiB3YXMgcGF1c2VkIChubyBjb25uZWMgYXR0YWNoZWQpXG4gICAgICAvLyB0aGVuIHJlc3VtZSBpdFxuICAgICAgaWYodGhpcy5wYXVzZWQpIHtcbiAgICAgICAgdGhpcy5yZXN1bXNlKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBleHBpcmUoKSB7XG4gICAgICB0aGlzLmV4cGlyZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLmRlbGV0ZVNlc3Npb24odGhpcyk7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICBfLmRldigoKSA9PiB0aGlzLnBhdXNlZC5zaG91bGQubm90LmJlLm9rKTtcbiAgICAgIHRoaXMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5leHBpcmUoKSwgRVhQSVJFX1RJTUVPVVQpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG5cbiAgICByZXN1bWUoKSB7XG4gICAgICBfLmRldigoKSA9PiB0aGlzLnBhdXNlZC5zaG91bGQuYmUub2spO1xuICAgICAgLy8gUHJldmVudCB0aGUgZXhwaXJhdGlvbiB0aW1lb3V0XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcbiAgICAgIHRoaXMudGltZW91dCA9IG51bGw7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBkZXRhY2goY29ubmVjdGlvbikge1xuICAgICAgXy5kZXYoKCkgPT4gY29ubmVjdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihDb25uZWN0aW9uKSAmJlxuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdLnNob3VsZC5iZS5leGFjdGx5KGNvbm5lY3Rpb24pXG4gICAgICApO1xuICAgICAgdGhpcy5jb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXS5kZXRhY2goKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdO1xuICAgICAgLy8gSWYgdGhpcyB3YXMgdGhlIGxhc3QgY29ubmVjdGlvbiwgcGF1c2UgdGhlIHNlc3Npb25cbiAgICAgIC8vIGFuZCBzdGFydCB0aGUgZXhwaXJlIGNvdW50ZG93blxuICAgICAgaWYoT2JqZWN0LmtleXModGhpcy5jb25uZWN0aW9ucykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICB1cGRhdGUoeyBwYXRoLCBkaWZmLCBoYXNoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCd1cGRhdGUnKSh7IHBhdGgsIGRpZmYsIGhhc2ggfSk7XG4gICAgfVxuXG4gICAgc3Vic2NyaWJlVG8ocGF0aCkge1xuICAgICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdLnNob3VsZC5ub3QuYmUub2tcbiAgICAgICk7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0gPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnN1YnNjcmliZVRvKHBhdGgsIHRoaXMpO1xuICAgIH1cblxuICAgIHVuc3Vic2NyaWJlRnJvbShwYXRoKSB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0uc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgZGVsZXRlIHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXTtcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay51bnN1YnNjcmliZUZyb20ocGF0aCwgdGhpcyk7XG4gICAgfVxuXG4gICAgZW1pdCh7IHJvb20sIHBhcmFtcyB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm94eSgnZW1pdCcpKHsgcm9vbSwgcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIGxpc3RlblRvKHJvb20pIHtcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dLnNob3VsZC5ub3QuYmUub2tcbiAgICAgICk7XG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXSA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsubGlzdGVuVG8ocm9vbSwgdGhpcyk7XG4gICAgfVxuXG4gICAgdW5saXN0ZW5Gcm9tKHJvb20pIHtcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay51bmxpc3RlbkZyb20ocm9vbSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZGVidWcoLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2RlYnVnJykoLi4uYXJncyk7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdsb2cnKSguLi5hcmdzKTtcbiAgICB9XG5cbiAgICB3YXJuKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCd3YXJuJykoLi4uYXJncyk7XG4gICAgfVxuXG4gICAgZXJyKC4uLmFyZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdlcnInKSguLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBfLmV4dGVuZChTZXNzaW9uLnByb3RvdHlwZSwge1xuICAgIGd1aWQ6IG51bGwsXG4gICAgdXBsaW5rOiBudWxsLFxuICAgIGNvbm5lY3Rpb25zOiBudWxsLFxuICAgIHRpbWVvdXQ6IG51bGwsXG4gICAgZXhwaXJlZDogbnVsbCxcbiAgICBzdWJzY3JpcHRpb25zOiBudWxsLFxuICAgIGxpc3RlbmVyczogbnVsbCxcbiAgfSk7XG5cbiAgcmV0dXJuIFNlc3Npb247XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9