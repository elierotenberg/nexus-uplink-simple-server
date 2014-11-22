"use strict";

var _classProps = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = require("bluebird");var __DEV__ = (process.env.NODE_ENV !== "production");
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
      return instanceOfSocketIO(socket).should.be.ok && _this.connections.should.not.have.property(socket.id);
    });
    this.connections[socket.id] = new Connection({ socket: socket, uplink: this });
    socket.on("disconnect", function () {
      return ioHandlers.disconnection.call(_this, socket);
    });
  },

  disconnection: function (socket) {
    var _this2 = this;
    _.dev(function () {
      return socket.should.be.an.Object && socket.on.should.be.a.Function && socket.emit.should.be.a.Function && socket.id.should.be.a.String && _this2.connections.should.have.property(socket.id, socket);
    });
    this.connections[socket.id].destroy();
    delete this.connections[socket.id];
  } };

var UplinkSimpleServer = (function () {
  var UplinkSimpleServer =
  // stores, rooms, and actions are three whitelists of
  // string patterns. Each is an array that will be passed
  // to the Router constructor.
  function UplinkSimpleServer(_ref) {
    var pid = _ref.pid;
    var stores = _ref.stores;
    var rooms = _ref.rooms;
    var actions = _ref.actions;
    var app = _ref.app;
    _.dev(function () {
      return (pid !== undefined).should.be.ok && stores.should.be.an.Array && rooms.should.be.an.Array && actions.should.be.an.Array &&
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
      value: function (port, fn) {
        var _this3 = this;
        if (fn === undefined) fn = _.noop;
        return (function () {
          _.dev(function () {
            return port.should.be.a.Number;
          });
          var _ref2 = _this3;
          var app = _ref2.app;
          var server = _ref2.server;
          // socket.io handlers are installed first, to pre-empt some paths over the http handlers.
          var io = require("socket.io")(server);
          // Delegate to static ioHandler methods, but call them with context.
          Object.keys(ioHandlers).forEach(function (event) {
            return io.on(event, _.scope(ioHandlers[event], _this3));
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
              _.dev(function () {
                return console.warn("GET " + req.path, value);
              });
              res.status(200).type("application/json").send(value);
            })["catch"](function (e) {
              _.dev(function () {
                return console.warn("GET " + req.path, e);
              });
              if (e instanceof HTTPExceptions.HTTPError) {
                HTTPExceptions.forward(res, e);
              } else {
                res.status(500).json({ err: e.toString() });
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
              _.dev(function () {
                return console.warn("POST " + req.path, req.body, result);
              });
              res.status(200).json(result);
            })["catch"](function (e) {
              _.dev(function () {
                return console.warn("POST " + req.path, req.body, e);
              });
              if (e instanceof HTTPExceptions.HTTPError) {
                HTTPExceptions.forward(res, e);
              } else {
                res.status(500).json({ err: e.toString() });
              }
            });
          });
          server.listen(port, fn);
          return _this3;
        })();
      }
    },
    pull: {
      writable: true,
      value: function (path) {
        var _this4 = this;
        return Promise["try"](function () {
          _.dev(function () {
            return path.should.be.a.String && (_this4.stores.match(path) !== null).should.be.ok;
          });
          return _this4._data[path];
        });
      }
    },
    update: {
      writable: true,
      value: regeneratorRuntime.mark(function _callee(path, value) {
        var _this5 = this;
        var hash, diff;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (true) switch (_context.prev = _context.next) {
            case 0: // jshint ignore:line
              _.dev(function () {
                return path.should.be.a.String && value.should.be.an.Object && (_this5.stores.match(path) !== null).should.be.ok;
              });
              if (!_this5.subscribers[path]) {
                _context.next = 5;
                break;
              }
              // Diff and JSON-encode as early as possible to avoid duplicating
              // these lengthy calculations down the propagation tree.
              // If no value was present before, then nullify the hash. No value has a null hash.
              if (!_this5._data[path]) {
                hash = null;
              } else {
                hash = _.hash(_this5._data[path]);
                diff = _.diff(_this5._data[path], value);
              }
              _context.next = 5;
              return Object.keys(_this5.subscribers[path]) // jshint ignore:line
              .map(function (session) {
                return session.update(path, { hash: hash, diff: diff });
              });
            case 5:
            case "end": return _context.stop();
          }
        }, _callee, this);
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
            return _this6.subscribers[path].should.not.have.property(session.id);
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
          return path.should.be.a.String && session.should.be.an.instanceOf(Session) && _this7.subscribers.should.have.property(path) && _this7.subscribers[path].should.be.an.Object && _this7.subscribers[path].should.have.property(session.id, session);
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
      value: regeneratorRuntime.mark(function _callee2(room, params) {
        var _this8 = this;
        var json;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (true) switch (_context2.prev = _context2.next) {
            case 0: // jshint ignore:line
              _.dev(function () {
                return room.should.be.a.String && params.should.be.an.Object && (_this8.rooms.match(room) !== null).should.be.ok;
              });
              if (!_this8.listeners[room]) {
                _context2.next = 5;
                break;
              }
              // Encode as early as possible to avoid duplicating
              // this operation down the propagation tree.
              json = _.prollystringify(params);
              _context2.next = 5;
              return Object.keys(_this8.listeners[room]) // jshint ignore:line
              .map(function (session) {
                return session.emit(room, json);
              });
            case 5:
            case "end": return _context2.stop();
          }
        }, _callee2, this);
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
            return _this9.listeners[room].should.not.have.property(session.id);
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
          return room.should.be.a.String && session.should.be.an.instanceOf(Session) && _this10.listeners[room].should.have.property(session.id, session);
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
      value: regeneratorRuntime.mark(function _callee3(action, params) {
        var _this13 = this;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (true) switch (_context3.prev = _context3.next) {
            case 0:
              if (params === undefined) params = {};
              // jshint ignore:line
              _.dev(function () {
                return action.should.be.a.String && params.should.be.an.Object && params.guid.should.be.a.String && (_this13.actions[action].match(action) !== null).should.be.ok;
              });
              _context3.next = 4;
              return (_this13.actionHandlers[action] ? _this13.actionHandlers[action] : []) // jshint ignore:line
              .map(function (handler) {
                return handler.call(null, params);
              });
            case 4: return _context3.abrupt("return", _context3.sent);
            case 5:
            case "end": return _context3.stop();
          }
        }, _callee3, this);
      })
    },
    hasSession: {
      writable: true,
      value: function (guid) {
        return !!this.sessions[guid];
      }
    },
    getSession: {
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


      // No-op placeholder, to be overridden by subclasses to initialize
      // session-related resources.
      // Implementation should return a Promise for the created session.
      value: function (session) {
        return Promise.resolve(session);
      }
    },
    sessionDeleted: {
      writable: true,


      // No-op placeholder, to be overridden by subclasses to clean-up
      // session-related resources.
      // Implementation should return a Promise for the deleted session.
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
//# sourceMappingURL=data:application/json;base64,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QUNqQzs7QUFLRCxrQkFBYzs7Ozs7OzthQUFBLFVBQUMsT0FBTyxFQUFFO0FBQ3RCLGVBQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztPQUNqQzs7OztTQWxURyxrQkFBa0I7OztBQXFUeEIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLEVBQUU7QUFDckMsUUFBTSxFQUFFLElBQUk7QUFDWixPQUFLLEVBQUUsSUFBSTtBQUNYLFNBQU8sRUFBRSxJQUFJO0FBQ2IsS0FBRyxFQUFFLElBQUk7QUFDVCxRQUFNLEVBQUUsSUFBSTs7QUFFWixPQUFLLEVBQUUsSUFBSTs7QUFFWCxhQUFXLEVBQUUsSUFBSTtBQUNqQixVQUFRLEVBQUUsSUFBSTs7QUFFZCxhQUFXLEVBQUUsSUFBSTtBQUNqQixXQUFTLEVBQUUsSUFBSTtBQUNmLGdCQUFjLEVBQUUsSUFBSSxFQUNyQixDQUFDLENBQUM7O0FBRUgsVUFBVSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixFQUFsQixrQkFBa0IsRUFBRSxDQUFDLENBQUM7QUFDN0QsT0FBTyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLFVBQVUsRUFBVixVQUFVLEVBQUUsa0JBQWtCLEVBQWxCLGtCQUFrQixFQUFFLENBQUMsQ0FBQzs7QUFFbkUsTUFBTSxDQUFDLE9BQU8sR0FBRyxrQkFBa0IsQ0FBQyIsImZpbGUiOiJVcGxpbmtTaW1wbGVTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcbmNvbnN0IGJvZHlQYXJzZXIgPSByZXF1aXJlKCdib2R5LXBhcnNlcicpO1xuY29uc3QgQ29uc3RhbnRSb3V0ZXIgPSByZXF1aXJlKCduZXh1cy1yb3V0ZXInKS5Db25zdGFudFJvdXRlcjtcbmNvbnN0IEhUVFBFeGNlcHRpb25zID0gcmVxdWlyZSgnaHR0cC1leGNlcHRpb25zJyk7XG5jb25zdCBodHRwID0gcmVxdWlyZSgnaHR0cCcpO1xuXG5jb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xubGV0IENvbm5lY3Rpb24sIFNlc3Npb247XG5cbmNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gIGNvbm5lY3Rpb24oc29ja2V0KSB7XG4gICAgXy5kZXYoKCkgPT4gaW5zdGFuY2VPZlNvY2tldElPKHNvY2tldCkuc2hvdWxkLmJlLm9rICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zLnNob3VsZC5ub3QuaGF2ZS5wcm9wZXJ0eShzb2NrZXQuaWQpXG4gICAgKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0gPSBuZXcgQ29ubmVjdGlvbih7IHNvY2tldCwgdXBsaW5rOiB0aGlzIH0pO1xuICAgIHNvY2tldC5vbignZGlzY29ubmVjdCcsICgpID0+IGlvSGFuZGxlcnMuZGlzY29ubmVjdGlvbi5jYWxsKHRoaXMsIHNvY2tldCkpO1xuICB9LFxuXG4gIGRpc2Nvbm5lY3Rpb24oc29ja2V0KSB7XG4gICAgXy5kZXYoKCkgPT4gc29ja2V0LnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHNvY2tldC5vbi5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgc29ja2V0LmVtaXQuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHNvY2tldC5pZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMuc2hvdWxkLmhhdmUucHJvcGVydHkoc29ja2V0LmlkLCBzb2NrZXQpXG4gICAgKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uZGVzdHJveSgpO1xuICAgIGRlbGV0ZSB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF07XG4gIH0sXG59O1xuXG4vLyBNb3N0IHB1YmxpYyBtZXRob2RzIGV4cG9zZSBhbiBhc3luYyBBUElcbi8vIHRvIGVuZm9yY2UgY29uc2lzdGVuY2Ugd2l0aCBhc3luYyBkYXRhIGJhY2tlbmRzLFxuLy8gZWcuIHJlZGlzIG9yIG15c3FsLCBhbHRob3VnaCBpbiB0aGlzIGltcGxlbWVudGF0aW9uXG4vLyB0aGUgYmFja2VuZCByZXNpZGVzIGluIG1lbW9yeSAoYSBzaW1wbGUgT2JqZWN0IGFjdGluZ1xuLy8gYXMgYW4gYXNzb2NpYXRpdmUgbWFwKS5cbmNsYXNzIFVwbGlua1NpbXBsZVNlcnZlciB7XG4gIC8vIHN0b3Jlcywgcm9vbXMsIGFuZCBhY3Rpb25zIGFyZSB0aHJlZSB3aGl0ZWxpc3RzIG9mXG4gIC8vIHN0cmluZyBwYXR0ZXJucy4gRWFjaCBpcyBhbiBhcnJheSB0aGF0IHdpbGwgYmUgcGFzc2VkXG4gIC8vIHRvIHRoZSBSb3V0ZXIgY29uc3RydWN0b3IuXG4gIGNvbnN0cnVjdG9yKHsgcGlkLCBzdG9yZXMsIHJvb21zLCBhY3Rpb25zLCBhcHAgfSkge1xuICAgIF8uZGV2KCgpID0+IChwaWQgIT09IHVuZGVmaW5lZCkuc2hvdWxkLmJlLm9rICYmXG4gICAgICBzdG9yZXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICByb29tcy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIGFjdGlvbnMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICAvLyBEdWNrdHlwZS1jaGVjayBmb3IgYW4gZXhwcmVzcy1saWtlIGFwcFxuICAgICAgYXBwLmdldC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgYXBwLnBvc3Quc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIC8vIEhlcmUgd2UgdXNlIENvbnN0YW50Um91dGVyIGluc3RhbmNlczsgd2Ugb25seSBuZWVkXG4gICAgLy8gdG8ga25vdyBpZiBhIGdpdmVuIHN0cmluZyBtYXRjaCBhIHJlZ2lzdGVyZWQgcGF0dGVybi5cbiAgICB0aGlzLnN0b3JlcyA9IG5ldyBDb25zdGFudFJvdXRlcihzdG9yZXMpO1xuICAgIHRoaXMucm9vbXMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIocm9vbXMpO1xuICAgIHRoaXMuYWN0aW9ucyA9IG5ldyBDb25zdGFudFJvdXRlcihhY3Rpb25zKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnNlcnZlciA9IGh0dHAuU2VydmVyKGFwcCk7XG5cbiAgICAvLyBTdG9yZSBkYXRhIGNhY2hlXG4gICAgdGhpcy5fZGF0YSA9IHt9O1xuXG4gICAgLy8gQ29ubmVjdGlvbnMgcmVwcmVzZW50IGFjdHVhbCBsaXZpbmcgc29ja2V0LmlvIGNvbm5lY3Rpb25zLlxuICAgIC8vIFNlc3Npb24gcmVwcmVzZW50IGEgcmVtb3RlIFVwbGluayBjbGllbnQgaW5zdGFuY2UsIHdpdGggYSB1bmlxdWUgZ3VpZC5cbiAgICAvLyBUaGUgY29uY2VwdCBvZiBzZXNzaW9uIGVuZm9yY2VzIGNvbnNpc3RlbmN5IGJldHdlZW4gaXRzIGF0dGFjaGVkIHNvY2tldCBjb25uZWN0aW9ucyxcbiAgICAvLyBhbmQgSFRUUCByZXF1ZXN0cy5cbiAgICAvLyBBIHNpbmdsZSBzZXNzaW9uIGNhbiBiZSBhdHRhY2hlZCB0byB6ZXJvIG9yIG1vcmUgdGhhbiBvbmUgY29ubmVjdGlvbi5cbiAgICAvLyBVcGxpbmsgZnJhbWVzIGFyZSByZWNlaXZlZCBmcm9tIGFuZCBzZW50IHRvIHNlc3Npb25zLCBub3QgY29ubmVjdGlvbi5cbiAgICAvLyBFYWNoIHNlc3Npb24gbXVzdCBrZWVwIHJlZmVyZW5jZXMgdG8gaXRzIGF0dGFjaGVkIGNvbm5lY3Rpb25zIGFuZCBwcm9wYWdhdGVcbiAgICAvLyByZWxldmFudCBmcmFtZXMgYWNjb3JkaW5nbHkuXG4gICAgdGhpcy5jb25uZWN0aW9ucyA9IHt9O1xuICAgIHRoaXMuc2Vzc2lvbnMgPSB7fTtcblxuICAgIHRoaXMuc3Vic2NyaWJlcnMgPSB7fTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuYWN0aW9uSGFuZGxlcnMgPSB7fTtcbiAgfVxuXG4gIGxpc3Rlbihwb3J0LCBmbiA9IF8ubm9vcCkge1xuICAgIF8uZGV2KCgpID0+IHBvcnQuc2hvdWxkLmJlLmEuTnVtYmVyKTtcbiAgICBsZXQgeyBhcHAsIHNlcnZlciB9ID0gdGhpcztcbiAgICAvLyBzb2NrZXQuaW8gaGFuZGxlcnMgYXJlIGluc3RhbGxlZCBmaXJzdCwgdG8gcHJlLWVtcHQgc29tZSBwYXRocyBvdmVyIHRoZSBodHRwIGhhbmRsZXJzLlxuICAgIGxldCBpbyA9IHJlcXVpcmUoJ3NvY2tldC5pbycpKHNlcnZlcik7XG4gICAgLy8gRGVsZWdhdGUgdG8gc3RhdGljIGlvSGFuZGxlciBtZXRob2RzLCBidXQgY2FsbCB0aGVtIHdpdGggY29udGV4dC5cbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgIC5mb3JFYWNoKChldmVudCkgPT4gaW8ub24oZXZlbnQsIF8uc2NvcGUoaW9IYW5kbGVyc1tldmVudF0sIHRoaXMpKSk7XG5cbiAgICAvLyBGZXRjaCBmcm9tIHN0b3JlXG4gICAgYXBwLmdldCgnKicsXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgc3RvcmUgcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLnN0b3Jlcy5tYXRjaChyZXEucGF0aCkgPT09IG51bGwgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLk5vdEZvdW5kKHJlcS5wYXRoKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMucHVsbChyZXEucGF0aClcbiAgICAgICAgLnRoZW4oKHZhbHVlKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2spO1xuICAgICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgR0VUICR7cmVxLnBhdGh9YCwgdmFsdWUpKTtcbiAgICAgICAgICByZXMuc3RhdHVzKDIwMCkudHlwZSgnYXBwbGljYXRpb24vanNvbicpLnNlbmQodmFsdWUpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYEdFVCAke3JlcS5wYXRofWAsIGUpKTtcbiAgICAgICAgICBpZihlIGluc3RhbmNlb2YgSFRUUEV4Y2VwdGlvbnMuSFRUUEVycm9yKSB7XG4gICAgICAgICAgICBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGUudG9TdHJpbmcoKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIERpc3BhdGNoIGFjdGlvblxuICAgIGFwcC5wb3N0KCcqJyxcbiAgICAgIC8vIFBhcnNlIGJvZHkgYXMgSlNPTlxuICAgICAgYm9keVBhcnNlci5qc29uKCksXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgYWN0aW9uIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5hY3Rpb25zLm1hdGNoKHJlcS5wYXRoKSA9PT0gbnVsbCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuTm90Rm91bmQocmVxLnBhdGgpKSA6IG5leHQoKSxcbiAgICAgIC8vIHBhcmFtcyBzaG91bGQgYmUgcHJlc2VudFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhXy5pc09iamVjdChyZXEuYm9keS5wYXJhbXMpID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5CYWRSZXF1ZXN0KCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbVxcJycpKSA6IG5leHQoKSxcbiAgICAgIC8vIENoZWNrIGZvciBhIHZhbGlkLCBhY3RpdmUgc2Vzc2lvbiBndWlkIGluIHBhcmFtc1xuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhcmVxLmJvZHkucGFyYW1zLmd1aWQgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLlVuYXV0aG9yaXplZCgnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogXFwncGFyYW1zXFwnLlxcJ2d1aWRcXCcnKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICF0aGlzLmlzQWN0aXZlU2Vzc2lvbihyZXEuYm9keS5wYXJhbXMuZ3VpZCkgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdJbnZhbGlkIFxcJ2d1aWRcXCcuJykpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLmRpc3BhdGNoKHJlcS5wYXRoLCByZXEuYm9keS5wYXJhbXMpXG4gICAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgUE9TVCAke3JlcS5wYXRofWAsIHJlcS5ib2R5LCByZXN1bHQpKTtcbiAgICAgICAgcmVzLnN0YXR1cygyMDApLmpzb24ocmVzdWx0KTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYFBPU1QgJHtyZXEucGF0aH1gLCByZXEuYm9keSwgZSkpO1xuICAgICAgICAgIGlmKGUgaW5zdGFuY2VvZiBIVFRQRXhjZXB0aW9ucy5IVFRQRXJyb3IpIHtcbiAgICAgICAgICAgIEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycjogZS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcbiAgICBzZXJ2ZXIubGlzdGVuKHBvcnQsIGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCkge1xuICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIHJldHVybiB0aGlzLl9kYXRhW3BhdGhdO1xuICAgIH0pO1xuICB9XG5cbiAgKnVwZGF0ZShwYXRoLCB2YWx1ZSkgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdmFsdWUuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgKHRoaXMuc3RvcmVzLm1hdGNoKHBhdGgpICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBoYXNoLCBkaWZmO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIERpZmYgYW5kIEpTT04tZW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAvLyB0aGVzZSBsZW5ndGh5IGNhbGN1bGF0aW9ucyBkb3duIHRoZSBwcm9wYWdhdGlvbiB0cmVlLlxuICAgICAgLy8gSWYgbm8gdmFsdWUgd2FzIHByZXNlbnQgYmVmb3JlLCB0aGVuIG51bGxpZnkgdGhlIGhhc2guIE5vIHZhbHVlIGhhcyBhIG51bGwgaGFzaC5cbiAgICAgIGlmKCF0aGlzLl9kYXRhW3BhdGhdKSB7XG4gICAgICAgIGhhc2ggPSBudWxsO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGhhc2ggPSBfLmhhc2godGhpcy5fZGF0YVtwYXRoXSk7XG4gICAgICAgIGRpZmYgPSBfLmRpZmYodGhpcy5fZGF0YVtwYXRoXSwgdmFsdWUpO1xuICAgICAgfVxuICAgICAgLy8gRGlyZWN0bHkgcGFzcyB0aGUgcGF0Y2gsIHNlc3Npb25zIGRvbid0IG5lZWQgdG8gYmUgYXdhcmVcbiAgICAgIC8vIG9mIHRoZSBhY3R1YWwgY29udGVudHM7IHRoZXkgb25seSBuZWVkIHRvIGZvcndhcmQgdGhlIGRpZmZcbiAgICAgIC8vIHRvIHRoZWlyIGFzc29jaWF0ZWQgY2xpZW50cy5cbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi51cGRhdGUocGF0aCwgeyBoYXNoLCBkaWZmIH0pKTtcbiAgICB9XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBjcmVhdGVkUGF0aDtcbiAgICBpZih0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGxlYWt5IGVudHJ5IGluIHRoaXMuc3Vic2NyaWJlcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0uc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KHNlc3Npb24uaWQpKTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXSA9IHt9O1xuICAgICAgY3JlYXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVycy5zaG91bGQuaGF2ZS5wcm9wZXJ0eShwYXRoKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdLnNob3VsZC5oYXZlLnByb3BlcnR5KHNlc3Npb24uaWQsIHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmliZXJzW3BhdGhdO1xuICAgICAgZGVsZXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiB1bnNidXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gICplbWl0KHJvb20sIHBhcmFtcykgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgICh0aGlzLnJvb21zLm1hdGNoKHJvb20pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBqc29uO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBFbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgIC8vIHRoaXMgb3BlcmF0aW9uIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICBqc29uID0gXy5wcm9sbHlzdHJpbmdpZnkocGFyYW1zKTtcbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgIC5tYXAoKHNlc3Npb24pID0+IHNlc3Npb24uZW1pdChyb29tLCBqc29uKSk7XG4gICAgfVxuICB9XG5cbiAgbGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZFJvb207XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgYSBsZWFreSBlbnRyeSBpbiB0aGlzLmxpc3RlbmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5saXN0ZW5lcnNbcm9vbV0uc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KHNlc3Npb24uaWQpKTtcbiAgICAgIGNyZWF0ZWRSb29tID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0gPSB7fTtcbiAgICAgIGNyZWF0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF0gPSBzZXNzaW9uO1xuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgaXMgdGhlIGZpcnN0IGxpc3RlbmVyXG4gICAgLy8gdG8gdGhpcyByb29tOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlLmcuIHN1YnNjcmliZSB0byBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGNyZWF0ZWRSb29tIH07XG4gIH1cblxuICB1bmxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0uc2hvdWxkLmhhdmUucHJvcGVydHkoc2Vzc2lvbi5pZCwgc2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBkZWxldGVkUm9vbSA9IGZhbHNlO1xuICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbcm9vbV07XG4gICAgICBkZWxldGVkUm9vbSA9IHRydWU7XG4gICAgfVxuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgd2FzIHRoZSBsYXN0IGxpc3RlbmVyXG4gICAgLy8gdG8gdGhpcyByb29tOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlLmcuIHVuc3VzY3JpYmUgZnJvbSBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGRlbGV0ZWRSb29tIH07XG4gIH1cblxuICBhZGRBY3Rpb25IYW5kbGVyKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgICh0aGlzLmFjdGlvbnMubWF0Y2goYWN0aW9uKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKCF0aGlzLmFjdGlvbnNbYWN0aW9uXSkge1xuICAgICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0gPSBbXTtcbiAgICAgIGNyZWF0ZWRBY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXS5wdXNoKGhhbmRsZXIpO1xuICAgIHJldHVybiB7IGNyZWF0ZWRBY3Rpb24gfTtcbiAgfVxuXG4gIHJlbW92ZUFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0uc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBfLmNvbnRhaW5zKHRoaXMuYWN0aW9uc1thY3Rpb25dLCBoYW5kbGVyKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgbGlzdCBvZiBoYW5kbGVycyBoZXJlO1xuICAgIC8vIFdlIGRvbid0IGV4cGVjdCB0byBoYXZlIF90aGF0XyBtdWNoIGRpZmZlcmVudCBoYW5kbGVyc1xuICAgIC8vIGZvciBhIGdpdmVuIGFjdGlvbiwgc28gcGVyZm9ybWFuY2UgaW1wbGljYXRpb25zXG4gICAgLy8gc2hvdWxkIGJlIGNvbXBsZXRlbHkgbmVnbGlnaWJsZS5cbiAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXSA9IF8ud2l0aG91dCh0aGlzLmFjdGlvbnNbYWN0aW9uXSwgaGFuZGxlcik7XG4gICAgbGV0IGRlbGV0ZWRBY3Rpb24gPSBmYWxzZTtcbiAgICBpZih0aGlzLmFjdGlvbnNbYWN0aW9uXS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmFjdGlvbnNbYWN0aW9uXTtcbiAgICAgIGRlbGV0ZWRBY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4geyBkZWxldGVkQWN0aW9uIH07XG4gIH1cblxuICAqZGlzcGF0Y2goYWN0aW9uLCBwYXJhbXMgPSB7fSkgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgcGFyYW1zLmd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAodGhpcy5hY3Rpb25zW2FjdGlvbl0ubWF0Y2goYWN0aW9uKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICAvLyBSdW4gYWxsIGhhbmRsZXJzIGNvbmN1cnJlbnRseSBhbmQgcmV0dXJuIHRoZSBsaXN0IG9mIHRoZSByZXN1bHRzXG4gICAgLy8gKGVtcHR5IGxpc3QgaWYgbm8gaGFuZGxlcnMpLlxuICAgIC8vIElmIGFuIGFjdGlvbiBoYW5kbGVyIHRocm93cywgdGhlbiBkaXNwYXRjaCB3aWxsIHRocm93LCBidXQgdGhlIG90aGVycyBoYW5kbGVyc1xuICAgIC8vIGNhbiBzdGlsbCBzdWNjZWVkLlxuICAgIHJldHVybiB5aWVsZCAodGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dID8gdGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dIDogW10pIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIC5tYXAoKGhhbmRsZXIpID0+IGhhbmRsZXIuY2FsbChudWxsLCBwYXJhbXMpKTtcbiAgfVxuXG4gIGhhc1Nlc3Npb24oZ3VpZCkge1xuICAgIHJldHVybiAhIXRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gIH1cblxuICBnZXRTZXNzaW9uKGd1aWQpIHtcbiAgICBfLmRldigoKSA9PiBndWlkLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMuc2Vzc2lvbnNbZ3VpZF0pIHtcbiAgICAgIHRoaXMuc2Vzc2lvbnNbZ3VpZF0gPSB0aGlzLnNlc3Npb25DcmVhdGVkKG5ldyBTZXNzaW9uKHsgZ3VpZCwgdXBsaW5rOiB0aGlzIH0pKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gIH1cblxuICBkZWxldGVTZXNzaW9uKGd1aWQpIHtcbiAgICBfLmRldigoKSA9PiBndWlkLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgbGV0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIGRlbGV0ZSB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICAgIHJldHVybiB0aGlzLnNlc3Npb25EZWxldGVkKHNlc3Npb24pO1xuICB9XG5cbiAgLy8gTm8tb3AgcGxhY2Vob2xkZXIsIHRvIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0byBpbml0aWFsaXplXG4gIC8vIHNlc3Npb24tcmVsYXRlZCByZXNvdXJjZXMuXG4gIC8vIEltcGxlbWVudGF0aW9uIHNob3VsZCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgY3JlYXRlZCBzZXNzaW9uLlxuICBzZXNzaW9uQ3JlYXRlZChzZXNzaW9uKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgfVxuXG4gIC8vIE5vLW9wIHBsYWNlaG9sZGVyLCB0byBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdG8gY2xlYW4tdXBcbiAgLy8gc2Vzc2lvbi1yZWxhdGVkIHJlc291cmNlcy5cbiAgLy8gSW1wbGVtZW50YXRpb24gc2hvdWxkIHJldHVybiBhIFByb21pc2UgZm9yIHRoZSBkZWxldGVkIHNlc3Npb24uXG4gIHNlc3Npb25EZWxldGVkKHNlc3Npb24pIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNlc3Npb24pO1xuICB9XG59XG5cbl8uZXh0ZW5kKFVwbGlua1NpbXBsZVNlcnZlci5wcm90b3R5cGUsIHtcbiAgc3RvcmVzOiBudWxsLFxuICByb29tczogbnVsbCxcbiAgYWN0aW9uczogbnVsbCxcbiAgYXBwOiBudWxsLFxuICBzZXJ2ZXI6IG51bGwsXG5cbiAgX2RhdGE6IG51bGwsXG5cbiAgY29ubmVjdGlvbnM6IG51bGwsXG4gIHNlc3Npb25zOiBudWxsLFxuXG4gIHN1YnNjcmliZXJzOiBudWxsLFxuICBsaXN0ZW5lcnM6IG51bGwsXG4gIGFjdGlvbkhhbmRsZXJzOiBudWxsLFxufSk7XG5cbkNvbm5lY3Rpb24gPSByZXF1aXJlKCcuL0Nvbm5lY3Rpb24nKSh7IFVwbGlua1NpbXBsZVNlcnZlciB9KTtcblNlc3Npb24gPSByZXF1aXJlKCcuL1Nlc3Npb24nKSh7IENvbm5lY3Rpb24sIFVwbGlua1NpbXBsZVNlcnZlciB9KTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcGxpbmtTaW1wbGVTZXJ2ZXI7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=