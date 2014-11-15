"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");
var Promise = require("bluebird");
var _ = require("lodash-next");
var should = _.should;
var bodyParser = require("body-parser");
var ConstantRouter = require("nexus-router").ConstantRouter;
var HTTPExceptions = require("http-exceptions");

var Connection = require("./Connection")({ UplinkSimpleServer: UplinkSimpleServer });
var Session = require("./Session")({ Connection: Connection, UplinkSimpleServer: UplinkSimpleServer });
var instanceOfSocketIO = require("./instanceOfSocketIO");

var ioHandlers = {
  connection: function (socket) {
    var _this = this;
    _.dev(function () {
      return instanceOfSocketIO(socket).should.be.ok && _this.connections[socket.id].should.not.be.ok;
    });
    this.connections[socket.id] = new Connection({ socket: socket, uplink: this });
    socket.on("disconnect", function () {
      return ioHandlers.disconnection.call(_this, socket);
    });
  },

  disconnection: function (socket) {
    var _this2 = this;
    _.dev(function () {
      return socket.should.be.an.Object && socket.on.should.be.a.Function && socket.emit.should.be.a.Function && socket.id.should.be.a.String && _this2.connections[socket.id].should.be.exactly(socket);
    });
    this.connections[socket.id].destroy();
    delete this.connections[socket.id];
  } };

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

    // Connections represent actual living socket.io connections.
    // Session represent a remote Uplink client instance, with a unique guid.
    // The concept of session enforces consistency between its attached socket connections,
    // and HTTP requests.
    // A single session can be attached to zero or more than one connection.
    // Uplink frames are received from and sent to sessions, not connection.
    // Each session must keep references to its attached connections and propagate
    // relevant frames accordingly.
    this.connections = {};
    this.sessions = {};

    this.subscribers = {};
    this.listeners = {};
    this.actionHandlers = {};
  };

  _classProps(UplinkSimpleServer, null, {
    attach: {
      writable: true,
      value: function (app) {
        var _this3 = this;
        var _arguments = arguments;
        _.dev(function () {
          return app.should.be.an.Object &&
          // Ducktype-check for an express-like app
          app.get.should.be.a.Function && app.post.should.be.a.Function;
        });
        // socket.io handlers are installed first, to pre-empt some paths over the http handlers.
        var io = require("socket.io")(app);
        // Delegate to static ioHandler methods, but call them with context.
        Object.keys(ioHandlers).forEach(function (event) {
          return io.on(event, function () {
            return ioHandlers[event].apply(_this3, _arguments);
          });
        });

        // Fetch from store
        app.get("*",
        // Check that this store path is whitelisted
        function (req, res, next) {
          return _this3.stores.match(req.path) === null ? HTTPExceptions.forward(res, new HTTPExceptions.NotFound(req.path)) : next();
        }, function (req, res) {
          return _this3.pull(req.path).then(function (value) {
            _.dev(function () {
              return (value === null || _.isObject(value)).should.be.ok;
            });
            res.status(200).type("application/json").send(value);
          }).catch(function (err) {
            _.dev(function () {
              console.error(err, err.stack);
            });
            if (err instanceof HTTPExceptions.HTTPError) {
              HTTPExceptions.forward(res, err);
            } else {
              res.status(500).json({ err: err.toString() });
            }
          });
        });

        // Dispatch action
        app.post("*",
        // Parse body as JSON
        bodyParser.json(),
        // Check that this action path is whitelisted
        function (req, res, next) {
          return _this3.actions.match(req.path) === null ? HTTPExceptions.forward(res, new HTTPExceptions.NotFound(req.path)) : next();
        },
        // params should be present
        function (req, res, next) {
          return !_.isObject(req.body.params) ? HTTPExceptions.forward(res, new HTTPExceptions.BadRequest("Missing required field: 'param'")) : next();
        },
        // Check for a valid, active session guid in params
        function (req, res, next) {
          return !req.body.params.guid ? HTTPExceptions.forward(res, new HTTPExceptions.Unauthorized("Missing required field: 'params'.'guid'")) : next();
        }, function (req, res, next) {
          return !_this3.isActiveSession(req.body.params.guid) ? HTTPExceptions.forward(res, HTTPExceptions.Unauthorized("Invalid 'guid'.")) : next();
        }, function (req, res) {
          return _this3.dispatch(req.path, req.body.params).then(function (result) {
            return res.status(200).json(result);
          }).catch(function (err) {
            _.dev(function () {
              console.error(err, err.stack);
            });
            if (err instanceof HTTPExceptions.HTTPError) {
              HTTPExceptions.forward(res, err);
            } else {
              res.status(500).json({ err: err.toString() });
            }
          });
        });
        return this;
      }
    },
    pull: {
      writable: true,
      value: function (path) {
        var _this4 = this;
        return Promise.try(function () {
          _.dev(function () {
            return path.should.be.a.String && (_this4.stores.match(path) !== null).should.be.ok;
          });
          return _this4._data[path];
        });
      }
    },
    update: {
      writable: true,
      value: function (path, value) {
        return _.copromise(regeneratorRuntime.mark(function callee$2$0() {
          var _this5;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {
              case 0: _this5 = this;
                _.dev(function () {
                  return path.should.be.a.String && value.should.be.an.Object && (_this5.stores.match(path) !== null).should.be.ok;
                });
                if (this.subscribers[path]) {
                  (function () {
                    // Diff and JSON-encode as early as possible to avoid duplicating
                    // these lengthy calculations down the propagation tree.
                    var hash, diff;
                    // If no value was present before, then nullify the hash. No value has a null hash.
                    if (!_this5._data[path]) {
                      hash = null;
                    } else {
                      hash = _.hash(_this5._data[path]);
                      diff = _.diff(_this5._data[path], value);
                    }
                    yield Object.keys(_this5.subscribers[path])
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
        var _this6 = this;
        _.dev(function () {
          return path.should.be.a.String && session.should.be.an.instanceOf(Session);
        });
        var createdPath;
        if (this.subscribers[path]) {
          // Fail early to avoid creating leaky entry in this.subscribers
          _.dev(function () {
            return _this6.subscribers[path][session.id].should.not.be.ok;
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
        var _this7 = this;
        _.dev(function () {
          return path.should.be.a.String && session.should.be.an.instanceOf(Session) && _this7.subscribers[path].should.be.an.Object && _this7.subscribers[path][session.id].should.be.exactly(session);
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
          var _this8;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {
              case 0: _this8 = this;
                _.dev(function () {
                  return room.should.be.a.String && params.should.be.an.Object && (_this8.rooms.match(room) !== null).should.be.ok;
                });
                if (this.listeners[path]) {
                  (function () {
                    // Encode as early as possible to avoid duplicating
                    // this operation down the propagation tree.
                    var json = JSON.stringify(params);
                    yield Object.keys(_this8.listeners[path]).map(function (session) {
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
        var _this9 = this;
        _.dev(function () {
          return room.should.be.a.String && session.should.be.an.instanceOf(Session);
        });
        var createdRoom;
        if (this.listeners[path]) {
          // Fail early to avoid creating a leaky entry in this.listeners
          _.dev(function () {
            return _this9.listeners[path][session.id].should.not.be.ok;
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
        var _this10 = this;
        _.dev(function () {
          return room.should.be.a.String && session.should.be.an.instanceOf(Session) && _this10.listeners[room][session.id].should.be.exactly(session);
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
        var _this11 = this;
        _.dev(function () {
          return action.should.be.a.String && handler.should.be.a.Function && (_this11.actions.match(action) !== null).should.be.ok;
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
        var _this12 = this;
        _.dev(function () {
          return action.should.be.a.String && handler.should.be.a.Function && _this12.actions[action].should.be.an.Array && _.contains(_this12.actions[action], handler).should.be.ok;
        });
        // Loop through the list of handlers here;
        // We don't expect to have _that_ much different handlers
        // for a given action, so performance implications
        // should be completely negligible.
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
          var _this13;
          return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
            while (1) switch (context$3$0.prev = context$3$0.next) {
              case 0: _this13 = this;
                _.dev(function () {
                  return action.should.be.a.String && params.should.be.an.Object && params.guid.should.be.a.String && (_this13.actions[action].match(action) !== null).should.be.ok;
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
    },
    hasSession: {
      writable: true,
      value: function (guid) {
        return !!this.sessions[guid];
      }
    },
    createSession: {
      writable: true,
      value: function (guid) {
        _.dev(function () {
          return guid.should.be.a.String;
        });
        if (!this.sessions[guid]) {
          this.sessions[guid] = this.sessionCreated(new Session({ guid: guid, uplink: this }));
        }
        return this.sessions[guid];
      }
    },
    deleteSession: {
      writable: true,
      value: function (guid) {
        _.dev(function () {
          return guid.should.be.a.String;
        });
        var session = this.sessions[guid];
        session.destroy();
        delete this.sessions[guid];
        return this.sessionDeleted(session);
      }
    },
    sessionCreated: {
      writable: true,
      value: function (session) {
        return Promise.resolve(session);
      }
    },
    sessionDeleted: {
      writable: true,
      value: function (session) {
        return Promise.resolve(session);
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

  connections: null,
  sessions: null,

  subscribers: null,
  listeners: null,
  actionHandlers: null });

module.exports = UplinkSimpleServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9VcGxpbmtTaW1wbGVTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7QUFDeEIsSUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzFDLElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxjQUFjLENBQUM7QUFDOUQsSUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7O0FBRWxELElBQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixFQUFsQixrQkFBa0IsRUFBRSxDQUFDLENBQUM7QUFDbkUsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFWLFVBQVUsRUFBRSxrQkFBa0IsRUFBbEIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0FBQ3pFLElBQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7O0FBRTNELElBQU0sVUFBVSxHQUFHO0FBQ2pCLFlBQVUsRUFBQSxVQUFDLE1BQU0sRUFBRTs7QUFDakIsS0FBQyxDQUFDLEdBQUcsQ0FBQzthQUFNLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUNqRCxNQUFLLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtL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QUFDWixPQUFLLEVBQUUsSUFBSTtBQUNYLFNBQU8sRUFBRSxJQUFJOztBQUViLE9BQUssRUFBRSxJQUFJOztBQUVYLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFVBQVEsRUFBRSxJQUFJOztBQUVkLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFdBQVMsRUFBRSxJQUFJO0FBQ2YsZ0JBQWMsRUFBRSxJQUFJLEVBQ3JCLENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLGtCQUFrQixDQUFDIiwiZmlsZSI6IlVwbGlua1NpbXBsZVNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuY29uc3Qgc2hvdWxkID0gXy5zaG91bGQ7XG5jb25zdCBib2R5UGFyc2VyID0gcmVxdWlyZSgnYm9keS1wYXJzZXInKTtcbmNvbnN0IENvbnN0YW50Um91dGVyID0gcmVxdWlyZSgnbmV4dXMtcm91dGVyJykuQ29uc3RhbnRSb3V0ZXI7XG5jb25zdCBIVFRQRXhjZXB0aW9ucyA9IHJlcXVpcmUoJ2h0dHAtZXhjZXB0aW9ucycpO1xuXG5jb25zdCBDb25uZWN0aW9uID0gcmVxdWlyZSgnLi9Db25uZWN0aW9uJykoeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5jb25zdCBTZXNzaW9uID0gcmVxdWlyZSgnLi9TZXNzaW9uJykoeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5jb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xuXG5jb25zdCBpb0hhbmRsZXJzID0ge1xuICBjb25uZWN0aW9uKHNvY2tldCkge1xuICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLnNob3VsZC5ub3QuYmUub2tcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXSA9IG5ldyBDb25uZWN0aW9uKHsgc29ja2V0LCB1cGxpbms6IHRoaXMgfSk7XG4gICAgc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgKCkgPT4gaW9IYW5kbGVycy5kaXNjb25uZWN0aW9uLmNhbGwodGhpcywgc29ja2V0KSk7XG4gIH0sXG5cbiAgZGlzY29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICBfLmRldigoKSA9PiBzb2NrZXQuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgc29ja2V0Lm9uLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuZW1pdC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgc29ja2V0LmlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLnNob3VsZC5iZS5leGFjdGx5KHNvY2tldClcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXS5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXTtcbiAgfSxcbn07XG5cbi8vIE1vc3QgcHVibGljIG1ldGhvZHMgZXhwb3NlIGFuIGFzeW5jIEFQSVxuLy8gdG8gZW5mb3JjZSBjb25zaXN0ZW5jZSB3aXRoIGFzeW5jIGRhdGEgYmFja2VuZHMsXG4vLyBlZy4gcmVkaXMgb3IgbXlzcWwsIGFsdGhvdWdoIGluIHRoaXMgaW1wbGVtZW50YXRpb25cbi8vIHRoZSBiYWNrZW5kIHJlc2lkZXMgaW4gbWVtb3J5IChhIHNpbXBsZSBPYmplY3QgYWN0aW5nXG4vLyBhcyBhbiBhc3NvY2lhdGl2ZSBtYXApLlxuY2xhc3MgVXBsaW5rU2ltcGxlU2VydmVyIHtcbiAgLy8gc3RvcmVzLCByb29tcywgYW5kIGFjdGlvbnMgYXJlIHRocmVlIHdoaXRlbGlzdHMgb2ZcbiAgLy8gc3RyaW5nIHBhdHRlcm5zLiBFYWNoIGlzIGFuIGFycmF5IHRoYXQgd2lsbCBiZSBwYXNzZWRcbiAgLy8gdG8gdGhlIFJvdXRlciBjb25zdHJ1Y3Rvci5cbiAgY29uc3RydWN0b3IoeyBwaWQsIHN0b3Jlcywgcm9vbXMsIGFjdGlvbnMgfSkge1xuICAgIF8uZGV2KCgpID0+IHN0b3Jlcy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIHJvb21zLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgYWN0aW9ucy5zaG91bGQuYmUuYW4uQXJyYXlcbiAgICApO1xuICAgIC8vIEhlcmUgd2UgdXNlIENvbnN0YW50Um91dGVyIGluc3RhbmNlczsgd2Ugb25seSBuZWVkXG4gICAgLy8gdG8ga25vdyBpZiBhIGdpdmVuIHN0cmluZyBtYXRjaCBhIHJlZ2lzdGVyZWQgcGF0dGVybi5cbiAgICB0aGlzLnN0b3JlcyA9IG5ldyBDb25zdGFudFJvdXRlcihzdG9yZXMpO1xuICAgIHRoaXMucm9vbXMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIocm9vbXMpO1xuICAgIHRoaXMuYWN0aW9ucyA9IG5ldyBDb25zdGFudFJvdXRlcihhY3Rpb25zKTtcblxuICAgIC8vIFN0b3JlIGRhdGEgY2FjaGVcbiAgICB0aGlzLl9kYXRhID0ge307XG5cbiAgICAvLyBDb25uZWN0aW9ucyByZXByZXNlbnQgYWN0dWFsIGxpdmluZyBzb2NrZXQuaW8gY29ubmVjdGlvbnMuXG4gICAgLy8gU2Vzc2lvbiByZXByZXNlbnQgYSByZW1vdGUgVXBsaW5rIGNsaWVudCBpbnN0YW5jZSwgd2l0aCBhIHVuaXF1ZSBndWlkLlxuICAgIC8vIFRoZSBjb25jZXB0IG9mIHNlc3Npb24gZW5mb3JjZXMgY29uc2lzdGVuY3kgYmV0d2VlbiBpdHMgYXR0YWNoZWQgc29ja2V0IGNvbm5lY3Rpb25zLFxuICAgIC8vIGFuZCBIVFRQIHJlcXVlc3RzLlxuICAgIC8vIEEgc2luZ2xlIHNlc3Npb24gY2FuIGJlIGF0dGFjaGVkIHRvIHplcm8gb3IgbW9yZSB0aGFuIG9uZSBjb25uZWN0aW9uLlxuICAgIC8vIFVwbGluayBmcmFtZXMgYXJlIHJlY2VpdmVkIGZyb20gYW5kIHNlbnQgdG8gc2Vzc2lvbnMsIG5vdCBjb25uZWN0aW9uLlxuICAgIC8vIEVhY2ggc2Vzc2lvbiBtdXN0IGtlZXAgcmVmZXJlbmNlcyB0byBpdHMgYXR0YWNoZWQgY29ubmVjdGlvbnMgYW5kIHByb3BhZ2F0ZVxuICAgIC8vIHJlbGV2YW50IGZyYW1lcyBhY2NvcmRpbmdseS5cbiAgICB0aGlzLmNvbm5lY3Rpb25zID0ge307XG4gICAgdGhpcy5zZXNzaW9ucyA9IHt9O1xuXG4gICAgdGhpcy5zdWJzY3JpYmVycyA9IHt9O1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5hY3Rpb25IYW5kbGVycyA9IHt9O1xuICB9XG5cbiAgYXR0YWNoKGFwcCkge1xuICAgIF8uZGV2KCgpID0+IGFwcC5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAvLyBEdWNrdHlwZS1jaGVjayBmb3IgYW4gZXhwcmVzcy1saWtlIGFwcFxuICAgICAgYXBwLmdldC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgYXBwLnBvc3Quc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIC8vIHNvY2tldC5pbyBoYW5kbGVycyBhcmUgaW5zdGFsbGVkIGZpcnN0LCB0byBwcmUtZW1wdCBzb21lIHBhdGhzIG92ZXIgdGhlIGh0dHAgaGFuZGxlcnMuXG4gICAgbGV0IGlvID0gcmVxdWlyZSgnc29ja2V0LmlvJykoYXBwKTtcbiAgICAvLyBEZWxlZ2F0ZSB0byBzdGF0aWMgaW9IYW5kbGVyIG1ldGhvZHMsIGJ1dCBjYWxsIHRoZW0gd2l0aCBjb250ZXh0LlxuICAgIE9iamVjdC5rZXlzKGlvSGFuZGxlcnMpXG4gICAgLmZvckVhY2goKGV2ZW50KSA9PiBpby5vbihldmVudCwgKCkgPT4gaW9IYW5kbGVyc1tldmVudF0uYXBwbHkodGhpcywgYXJndW1lbnRzKSkpO1xuXG4gICAgLy8gRmV0Y2ggZnJvbSBzdG9yZVxuICAgIGFwcC5nZXQoJyonLFxuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGlzIHN0b3JlIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5zdG9yZXMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLnB1bGwocmVxLnBhdGgpXG4gICAgICAgIC50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+ICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rKTtcbiAgICAgICAgICByZXMuc3RhdHVzKDIwMCkudHlwZSgnYXBwbGljYXRpb24vanNvbicpLnNlbmQodmFsdWUpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IHsgY29uc29sZS5lcnJvcihlcnIsIGVyci5zdGFjayk7IH0pO1xuICAgICAgICAgIGlmKGVyciBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gRGlzcGF0Y2ggYWN0aW9uXG4gICAgYXBwLnBvc3QoJyonLFxuICAgICAgLy8gUGFyc2UgYm9keSBhcyBKU09OXG4gICAgICBib2R5UGFyc2VyLmpzb24oKSxcbiAgICAgIC8vIENoZWNrIHRoYXQgdGhpcyBhY3Rpb24gcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLmFjdGlvbnMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgLy8gcGFyYW1zIHNob3VsZCBiZSBwcmVzZW50XG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFfLmlzT2JqZWN0KHJlcS5ib2R5LnBhcmFtcykgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLkJhZFJlcXVlc3QoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IFxcJ3BhcmFtXFwnJykpIDogbmV4dCgpLFxuICAgICAgLy8gQ2hlY2sgZm9yIGEgdmFsaWQsIGFjdGl2ZSBzZXNzaW9uIGd1aWQgaW4gcGFyYW1zXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFyZXEuYm9keS5wYXJhbXMuZ3VpZCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbXNcXCcuXFwnZ3VpZFxcJycpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIXRoaXMuaXNBY3RpdmVTZXNzaW9uKHJlcS5ib2R5LnBhcmFtcy5ndWlkKSA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBIVFRQRXhjZXB0aW9ucy5VbmF1dGhvcml6ZWQoJ0ludmFsaWQgXFwnZ3VpZFxcJy4nKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMuZGlzcGF0Y2gocmVxLnBhdGgsIHJlcS5ib2R5LnBhcmFtcylcbiAgICAgIC50aGVuKChyZXN1bHQpID0+IHJlcy5zdGF0dXMoMjAwKS5qc29uKHJlc3VsdCkpXG4gICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IHsgY29uc29sZS5lcnJvcihlcnIsIGVyci5zdGFjayk7IH0pO1xuICAgICAgICAgIGlmKGVyciBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCkge1xuICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIHJldHVybiB0aGlzLl9kYXRhW3BhdGhdO1xuICAgIH0pO1xuICB9XG5cbiAgdXBkYXRlKHBhdGgsIHZhbHVlKSB7XG4gICAgcmV0dXJuIF8uY29wcm9taXNlKGZ1bmN0aW9uKigpIHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHZhbHVlLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgICAgKHRoaXMuc3RvcmVzLm1hdGNoKHBhdGgpICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICAgICk7XG4gICAgICBpZih0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSB7XG4gICAgICAgIC8vIERpZmYgYW5kIEpTT04tZW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAgIC8vIHRoZXNlIGxlbmd0aHkgY2FsY3VsYXRpb25zIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICAgIGxldCBoYXNoLCBkaWZmO1xuICAgICAgICAvLyBJZiBubyB2YWx1ZSB3YXMgcHJlc2VudCBiZWZvcmUsIHRoZW4gbnVsbGlmeSB0aGUgaGFzaC4gTm8gdmFsdWUgaGFzIGEgbnVsbCBoYXNoLlxuICAgICAgICBpZighdGhpcy5fZGF0YVtwYXRoXSkge1xuICAgICAgICAgIGhhc2ggPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGhhc2ggPSBfLmhhc2godGhpcy5fZGF0YVtwYXRoXSk7XG4gICAgICAgICAgZGlmZiA9IF8uZGlmZih0aGlzLl9kYXRhW3BhdGhdLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgeWllbGQgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSlcbiAgICAgICAgLy8gRGlyZWN0bHkgcGFzcyB0aGUgcGF0Y2gsIHNlc3Npb25zIGRvbid0IG5lZWQgdG8gYmUgYXdhcmVcbiAgICAgICAgLy8gb2YgdGhlIGFjdHVhbCBjb250ZW50czsgdGhleSBvbmx5IG5lZWQgdG8gZm9yd2FyZCB0aGUgZGlmZlxuICAgICAgICAvLyB0byB0aGVpciBhc3NvY2lhdGVkIGNsaWVudHMuXG4gICAgICAgIC5tYXAoKHNlc3Npb24pID0+IHNlc3Npb24udXBkYXRlKHBhdGgsIHsgaGFzaCwgZGlmZiB9KSk7XG4gICAgICB9XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBjcmVhdGVkUGF0aDtcbiAgICBpZih0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGxlYWt5IGVudHJ5IGluIHRoaXMuc3Vic2NyaWJlcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF0uc2hvdWxkLm5vdC5iZS5vayk7XG4gICAgICBjcmVhdGVkUGF0aCA9IGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0gPSB7fTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFBhdGggfTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlRnJvbShwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbikgJiZcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRQYXRoID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF07XG4gICAgaWYoT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXTtcbiAgICAgIGRlbGV0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gdW5zYnVzY3JpYmUgZnJvbSBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGRlbGV0ZWRQYXRoIH07XG4gIH1cblxuICBlbWl0KHJvb20sIHBhcmFtcykge1xuICAgIHJldHVybiBfLmNvcHJvbWlzZShmdW5jdGlvbiooKSB7XG4gICAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgICAodGhpcy5yb29tcy5tYXRjaChyb29tKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgaWYodGhpcy5saXN0ZW5lcnNbcGF0aF0pIHtcbiAgICAgICAgLy8gRW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAgIC8vIHRoaXMgb3BlcmF0aW9uIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICAgIGxldCBqc29uID0gSlNPTi5zdHJpbmdpZnkocGFyYW1zKTtcbiAgICAgICAgeWllbGQgT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcGF0aF0pXG4gICAgICAgIC5tYXAoKHNlc3Npb24pID0+IHNlc3Npb24uZW1pdChyb29tLCBqc29uKSk7XG4gICAgICB9XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBsaXN0ZW5Ubyhyb29tLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBjcmVhdGVkUm9vbTtcbiAgICBpZih0aGlzLmxpc3RlbmVyc1twYXRoXSkge1xuICAgICAgLy8gRmFpbCBlYXJseSB0byBhdm9pZCBjcmVhdGluZyBhIGxlYWt5IGVudHJ5IGluIHRoaXMubGlzdGVuZXJzXG4gICAgICBfLmRldigoKSA9PiB0aGlzLmxpc3RlbmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQubm90LmJlLm9rKTtcbiAgICAgIGNyZWF0ZWRSb29tID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbcGF0aF0gPSB7fTtcbiAgICAgIGNyZWF0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5saXN0ZW5lcnNbcGF0aF1bc2Vzc2lvbi5pZF0gPSBzZXNzaW9uO1xuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgaXMgdGhlIGZpcnN0IGxpc3RlbmVyXG4gICAgLy8gdG8gdGhpcyByb29tOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlLmcuIHN1YnNjcmliZSB0byBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGNyZWF0ZWRSb29tIH07XG4gIH1cblxuICB1bmxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF0uc2hvdWxkLmJlLmV4YWN0bHkoc2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBkZWxldGVkUm9vbSA9IGZhbHNlO1xuICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbcGF0aF07XG4gICAgICBkZWxldGVkUm9vbSA9IHRydWU7XG4gICAgfVxuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgd2FzIHRoZSBsYXN0IGxpc3RlbmVyXG4gICAgLy8gdG8gdGhpcyByb29tOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlLmcuIHVuc3VzY3JpYmUgZnJvbSBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGRlbGV0ZWRSb29tIH07XG4gIH1cblxuICBhZGRBY3Rpb25IYW5kbGVyKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgICh0aGlzLmFjdGlvbnMubWF0Y2goYWN0aW9uKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKCF0aGlzLmFjdGlvbnNbcGF0aF0pIHtcbiAgICAgIHRoaXMuYWN0aW9uc1twYXRoXSA9IFtdO1xuICAgICAgY3JlYXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuYWN0aW9uc1twYXRoXS5wdXNoKGhhbmRsZXIpO1xuICAgIHJldHVybiB7IGNyZWF0ZWRBY3Rpb24gfTtcbiAgfVxuXG4gIHJlbW92ZUFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0uc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBfLmNvbnRhaW5zKHRoaXMuYWN0aW9uc1thY3Rpb25dLCBoYW5kbGVyKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgbGlzdCBvZiBoYW5kbGVycyBoZXJlO1xuICAgIC8vIFdlIGRvbid0IGV4cGVjdCB0byBoYXZlIF90aGF0XyBtdWNoIGRpZmZlcmVudCBoYW5kbGVyc1xuICAgIC8vIGZvciBhIGdpdmVuIGFjdGlvbiwgc28gcGVyZm9ybWFuY2UgaW1wbGljYXRpb25zXG4gICAgLy8gc2hvdWxkIGJlIGNvbXBsZXRlbHkgbmVnbGlnaWJsZS5cbiAgICB0aGlzLmFjdGlvbnNbcGF0aF0gPSBfLndpdGhvdXQodGhpcy5hY3Rpb25zW3BhdGhdLCBoYW5kbGVyKTtcbiAgICBsZXQgZGVsZXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKHRoaXMuYWN0aW9uc1twYXRoXS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmFjdGlvbnNbcGF0aF07XG4gICAgICBkZWxldGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHsgZGVsZXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgZGlzcGF0Y2goYWN0aW9uLCBwYXJhbXMgPSB7fSkge1xuICAgIHJldHVybiBfLmNvcHJvbWlzZShmdW5jdGlvbiooKSB7XG4gICAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAgIHBhcmFtcy5ndWlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICAodGhpcy5hY3Rpb25zW2FjdGlvbl0ubWF0Y2goYWN0aW9uKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgLy8gUnVuIGFsbCBoYW5kbGVycyBjb25jdXJyZW50bHkgYW5kIHJldHVybiB0aGUgbGlzdCBvZiB0aGUgcmVzdWx0c1xuICAgICAgLy8gKGVtcHR5IGxpc3QgaWYgbm8gaGFuZGxlcnMpLlxuICAgICAgLy8gSWYgYW4gYWN0aW9uIGhhbmRsZXIgdGhyb3dzLCB0aGVuIGRpc3BhdGNoIHdpbGwgdGhyb3csIGJ1dCB0aGUgb3RoZXJzIGhhbmRsZXJzXG4gICAgICAvLyBjYW4gc3RpbGwgc3VjY2VlZC5cbiAgICAgIHJldHVybiB5aWVsZCAodGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dID8gdGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dIDogW10pXG4gICAgICAubWFwKChoYW5kbGVyKSA9PiBoYW5kbGVyLmNhbGwobnVsbCwgcGFyYW1zKSk7XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBoYXNTZXNzaW9uKGd1aWQpIHtcbiAgICByZXR1cm4gISF0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgY3JlYXRlU2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnNlc3Npb25zW2d1aWRdKSB7XG4gICAgICB0aGlzLnNlc3Npb25zW2d1aWRdID0gdGhpcy5zZXNzaW9uQ3JlYXRlZChuZXcgU2Vzc2lvbih7IGd1aWQsIHVwbGluazogdGhpcyB9KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgZGVsZXRlU2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGxldCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uRGVsZXRlZChzZXNzaW9uKTtcbiAgfVxuXG4gIC8vIE5vLW9wIHBsYWNlaG9sZGVyLCB0byBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdG8gaW5pdGlhbGl6ZVxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGNyZWF0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkNyZWF0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGNsZWFuLXVwXG4gIC8vIHNlc3Npb24tcmVsYXRlZCByZXNvdXJjZXMuXG4gIC8vIEltcGxlbWVudGF0aW9uIHNob3VsZCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgZGVsZXRlZCBzZXNzaW9uLlxuICBzZXNzaW9uRGVsZXRlZChzZXNzaW9uKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgfVxufVxuXG5fLmV4dGVuZChVcGxpbmtTaW1wbGVTZXJ2ZXIucHJvdG90eXBlLCB7XG4gIHN0b3JlczogbnVsbCxcbiAgcm9vbXM6IG51bGwsXG4gIGFjdGlvbnM6IG51bGwsXG5cbiAgX2RhdGE6IG51bGwsXG5cbiAgY29ubmVjdGlvbnM6IG51bGwsXG4gIHNlc3Npb25zOiBudWxsLFxuXG4gIHN1YnNjcmliZXJzOiBudWxsLFxuICBsaXN0ZW5lcnM6IG51bGwsXG4gIGFjdGlvbkhhbmRsZXJzOiBudWxsLFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rU2ltcGxlU2VydmVyO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9