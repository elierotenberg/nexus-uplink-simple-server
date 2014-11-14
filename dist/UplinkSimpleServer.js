"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
var _ = require("lodash-next");
var bodyParser = require("body-parser");
var ConstantRouter = require("nexus-router").ConstantRouter;
var HTTPExceptions = require("http-exceptions");

var Connection = require("./Connection");
var Session = require("./Session");

var UplinkSimpleServer = (function () {
  var UplinkSimpleServer = function UplinkSimpleServer(_ref) {
    var pid = _ref.pid;
    var stores = _ref.stores;
    var rooms = _ref.rooms;
    var actions = _ref.actions;
    _.dev(function () {
      return stores.should.be.an.Array && rooms.should.be.an.Array && actions.should.be.an.Array;
    });
    // Here we use ConstantRouter instances; we only need
    // to know if a given string match a registered pattern.
    this.stores = new ConstantRouter(stores);
    this.rooms = new ConstantRouter(rooms);
    this.actions = new ConstantRouter(actions);

    // Store data cache
    this._data = {};

    this.subscribers = {};
    this.listeners = {};
    this.actionHandlers = {};
  };

  _classProps(UplinkSimpleServer, null, {
    attach: {
      writable: true,
      value: function (app) {
        var _this = this;
        var _arguments = arguments;
        _.dev(function () {
          return app.should.be.an.Object &&
          // Ducktype-check for an express-like app
          app.get.should.be.a.Function && app.post.should.be.a.Function;
        });
        var io = require("socket.io")(app);
        Object.keys(ioHandlers).forEach(function (event) {
          return io.on(event, function () {
            return ioHandlers[event].apply(_this, _arguments);
          });
        });

        app.get(function (req, res, next) {
          return httpHandlers.get.call(_this, req, res, next);
        });
        app.post(function (req, res, next) {
          return httpHandlers.post.call(_this, req, res, next);
        });
        return this;
      }
    },
    pull: {
      writable: true,
      value: function (path) {
        var _this2 = this;
        return Promise.try(function () {
          if (_this2.stores.match(path) === null) {
            throw new HTTPExceptions.NotFound(path);
          }
          return _this2._data[path];
        });
      }
    },
    update: {
      writable: true,
      value: function (path, value) {
        return _.copromise(regeneratorRuntime.mark(function callee$2$0() {
          var _this3;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {
              case 0: _this3 = this;
                _.dev(function () {
                  return path.should.be.a.String && value.should.be.an.Object && (_this3.stores.match(path) !== null).should.be.ok;
                });
                if (this.subscribers[path]) {
                  (function () {
                    // Diff and JSON-encode as early as possible to avoid duplicating
                    // these lengthy calculations down the propagation tree.
                    var hash, diff;
                    if (!_this3._data[path]) {
                      hash = null;
                    } else {
                      hash = _.hash(_this3._data[path]);
                      diff = _.diff(_this3._data[path], value);
                    }
                    yield Object.keys(_this3.subscribers[path])
                    // Directly pass the patch, sessions don't need to be aware
                    // of the actual contents; they only need to forward the diff
                    // to their associated clients.
                    .map(function (session) {
                      return session.update(path, { hash: hash, diff: diff });
                    });
                  })();
                }
              case 3:
              case "end": return context$3$0.stop();
            }
          }, callee$2$0, this);
        }), this);
      }
    },
    subscribeTo: {
      writable: true,
      value: function (path, session) {
        var _this4 = this;
        _.dev(function () {
          return path.should.be.a.String && session.should.be.an.instanceOf(Session);
        });
        var createdPath;
        if (this.subscribers[path]) {
          // Fail early to avoid creating leaky entry in this.subscribers
          _.dev(function () {
            return _this4.subscribers[path][session.id].should.not.be.ok;
          });
          createdPath = false;
        } else {
          this.subscribers[path] = {};
          createdPath = true;
        }
        this.subscribers[path][session.id] = session;
        // Return a flag indicating whether this is the first subscription
        // to this path; can be useful to implement subclass-specific handling
        // (eg. subscribe to an external backend)
        return { createdPath: createdPath };
      }
    },
    unsubscribeFrom: {
      writable: true,
      value: function (path, session) {
        var _this5 = this;
        _.dev(function () {
          return path.should.be.a.String && session.should.be.an.instanceOf(Session) && _this5.subscribers[path].should.be.an.Object && _this5.subscribers[path][session.id].should.be.exactly(session);
        });
        var deletedPath = false;
        delete this.subscribers[path][session.id];
        if (Object.keys(this.subscribers[path]).length === 0) {
          delete this.subscribers[path];
          deletedPath = true;
        }
        // Return a flag indicating whether this was the last subscription
        // to this path; can be useful to implement subclass-specific handling
        // (eg. unsbuscribe from an external backend)
        return { deletedPath: deletedPath };
      }
    },
    emit: {
      writable: true,
      value: function (room, params) {
        return _.copromise(regeneratorRuntime.mark(function callee$2$0() {
          var _this6;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {
              case 0: _this6 = this;
                _.dev(function () {
                  return room.should.be.a.String && params.should.be.an.Object && (_this6.rooms.match(room) !== null).should.be.ok;
                });
                if (this.listeners[path]) {
                  (function () {
                    // Encode as early as possible to avoid duplicating
                    // this operation down the propagation tree.
                    var json = JSON.stringify(params);
                    yield Object.keys(_this6.listeners[path]).map(function (session) {
                      return session.emit(room, json);
                    });
                  })();
                }
              case 3:
              case "end": return context$3$0.stop();
            }
          }, callee$2$0, this);
        }), this);
      }
    },
    listenTo: {
      writable: true,
      value: function (room, session) {
        var _this7 = this;
        _.dev(function () {
          return room.should.be.a.String && session.should.be.an.instanceOf(Session);
        });
        var createdRoom;
        if (this.listeners[path]) {
          // Fail early to avoid creating a leaky entry in this.listeners
          _.dev(function () {
            return _this7.listeners[path][session.id].should.not.be.ok;
          });
          createdRoom = false;
        } else {
          this.listeners[path] = {};
          createdRoom = true;
        }
        this.listeners[path][session.id] = session;
        // Return a flag indicating whether this is the first listener
        // to this room; can be useful to implement subclass-specific handling
        // (e.g. subscribe to an external backend)
        return { createdRoom: createdRoom };
      }
    },
    unlistenTo: {
      writable: true,
      value: function (room, session) {
        var _this8 = this;
        _.dev(function () {
          return room.should.be.a.String && session.should.be.an.instanceOf(Session) && _this8.listeners[room][session.id].should.be.exactly(session);
        });
        var deletedRoom = false;
        delete this.listeners[room][session.id];
        if (Object.keys(this.listeners[room]).length === 0) {
          delete this.listeners[path];
          deletedRoom = true;
        }
        // Return a flag indicating whether this was the last listener
        // to this room; can be useful to implement subclass-specific handling
        // (e.g. unsuscribe from an external backend)
        return { deletedRoom: deletedRoom };
      }
    },
    addActionHandler: {
      writable: true,
      value: function (action, handler) {
        var _this9 = this;
        _.dev(function () {
          return action.should.be.a.String && handler.should.be.a.Function && (_this9.actions.match(action) !== null).should.be.ok;
        });
        var createdAction = false;
        if (!this.actions[path]) {
          this.actions[path] = [];
          createdAction = true;
        }
        this.actions[path].push(handler);
        return { createdAction: createdAction };
      }
    },
    removeActionHandler: {
      writable: true,
      value: function (action, handler) {
        var _this10 = this;
        _.dev(function () {
          return action.should.be.a.String && handler.should.be.a.Function && _this10.actions[action].should.be.an.Array && _.contains(_this10.actions[action], handler).should.be.ok;
        });
        // Loop through the list of handlers here;
        // We don't expect to have _that_ much different handlers
        // for a given action.
        this.actions[path] = _.without(this.actions[path], handler);
        var deletedAction = false;
        if (this.actions[path].length === 0) {
          delete this.actions[path];
          deletedAction = true;
        }
        return { deletedAction: deletedAction };
      }
    },
    dispatch: {
      writable: true,
      value: function (action, params) {
        if (params === undefined) params = {};
        return _.copromise(regeneratorRuntime.mark(function callee$2$0() {
          var _this11;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {
              case 0: _this11 = this;
                _.dev(function () {
                  return action.should.be.a.String && params.should.be.an.Object && (_this11.actions[action].match(action) !== null).should.be.ok;
                });
                context$3$0.next = 4;
                return (this.actionHandlers[action] ? this.actionHandlers[action] : []).map(function (handler) {
                  return handler.call(null, params);
                });
              case 4: return context$3$0.abrupt("return", context$3$0.sent);
              case 5:
              case "end": return context$3$0.stop();
            }
          }, callee$2$0, this);
        }), this);
      }
    }
  });

  return UplinkSimpleServer;
})();

_.extend(UplinkSimpleServer.prototype, {
  stores: null,
  rooms: null,
  actions: null,
  _data: null,
  subscribers: null,
  listeners: null,
  actionHandlers: null });

module.exports = UplinkSimpleServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9VcGxpbmtTaW1wbGVTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLElBQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxJQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsY0FBYyxDQUFDO0FBQzlELElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDOztBQUVsRCxJQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDM0MsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDOztJQU8vQixrQkFBa0I7TUFBbEIsa0JBQWtCLEdBSVgsU0FKUCxrQkFBa0IsT0FJdUI7UUFBL0IsR0FBRyxRQUFILEdBQUc7UUFBRSxNQUFNLFFBQU4sTUFBTTtRQUFFLEtBQUssUUFBTCxLQUFLO1FBQUUsT0FBTyxRQUFQLE9BQU87QUFDdkMsS0FBQyxDQUFDLEdBQUcsQ0FBQzthQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLElBQ25DLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLElBQ3hCLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLO0tBQUEsQ0FDM0IsQ0FBQzs7O0FBR0YsUUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN6QyxRQUFJLENBQUMsS0FB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QUFJLENBQUMsQ0FBQztPQUNWOzs7O1NBak5HLGtCQUFrQjs7O0FBb054QixDQUFDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRTtBQUNyQyxRQUFNLEVBQUUsSUFBSTtBQUNaLE9BQUssRUFBRSxJQUFJO0FBQ1gsU0FBTyxFQUFFLElBQUk7QUFDYixPQUFLLEVBQUUsSUFBSTtBQUNYLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFdBQVMsRUFBRSxJQUFJO0FBQ2YsZ0JBQWMsRUFBRSxJQUFJLEVBQ3JCLENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLGtCQUFrQixDQUFDIiwiZmlsZSI6IlVwbGlua1NpbXBsZVNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuY29uc3QgYm9keVBhcnNlciA9IHJlcXVpcmUoJ2JvZHktcGFyc2VyJyk7XG5jb25zdCBDb25zdGFudFJvdXRlciA9IHJlcXVpcmUoJ25leHVzLXJvdXRlcicpLkNvbnN0YW50Um91dGVyO1xuY29uc3QgSFRUUEV4Y2VwdGlvbnMgPSByZXF1aXJlKCdodHRwLWV4Y2VwdGlvbnMnKTtcblxuY29uc3QgQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vQ29ubmVjdGlvbicpO1xuY29uc3QgU2Vzc2lvbiA9IHJlcXVpcmUoJy4vU2Vzc2lvbicpO1xuXG4vLyBNb3N0IHB1YmxpYyBtZXRob2RzIGV4cG9zZSBhbiBhc3luYyBBUElcbi8vIHRvIGVuZm9yY2UgY29uc2lzdGVuY2Ugd2l0aCBhc3luYyBkYXRhIGJhY2tlbmRzLFxuLy8gZWcuIHJlZGlzIG9yIG15c3FsLCBhbHRob3VnaCBpbiB0aGlzIGltcGxlbWVudGF0aW9uXG4vLyB0aGUgYmFja2VuZCByZXNpZGVzIGluIG1lbW9yeSAoYSBzaW1wbGUgT2JqZWN0IGFjdGluZ1xuLy8gYXMgYW4gYXNzb2NpYXRpdmUgbWFwKS5cbmNsYXNzIFVwbGlua1NpbXBsZVNlcnZlciB7XG4gIC8vIHN0b3Jlcywgcm9vbXMsIGFuZCBhY3Rpb25zIGFyZSB0aHJlZSB3aGl0ZWxpc3RzIG9mXG4gIC8vIHN0cmluZyBwYXR0ZXJucy4gRWFjaCBpcyBhbiBhcnJheSB0aGF0IHdpbGwgYmUgcGFzc2VkXG4gIC8vIHRvIHRoZSBSb3V0ZXIgY29uc3RydWN0b3IuXG4gIGNvbnN0cnVjdG9yKHsgcGlkLCBzdG9yZXMsIHJvb21zLCBhY3Rpb25zIH0pIHtcbiAgICBfLmRldigoKSA9PiBzdG9yZXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICByb29tcy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIGFjdGlvbnMuc2hvdWxkLmJlLmFuLkFycmF5XG4gICAgKTtcbiAgICAvLyBIZXJlIHdlIHVzZSBDb25zdGFudFJvdXRlciBpbnN0YW5jZXM7IHdlIG9ubHkgbmVlZFxuICAgIC8vIHRvIGtub3cgaWYgYSBnaXZlbiBzdHJpbmcgbWF0Y2ggYSByZWdpc3RlcmVkIHBhdHRlcm4uXG4gICAgdGhpcy5zdG9yZXMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIoc3RvcmVzKTtcbiAgICB0aGlzLnJvb21zID0gbmV3IENvbnN0YW50Um91dGVyKHJvb21zKTtcbiAgICB0aGlzLmFjdGlvbnMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIoYWN0aW9ucyk7XG5cbiAgICAvLyBTdG9yZSBkYXRhIGNhY2hlXG4gICAgdGhpcy5fZGF0YSA9IHt9O1xuXG4gICAgdGhpcy5zdWJzY3JpYmVycyA9IHt9O1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5hY3Rpb25IYW5kbGVycyA9IHt9O1xuICB9XG5cbiAgYXR0YWNoKGFwcCkge1xuICAgIF8uZGV2KCgpID0+IGFwcC5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAvLyBEdWNrdHlwZS1jaGVjayBmb3IgYW4gZXhwcmVzcy1saWtlIGFwcFxuICAgICAgYXBwLmdldC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgYXBwLnBvc3Quc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIGxldCBpbyA9IHJlcXVpcmUoJ3NvY2tldC5pbycpKGFwcCk7XG4gICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAuZm9yRWFjaCgoZXZlbnQpID0+IGlvLm9uKGV2ZW50LCAoKSA9PiBpb0hhbmRsZXJzW2V2ZW50XS5hcHBseSh0aGlzLCBhcmd1bWVudHMpKSk7XG5cbiAgICBhcHAuZ2V0KChyZXEsIHJlcywgbmV4dCkgPT4gaHR0cEhhbmRsZXJzLmdldC5jYWxsKHRoaXMsIHJlcSwgcmVzLCBuZXh0KSk7XG4gICAgYXBwLnBvc3QoKHJlcSwgcmVzLCBuZXh0KSA9PiBodHRwSGFuZGxlcnMucG9zdC5jYWxsKHRoaXMsIHJlcSwgcmVzLCBuZXh0KSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWxsKHBhdGgpIHtcbiAgICByZXR1cm4gUHJvbWlzZS50cnkoKCkgPT4ge1xuICAgICAgaWYodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEhUVFBFeGNlcHRpb25zLk5vdEZvdW5kKHBhdGgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2RhdGFbcGF0aF07XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGUocGF0aCwgdmFsdWUpIHtcbiAgICByZXR1cm4gXy5jb3Byb21pc2UoZnVuY3Rpb24qKCkge1xuICAgICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdmFsdWUuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgICAgLy8gRGlmZiBhbmQgSlNPTi1lbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgICAgLy8gdGhlc2UgbGVuZ3RoeSBjYWxjdWxhdGlvbnMgZG93biB0aGUgcHJvcGFnYXRpb24gdHJlZS5cbiAgICAgICAgbGV0IGhhc2gsIGRpZmY7XG4gICAgICAgIGlmKCF0aGlzLl9kYXRhW3BhdGhdKSB7XG4gICAgICAgICAgaGFzaCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaCA9IF8uaGFzaCh0aGlzLl9kYXRhW3BhdGhdKTtcbiAgICAgICAgICBkaWZmID0gXy5kaWZmKHRoaXMuX2RhdGFbcGF0aF0sIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKVxuICAgICAgICAvLyBEaXJlY3RseSBwYXNzIHRoZSBwYXRjaCwgc2Vzc2lvbnMgZG9uJ3QgbmVlZCB0byBiZSBhd2FyZVxuICAgICAgICAvLyBvZiB0aGUgYWN0dWFsIGNvbnRlbnRzOyB0aGV5IG9ubHkgbmVlZCB0byBmb3J3YXJkIHRoZSBkaWZmXG4gICAgICAgIC8vIHRvIHRoZWlyIGFzc29jaWF0ZWQgY2xpZW50cy5cbiAgICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi51cGRhdGUocGF0aCwgeyBoYXNoLCBkaWZmIH0pKTtcbiAgICAgIH1cbiAgICB9LCB0aGlzKTtcbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRQYXRoO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgbGVha3kgZW50cnkgaW4gdGhpcy5zdWJzY3JpYmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQubm90LmJlLm9rKTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXSA9IHt9O1xuICAgICAgY3JlYXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdLnNob3VsZC5iZS5leGFjdGx5KHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmliZXJzW3BhdGhdO1xuICAgICAgZGVsZXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiB1bnNidXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gIGVtaXQocm9vbSwgcGFyYW1zKSB7XG4gICAgcmV0dXJuIF8uY29wcm9taXNlKGZ1bmN0aW9uKigpIHtcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAgICh0aGlzLnJvb21zLm1hdGNoKHJvb20pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICAgICk7XG4gICAgICBpZih0aGlzLmxpc3RlbmVyc1twYXRoXSkge1xuICAgICAgICAvLyBFbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgICAgLy8gdGhpcyBvcGVyYXRpb24gZG93biB0aGUgcHJvcGFnYXRpb24gdHJlZS5cbiAgICAgICAgbGV0IGpzb24gPSBKU09OLnN0cmluZ2lmeShwYXJhbXMpO1xuICAgICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1twYXRoXSlcbiAgICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi5lbWl0KHJvb20sIGpzb24pKTtcbiAgICAgIH1cbiAgICB9LCB0aGlzKTtcbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRSb29tO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3BhdGhdKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGEgbGVha3kgZW50cnkgaW4gdGhpcy5saXN0ZW5lcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMubGlzdGVuZXJzW3BhdGhdW3Nlc3Npb24uaWRdLnNob3VsZC5ub3QuYmUub2spO1xuICAgICAgY3JlYXRlZFJvb20gPSBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1twYXRoXSA9IHt9O1xuICAgICAgY3JlYXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxpc3RlbmVyc1twYXRoXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pICYmXG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1twYXRoXTtcbiAgICAgIGRlbGV0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gdW5zdXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFJvb20gfTtcbiAgfVxuXG4gIGFkZEFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgKHRoaXMuYWN0aW9ucy5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBjcmVhdGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYoIXRoaXMuYWN0aW9uc1twYXRoXSkge1xuICAgICAgdGhpcy5hY3Rpb25zW3BhdGhdID0gW107XG4gICAgICBjcmVhdGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5hY3Rpb25zW3BhdGhdLnB1c2goaGFuZGxlcik7XG4gICAgcmV0dXJuIHsgY3JlYXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgcmVtb3ZlQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXS5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIF8uY29udGFpbnModGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBsaXN0IG9mIGhhbmRsZXJzIGhlcmU7XG4gICAgLy8gV2UgZG9uJ3QgZXhwZWN0IHRvIGhhdmUgX3RoYXRfIG11Y2ggZGlmZmVyZW50IGhhbmRsZXJzXG4gICAgLy8gZm9yIGEgZ2l2ZW4gYWN0aW9uLlxuICAgIHRoaXMuYWN0aW9uc1twYXRoXSA9IF8ud2l0aG91dCh0aGlzLmFjdGlvbnNbcGF0aF0sIGhhbmRsZXIpO1xuICAgIGxldCBkZWxldGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYodGhpcy5hY3Rpb25zW3BhdGhdLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMuYWN0aW9uc1twYXRoXTtcbiAgICAgIGRlbGV0ZWRBY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4geyBkZWxldGVkQWN0aW9uIH07XG4gIH1cblxuICBkaXNwYXRjaChhY3Rpb24sIHBhcmFtcyA9IHt9KSB7XG4gICAgcmV0dXJuIF8uY29wcm9taXNlKGZ1bmN0aW9uKigpIHtcbiAgICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgICAgKHRoaXMuYWN0aW9uc1thY3Rpb25dLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIC8vIFJ1biBhbGwgaGFuZGxlcnMgY29uY3VycmVudGx5IGFuZCByZXR1cm4gdGhlIGxpc3Qgb2YgdGhlIHJlc3VsdHNcbiAgICAgIC8vIChlbXB0eSBsaXN0IGlmIG5vIGhhbmRsZXJzKS5cbiAgICAgIHJldHVybiB5aWVsZCAodGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dID8gdGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dIDogW10pXG4gICAgICAubWFwKChoYW5kbGVyKSA9PiBoYW5kbGVyLmNhbGwobnVsbCwgcGFyYW1zKSk7XG4gICAgfSwgdGhpcyk7XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rU2ltcGxlU2VydmVyLnByb3RvdHlwZSwge1xuICBzdG9yZXM6IG51bGwsXG4gIHJvb21zOiBudWxsLFxuICBhY3Rpb25zOiBudWxsLFxuICBfZGF0YTogbnVsbCxcbiAgc3Vic2NyaWJlcnM6IG51bGwsXG4gIGxpc3RlbmVyczogbnVsbCxcbiAgYWN0aW9uSGFuZGxlcnM6IG51bGwsXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcGxpbmtTaW1wbGVTZXJ2ZXI7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=