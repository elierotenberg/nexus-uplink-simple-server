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
      return stores.should.be.an.Array && rooms.should.be.an.Array && actions.should.be.an.Array &&
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
//# sourceMappingURL=data:application/json;base64,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QUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO09BQ2pDOzs7O1NBalRHLGtCQUFrQjs7O0FBb1R4QixDQUFDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRTtBQUNyQyxRQUFNLEVBQUUsSUFBSTtBQUNaLE9BQUssRUFBRSxJQUFJO0FBQ1gsU0FBTyxFQUFFLElBQUk7QUFDYixLQUFHLEVBQUUsSUFBSTtBQUNULFFBQU0sRUFBRSxJQUFJOztBQUVaLE9BQUssRUFBRSxJQUFJOztBQUVYLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFVBQVEsRUFBRSxJQUFJOztBQUVkLGFBQVcsRUFBRSxJQUFJO0FBQ2pCLFdBQVMsRUFBRSxJQUFJO0FBQ2YsZ0JBQWMsRUFBRSxJQUFJLEVBQ3JCLENBQUMsQ0FBQzs7QUFFSCxVQUFVLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLEVBQWxCLGtCQUFrQixFQUFFLENBQUMsQ0FBQztBQUM3RCxPQUFPLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFWLFVBQVUsRUFBRSxrQkFBa0IsRUFBbEIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDOztBQUVuRSxNQUFNLENBQUMsT0FBTyxHQUFHLGtCQUFrQixDQUFDIiwiZmlsZSI6IlVwbGlua1NpbXBsZVNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gtbmV4dCcpO1xuY29uc3QgYm9keVBhcnNlciA9IHJlcXVpcmUoJ2JvZHktcGFyc2VyJyk7XG5jb25zdCBDb25zdGFudFJvdXRlciA9IHJlcXVpcmUoJ25leHVzLXJvdXRlcicpLkNvbnN0YW50Um91dGVyO1xuY29uc3QgSFRUUEV4Y2VwdGlvbnMgPSByZXF1aXJlKCdodHRwLWV4Y2VwdGlvbnMnKTtcbmNvbnN0IGh0dHAgPSByZXF1aXJlKCdodHRwJyk7XG5cbmNvbnN0IGluc3RhbmNlT2ZTb2NrZXRJTyA9IHJlcXVpcmUoJy4vaW5zdGFuY2VPZlNvY2tldElPJyk7XG5sZXQgQ29ubmVjdGlvbiwgU2Vzc2lvbjtcblxuY29uc3QgaW9IYW5kbGVycyA9IHtcbiAgY29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICBfLmRldigoKSA9PiBpbnN0YW5jZU9mU29ja2V0SU8oc29ja2V0KS5zaG91bGQuYmUub2sgJiZcbiAgICAgIHRoaXMuY29ubmVjdGlvbnMuc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KHNvY2tldC5pZClcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXSA9IG5ldyBDb25uZWN0aW9uKHsgc29ja2V0LCB1cGxpbms6IHRoaXMgfSk7XG4gICAgc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgKCkgPT4gaW9IYW5kbGVycy5kaXNjb25uZWN0aW9uLmNhbGwodGhpcywgc29ja2V0KSk7XG4gIH0sXG5cbiAgZGlzY29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICBfLmRldigoKSA9PiBzb2NrZXQuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgc29ja2V0Lm9uLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuZW1pdC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgc29ja2V0LmlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdGhpcy5jb25uZWN0aW9ucy5zaG91bGQuaGF2ZS5wcm9wZXJ0eShzb2NrZXQuaWQsIHNvY2tldClcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXS5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXTtcbiAgfSxcbn07XG5cbi8vIE1vc3QgcHVibGljIG1ldGhvZHMgZXhwb3NlIGFuIGFzeW5jIEFQSVxuLy8gdG8gZW5mb3JjZSBjb25zaXN0ZW5jZSB3aXRoIGFzeW5jIGRhdGEgYmFja2VuZHMsXG4vLyBlZy4gcmVkaXMgb3IgbXlzcWwsIGFsdGhvdWdoIGluIHRoaXMgaW1wbGVtZW50YXRpb25cbi8vIHRoZSBiYWNrZW5kIHJlc2lkZXMgaW4gbWVtb3J5IChhIHNpbXBsZSBPYmplY3QgYWN0aW5nXG4vLyBhcyBhbiBhc3NvY2lhdGl2ZSBtYXApLlxuY2xhc3MgVXBsaW5rU2ltcGxlU2VydmVyIHtcbiAgLy8gc3RvcmVzLCByb29tcywgYW5kIGFjdGlvbnMgYXJlIHRocmVlIHdoaXRlbGlzdHMgb2ZcbiAgLy8gc3RyaW5nIHBhdHRlcm5zLiBFYWNoIGlzIGFuIGFycmF5IHRoYXQgd2lsbCBiZSBwYXNzZWRcbiAgLy8gdG8gdGhlIFJvdXRlciBjb25zdHJ1Y3Rvci5cbiAgY29uc3RydWN0b3IoeyBwaWQsIHN0b3Jlcywgcm9vbXMsIGFjdGlvbnMsIGFwcCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gc3RvcmVzLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgcm9vbXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBhY3Rpb25zLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgLy8gRHVja3R5cGUtY2hlY2sgZm9yIGFuIGV4cHJlc3MtbGlrZSBhcHBcbiAgICAgIGFwcC5nZXQuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIGFwcC5wb3N0LnNob3VsZC5iZS5hLkZ1bmN0aW9uXG4gICAgKTtcbiAgICAvLyBIZXJlIHdlIHVzZSBDb25zdGFudFJvdXRlciBpbnN0YW5jZXM7IHdlIG9ubHkgbmVlZFxuICAgIC8vIHRvIGtub3cgaWYgYSBnaXZlbiBzdHJpbmcgbWF0Y2ggYSByZWdpc3RlcmVkIHBhdHRlcm4uXG4gICAgdGhpcy5zdG9yZXMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIoc3RvcmVzKTtcbiAgICB0aGlzLnJvb21zID0gbmV3IENvbnN0YW50Um91dGVyKHJvb21zKTtcbiAgICB0aGlzLmFjdGlvbnMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIoYWN0aW9ucyk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5zZXJ2ZXIgPSBodHRwLlNlcnZlcihhcHApO1xuXG4gICAgLy8gU3RvcmUgZGF0YSBjYWNoZVxuICAgIHRoaXMuX2RhdGEgPSB7fTtcblxuICAgIC8vIENvbm5lY3Rpb25zIHJlcHJlc2VudCBhY3R1YWwgbGl2aW5nIHNvY2tldC5pbyBjb25uZWN0aW9ucy5cbiAgICAvLyBTZXNzaW9uIHJlcHJlc2VudCBhIHJlbW90ZSBVcGxpbmsgY2xpZW50IGluc3RhbmNlLCB3aXRoIGEgdW5pcXVlIGd1aWQuXG4gICAgLy8gVGhlIGNvbmNlcHQgb2Ygc2Vzc2lvbiBlbmZvcmNlcyBjb25zaXN0ZW5jeSBiZXR3ZWVuIGl0cyBhdHRhY2hlZCBzb2NrZXQgY29ubmVjdGlvbnMsXG4gICAgLy8gYW5kIEhUVFAgcmVxdWVzdHMuXG4gICAgLy8gQSBzaW5nbGUgc2Vzc2lvbiBjYW4gYmUgYXR0YWNoZWQgdG8gemVybyBvciBtb3JlIHRoYW4gb25lIGNvbm5lY3Rpb24uXG4gICAgLy8gVXBsaW5rIGZyYW1lcyBhcmUgcmVjZWl2ZWQgZnJvbSBhbmQgc2VudCB0byBzZXNzaW9ucywgbm90IGNvbm5lY3Rpb24uXG4gICAgLy8gRWFjaCBzZXNzaW9uIG11c3Qga2VlcCByZWZlcmVuY2VzIHRvIGl0cyBhdHRhY2hlZCBjb25uZWN0aW9ucyBhbmQgcHJvcGFnYXRlXG4gICAgLy8gcmVsZXZhbnQgZnJhbWVzIGFjY29yZGluZ2x5LlxuICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fTtcbiAgICB0aGlzLnNlc3Npb25zID0ge307XG5cbiAgICB0aGlzLnN1YnNjcmliZXJzID0ge307XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLmFjdGlvbkhhbmRsZXJzID0ge307XG4gIH1cblxuICBsaXN0ZW4ocG9ydCwgZm4gPSBfLm5vb3ApIHtcbiAgICBfLmRldigoKSA9PiBwb3J0LnNob3VsZC5iZS5hLk51bWJlcik7XG4gICAgbGV0IHsgYXBwLCBzZXJ2ZXIgfSA9IHRoaXM7XG4gICAgLy8gc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBpbnN0YWxsZWQgZmlyc3QsIHRvIHByZS1lbXB0IHNvbWUgcGF0aHMgb3ZlciB0aGUgaHR0cCBoYW5kbGVycy5cbiAgICBsZXQgaW8gPSByZXF1aXJlKCdzb2NrZXQuaW8nKShzZXJ2ZXIpO1xuICAgIC8vIERlbGVnYXRlIHRvIHN0YXRpYyBpb0hhbmRsZXIgbWV0aG9kcywgYnV0IGNhbGwgdGhlbSB3aXRoIGNvbnRleHQuXG4gICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAuZm9yRWFjaCgoZXZlbnQpID0+IGlvLm9uKGV2ZW50LCBfLnNjb3BlKGlvSGFuZGxlcnNbZXZlbnRdLCB0aGlzKSkpO1xuXG4gICAgLy8gRmV0Y2ggZnJvbSBzdG9yZVxuICAgIGFwcC5nZXQoJyonLFxuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGlzIHN0b3JlIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5zdG9yZXMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLnB1bGwocmVxLnBhdGgpXG4gICAgICAgIC50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+ICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rKTtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYEdFVCAke3JlcS5wYXRofWAsIHZhbHVlKSk7XG4gICAgICAgICAgcmVzLnN0YXR1cygyMDApLnR5cGUoJ2FwcGxpY2F0aW9uL2pzb24nKS5zZW5kKHZhbHVlKTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKGBHRVQgJHtyZXEucGF0aH1gLCBlKSk7XG4gICAgICAgICAgaWYoZSBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyOiBlLnRvU3RyaW5nKCkgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBEaXNwYXRjaCBhY3Rpb25cbiAgICBhcHAucG9zdCgnKicsXG4gICAgICAvLyBQYXJzZSBib2R5IGFzIEpTT05cbiAgICAgIGJvZHlQYXJzZXIuanNvbigpLFxuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGlzIGFjdGlvbiBwYXRoIGlzIHdoaXRlbGlzdGVkXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+IHRoaXMuYWN0aW9ucy5tYXRjaChyZXEucGF0aCkgPT09IG51bGwgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLk5vdEZvdW5kKHJlcS5wYXRoKSkgOiBuZXh0KCksXG4gICAgICAvLyBwYXJhbXMgc2hvdWxkIGJlIHByZXNlbnRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIV8uaXNPYmplY3QocmVxLmJvZHkucGFyYW1zKSA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuQmFkUmVxdWVzdCgnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogXFwncGFyYW1cXCcnKSkgOiBuZXh0KCksXG4gICAgICAvLyBDaGVjayBmb3IgYSB2YWxpZCwgYWN0aXZlIHNlc3Npb24gZ3VpZCBpbiBwYXJhbXNcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIXJlcS5ib2R5LnBhcmFtcy5ndWlkID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5VbmF1dGhvcml6ZWQoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IFxcJ3BhcmFtc1xcJy5cXCdndWlkXFwnJykpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhdGhpcy5pc0FjdGl2ZVNlc3Npb24ocmVxLmJvZHkucGFyYW1zLmd1aWQpID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIEhUVFBFeGNlcHRpb25zLlVuYXV0aG9yaXplZCgnSW52YWxpZCBcXCdndWlkXFwnLicpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcykgPT4gdGhpcy5kaXNwYXRjaChyZXEucGF0aCwgcmVxLmJvZHkucGFyYW1zKVxuICAgICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYFBPU1QgJHtyZXEucGF0aH1gLCByZXEuYm9keSwgcmVzdWx0KSk7XG4gICAgICAgIHJlcy5zdGF0dXMoMjAwKS5qc29uKHJlc3VsdCk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gY29uc29sZS53YXJuKGBQT1NUICR7cmVxLnBhdGh9YCwgcmVxLmJvZHksIGUpKTtcbiAgICAgICAgICBpZihlIGluc3RhbmNlb2YgSFRUUEV4Y2VwdGlvbnMuSFRUUEVycm9yKSB7XG4gICAgICAgICAgICBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGUudG9TdHJpbmcoKSB9KTtcbiAgICAgICAgICB9XG4gICAgICB9KVxuICAgICk7XG4gICAgc2VydmVyLmxpc3Rlbihwb3J0LCBmbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWxsKHBhdGgpIHtcbiAgICByZXR1cm4gUHJvbWlzZS50cnkoKCkgPT4ge1xuICAgICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgKHRoaXMuc3RvcmVzLm1hdGNoKHBhdGgpICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICAgICk7XG4gICAgICByZXR1cm4gdGhpcy5fZGF0YVtwYXRoXTtcbiAgICB9KTtcbiAgfVxuXG4gICp1cGRhdGUocGF0aCwgdmFsdWUpIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHZhbHVlLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgICh0aGlzLnN0b3Jlcy5tYXRjaChwYXRoKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBsZXQgaGFzaCwgZGlmZjtcbiAgICBpZih0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSB7XG4gICAgICAvLyBEaWZmIGFuZCBKU09OLWVuY29kZSBhcyBlYXJseSBhcyBwb3NzaWJsZSB0byBhdm9pZCBkdXBsaWNhdGluZ1xuICAgICAgLy8gdGhlc2UgbGVuZ3RoeSBjYWxjdWxhdGlvbnMgZG93biB0aGUgcHJvcGFnYXRpb24gdHJlZS5cbiAgICAgIC8vIElmIG5vIHZhbHVlIHdhcyBwcmVzZW50IGJlZm9yZSwgdGhlbiBudWxsaWZ5IHRoZSBoYXNoLiBObyB2YWx1ZSBoYXMgYSBudWxsIGhhc2guXG4gICAgICBpZighdGhpcy5fZGF0YVtwYXRoXSkge1xuICAgICAgICBoYXNoID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBoYXNoID0gXy5oYXNoKHRoaXMuX2RhdGFbcGF0aF0pO1xuICAgICAgICBkaWZmID0gXy5kaWZmKHRoaXMuX2RhdGFbcGF0aF0sIHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIC8vIERpcmVjdGx5IHBhc3MgdGhlIHBhdGNoLCBzZXNzaW9ucyBkb24ndCBuZWVkIHRvIGJlIGF3YXJlXG4gICAgICAvLyBvZiB0aGUgYWN0dWFsIGNvbnRlbnRzOyB0aGV5IG9ubHkgbmVlZCB0byBmb3J3YXJkIHRoZSBkaWZmXG4gICAgICAvLyB0byB0aGVpciBhc3NvY2lhdGVkIGNsaWVudHMuXG4gICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgIC5tYXAoKHNlc3Npb24pID0+IHNlc3Npb24udXBkYXRlKHBhdGgsIHsgaGFzaCwgZGlmZiB9KSk7XG4gICAgfVxuICB9XG5cbiAgc3Vic2NyaWJlVG8ocGF0aCwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZFBhdGg7XG4gICAgaWYodGhpcy5zdWJzY3JpYmVyc1twYXRoXSkge1xuICAgICAgLy8gRmFpbCBlYXJseSB0byBhdm9pZCBjcmVhdGluZyBsZWFreSBlbnRyeSBpbiB0aGlzLnN1YnNjcmliZXJzXG4gICAgICBfLmRldigoKSA9PiB0aGlzLnN1YnNjcmliZXJzW3BhdGhdLnNob3VsZC5ub3QuaGF2ZS5wcm9wZXJ0eShzZXNzaW9uLmlkKSk7XG4gICAgICBjcmVhdGVkUGF0aCA9IGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0gPSB7fTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFBhdGggfTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlRnJvbShwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbikgJiZcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnMuc2hvdWxkLmhhdmUucHJvcGVydHkocGF0aCkgJiZcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQuaGF2ZS5wcm9wZXJ0eShzZXNzaW9uLmlkLCBzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRQYXRoID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF07XG4gICAgaWYoT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXTtcbiAgICAgIGRlbGV0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gdW5zYnVzY3JpYmUgZnJvbSBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGRlbGV0ZWRQYXRoIH07XG4gIH1cblxuICAqZW1pdChyb29tLCBwYXJhbXMpIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAodGhpcy5yb29tcy5tYXRjaChyb29tKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBsZXQganNvbjtcbiAgICBpZih0aGlzLmxpc3RlbmVyc1tyb29tXSkge1xuICAgICAgLy8gRW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAvLyB0aGlzIG9wZXJhdGlvbiBkb3duIHRoZSBwcm9wYWdhdGlvbiB0cmVlLlxuICAgICAganNvbiA9IF8ucHJvbGx5c3RyaW5naWZ5KHBhcmFtcyk7XG4gICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAubWFwKChzZXNzaW9uKSA9PiBzZXNzaW9uLmVtaXQocm9vbSwganNvbikpO1xuICAgIH1cbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRSb29tO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGEgbGVha3kgZW50cnkgaW4gdGhpcy5saXN0ZW5lcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMubGlzdGVuZXJzW3Jvb21dLnNob3VsZC5ub3QuaGF2ZS5wcm9wZXJ0eShzZXNzaW9uLmlkKSk7XG4gICAgICBjcmVhdGVkUm9vbSA9IGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dID0ge307XG4gICAgICBjcmVhdGVkUm9vbSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBsaXN0ZW5lclxuICAgIC8vIHRvIHRoaXMgcm9vbTsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZS5nLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUm9vbSB9O1xuICB9XG5cbiAgdW5saXN0ZW5Ubyhyb29tLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbikgJiZcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dLnNob3VsZC5oYXZlLnByb3BlcnR5KHNlc3Npb24uaWQsIHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFJvb20gPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF07XG4gICAgaWYoT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcm9vbV0pLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dO1xuICAgICAgZGVsZXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBsaXN0ZW5lclxuICAgIC8vIHRvIHRoaXMgcm9vbTsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZS5nLiB1bnN1c2NyaWJlIGZyb20gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBkZWxldGVkUm9vbSB9O1xuICB9XG5cbiAgYWRkQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICAodGhpcy5hY3Rpb25zLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRBY3Rpb24gPSBmYWxzZTtcbiAgICBpZighdGhpcy5hY3Rpb25zW2FjdGlvbl0pIHtcbiAgICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dID0gW107XG4gICAgICBjcmVhdGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0ucHVzaChoYW5kbGVyKTtcbiAgICByZXR1cm4geyBjcmVhdGVkQWN0aW9uIH07XG4gIH1cblxuICByZW1vdmVBY3Rpb25IYW5kbGVyKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgXy5jb250YWlucyh0aGlzLmFjdGlvbnNbYWN0aW9uXSwgaGFuZGxlcikuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICAvLyBMb29wIHRocm91Z2ggdGhlIGxpc3Qgb2YgaGFuZGxlcnMgaGVyZTtcbiAgICAvLyBXZSBkb24ndCBleHBlY3QgdG8gaGF2ZSBfdGhhdF8gbXVjaCBkaWZmZXJlbnQgaGFuZGxlcnNcbiAgICAvLyBmb3IgYSBnaXZlbiBhY3Rpb24sIHNvIHBlcmZvcm1hbmNlIGltcGxpY2F0aW9uc1xuICAgIC8vIHNob3VsZCBiZSBjb21wbGV0ZWx5IG5lZ2xpZ2libGUuXG4gICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0gPSBfLndpdGhvdXQodGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpO1xuICAgIGxldCBkZWxldGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYodGhpcy5hY3Rpb25zW2FjdGlvbl0ubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5hY3Rpb25zW2FjdGlvbl07XG4gICAgICBkZWxldGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHsgZGVsZXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgKmRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zID0ge30pIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHBhcmFtcy5ndWlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgKHRoaXMuYWN0aW9uc1thY3Rpb25dLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gUnVuIGFsbCBoYW5kbGVycyBjb25jdXJyZW50bHkgYW5kIHJldHVybiB0aGUgbGlzdCBvZiB0aGUgcmVzdWx0c1xuICAgIC8vIChlbXB0eSBsaXN0IGlmIG5vIGhhbmRsZXJzKS5cbiAgICAvLyBJZiBhbiBhY3Rpb24gaGFuZGxlciB0aHJvd3MsIHRoZW4gZGlzcGF0Y2ggd2lsbCB0aHJvdywgYnV0IHRoZSBvdGhlcnMgaGFuZGxlcnNcbiAgICAvLyBjYW4gc3RpbGwgc3VjY2VlZC5cbiAgICByZXR1cm4geWllbGQgKHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA/IHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA6IFtdKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAubWFwKChoYW5kbGVyKSA9PiBoYW5kbGVyLmNhbGwobnVsbCwgcGFyYW1zKSk7XG4gIH1cblxuICBoYXNTZXNzaW9uKGd1aWQpIHtcbiAgICByZXR1cm4gISF0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgZ2V0U2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnNlc3Npb25zW2d1aWRdKSB7XG4gICAgICB0aGlzLnNlc3Npb25zW2d1aWRdID0gdGhpcy5zZXNzaW9uQ3JlYXRlZChuZXcgU2Vzc2lvbih7IGd1aWQsIHVwbGluazogdGhpcyB9KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgZGVsZXRlU2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGxldCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uRGVsZXRlZChzZXNzaW9uKTtcbiAgfVxuXG4gIC8vIE5vLW9wIHBsYWNlaG9sZGVyLCB0byBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdG8gaW5pdGlhbGl6ZVxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGNyZWF0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkNyZWF0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGNsZWFuLXVwXG4gIC8vIHNlc3Npb24tcmVsYXRlZCByZXNvdXJjZXMuXG4gIC8vIEltcGxlbWVudGF0aW9uIHNob3VsZCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgZGVsZXRlZCBzZXNzaW9uLlxuICBzZXNzaW9uRGVsZXRlZChzZXNzaW9uKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgfVxufVxuXG5fLmV4dGVuZChVcGxpbmtTaW1wbGVTZXJ2ZXIucHJvdG90eXBlLCB7XG4gIHN0b3JlczogbnVsbCxcbiAgcm9vbXM6IG51bGwsXG4gIGFjdGlvbnM6IG51bGwsXG4gIGFwcDogbnVsbCxcbiAgc2VydmVyOiBudWxsLFxuXG4gIF9kYXRhOiBudWxsLFxuXG4gIGNvbm5lY3Rpb25zOiBudWxsLFxuICBzZXNzaW9uczogbnVsbCxcblxuICBzdWJzY3JpYmVyczogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBhY3Rpb25IYW5kbGVyczogbnVsbCxcbn0pO1xuXG5Db25uZWN0aW9uID0gcmVxdWlyZSgnLi9Db25uZWN0aW9uJykoeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5TZXNzaW9uID0gcmVxdWlyZSgnLi9TZXNzaW9uJykoeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rU2ltcGxlU2VydmVyO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9