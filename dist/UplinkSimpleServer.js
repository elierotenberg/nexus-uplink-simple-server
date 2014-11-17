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
var http = require("http");

var instanceOfSocketIO = require("./instanceOfSocketIO");
var Connection, Session;

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
    var app = _ref.app;
    _.dev(function () {
      return stores.should.be.an.Array && rooms.should.be.an.Array && actions.should.be.an.Array && app.should.be.an.Object &&
      // Ducktype-check for an express-like app
      app.get.should.be.a.Function && app.post.should.be.a.Function;
    });
    // Here we use ConstantRouter instances; we only need
    // to know if a given string match a registered pattern.
    this.stores = new ConstantRouter(stores);
    this.rooms = new ConstantRouter(rooms);
    this.actions = new ConstantRouter(actions);
    this.app = app;
    this.server = http.Server(app);

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
    listen: {
      writable: true,
      value: function (port) {
        var _this3 = this;
        _.dev(function () {
          return port.should.be.a.Number;
        });
        var _ref2 = this;
        var app = _ref2.app;
        var server = _ref2.server;
        // socket.io handlers are installed first, to pre-empt some paths over the http handlers.
        var io = require("socket.io")(server);
        // Delegate to static ioHandler methods, but call them with context.
        Object.keys(ioHandlers).forEach(function (event) {
          return io.on(event, function () {
            ioHandlers[event].apply(this, arguments);
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
        server.listen(port);
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
      value: regeneratorRuntime.mark(function callee$1$0(path, value) {
        var _this5, hash, diff;
        return regeneratorRuntime.wrap(function callee$1$0$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {
            case 0: _this5 = this;
              // jshint ignore:line
              _.dev(function () {
                return path.should.be.a.String && value.should.be.an.Object && (_this5.stores.match(path) !== null).should.be.ok;
              });
              if (!this.subscribers[path]) {
                context$2$0.next = 6;
                break;
              }
              // Diff and JSON-encode as early as possible to avoid duplicating
              // these lengthy calculations down the propagation tree.
              // If no value was present before, then nullify the hash. No value has a null hash.
              if (!this._data[path]) {
                hash = null;
              } else {
                hash = _.hash(this._data[path]);
                diff = _.diff(this._data[path], value);
              }
              context$2$0.next = 6;
              return Object.keys(this.subscribers[path]) // jshint ignore:line
              .map(function (session) {
                return session.update(path, { hash: hash, diff: diff });
              });
            case 6:
            case "end": return context$2$0.stop();
          }
        }, callee$1$0, this);
      })
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
      value: regeneratorRuntime.mark(function callee$1$1(room, params) {
        var _this8, json;
        return regeneratorRuntime.wrap(function callee$1$1$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {
            case 0: _this8 = this;
              // jshint ignore:line
              _.dev(function () {
                return room.should.be.a.String && params.should.be.an.Object && (_this8.rooms.match(room) !== null).should.be.ok;
              });
              if (!this.listeners[room]) {
                context$2$0.next = 6;
                break;
              }
              // Encode as early as possible to avoid duplicating
              // this operation down the propagation tree.
              json = JSON.stringify(params);
              context$2$0.next = 6;
              return Object.keys(this.listeners[room]) // jshint ignore:line
              .map(function (session) {
                return session.emit(room, json);
              });
            case 6:
            case "end": return context$2$0.stop();
          }
        }, callee$1$1, this);
      })
    },
    listenTo: {
      writable: true,
      value: function (room, session) {
        var _this9 = this;
        _.dev(function () {
          return room.should.be.a.String && session.should.be.an.instanceOf(Session);
        });
        var createdRoom;
        if (this.listeners[room]) {
          // Fail early to avoid creating a leaky entry in this.listeners
          _.dev(function () {
            return _this9.listeners[room][session.id].should.not.be.ok;
          });
          createdRoom = false;
        } else {
          this.listeners[room] = {};
          createdRoom = true;
        }
        this.listeners[room][session.id] = session;
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
          delete this.listeners[room];
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
        if (!this.actions[action]) {
          this.actions[action] = [];
          createdAction = true;
        }
        this.actions[action].push(handler);
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
        this.actions[action] = _.without(this.actions[action], handler);
        var deletedAction = false;
        if (this.actions[action].length === 0) {
          delete this.actions[action];
          deletedAction = true;
        }
        return { deletedAction: deletedAction };
      }
    },
    dispatch: {
      writable: true,
      value: regeneratorRuntime.mark(function callee$1$2(action, params) {
        var _this13;
        return regeneratorRuntime.wrap(function callee$1$2$(context$2$0) {
          while (1) switch (context$2$0.prev = context$2$0.next) {
            case 0: _this13 = this;
              if (params === undefined) params = {};
              // jshint ignore:line
              _.dev(function () {
                return action.should.be.a.String && params.should.be.an.Object && params.guid.should.be.a.String && (_this13.actions[action].match(action) !== null).should.be.ok;
              });
              context$2$0.next = 5;
              return (this.actionHandlers[action] ? this.actionHandlers[action] : []) // jshint ignore:line
              .map(function (handler) {
                return handler.call(null, params);
              });
            case 5: return context$2$0.abrupt("return", context$2$0.sent);
            case 6:
            case "end": return context$2$0.stop();
          }
        }, callee$1$2, this);
      })
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
  app: null,
  server: null,

  _data: null,

  connections: null,
  sessions: null,

  subscribers: null,
  listeners: null,
  actionHandlers: null });

Connection = require("./Connection")({ UplinkSimpleServer: UplinkSimpleServer });
Session = require("./Session")({ Connection: Connection, UplinkSimpleServer: UplinkSimpleServer });

module.exports = UplinkSimpleServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9VcGxpbmtTaW1wbGVTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLElBQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxJQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsY0FBYyxDQUFDO0FBQzlELElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2xELElBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzs7QUFFN0IsSUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUMzRCxJQUFJLFVBQVUsRUFBRSxPQUFPLENBQUM7O0FBRXhCLElBQU0sVUFBVSxHQUFHO0FBQ2pCLFlBQVUsRUFBQSxVQUFDLE1BQU0sRUFBRTs7QUFDakIsS0FBQyxDQUFDLEdBQUcsQ0FBQzthQUFNLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUNqRCxNQUFLLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtLQUFBLENBQzdDLENBQUM7QUFDRixRQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDdkUsVUFBTSxD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QUVaLE9BQUssRUFBRSxJQUFJOztBQUVYLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFVBQVEsRUFBRSxJQUFJOztBQUVkLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFdBQVMsRUFBRSxJQUFJO0FBQ2YsZ0JBQWMsRUFBRSxJQUFJLEVBQ3JCLENBQUMsQ0FBQzs7QUFFSCxVQUFVLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLEVBQWxCLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUM3RCxPQUFPLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFWLFVBQVUsRUFBRSxrQkFBa0IsRUFBbEIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDOztBQUVuRSxNQUFNLENBQUMsT0FBTyxHQUFHLGtCQUFrQixDQUFDIiwiZmlsZSI6IlVwbGlua1NpbXBsZVNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbInJlcXVpcmUoJzZ0bzUvcG9seWZpbGwnKTtcbnZhciBQcm9taXNlID0gcmVxdWlyZSgnYmx1ZWJpcmQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuY29uc3QgYm9keVBhcnNlciA9IHJlcXVpcmUoJ2JvZHktcGFyc2VyJyk7XG5jb25zdCBDb25zdGFudFJvdXRlciA9IHJlcXVpcmUoJ25leHVzLXJvdXRlcicpLkNvbnN0YW50Um91dGVyO1xuY29uc3QgSFRUUEV4Y2VwdGlvbnMgPSByZXF1aXJlKCdodHRwLWV4Y2VwdGlvbnMnKTtcbmNvbnN0IGh0dHAgPSByZXF1aXJlKCdodHRwJyk7XG5cbmNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5sZXQgQ29ubmVjdGlvbiwgU2Vzc2lvbjtcblxuY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgY29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICBfLmRldigoKSA9PiBpbnN0YW5jZU9mU29ja2V0SU8oc29ja2V0KS5zaG91bGQuYmUub2sgJiZcbiAgICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXS5zaG91bGQubm90LmJlLm9rXG4gICAgKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0gPSBuZXcgQ29ubmVjdGlvbih7IHNvY2tldCwgdXBsaW5rOiB0aGlzIH0pO1xuICAgIHNvY2tldC5vbignZGlzY29ubmVjdCcsICgpID0+IGlvSGFuZGxlcnMuZGlzY29ubmVjdGlvbi5jYWxsKHRoaXMsIHNvY2tldCkpO1xuICB9LFxuXG4gIGRpc2Nvbm5lY3Rpb24oc29ja2V0KSB7XG4gICAgXy5kZXYoKCkgPT4gc29ja2V0LnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHNvY2tldC5vbi5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgc29ja2V0LmVtaXQuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHNvY2tldC5pZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXS5zaG91bGQuYmUuZXhhY3RseShzb2NrZXQpXG4gICAgKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uZGVzdHJveSgpO1xuICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF07XG4gIH0sXG59O1xuXG4vLyBNb3N0IHB1YmxpYyBtZXRob2RzIGV4cG9zZSBhbiBhc3luYyBBUElcbi8vIHRvIGVuZm9yY2UgY29uc2lzdGVuY2Ugd2l0aCBhc3luYyBkYXRhIGJhY2tlbmRzLFxuLy8gZWcuIHJlZGlzIG9yIG15c3FsLCBhbHRob3VnaCBpbiB0aGlzIGltcGxlbWVudGF0aW9uXG4vLyB0aGUgYmFja2VuZCByZXNpZGVzIGluIG1lbW9yeSAoYSBzaW1wbGUgT2JqZWN0IGFjdGluZ1xuLy8gYXMgYW4gYXNzb2NpYXRpdmUgbWFwKS5cbmNsYXNzIFVwbGlua1NpbXBsZVNlcnZlciB7XG4gIC8vIHN0b3Jlcywgcm9vbXMsIGFuZCBhY3Rpb25zIGFyZSB0aHJlZSB3aGl0ZWxpc3RzIG9mXG4gIC8vIHN0cmluZyBwYXR0ZXJucy4gRWFjaCBpcyBhbiBhcnJheSB0aGF0IHdpbGwgYmUgcGFzc2VkXG4gIC8vIHRvIHRoZSBSb3V0ZXIgY29uc3RydWN0b3IuXG4gIGNvbnN0cnVjdG9yKHsgcGlkLCBzdG9yZXMsIHJvb21zLCBhY3Rpb25zLCBhcHAgfSkge1xuICAgIF8uZGV2KCgpID0+IHN0b3Jlcy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIHJvb21zLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgYWN0aW9ucy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIGFwcC5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAvLyBEdWNrdHlwZS1jaGVjayBmb3IgYW4gZXhwcmVzcy1saWtlIGFwcFxuICAgICAgYXBwLmdldC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgYXBwLnBvc3Quc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIC8vIEhlcmUgd2UgdXNlIENvbnN0YW50Um91dGVyIGluc3RhbmNlczsgd2Ugb25seSBuZWVkXG4gICAgLy8gdG8ga25vdyBpZiBhIGdpdmVuIHN0cmluZyBtYXRjaCBhIHJlZ2lzdGVyZWQgcGF0dGVybi5cbiAgICB0aGlzLnN0b3JlcyA9IG5ldyBDb25zdGFudFJvdXRlcihzdG9yZXMpO1xuICAgIHRoaXMucm9vbXMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIocm9vbXMpO1xuICAgIHRoaXMuYWN0aW9ucyA9IG5ldyBDb25zdGFudFJvdXRlcihhY3Rpb25zKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnNlcnZlciA9IGh0dHAuU2VydmVyKGFwcCk7XG5cbiAgICAvLyBTdG9yZSBkYXRhIGNhY2hlXG4gICAgdGhpcy5fZGF0YSA9IHt9O1xuXG4gICAgLy8gQ29ubmVjdGlvbnMgcmVwcmVzZW50IGFjdHVhbCBsaXZpbmcgc29ja2V0LmlvIGNvbm5lY3Rpb25zLlxuICAgIC8vIFNlc3Npb24gcmVwcmVzZW50IGEgcmVtb3RlIFVwbGluayBjbGllbnQgaW5zdGFuY2UsIHdpdGggYSB1bmlxdWUgZ3VpZC5cbiAgICAvLyBUaGUgY29uY2VwdCBvZiBzZXNzaW9uIGVuZm9yY2VzIGNvbnNpc3RlbmN5IGJldHdlZW4gaXRzIGF0dGFjaGVkIHNvY2tldCBjb25uZWN0aW9ucyxcbiAgICAvLyBhbmQgSFRUUCByZXF1ZXN0cy5cbiAgICAvLyBBIHNpbmdsZSBzZXNzaW9uIGNhbiBiZSBhdHRhY2hlZCB0byB6ZXJvIG9yIG1vcmUgdGhhbiBvbmUgY29ubmVjdGlvbi5cbiAgICAvLyBVcGxpbmsgZnJhbWVzIGFyZSByZWNlaXZlZCBmcm9tIGFuZCBzZW50IHRvIHNlc3Npb25zLCBub3QgY29ubmVjdGlvbi5cbiAgICAvLyBFYWNoIHNlc3Npb24gbXVzdCBrZWVwIHJlZmVyZW5jZXMgdG8gaXRzIGF0dGFjaGVkIGNvbm5lY3Rpb25zIGFuZCBwcm9wYWdhdGVcbiAgICAvLyByZWxldmFudCBmcmFtZXMgYWNjb3JkaW5nbHkuXG4gICAgdGhpcy5jb25uZWN0aW9ucyA9IHt9O1xuICAgIHRoaXMuc2Vzc2lvbnMgPSB7fTtcblxuICAgIHRoaXMuc3Vic2NyaWJlcnMgPSB7fTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuYWN0aW9uSGFuZGxlcnMgPSB7fTtcbiAgfVxuXG4gIGxpc3Rlbihwb3J0KSB7XG4gICAgXy5kZXYoKCkgPT4gcG9ydC5zaG91bGQuYmUuYS5OdW1iZXIpO1xuICAgIGxldCB7IGFwcCwgc2VydmVyIH0gPSB0aGlzO1xuICAgIC8vIHNvY2tldC5pbyBoYW5kbGVycyBhcmUgaW5zdGFsbGVkIGZpcnN0LCB0byBwcmUtZW1wdCBzb21lIHBhdGhzIG92ZXIgdGhlIGh0dHAgaGFuZGxlcnMuXG4gICAgbGV0IGlvID0gcmVxdWlyZSgnc29ja2V0LmlvJykoc2VydmVyKTtcbiAgICAvLyBEZWxlZ2F0ZSB0byBzdGF0aWMgaW9IYW5kbGVyIG1ldGhvZHMsIGJ1dCBjYWxsIHRoZW0gd2l0aCBjb250ZXh0LlxuICAgIE9iamVjdC5rZXlzKGlvSGFuZGxlcnMpXG4gICAgLmZvckVhY2goKGV2ZW50KSA9PiBpby5vbihldmVudCwgZnVuY3Rpb24oKSB7IGlvSGFuZGxlcnNbZXZlbnRdLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IH0pKTtcblxuICAgIC8vIEZldGNoIGZyb20gc3RvcmVcbiAgICBhcHAuZ2V0KCcqJyxcbiAgICAgIC8vIENoZWNrIHRoYXQgdGhpcyBzdG9yZSBwYXRoIGlzIHdoaXRlbGlzdGVkXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+IHRoaXMuc3RvcmVzLm1hdGNoKHJlcS5wYXRoKSA9PT0gbnVsbCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuTm90Rm91bmQocmVxLnBhdGgpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcykgPT4gdGhpcy5wdWxsKHJlcS5wYXRoKVxuICAgICAgICAudGhlbigodmFsdWUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiAodmFsdWUgPT09IG51bGwgfHwgXy5pc09iamVjdCh2YWx1ZSkpLnNob3VsZC5iZS5vayk7XG4gICAgICAgICAgcmVzLnN0YXR1cygyMDApLnR5cGUoJ2FwcGxpY2F0aW9uL2pzb24nKS5zZW5kKHZhbHVlKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiB7IGNvbnNvbGUuZXJyb3IoZXJyLCBlcnIuc3RhY2spOyB9KTtcbiAgICAgICAgICBpZihlcnIgaW5zdGFuY2VvZiBIVFRQRXhjZXB0aW9ucy5IVFRQRXJyb3IpIHtcbiAgICAgICAgICAgIEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyOiBlcnIudG9TdHJpbmcoKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIERpc3BhdGNoIGFjdGlvblxuICAgIGFwcC5wb3N0KCcqJyxcbiAgICAgIC8vIFBhcnNlIGJvZHkgYXMgSlNPTlxuICAgICAgYm9keVBhcnNlci5qc29uKCksXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgYWN0aW9uIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5hY3Rpb25zLm1hdGNoKHJlcS5wYXRoKSA9PT0gbnVsbCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuTm90Rm91bmQocmVxLnBhdGgpKSA6IG5leHQoKSxcbiAgICAgIC8vIHBhcmFtcyBzaG91bGQgYmUgcHJlc2VudFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhXy5pc09iamVjdChyZXEuYm9keS5wYXJhbXMpID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5CYWRSZXF1ZXN0KCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbVxcJycpKSA6IG5leHQoKSxcbiAgICAgIC8vIENoZWNrIGZvciBhIHZhbGlkLCBhY3RpdmUgc2Vzc2lvbiBndWlkIGluIHBhcmFtc1xuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhcmVxLmJvZHkucGFyYW1zLmd1aWQgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLlVuYXV0aG9yaXplZCgnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogXFwncGFyYW1zXFwnLlxcJ2d1aWRcXCcnKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICF0aGlzLmlzQWN0aXZlU2Vzc2lvbihyZXEuYm9keS5wYXJhbXMuZ3VpZCkgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdJbnZhbGlkIFxcJ2d1aWRcXCcuJykpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLmRpc3BhdGNoKHJlcS5wYXRoLCByZXEuYm9keS5wYXJhbXMpXG4gICAgICAudGhlbigocmVzdWx0KSA9PiByZXMuc3RhdHVzKDIwMCkuanNvbihyZXN1bHQpKVxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiB7IGNvbnNvbGUuZXJyb3IoZXJyLCBlcnIuc3RhY2spOyB9KTtcbiAgICAgICAgICBpZihlcnIgaW5zdGFuY2VvZiBIVFRQRXhjZXB0aW9ucy5IVFRQRXJyb3IpIHtcbiAgICAgICAgICAgIEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyOiBlcnIudG9TdHJpbmcoKSB9KTtcbiAgICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG4gICAgc2VydmVyLmxpc3Rlbihwb3J0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCkge1xuICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIHJldHVybiB0aGlzLl9kYXRhW3BhdGhdO1xuICAgIH0pO1xuICB9XG5cbiAgKnVwZGF0ZShwYXRoLCB2YWx1ZSkgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdmFsdWUuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgKHRoaXMuc3RvcmVzLm1hdGNoKHBhdGgpICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBoYXNoLCBkaWZmO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIERpZmYgYW5kIEpTT04tZW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAvLyB0aGVzZSBsZW5ndGh5IGNhbGN1bGF0aW9ucyBkb3duIHRoZSBwcm9wYWdhdGlvbiB0cmVlLlxuICAgICAgLy8gSWYgbm8gdmFsdWUgd2FzIHByZXNlbnQgYmVmb3JlLCB0aGVuIG51bGxpZnkgdGhlIGhhc2guIE5vIHZhbHVlIGhhcyBhIG51bGwgaGFzaC5cbiAgICAgIGlmKCF0aGlzLl9kYXRhW3BhdGhdKSB7XG4gICAgICAgIGhhc2ggPSBudWxsO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGhhc2ggPSBfLmhhc2godGhpcy5fZGF0YVtwYXRoXSk7XG4gICAgICAgIGRpZmYgPSBfLmRpZmYodGhpcy5fZGF0YVtwYXRoXSwgdmFsdWUpO1xuICAgICAgfVxuICAgICAgLy8gRGlyZWN0bHkgcGFzcyB0aGUgcGF0Y2gsIHNlc3Npb25zIGRvbid0IG5lZWQgdG8gYmUgYXdhcmVcbiAgICAgIC8vIG9mIHRoZSBhY3R1YWwgY29udGVudHM7IHRoZXkgb25seSBuZWVkIHRvIGZvcndhcmQgdGhlIGRpZmZcbiAgICAgIC8vIHRvIHRoZWlyIGFzc29jaWF0ZWQgY2xpZW50cy5cbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi51cGRhdGUocGF0aCwgeyBoYXNoLCBkaWZmIH0pKTtcbiAgICB9XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBjcmVhdGVkUGF0aDtcbiAgICBpZih0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGxlYWt5IGVudHJ5IGluIHRoaXMuc3Vic2NyaWJlcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF0uc2hvdWxkLm5vdC5iZS5vayk7XG4gICAgICBjcmVhdGVkUGF0aCA9IGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0gPSB7fTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFBhdGggfTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlRnJvbShwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbikgJiZcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRQYXRoID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF07XG4gICAgaWYoT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXTtcbiAgICAgIGRlbGV0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gdW5zYnVzY3JpYmUgZnJvbSBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGRlbGV0ZWRQYXRoIH07XG4gIH1cblxuICAqZW1pdChyb29tLCBwYXJhbXMpIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAodGhpcy5yb29tcy5tYXRjaChyb29tKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBsZXQganNvbjtcbiAgICBpZih0aGlzLmxpc3RlbmVyc1tyb29tXSkge1xuICAgICAgLy8gRW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAvLyB0aGlzIG9wZXJhdGlvbiBkb3duIHRoZSBwcm9wYWdhdGlvbiB0cmVlLlxuICAgICAganNvbiA9IEpTT04uc3RyaW5naWZ5KHBhcmFtcyk7XG4gICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAubWFwKChzZXNzaW9uKSA9PiBzZXNzaW9uLmVtaXQocm9vbSwganNvbikpO1xuICAgIH1cbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRSb29tO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGEgbGVha3kgZW50cnkgaW4gdGhpcy5saXN0ZW5lcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdLnNob3VsZC5ub3QuYmUub2spO1xuICAgICAgY3JlYXRlZFJvb20gPSBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXSA9IHt9O1xuICAgICAgY3JlYXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pICYmXG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcbiAgICAgIGRlbGV0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gdW5zdXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFJvb20gfTtcbiAgfVxuXG4gIGFkZEFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgKHRoaXMuYWN0aW9ucy5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBjcmVhdGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYoIXRoaXMuYWN0aW9uc1thY3Rpb25dKSB7XG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXSA9IFtdO1xuICAgICAgY3JlYXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dLnB1c2goaGFuZGxlcik7XG4gICAgcmV0dXJuIHsgY3JlYXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgcmVtb3ZlQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXS5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIF8uY29udGFpbnModGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBsaXN0IG9mIGhhbmRsZXJzIGhlcmU7XG4gICAgLy8gV2UgZG9uJ3QgZXhwZWN0IHRvIGhhdmUgX3RoYXRfIG11Y2ggZGlmZmVyZW50IGhhbmRsZXJzXG4gICAgLy8gZm9yIGEgZ2l2ZW4gYWN0aW9uLCBzbyBwZXJmb3JtYW5jZSBpbXBsaWNhdGlvbnNcbiAgICAvLyBzaG91bGQgYmUgY29tcGxldGVseSBuZWdsaWdpYmxlLlxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dID0gXy53aXRob3V0KHRoaXMuYWN0aW9uc1thY3Rpb25dLCBoYW5kbGVyKTtcbiAgICBsZXQgZGVsZXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKHRoaXMuYWN0aW9uc1thY3Rpb25dLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMuYWN0aW9uc1thY3Rpb25dO1xuICAgICAgZGVsZXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiB7IGRlbGV0ZWRBY3Rpb24gfTtcbiAgfVxuXG4gICpkaXNwYXRjaChhY3Rpb24sIHBhcmFtcyA9IHt9KSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBwYXJhbXMuZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICh0aGlzLmFjdGlvbnNbYWN0aW9uXS5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIC8vIFJ1biBhbGwgaGFuZGxlcnMgY29uY3VycmVudGx5IGFuZCByZXR1cm4gdGhlIGxpc3Qgb2YgdGhlIHJlc3VsdHNcbiAgICAvLyAoZW1wdHkgbGlzdCBpZiBubyBoYW5kbGVycykuXG4gICAgLy8gSWYgYW4gYWN0aW9uIGhhbmRsZXIgdGhyb3dzLCB0aGVuIGRpc3BhdGNoIHdpbGwgdGhyb3csIGJ1dCB0aGUgb3RoZXJzIGhhbmRsZXJzXG4gICAgLy8gY2FuIHN0aWxsIHN1Y2NlZWQuXG4gICAgcmV0dXJuIHlpZWxkICh0aGlzLmFjdGlvbkhhbmRsZXJzW2FjdGlvbl0gPyB0aGlzLmFjdGlvbkhhbmRsZXJzW2FjdGlvbl0gOiBbXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgLm1hcCgoaGFuZGxlcikgPT4gaGFuZGxlci5jYWxsKG51bGwsIHBhcmFtcykpO1xuICB9XG5cbiAgaGFzU2Vzc2lvbihndWlkKSB7XG4gICAgcmV0dXJuICEhdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGNyZWF0ZVNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBpZighdGhpcy5zZXNzaW9uc1tndWlkXSkge1xuICAgICAgdGhpcy5zZXNzaW9uc1tndWlkXSA9IHRoaXMuc2Vzc2lvbkNyZWF0ZWQobmV3IFNlc3Npb24oeyBndWlkLCB1cGxpbms6IHRoaXMgfSkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGRlbGV0ZVNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBsZXQgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGluaXRpYWxpemVcbiAgLy8gc2Vzc2lvbi1yZWxhdGVkIHJlc291cmNlcy5cbiAgLy8gSW1wbGVtZW50YXRpb24gc2hvdWxkIHJldHVybiBhIFByb21pc2UgZm9yIHRoZSBjcmVhdGVkIHNlc3Npb24uXG4gIHNlc3Npb25DcmVhdGVkKHNlc3Npb24pIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNlc3Npb24pO1xuICB9XG5cbiAgLy8gTm8tb3AgcGxhY2Vob2xkZXIsIHRvIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0byBjbGVhbi11cFxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGRlbGV0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rU2ltcGxlU2VydmVyLnByb3RvdHlwZSwge1xuICBzdG9yZXM6IG51bGwsXG4gIHJvb21zOiBudWxsLFxuICBhY3Rpb25zOiBudWxsLFxuICBhcHA6IG51bGwsXG4gIHNlcnZlcjogbnVsbCxcblxuICBfZGF0YTogbnVsbCxcblxuICBjb25uZWN0aW9uczogbnVsbCxcbiAgc2Vzc2lvbnM6IG51bGwsXG5cbiAgc3Vic2NyaWJlcnM6IG51bGwsXG4gIGxpc3RlbmVyczogbnVsbCxcbiAgYWN0aW9uSGFuZGxlcnM6IG51bGwsXG59KTtcblxuQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vQ29ubmVjdGlvbicpKHsgVXBsaW5rU2ltcGxlU2VydmVyIH0pO1xuU2Vzc2lvbiA9IHJlcXVpcmUoJy4vU2Vzc2lvbicpKHsgQ29ubmVjdGlvbiwgVXBsaW5rU2ltcGxlU2VydmVyIH0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVwbGlua1NpbXBsZVNlcnZlcjtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==