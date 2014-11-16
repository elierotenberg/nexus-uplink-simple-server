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


        // Just proxy the invocation to all attached connections, which implement the same APIs.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIlNlc3Npb24uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBQSxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDekIsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2xDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsZ0JBQTZDO01BQWxDLFVBQVUsUUFBVixVQUFVO01BQUUsa0JBQWtCLFFBQWxCLGtCQUFrQjtBQUN4RCxNQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7O0FBRWpDLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQzs7TUFFdkIsT0FBTztRQUFQLE9BQU8sR0FDQSxTQURQLE9BQU8sUUFDbUI7VUFBaEIsSUFBSSxTQUFKLElBQUk7VUFBRSxNQUFNLFNBQU4sTUFBTTtBQUN4QixPQUFDLENBQUMsR0FBRyxDQUFDO2VBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQztPQUFBLENBQ25ELENBQUM7QUFDRixPQUFDLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsTUFBTSxFQUFOLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDakMsVUFBSSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7O0FBRXRCLFVBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRSxDQUFDO0FBQ3hCLFVBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDOztBQUVwQixVQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztBQUNwQixVQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztBQUNyQixVQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7S0FDZDs7Z0JBZEcsT0FBTztBQWdCWCxhQUFPOztlQUFBLFlBQUc7O0FBQ1IsY0FBRyxJQUFJLENBQUMsT0FBTyxLQUFLLElBQUksRUFBRTtBQUN4Qix3QkFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztXQUM1QjtBQUNELGdCQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxFQUFFO21CQUFLLE1BQUssTUFBTSxDQUFDLE1BQUssV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1dBQUEsQ0FBQyxDQUFDO0FBQ2pGLGdCQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxJQUFJO21CQUFLLE1BQUssZUFBZSxDQUFDLElBQUksQ0FBQztXQUFBLENBQUMsQ0FBQztBQUM5RSxnQkFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBSTttQkFBSyxNQUFLLFlBQVksQ0FBQyxJQUFJLENBQUM7V0FBQSxDQUFDLENBQUM7U0FDeEU7O0FBRUcsWUFBTTthQUFBLFlBQUc7QUFDWCxpQkFBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLENBQUM7U0FDaEM7O0FBR0QsV0FBSzs7Ozs7ZUFBQSxVQUFDLE1BQU0sRUFBRTs7O0FBQ1osaUJBQU8sWUFBTTtBQUFFLGdCQUFJLElBQUksYUFBWSxDQUFDLEFBQUMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQUssV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUMsRUFBRTtxQkFBSyxPQUFLLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLE9BQUMsQ0FBNUIsT0FBSyxXQUFXLENBQUMsRUFBRSxDQUFDLGFBQVksSUFBSSxFQUFDO2FBQUEsQ0FBQyxDQUFDO1dBQUUsQ0FBQztTQUNqSTs7QUFFRCxZQUFNOztlQUFBLFVBQUMsVUFBVSxFQUFFOztBQUNqQixXQUFDLENBQUMsR0FBRyxDQUFDO21CQUFNLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQ3hELE9BQUssV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1dBQUEsQ0FDakQsQ0FBQztBQUNGLGNBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQzs7O0FBRzdDLGNBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNkLGdCQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7V0FDaEI7QUFDRCxpQkFBTyxJQUFJLENBQUM7U0FDYjs7QUFFRCxZQUFNOztlQUFBLFlBQUc7QUFDUCxjQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztBQUNwQixpQkFBTyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN4Qzs7QUFFRCxXQUFLOztlQUFBLFlBQUc7O0FBQ04sV0FBQyxDQUFDLEdBQUcsQ0FBQzttQkFBTSxPQUFLLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1dBQUEsQ0FBQyxDQUFDO0FBQzFDLGNBQUksQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDO21CQUFNLE9BQUssTUFBTSxFQUFFO1dBQUEsRUFBRSxjQUFjLENBQUMsQ0FBQztBQUMvRCxpQkFBTyxJQUFJLENBQUM7U0FDYjs7QUFHRCxZQUFNOztlQUFBLFlBQUc7O0FBQ1AsV0FBQyxDQUFDLEdBQUcsQ0FBQzttQkFBTSxPQUFLLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7V0FBQSxDQUFDLENBQUM7O0FBRXRDLHNCQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzNCLGNBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQ3BCLGlCQUFPLElBQUksQ0FBQztTQUNiOztBQUVELFlBQU07O2VBQUEsVUFBQyxVQUFVLEVBQUU7O0FBQ2pCLFdBQUMsQ0FBQyxHQUFHLENBQUM7bUJBQU0sVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFDeEQsT0FBSyxXQUFXLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztXQUFBLENBQzlELENBQUM7QUFDRixjQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN6QyxpQkFBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQzs7O0FBR3ZDLGNBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUM3QyxnQkFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1dBQ2Q7QUFDRCxpQkFBTyxJQUFJLENBQUM7U0FDYjs7QUFDRCxZQUFNOztlQUFBLGlCQUF1QjtjQUFwQixJQUFJLFNBQUosSUFBSTtjQUFFLElBQUksU0FBSixJQUFJO2NBQUUsSUFBSSxTQUFKLElBQUk7QUFDdkIsaUJBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBSixJQUFJLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxJQUFJLEVBQUosSUFBSSxFQUFFLENBQUMsQ0FBQztTQUNuRDs7QUFFRCxpQkFBVzs7ZUFBQSxVQUFDLElBQUksRUFBRTs7QUFDaEIsV0FBQyxDQUFDLEdBQUcsQ0FBQzttQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUNqQyxPQUFLLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1dBQUEsQ0FDMUMsQ0FBQztBQUNGLGNBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQ2hDLGlCQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUM1Qzs7QUFFRCxxQkFBZTs7ZUFBQSxVQUFDLElBQUksRUFBRTs7QUFDcEIsV0FBQyxDQUFDLEdBQUcsQ0FBQzttQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUNqQyxPQUFLLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7V0FBQSxDQUN0QyxDQUFDO0FBQ0YsaUJBQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxpQkFBTyxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDaEQ7O0FBRUQsVUFBSTs7ZUFBQSxpQkFBbUI7Y0FBaEIsSUFBSSxTQUFKLElBQUk7Y0FBRSxNQUFNLFNBQU4sTUFBTTtBQUNqQixpQkFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFKLElBQUksRUFBRSxNQUFNLEVBQU4sTUFBTSxFQUFFLENBQUMsQ0FBQztTQUM3Qzs7QUFFRCxjQUFROztlQUFBLFVBQUMsSUFBSSxFQUFFOztBQUNiLFdBQUMsQ0FBQyxHQUFHLENBQUM7bUJBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsT0FBSyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtXQUFBLENBQ3RDLENBQUM7QUFDRixjQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQztBQUM1QixpQkFBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDekM7O0FBRUQsa0JBQVk7O2VBQUEsVUFBQyxJQUFJLEVBQUU7O0FBQ2pCLFdBQUMsQ0FBQyxHQUFHLENBQUM7bUJBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sSUFDakMsUUFBSyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1dBQUEsQ0FDbEMsQ0FBQztBQUNGLGlCQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDNUIsaUJBQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQzdDOztBQUVELFdBQUs7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1gsaUJBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsd0JBQUksSUFBSSxFQUFDLENBQUM7U0FDckM7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxpQkFBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyx3QkFBSSxJQUFJLEVBQUMsQ0FBQztTQUNuQzs7QUFFRCxVQUFJOztlQUFBLFlBQVU7Y0FBTixJQUFJOztBQUNWLGlCQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLHdCQUFJLElBQUksRUFBQyxDQUFDO1NBQ3BDOztBQUVELFNBQUc7O2VBQUEsWUFBVTtjQUFOLElBQUk7O0FBQ1QsaUJBQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsd0JBQUksSUFBSSxFQUFDLENBQUM7U0FDbkM7Ozs7V0F0SUcsT0FBTzs7O0FBeUliLEdBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRTtBQUMxQixRQUFJLEVBQUUsSUFBSTtBQUNWLFVBQU0sRUFBRSxJQUFJO0FBQ1osZUFBVyxFQUFFLElBQUk7QUFDakIsV0FBTyxFQUFFLElBQUk7QUFDYixXQUFPLEVBQUUsSUFBSTtBQUNiLGlCQUFhLEVBQUUsSUFBSTtBQUNuQixhQUFTLEVBQUUsSUFBSSxFQUNoQixDQUFDLENBQUM7O0FBRUgsU0FBTyxPQUFPLENBQUM7Q0FDaEIsQ0FBQyIsImZpbGUiOiJTZXNzaW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih7IENvbm5lY3Rpb24sIFVwbGlua1NpbXBsZVNlcnZlciB9KSB7XG4gIGNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuXG4gIGNvbnN0IEVYUElSRV9USU1FT1VUID0gMzAwMDA7XG5cbiAgY2xhc3MgU2Vzc2lvbiB7XG4gICAgY29uc3RydWN0b3IoeyBndWlkLCB1cGxpbmsgfSkge1xuICAgICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdXBsaW5rLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFVwbGlua1NpbXBsZVNlcnZlcilcbiAgICAgICk7XG4gICAgICBfLmV4dGVuZCh0aGlzLCB7IGd1aWQsIHVwbGluayB9KTtcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fTtcblxuICAgICAgdGhpcy5zdWJzY3JpcHRpb25zID0ge307XG4gICAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuXG4gICAgICB0aGlzLnRpbWVvdXQgPSBudWxsO1xuICAgICAgdGhpcy5leHBpcmVkID0gZmFsc2U7XG4gICAgICB0aGlzLnBhdXNlKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgIGlmKHRoaXMudGltZW91dCAhPT0gbnVsbCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lb3V0KTtcbiAgICAgIH1cbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuY29ubmVjdGlvbnMpLmZvckVhY2goKGlkKSA9PiB0aGlzLmRldGFjaCh0aGlzLmNvbm5lY3Rpb25zW2lkXSkpO1xuICAgICAgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChwYXRoKSA9PiB0aGlzLnVuc3Vic2NyaWJlRnJvbShwYXRoKSk7XG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVycykuZm9yRWFjaCgocm9vbSkgPT4gdGhpcy51bmxpc3RlbkZyb20ocm9vbSkpO1xuICAgIH1cblxuICAgIGdldCBwYXVzZWQoKSB7XG4gICAgICByZXR1cm4gKHRoaXMudGltZW91dCAhPT0gbnVsbCk7XG4gICAgfVxuXG4gICAgLy8gSnVzdCBwcm94eSB0aGUgaW52b2NhdGlvbiB0byBhbGwgYXR0YWNoZWQgY29ubmVjdGlvbnMsIHdoaWNoIGltcGxlbWVudCB0aGUgc2FtZSBBUElzLlxuICAgIHByb3h5KG1ldGhvZCkge1xuICAgICAgcmV0dXJuICgpID0+IHsgbGV0IGFyZ3MgPSBhcmd1bWVudHM7IHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmNvbm5lY3Rpb25zKS5tYXAoKGlkKSA9PiB0aGlzLmNvbm5lY3Rpb25zW2lkXVttZXRob2RdKC4uLmFyZ3MpKTsgfTtcbiAgICB9XG5cbiAgICBhdHRhY2goY29ubmVjdGlvbikge1xuICAgICAgXy5kZXYoKCkgPT4gY29ubmVjdGlvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihDb25uZWN0aW9uKSAmJlxuICAgICAgICB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdLnNob3VsZC5ub3QuYmUub2tcbiAgICAgICk7XG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdID0gY29ubmVjdGlvbjtcbiAgICAgIC8vIElmIHRoZSBzZXNzaW9uIHdhcyBwYXVzZWQgKG5vIGNvbm5lYyBhdHRhY2hlZClcbiAgICAgIC8vIHRoZW4gcmVzdW1lIGl0XG4gICAgICBpZih0aGlzLnBhdXNlZCkge1xuICAgICAgICB0aGlzLnJlc3Vtc2UoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGV4cGlyZSgpIHtcbiAgICAgIHRoaXMuZXhwaXJlZCA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsuZGVsZXRlU2Vzc2lvbih0aGlzKTtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMucGF1c2VkLnNob3VsZC5ub3QuYmUub2spO1xuICAgICAgdGhpcy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLmV4cGlyZSgpLCBFWFBJUkVfVElNRU9VVCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cblxuICAgIHJlc3VtZSgpIHtcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMucGF1c2VkLnNob3VsZC5iZS5vayk7XG4gICAgICAvLyBQcmV2ZW50IHRoZSBleHBpcmF0aW9uIHRpbWVvdXRcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpO1xuICAgICAgdGhpcy50aW1lb3V0ID0gbnVsbDtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGRldGFjaChjb25uZWN0aW9uKSB7XG4gICAgICBfLmRldigoKSA9PiBjb25uZWN0aW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKENvbm5lY3Rpb24pICYmXG4gICAgICAgIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF0uc2hvdWxkLmJlLmV4YWN0bHkoY29ubmVjdGlvbilcbiAgICAgICk7XG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdLmRldGFjaCgpO1xuICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbY29ubmVjdGlvbi5pZF07XG4gICAgICAvLyBJZiB0aGlzIHdhcyB0aGUgbGFzdCBjb25uZWN0aW9uLCBwYXVzZSB0aGUgc2Vzc2lvblxuICAgICAgLy8gYW5kIHN0YXJ0IHRoZSBleHBpcmUgY291bnRkb3duXG4gICAgICBpZihPYmplY3Qua2V5cyh0aGlzLmNvbm5lY3Rpb25zKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ3VwZGF0ZScpKHsgcGF0aCwgZGlmZiwgaGFzaCB9KTtcbiAgICB9XG5cbiAgICBzdWJzY3JpYmVUbyhwYXRoKSB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvbnNbcGF0aF0uc2hvdWxkLm5vdC5iZS5va1xuICAgICAgKTtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXSA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcy51cGxpbmsuc3Vic2NyaWJlVG8ocGF0aCwgdGhpcyk7XG4gICAgfVxuXG4gICAgdW5zdWJzY3JpYmVGcm9tKHBhdGgpIHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uc1twYXRoXS5zaG91bGQuYmUub2tcbiAgICAgICk7XG4gICAgICBkZWxldGUgdGhpcy5zdWJzY3JpcHRpb25zW3BhdGhdO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnVuc3Vic2NyaWJlRnJvbShwYXRoLCB0aGlzKTtcbiAgICB9XG5cbiAgICBlbWl0KHsgcm9vbSwgcGFyYW1zIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5KCdlbWl0JykoeyByb29tLCBwYXJhbXMgfSk7XG4gICAgfVxuXG4gICAgbGlzdGVuVG8ocm9vbSkge1xuICAgICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0uc2hvdWxkLm5vdC5iZS5va1xuICAgICAgKTtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dID0gdHJ1ZTtcbiAgICAgIHJldHVybiB0aGlzLnVwbGluay5saXN0ZW5Ubyhyb29tLCB0aGlzKTtcbiAgICB9XG5cbiAgICB1bmxpc3RlbkZyb20ocm9vbSkge1xuICAgICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0uc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dO1xuICAgICAgcmV0dXJuIHRoaXMudXBsaW5rLnVubGlzdGVuRnJvbShyb29tLCB0aGlzKTtcbiAgICB9XG5cbiAgICBkZWJ1ZyguLi5hcmdzKSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm94eSgnZGVidWcnKSguLi5hcmdzKTtcbiAgICB9XG5cbiAgICBsb2coLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2xvZycpKC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ3dhcm4nKSguLi5hcmdzKTtcbiAgICB9XG5cbiAgICBlcnIoLi4uYXJncykge1xuICAgICAgcmV0dXJuIHRoaXMucHJveHkoJ2VycicpKC4uLmFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIF8uZXh0ZW5kKFNlc3Npb24ucHJvdG90eXBlLCB7XG4gICAgZ3VpZDogbnVsbCxcbiAgICB1cGxpbms6IG51bGwsXG4gICAgY29ubmVjdGlvbnM6IG51bGwsXG4gICAgdGltZW91dDogbnVsbCxcbiAgICBleHBpcmVkOiBudWxsLFxuICAgIHN1YnNjcmlwdGlvbnM6IG51bGwsXG4gICAgbGlzdGVuZXJzOiBudWxsLFxuICB9KTtcblxuICByZXR1cm4gU2Vzc2lvbjtcbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=