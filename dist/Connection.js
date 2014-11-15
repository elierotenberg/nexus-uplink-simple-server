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
        (function () {
          return _this.handshake.isPending().should.not.be.ok && guid.should.be.a.String && _this.uplink.hasSession(guid).should.be.ok;
        })();
        _this.uplink.getSession(guid).attach(_this);
        _this._handshake.resolve(guid);
        return _this.handshakeAck(_this.uplink.pid);
      });
    },

    // subscriptions and listeners are stateless from the connections' point of view.
    // its the responsibility of the underlying connection to handle and maintain state.

    subscribeTo: function (_ref3) {
      var _this2 = this;
      var path = _ref3.path;
      return this.handshake.then(function (guid) {
        return _this2.uplink.getSession(guid).subscribeTo(path);
      });
    },

    unsubscribeFrom: function (_ref4) {
      var _this3 = this;
      var path = _ref4.path;
      return this.handshake.then(function (guid) {
        return _this3.uplink.getSession(guid).unsubscribeFrom(path);
      });
    },

    listenTo: function (_ref5) {
      var _this4 = this;
      var room = _ref5.room;
      return this.handshake.then(function (guid) {
        return _this4.uplink.getSession(guid).listenTo(room);
      });
    },

    unlistenFrom: function (_ref6) {
      var _this5 = this;
      var room = _ref6.room;
      return this.handshake.then(function (guid) {
        return _this5.uplink.getSession(guid).unlistenFrom(room);
      });
    } };

  var Connection = (function () {
    var Connection = function Connection(_ref7) {
      var _this6 = this;
      var socket = _ref7.socket;
      var uplink = _ref7.uplink;
      _.dev(function () {
        return instanceOfSocketIO(socket).should.be.ok && uplink.should.be.an.instanceOf(UplinkSimpleServer);
      });
      this.socket = socket;
      this.handshake = new Promise(function (resolve, reject) {
        return _this6._handshake = resolve;
      }).cancellable();
      Object.keys(ioHandlers).forEach(function (event) {
        return socket.on(event, function () {
          var args = _slice.call(arguments);

          return ioHandlers[event].call.apply(ioHandlers[event], [_this6].concat(Array.from(args))).catch(function (err) {
            return _this6.err({ err: err.toString, event: event, args: args });
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
          var _this7 = this;
          if (this.handshake.isPending()) {
            this.handshake.cancel();
          } else {
            this.handshake.then(function (guid) {
              return _this7.uplink.getSession(guid).detach(_this7);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9Db25uZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3pCLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLGdCQUFpQztNQUF0QixrQkFBa0IsUUFBbEIsa0JBQWtCO0FBQzVDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNqQyxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDO0FBQ3hCLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7O0FBRTNELE1BQU0sVUFBVSxHQUFHO0FBQ2pCLGFBQVMsRUFBQSxpQkFBVzs7VUFBUixJQUFJLFNBQUosSUFBSTtBQUNkLGFBQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFNO0FBQ3ZCLFNBQUM7aUJBQU0sTUFBSyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUNoRCxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUN2QixNQUFLLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFO1NBQUEsQ0FDMUMsRUFBRSxDQUFDO0FBQ0osY0FBSyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sT0FBTSxDQUFDO0FBQzFDLGNBQUssVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixlQUFPLE1BQUssWUFBWSxDQUFDLE1BQUssTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO09BQzNDLENBQUMsQ0FBQztLQUNKOzs7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O2NBQU4sSUFBSTs7QUFDVixjQUFJLENBQUMsTUFBTSxDQUFDLElBQUksTUFBQSxDQUFoQixJQUFJLENBQUMsTUFBTSxHQUFNLE1BQU0sb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDbkM7O0FBRUQsU0FBRzs7ZUFBQSxZQUFVO2NBQU4sSUFBSTs7QUFDVCxjQUFJLENBQUMsTUFBTSxDQUFDLElBQUksTUFBQSxDQUFoQixJQUFJLENBQUMsTUFBTSxHQUFNLEtBQUssb0JBQUssSUFBSSxHQUFDLENBQUM7U0FDbEM7Ozs7V0E3REcsVUFBVTs7O0FBZ0VoQixHQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUU7QUFDN0IsVUFBTSxFQUFFLElBQUk7QUFDWixhQUFTLEVBQUUsSUFBSTtBQUNmLGNBQVUsRUFBRSxJQUFJLEVBQ2pCLENBQUMsQ0FBQzs7QUFFSCxTQUFPLFVBQVUsQ0FBQztDQUNuQixDQUFDIiwiZmlsZSI6IkNvbm5lY3Rpb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHsgVXBsaW5rU2ltcGxlU2VydmVyIH0pIHtcbiAgY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG4gIGNvbnN0IHNob3VsZCA9IF8uc2hvdWxkO1xuICBjb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xuXG4gIGNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gICAgaGFuZHNoYWtlKHsgZ3VpZCB9KSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS50cnkoKCkgPT4ge1xuICAgICAgICAoKCkgPT4gdGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkuc2hvdWxkLm5vdC5iZS5vayAmJlxuICAgICAgICAgIGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgICAgdGhpcy51cGxpbmsuaGFzU2Vzc2lvbihndWlkKS5zaG91bGQuYmUub2tcbiAgICAgICAgKSgpO1xuICAgICAgICB0aGlzLnVwbGluay5nZXRTZXNzaW9uKGd1aWQpLmF0dGFjaCh0aGlzKTtcbiAgICAgICAgdGhpcy5faGFuZHNoYWtlLnJlc29sdmUoZ3VpZCk7XG4gICAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZUFjayh0aGlzLnVwbGluay5waWQpO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8vIHN1YnNjcmlwdGlvbnMgYW5kIGxpc3RlbmVycyBhcmUgc3RhdGVsZXNzIGZyb20gdGhlIGNvbm5lY3Rpb25zJyBwb2ludCBvZiB2aWV3LlxuICAgIC8vIGl0cyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbiB0byBoYW5kbGUgYW5kIG1haW50YWluIHN0YXRlLlxuXG4gICAgc3Vic2NyaWJlVG8oeyBwYXRoIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZS50aGVuKChndWlkKSA9PiB0aGlzLnVwbGluay5nZXRTZXNzaW9uKGd1aWQpLnN1YnNjcmliZVRvKHBhdGgpKTtcbiAgICB9LFxuXG4gICAgdW5zdWJzY3JpYmVGcm9tKHsgcGF0aCB9KSB7XG4gICAgICByZXR1cm4gdGhpcy5oYW5kc2hha2UudGhlbigoZ3VpZCkgPT4gdGhpcy51cGxpbmsuZ2V0U2Vzc2lvbihndWlkKS51bnN1YnNjcmliZUZyb20ocGF0aCkpO1xuICAgIH0sXG5cbiAgICBsaXN0ZW5Ubyh7IHJvb20gfSkge1xuICAgICAgcmV0dXJuIHRoaXMuaGFuZHNoYWtlLnRoZW4oKGd1aWQpID0+IHRoaXMudXBsaW5rLmdldFNlc3Npb24oZ3VpZCkubGlzdGVuVG8ocm9vbSkpO1xuICAgIH0sXG5cbiAgICB1bmxpc3RlbkZyb20oeyByb29tIH0pIHtcbiAgICAgIHJldHVybiB0aGlzLmhhbmRzaGFrZS50aGVuKChndWlkKSA9PiB0aGlzLnVwbGluay5nZXRTZXNzaW9uKGd1aWQpLnVubGlzdGVuRnJvbShyb29tKSk7XG4gICAgfSxcbiAgfTtcblxuICBjbGFzcyBDb25uZWN0aW9uIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNvY2tldCwgdXBsaW5rIH0pIHtcbiAgICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgICB1cGxpbmsuc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoVXBsaW5rU2ltcGxlU2VydmVyKVxuICAgICAgKTtcbiAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgdGhpcy5oYW5kc2hha2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB0aGlzLl9oYW5kc2hha2UgPSByZXNvbHZlKS5jYW5jZWxsYWJsZSgpO1xuICAgICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAgIC5mb3JFYWNoKChldmVudCkgPT5cbiAgICAgICAgc29ja2V0Lm9uKGV2ZW50LCAoLi4uYXJncykgPT5cbiAgICAgICAgICBpb0hhbmRsZXJzW2V2ZW50XS5jYWxsKHRoaXMsIC4uLmFyZ3MpXG4gICAgICAgICAgLmNhdGNoKChlcnIpID0+IHRoaXMuZXJyKHsgZXJyOiBlcnIudG9TdHJpbmcsIGV2ZW50LCBhcmdzIH0pKVxuICAgICAgICApXG4gICAgICApO1xuICAgIH1cblxuICAgIGdldCBpZCgpIHtcbiAgICAgIHJldHVybiB0aGlzLnNvY2tldC5pZDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgaWYodGhpcy5oYW5kc2hha2UuaXNQZW5kaW5nKCkpIHtcbiAgICAgICAgdGhpcy5oYW5kc2hha2UuY2FuY2VsKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5oYW5kc2hha2UudGhlbigoZ3VpZCkgPT4gdGhpcy51cGxpbmsuZ2V0U2Vzc2lvbihndWlkKS5kZXRhY2godGhpcykpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb2NrZXQuY2xvc2UoKTtcbiAgICB9XG5cbiAgICBkZXRhY2goKSB7XG4gICAgICAvLyBJbXByb3ZlbWVudCBvcHBvcnR1bml0eTogYWxsb3cgY2xpZW50IHRvIHJlLWhhbmRzaGFrZS5cbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGhhbmRzaGFrZUFjayhwaWQpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2hhbmRzaGFrZUFjaycsIHsgcGlkIH0pO1xuICAgIH1cblxuICAgIHVwZGF0ZSh7IHBhdGgsIGRpZmYsIGhhc2ggfSkge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgndXBkYXRlJywgeyBwYXRoLCBkaWZmLCBoYXNoIH0pO1xuICAgIH1cblxuICAgIGVtaXQoeyByb29tLCBwYXJhbXMgfSkge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnZW1pdCcsIHsgcm9vbSwgcGFyYW1zIH0pO1xuICAgIH1cblxuICAgIGRlYnVnKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2RlYnVnJywgLi4uYXJncyk7XG4gICAgfVxuXG4gICAgbG9nKC4uLmFyZ3MpIHtcbiAgICAgIHRoaXMuc29ja2V0LmVtaXQoJ2xvZycsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIHdhcm4oLi4uYXJncykge1xuICAgICAgdGhpcy5zb2NrZXQuZW1pdCgnd2FybicsIC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIGVyciguLi5hcmdzKSB7XG4gICAgICB0aGlzLnNvY2tldC5lbWl0KCdlcnInLCAuLi5hcmdzKTtcbiAgICB9XG4gIH1cblxuICBfLmV4dGVuZChDb25uZWN0aW9uLnByb3RvdHlwZSwge1xuICAgIHNvY2tldDogbnVsbCxcbiAgICBoYW5kc2hha2U6IG51bGwsXG4gICAgX2hhbmRzaGFrZTogbnVsbCxcbiAgfSk7XG5cbiAgcmV0dXJuIENvbm5lY3Rpb247XG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9