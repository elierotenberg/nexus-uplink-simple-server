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
    this.pid = pid;
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
//# sourceMappingURL=data:application/json;base64,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QUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO09BQ2pDOztBQUtELGtCQUFjOzs7Ozs7O2FBQUEsVUFBQyxPQUFPLEVBQUU7QUFDdEIsZUFBTyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO09BQ2pDOzs7O1NBblRHLGtCQUFrQjs7O0FBc1R4QixDQUFDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRTtBQUNyQyxRQUFNLEVBQUUsSUFBSTtBQUNaLE9BQUssRUFBRSxJQUFJO0FBQ1gsU0FBTyxFQUFFLElBQUk7QUFDYixLQUFHLEVBQUUsSUFBSTtBQUNULFFBQU0sRUFBRSxJQUFJOztBQUVaLE9BQUssRUFBRSxJQUFJOztBQUVYLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFVBQVEsRUFBRSxJQUFJOztBQUVkLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFdBQVMsRUFBRSxJQUFJO0FBQ2YsZ0JBQWMsRUFBRSxJQUFJLEVBQ3JCLENBQUMsQ0FBQzs7QUFFSCxVQUFVLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLEVBQWxCLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUM3RCxPQUFPLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFWLFVBQVUsRUFBRSxrQkFBa0IsRUFBbEIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDOztBQUVuRSxNQUFNLENBQUMsT0FBTyxHQUFHLGtCQUFrQixDQUFDIiwiZmlsZSI6IlVwbGlua1NpbXBsZVNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuY29uc3QgYm9keVBhcnNlciA9IHJlcXVpcmUoJ2JvZHktcGFyc2VyJyk7XG5jb25zdCBDb25zdGFudFJvdXRlciA9IHJlcXVpcmUoJ25leHVzLXJvdXRlcicpLkNvbnN0YW50Um91dGVyO1xuY29uc3QgSFRUUEV4Y2VwdGlvbnMgPSByZXF1aXJlKCdodHRwLWV4Y2VwdGlvbnMnKTtcbmNvbnN0IGh0dHAgPSByZXF1aXJlKCdodHRwJyk7XG5cbmNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5sZXQgQ29ubmVjdGlvbiwgU2Vzc2lvbjtcblxuY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgY29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICBfLmRldigoKSA9PiBpbnN0YW5jZU9mU29ja2V0SU8oc29ja2V0KS5zaG91bGQuYmUub2sgJiZcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMuc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KHNvY2tldC5pZClcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXSA9IG5ldyBDb25uZWN0aW9uKHsgc29ja2V0LCB1cGxpbms6IHRoaXMgfSk7XG4gICAgc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgKCkgPT4gaW9IYW5kbGVycy5kaXNjb25uZWN0aW9uLmNhbGwodGhpcywgc29ja2V0KSk7XG4gIH0sXG5cbiAgZGlzY29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICBfLmRldigoKSA9PiBzb2NrZXQuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgc29ja2V0Lm9uLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuZW1pdC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgc29ja2V0LmlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdGhpcy5jb25uZWN0aW9ucy5zaG91bGQuaGF2ZS5wcm9wZXJ0eShzb2NrZXQuaWQsIHNvY2tldClcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXS5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXTtcbiAgfSxcbn07XG5cbi8vIE1vc3QgcHVibGljIG1ldGhvZHMgZXhwb3NlIGFuIGFzeW5jIEFQSVxuLy8gdG8gZW5mb3JjZSBjb25zaXN0ZW5jZSB3aXRoIGFzeW5jIGRhdGEgYmFja2VuZHMsXG4vLyBlZy4gcmVkaXMgb3IgbXlzcWwsIGFsdGhvdWdoIGluIHRoaXMgaW1wbGVtZW50YXRpb25cbi8vIHRoZSBiYWNrZW5kIHJlc2lkZXMgaW4gbWVtb3J5IChhIHNpbXBsZSBPYmplY3QgYWN0aW5nXG4vLyBhcyBhbiBhc3NvY2lhdGl2ZSBtYXApLlxuY2xhc3MgVXBsaW5rU2ltcGxlU2VydmVyIHtcbiAgLy8gc3RvcmVzLCByb29tcywgYW5kIGFjdGlvbnMgYXJlIHRocmVlIHdoaXRlbGlzdHMgb2ZcbiAgLy8gc3RyaW5nIHBhdHRlcm5zLiBFYWNoIGlzIGFuIGFycmF5IHRoYXQgd2lsbCBiZSBwYXNzZWRcbiAgLy8gdG8gdGhlIFJvdXRlciBjb25zdHJ1Y3Rvci5cbiAgY29uc3RydWN0b3IoeyBwaWQsIHN0b3Jlcywgcm9vbXMsIGFjdGlvbnMsIGFwcCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gKHBpZCAhPT0gdW5kZWZpbmVkKS5zaG91bGQuYmUub2sgJiZcbiAgICAgIHN0b3Jlcy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIHJvb21zLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgYWN0aW9ucy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIC8vIER1Y2t0eXBlLWNoZWNrIGZvciBhbiBleHByZXNzLWxpa2UgYXBwXG4gICAgICBhcHAuZ2V0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBhcHAucG9zdC5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgdGhpcy5waWQgPSBwaWQ7XG4gICAgLy8gSGVyZSB3ZSB1c2UgQ29uc3RhbnRSb3V0ZXIgaW5zdGFuY2VzOyB3ZSBvbmx5IG5lZWRcbiAgICAvLyB0byBrbm93IGlmIGEgZ2l2ZW4gc3RyaW5nIG1hdGNoIGEgcmVnaXN0ZXJlZCBwYXR0ZXJuLlxuICAgIHRoaXMuc3RvcmVzID0gbmV3IENvbnN0YW50Um91dGVyKHN0b3Jlcyk7XG4gICAgdGhpcy5yb29tcyA9IG5ldyBDb25zdGFudFJvdXRlcihyb29tcyk7XG4gICAgdGhpcy5hY3Rpb25zID0gbmV3IENvbnN0YW50Um91dGVyKGFjdGlvbnMpO1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMuc2VydmVyID0gaHR0cC5TZXJ2ZXIoYXBwKTtcblxuICAgIC8vIFN0b3JlIGRhdGEgY2FjaGVcbiAgICB0aGlzLl9kYXRhID0ge307XG5cbiAgICAvLyBDb25uZWN0aW9ucyByZXByZXNlbnQgYWN0dWFsIGxpdmluZyBzb2NrZXQuaW8gY29ubmVjdGlvbnMuXG4gICAgLy8gU2Vzc2lvbiByZXByZXNlbnQgYSByZW1vdGUgVXBsaW5rIGNsaWVudCBpbnN0YW5jZSwgd2l0aCBhIHVuaXF1ZSBndWlkLlxuICAgIC8vIFRoZSBjb25jZXB0IG9mIHNlc3Npb24gZW5mb3JjZXMgY29uc2lzdGVuY3kgYmV0d2VlbiBpdHMgYXR0YWNoZWQgc29ja2V0IGNvbm5lY3Rpb25zLFxuICAgIC8vIGFuZCBIVFRQIHJlcXVlc3RzLlxuICAgIC8vIEEgc2luZ2xlIHNlc3Npb24gY2FuIGJlIGF0dGFjaGVkIHRvIHplcm8gb3IgbW9yZSB0aGFuIG9uZSBjb25uZWN0aW9uLlxuICAgIC8vIFVwbGluayBmcmFtZXMgYXJlIHJlY2VpdmVkIGZyb20gYW5kIHNlbnQgdG8gc2Vzc2lvbnMsIG5vdCBjb25uZWN0aW9uLlxuICAgIC8vIEVhY2ggc2Vzc2lvbiBtdXN0IGtlZXAgcmVmZXJlbmNlcyB0byBpdHMgYXR0YWNoZWQgY29ubmVjdGlvbnMgYW5kIHByb3BhZ2F0ZVxuICAgIC8vIHJlbGV2YW50IGZyYW1lcyBhY2NvcmRpbmdseS5cbiAgICB0aGlzLmNvbm5lY3Rpb25zID0ge307XG4gICAgdGhpcy5zZXNzaW9ucyA9IHt9O1xuXG4gICAgdGhpcy5zdWJzY3JpYmVycyA9IHt9O1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5hY3Rpb25IYW5kbGVycyA9IHt9O1xuICB9XG5cbiAgbGlzdGVuKHBvcnQsIGZuID0gXy5ub29wKSB7XG4gICAgXy5kZXYoKCkgPT4gcG9ydC5zaG91bGQuYmUuYS5OdW1iZXIpO1xuICAgIGxldCB7IGFwcCwgc2VydmVyIH0gPSB0aGlzO1xuICAgIC8vIHNvY2tldC5pbyBoYW5kbGVycyBhcmUgaW5zdGFsbGVkIGZpcnN0LCB0byBwcmUtZW1wdCBzb21lIHBhdGhzIG92ZXIgdGhlIGh0dHAgaGFuZGxlcnMuXG4gICAgbGV0IGlvID0gcmVxdWlyZSgnc29ja2V0LmlvJykoc2VydmVyKTtcbiAgICAvLyBEZWxlZ2F0ZSB0byBzdGF0aWMgaW9IYW5kbGVyIG1ldGhvZHMsIGJ1dCBjYWxsIHRoZW0gd2l0aCBjb250ZXh0LlxuICAgIE9iamVjdC5rZXlzKGlvSGFuZGxlcnMpXG4gICAgLmZvckVhY2goKGV2ZW50KSA9PiBpby5vbihldmVudCwgXy5zY29wZShpb0hhbmRsZXJzW2V2ZW50XSwgdGhpcykpKTtcblxuICAgIC8vIEZldGNoIGZyb20gc3RvcmVcbiAgICBhcHAuZ2V0KCcqJyxcbiAgICAgIC8vIENoZWNrIHRoYXQgdGhpcyBzdG9yZSBwYXRoIGlzIHdoaXRlbGlzdGVkXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+IHRoaXMuc3RvcmVzLm1hdGNoKHJlcS5wYXRoKSA9PT0gbnVsbCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuTm90Rm91bmQocmVxLnBhdGgpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcykgPT4gdGhpcy5wdWxsKHJlcS5wYXRoKVxuICAgICAgICAudGhlbigodmFsdWUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiAodmFsdWUgPT09IG51bGwgfHwgXy5pc09iamVjdCh2YWx1ZSkpLnNob3VsZC5iZS5vayk7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKGBHRVQgJHtyZXEucGF0aH1gLCB2YWx1ZSkpO1xuICAgICAgICAgIHJlcy5zdGF0dXMoMjAwKS50eXBlKCdhcHBsaWNhdGlvbi9qc29uJykuc2VuZCh2YWx1ZSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgR0VUICR7cmVxLnBhdGh9YCwgZSkpO1xuICAgICAgICAgIGlmKGUgaW5zdGFuY2VvZiBIVFRQRXhjZXB0aW9ucy5IVFRQRXJyb3IpIHtcbiAgICAgICAgICAgIEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycjogZS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gRGlzcGF0Y2ggYWN0aW9uXG4gICAgYXBwLnBvc3QoJyonLFxuICAgICAgLy8gUGFyc2UgYm9keSBhcyBKU09OXG4gICAgICBib2R5UGFyc2VyLmpzb24oKSxcbiAgICAgIC8vIENoZWNrIHRoYXQgdGhpcyBhY3Rpb24gcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLmFjdGlvbnMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgLy8gcGFyYW1zIHNob3VsZCBiZSBwcmVzZW50XG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFfLmlzT2JqZWN0KHJlcS5ib2R5LnBhcmFtcykgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLkJhZFJlcXVlc3QoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IFxcJ3BhcmFtXFwnJykpIDogbmV4dCgpLFxuICAgICAgLy8gQ2hlY2sgZm9yIGEgdmFsaWQsIGFjdGl2ZSBzZXNzaW9uIGd1aWQgaW4gcGFyYW1zXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFyZXEuYm9keS5wYXJhbXMuZ3VpZCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbXNcXCcuXFwnZ3VpZFxcJycpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIXRoaXMuaXNBY3RpdmVTZXNzaW9uKHJlcS5ib2R5LnBhcmFtcy5ndWlkKSA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBIVFRQRXhjZXB0aW9ucy5VbmF1dGhvcml6ZWQoJ0ludmFsaWQgXFwnZ3VpZFxcJy4nKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMuZGlzcGF0Y2gocmVxLnBhdGgsIHJlcS5ib2R5LnBhcmFtcylcbiAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKGBQT1NUICR7cmVxLnBhdGh9YCwgcmVxLmJvZHksIHJlc3VsdCkpO1xuICAgICAgICByZXMuc3RhdHVzKDIwMCkuanNvbihyZXN1bHQpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaCgoZSkgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgUE9TVCAke3JlcS5wYXRofWAsIHJlcS5ib2R5LCBlKSk7XG4gICAgICAgICAgaWYoZSBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyOiBlLnRvU3RyaW5nKCkgfSk7XG4gICAgICAgICAgfVxuICAgICAgfSlcbiAgICApO1xuICAgIHNlcnZlci5saXN0ZW4ocG9ydCwgZm4pO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVsbChwYXRoKSB7XG4gICAgcmV0dXJuIFByb21pc2UudHJ5KCgpID0+IHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgICh0aGlzLnN0b3Jlcy5tYXRjaChwYXRoKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRoaXMuX2RhdGFbcGF0aF07XG4gICAgfSk7XG4gIH1cblxuICAqdXBkYXRlKHBhdGgsIHZhbHVlKSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICB2YWx1ZS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgbGV0IGhhc2gsIGRpZmY7XG4gICAgaWYodGhpcy5zdWJzY3JpYmVyc1twYXRoXSkge1xuICAgICAgLy8gRGlmZiBhbmQgSlNPTi1lbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgIC8vIHRoZXNlIGxlbmd0aHkgY2FsY3VsYXRpb25zIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICAvLyBJZiBubyB2YWx1ZSB3YXMgcHJlc2VudCBiZWZvcmUsIHRoZW4gbnVsbGlmeSB0aGUgaGFzaC4gTm8gdmFsdWUgaGFzIGEgbnVsbCBoYXNoLlxuICAgICAgaWYoIXRoaXMuX2RhdGFbcGF0aF0pIHtcbiAgICAgICAgaGFzaCA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaGFzaCA9IF8uaGFzaCh0aGlzLl9kYXRhW3BhdGhdKTtcbiAgICAgICAgZGlmZiA9IF8uZGlmZih0aGlzLl9kYXRhW3BhdGhdLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgICAvLyBEaXJlY3RseSBwYXNzIHRoZSBwYXRjaCwgc2Vzc2lvbnMgZG9uJ3QgbmVlZCB0byBiZSBhd2FyZVxuICAgICAgLy8gb2YgdGhlIGFjdHVhbCBjb250ZW50czsgdGhleSBvbmx5IG5lZWQgdG8gZm9yd2FyZCB0aGUgZGlmZlxuICAgICAgLy8gdG8gdGhlaXIgYXNzb2NpYXRlZCBjbGllbnRzLlxuICAgICAgeWllbGQgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAubWFwKChzZXNzaW9uKSA9PiBzZXNzaW9uLnVwZGF0ZShwYXRoLCB7IGhhc2gsIGRpZmYgfSkpO1xuICAgIH1cbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRQYXRoO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgbGVha3kgZW50cnkgaW4gdGhpcy5zdWJzY3JpYmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQubm90LmhhdmUucHJvcGVydHkoc2Vzc2lvbi5pZCkpO1xuICAgICAgY3JlYXRlZFBhdGggPSBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdID0ge307XG4gICAgICBjcmVhdGVkUGF0aCA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF0gPSBzZXNzaW9uO1xuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgaXMgdGhlIGZpcnN0IHN1YnNjcmlwdGlvblxuICAgIC8vIHRvIHRoaXMgcGF0aDsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZWcuIHN1YnNjcmliZSB0byBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGNyZWF0ZWRQYXRoIH07XG4gIH1cblxuICB1bnN1YnNjcmliZUZyb20ocGF0aCwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzLnNob3VsZC5oYXZlLnByb3BlcnR5KHBhdGgpICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0uc2hvdWxkLmhhdmUucHJvcGVydHkoc2Vzc2lvbi5pZCwgc2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBkZWxldGVkUGF0aCA9IGZhbHNlO1xuICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF07XG4gICAgICBkZWxldGVkUGF0aCA9IHRydWU7XG4gICAgfVxuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgd2FzIHRoZSBsYXN0IHN1YnNjcmlwdGlvblxuICAgIC8vIHRvIHRoaXMgcGF0aDsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZWcuIHVuc2J1c2NyaWJlIGZyb20gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBkZWxldGVkUGF0aCB9O1xuICB9XG5cbiAgKmVtaXQocm9vbSwgcGFyYW1zKSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgKHRoaXMucm9vbXMubWF0Y2gocm9vbSkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgbGV0IGpzb247XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIC8vIEVuY29kZSBhcyBlYXJseSBhcyBwb3NzaWJsZSB0byBhdm9pZCBkdXBsaWNhdGluZ1xuICAgICAgLy8gdGhpcyBvcGVyYXRpb24gZG93biB0aGUgcHJvcGFnYXRpb24gdHJlZS5cbiAgICAgIGpzb24gPSBfLnByb2xseXN0cmluZ2lmeShwYXJhbXMpO1xuICAgICAgeWllbGQgT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcm9vbV0pIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi5lbWl0KHJvb20sIGpzb24pKTtcbiAgICB9XG4gIH1cblxuICBsaXN0ZW5Ubyhyb29tLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBjcmVhdGVkUm9vbTtcbiAgICBpZih0aGlzLmxpc3RlbmVyc1tyb29tXSkge1xuICAgICAgLy8gRmFpbCBlYXJseSB0byBhdm9pZCBjcmVhdGluZyBhIGxlYWt5IGVudHJ5IGluIHRoaXMubGlzdGVuZXJzXG4gICAgICBfLmRldigoKSA9PiB0aGlzLmxpc3RlbmVyc1tyb29tXS5zaG91bGQubm90LmhhdmUucHJvcGVydHkoc2Vzc2lvbi5pZCkpO1xuICAgICAgY3JlYXRlZFJvb20gPSBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXSA9IHt9O1xuICAgICAgY3JlYXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pICYmXG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXS5zaG91bGQuaGF2ZS5wcm9wZXJ0eShzZXNzaW9uLmlkLCBzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcbiAgICAgIGRlbGV0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gdW5zdXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFJvb20gfTtcbiAgfVxuXG4gIGFkZEFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgKHRoaXMuYWN0aW9ucy5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBjcmVhdGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYoIXRoaXMuYWN0aW9uc1thY3Rpb25dKSB7XG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXSA9IFtdO1xuICAgICAgY3JlYXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dLnB1c2goaGFuZGxlcik7XG4gICAgcmV0dXJuIHsgY3JlYXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgcmVtb3ZlQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXS5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIF8uY29udGFpbnModGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBsaXN0IG9mIGhhbmRsZXJzIGhlcmU7XG4gICAgLy8gV2UgZG9uJ3QgZXhwZWN0IHRvIGhhdmUgX3RoYXRfIG11Y2ggZGlmZmVyZW50IGhhbmRsZXJzXG4gICAgLy8gZm9yIGEgZ2l2ZW4gYWN0aW9uLCBzbyBwZXJmb3JtYW5jZSBpbXBsaWNhdGlvbnNcbiAgICAvLyBzaG91bGQgYmUgY29tcGxldGVseSBuZWdsaWdpYmxlLlxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dID0gXy53aXRob3V0KHRoaXMuYWN0aW9uc1thY3Rpb25dLCBoYW5kbGVyKTtcbiAgICBsZXQgZGVsZXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKHRoaXMuYWN0aW9uc1thY3Rpb25dLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMuYWN0aW9uc1thY3Rpb25dO1xuICAgICAgZGVsZXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiB7IGRlbGV0ZWRBY3Rpb24gfTtcbiAgfVxuXG4gICpkaXNwYXRjaChhY3Rpb24sIHBhcmFtcyA9IHt9KSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBwYXJhbXMuZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICh0aGlzLmFjdGlvbnNbYWN0aW9uXS5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIC8vIFJ1biBhbGwgaGFuZGxlcnMgY29uY3VycmVudGx5IGFuZCByZXR1cm4gdGhlIGxpc3Qgb2YgdGhlIHJlc3VsdHNcbiAgICAvLyAoZW1wdHkgbGlzdCBpZiBubyBoYW5kbGVycykuXG4gICAgLy8gSWYgYW4gYWN0aW9uIGhhbmRsZXIgdGhyb3dzLCB0aGVuIGRpc3BhdGNoIHdpbGwgdGhyb3csIGJ1dCB0aGUgb3RoZXJzIGhhbmRsZXJzXG4gICAgLy8gY2FuIHN0aWxsIHN1Y2NlZWQuXG4gICAgcmV0dXJuIHlpZWxkICh0aGlzLmFjdGlvbkhhbmRsZXJzW2FjdGlvbl0gPyB0aGlzLmFjdGlvbkhhbmRsZXJzW2FjdGlvbl0gOiBbXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgLm1hcCgoaGFuZGxlcikgPT4gaGFuZGxlci5jYWxsKG51bGwsIHBhcmFtcykpO1xuICB9XG5cbiAgaGFzU2Vzc2lvbihndWlkKSB7XG4gICAgcmV0dXJuICEhdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGdldFNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBpZighdGhpcy5zZXNzaW9uc1tndWlkXSkge1xuICAgICAgdGhpcy5zZXNzaW9uc1tndWlkXSA9IHRoaXMuc2Vzc2lvbkNyZWF0ZWQobmV3IFNlc3Npb24oeyBndWlkLCB1cGxpbms6IHRoaXMgfSkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGRlbGV0ZVNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBsZXQgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGluaXRpYWxpemVcbiAgLy8gc2Vzc2lvbi1yZWxhdGVkIHJlc291cmNlcy5cbiAgLy8gSW1wbGVtZW50YXRpb24gc2hvdWxkIHJldHVybiBhIFByb21pc2UgZm9yIHRoZSBjcmVhdGVkIHNlc3Npb24uXG4gIHNlc3Npb25DcmVhdGVkKHNlc3Npb24pIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNlc3Npb24pO1xuICB9XG5cbiAgLy8gTm8tb3AgcGxhY2Vob2xkZXIsIHRvIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0byBjbGVhbi11cFxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGRlbGV0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rU2ltcGxlU2VydmVyLnByb3RvdHlwZSwge1xuICBzdG9yZXM6IG51bGwsXG4gIHJvb21zOiBudWxsLFxuICBhY3Rpb25zOiBudWxsLFxuICBhcHA6IG51bGwsXG4gIHNlcnZlcjogbnVsbCxcblxuICBfZGF0YTogbnVsbCxcblxuICBjb25uZWN0aW9uczogbnVsbCxcbiAgc2Vzc2lvbnM6IG51bGwsXG5cbiAgc3Vic2NyaWJlcnM6IG51bGwsXG4gIGxpc3RlbmVyczogbnVsbCxcbiAgYWN0aW9uSGFuZGxlcnM6IG51bGwsXG59KTtcblxuQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vQ29ubmVjdGlvbicpKHsgVXBsaW5rU2ltcGxlU2VydmVyIH0pO1xuU2Vzc2lvbiA9IHJlcXVpcmUoJy4vU2Vzc2lvbicpKHsgQ29ubmVjdGlvbiwgVXBsaW5rU2ltcGxlU2VydmVyIH0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVwbGlua1NpbXBsZVNlcnZlcjtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==