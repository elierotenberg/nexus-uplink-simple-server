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
//# sourceMappingURL=data:application/json;base64,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Q0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7T0FDakM7Ozs7U0FqVEcsa0JBQWtCOzs7QUFvVHhCLENBQUMsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsU0FBUyxFQUFFO0FBQ3JDLFFBQU0sRUFBRSxJQUFJO0FBQ1osT0FBSyxFQUFFLElBQUk7QUFDWCxTQUFPLEVBQUUsSUFBSTtBQUNiLEtBQUcsRUFBRSxJQUFJO0FBQ1QsUUFBTSxFQUFFLElBQUk7O0FBRVosT0FBSyxFQUFFLElBQUk7O0FBRVgsYUFBVyxFQUFFLElBQUk7QUFDakIsVUFBUSxFQUFFLElBQUk7O0FBRWQsYUFBVyxFQUFFLElBQUk7QUFDakIsV0FBUyxFQUFFLElBQUk7QUFDZixnQkFBYyxFQUFFLElBQUksRUFDckIsQ0FBQyxDQUFDOztBQUVILFVBQVUsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsRUFBbEIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0FBQzdELE9BQU8sR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQVYsVUFBVSxFQUFFLGtCQUFrQixFQUFsQixrQkFBa0IsRUFBRSxDQUFDLENBQUM7O0FBRW5FLE1BQU0sQ0FBQyxPQUFPLEdBQUcsa0JBQWtCLENBQUMiLCJmaWxlIjoiVXBsaW5rU2ltcGxlU2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG5jb25zdCBib2R5UGFyc2VyID0gcmVxdWlyZSgnYm9keS1wYXJzZXInKTtcbmNvbnN0IENvbnN0YW50Um91dGVyID0gcmVxdWlyZSgnbmV4dXMtcm91dGVyJykuQ29uc3RhbnRSb3V0ZXI7XG5jb25zdCBIVFRQRXhjZXB0aW9ucyA9IHJlcXVpcmUoJ2h0dHAtZXhjZXB0aW9ucycpO1xuY29uc3QgaHR0cCA9IHJlcXVpcmUoJ2h0dHAnKTtcblxuY29uc3QgaW5zdGFuY2VPZlNvY2tldElPID0gcmVxdWlyZSgnLi9pbnN0YW5jZU9mU29ja2V0SU8nKTtcbmxldCBDb25uZWN0aW9uLCBTZXNzaW9uO1xuXG5jb25zdCBpb0hhbmRsZXJzID0ge1xuICBjb25uZWN0aW9uKHNvY2tldCkge1xuICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgdGhpcy5jb25uZWN0aW9ucy5zaG91bGQubm90LmhhdmUucHJvcGVydHkoc29ja2V0LmlkKVxuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdID0gbmV3IENvbm5lY3Rpb24oeyBzb2NrZXQsIHVwbGluazogdGhpcyB9KTtcbiAgICBzb2NrZXQub24oJ2Rpc2Nvbm5lY3QnLCAoKSA9PiBpb0hhbmRsZXJzLmRpc2Nvbm5lY3Rpb24uY2FsbCh0aGlzLCBzb2NrZXQpKTtcbiAgfSxcblxuICBkaXNjb25uZWN0aW9uKHNvY2tldCkge1xuICAgIF8uZGV2KCgpID0+IHNvY2tldC5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBzb2NrZXQub24uc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHNvY2tldC5lbWl0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuaWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zLnNob3VsZC5oYXZlLnByb3BlcnR5KHNvY2tldC5pZCwgc29ja2V0KVxuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdO1xuICB9LFxufTtcblxuLy8gTW9zdCBwdWJsaWMgbWV0aG9kcyBleHBvc2UgYW4gYXN5bmMgQVBJXG4vLyB0byBlbmZvcmNlIGNvbnNpc3RlbmNlIHdpdGggYXN5bmMgZGF0YSBiYWNrZW5kcyxcbi8vIGVnLiByZWRpcyBvciBteXNxbCwgYWx0aG91Z2ggaW4gdGhpcyBpbXBsZW1lbnRhdGlvblxuLy8gdGhlIGJhY2tlbmQgcmVzaWRlcyBpbiBtZW1vcnkgKGEgc2ltcGxlIE9iamVjdCBhY3Rpbmdcbi8vIGFzIGFuIGFzc29jaWF0aXZlIG1hcCkuXG5jbGFzcyBVcGxpbmtTaW1wbGVTZXJ2ZXIge1xuICAvLyBzdG9yZXMsIHJvb21zLCBhbmQgYWN0aW9ucyBhcmUgdGhyZWUgd2hpdGVsaXN0cyBvZlxuICAvLyBzdHJpbmcgcGF0dGVybnMuIEVhY2ggaXMgYW4gYXJyYXkgdGhhdCB3aWxsIGJlIHBhc3NlZFxuICAvLyB0byB0aGUgUm91dGVyIGNvbnN0cnVjdG9yLlxuICBjb25zdHJ1Y3Rvcih7IHBpZCwgc3RvcmVzLCByb29tcywgYWN0aW9ucywgYXBwIH0pIHtcbiAgICBfLmRldigoKSA9PiBzdG9yZXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICByb29tcy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIGFjdGlvbnMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICAvLyBEdWNrdHlwZS1jaGVjayBmb3IgYW4gZXhwcmVzcy1saWtlIGFwcFxuICAgICAgYXBwLmdldC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgYXBwLnBvc3Quc2hvdWxkLmJlLmEuRnVuY3Rpb25cbiAgICApO1xuICAgIC8vIEhlcmUgd2UgdXNlIENvbnN0YW50Um91dGVyIGluc3RhbmNlczsgd2Ugb25seSBuZWVkXG4gICAgLy8gdG8ga25vdyBpZiBhIGdpdmVuIHN0cmluZyBtYXRjaCBhIHJlZ2lzdGVyZWQgcGF0dGVybi5cbiAgICB0aGlzLnN0b3JlcyA9IG5ldyBDb25zdGFudFJvdXRlcihzdG9yZXMpO1xuICAgIHRoaXMucm9vbXMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIocm9vbXMpO1xuICAgIHRoaXMuYWN0aW9ucyA9IG5ldyBDb25zdGFudFJvdXRlcihhY3Rpb25zKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnNlcnZlciA9IGh0dHAuU2VydmVyKGFwcCk7XG5cbiAgICAvLyBTdG9yZSBkYXRhIGNhY2hlXG4gICAgdGhpcy5fZGF0YSA9IHt9O1xuXG4gICAgLy8gQ29ubmVjdGlvbnMgcmVwcmVzZW50IGFjdHVhbCBsaXZpbmcgc29ja2V0LmlvIGNvbm5lY3Rpb25zLlxuICAgIC8vIFNlc3Npb24gcmVwcmVzZW50IGEgcmVtb3RlIFVwbGluayBjbGllbnQgaW5zdGFuY2UsIHdpdGggYSB1bmlxdWUgZ3VpZC5cbiAgICAvLyBUaGUgY29uY2VwdCBvZiBzZXNzaW9uIGVuZm9yY2VzIGNvbnNpc3RlbmN5IGJldHdlZW4gaXRzIGF0dGFjaGVkIHNvY2tldCBjb25uZWN0aW9ucyxcbiAgICAvLyBhbmQgSFRUUCByZXF1ZXN0cy5cbiAgICAvLyBBIHNpbmdsZSBzZXNzaW9uIGNhbiBiZSBhdHRhY2hlZCB0byB6ZXJvIG9yIG1vcmUgdGhhbiBvbmUgY29ubmVjdGlvbi5cbiAgICAvLyBVcGxpbmsgZnJhbWVzIGFyZSByZWNlaXZlZCBmcm9tIGFuZCBzZW50IHRvIHNlc3Npb25zLCBub3QgY29ubmVjdGlvbi5cbiAgICAvLyBFYWNoIHNlc3Npb24gbXVzdCBrZWVwIHJlZmVyZW5jZXMgdG8gaXRzIGF0dGFjaGVkIGNvbm5lY3Rpb25zIGFuZCBwcm9wYWdhdGVcbiAgICAvLyByZWxldmFudCBmcmFtZXMgYWNjb3JkaW5nbHkuXG4gICAgdGhpcy5jb25uZWN0aW9ucyA9IHt9O1xuICAgIHRoaXMuc2Vzc2lvbnMgPSB7fTtcblxuICAgIHRoaXMuc3Vic2NyaWJlcnMgPSB7fTtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICAgIHRoaXMuYWN0aW9uSGFuZGxlcnMgPSB7fTtcbiAgfVxuXG4gIGxpc3Rlbihwb3J0LCBmbiA9IF8ubm9vcCkge1xuICAgIF8uZGV2KCgpID0+IHBvcnQuc2hvdWxkLmJlLmEuTnVtYmVyKTtcbiAgICBsZXQgeyBhcHAsIHNlcnZlciB9ID0gdGhpcztcbiAgICAvLyBzb2NrZXQuaW8gaGFuZGxlcnMgYXJlIGluc3RhbGxlZCBmaXJzdCwgdG8gcHJlLWVtcHQgc29tZSBwYXRocyBvdmVyIHRoZSBodHRwIGhhbmRsZXJzLlxuICAgIGxldCBpbyA9IHJlcXVpcmUoJ3NvY2tldC5pbycpKHNlcnZlcik7XG4gICAgLy8gRGVsZWdhdGUgdG8gc3RhdGljIGlvSGFuZGxlciBtZXRob2RzLCBidXQgY2FsbCB0aGVtIHdpdGggY29udGV4dC5cbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgIC5mb3JFYWNoKChldmVudCkgPT4gaW8ub24oZXZlbnQsIF8uc2NvcGUoaW9IYW5kbGVyc1tldmVudF0sIHRoaXMpKSk7XG5cbiAgICAvLyBGZXRjaCBmcm9tIHN0b3JlXG4gICAgYXBwLmdldCgnKicsXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgc3RvcmUgcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLnN0b3Jlcy5tYXRjaChyZXEucGF0aCkgPT09IG51bGwgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLk5vdEZvdW5kKHJlcS5wYXRoKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMucHVsbChyZXEucGF0aClcbiAgICAgICAgLnRoZW4oKHZhbHVlKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2spO1xuICAgICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgR0VUICR7cmVxLnBhdGh9YCwgdmFsdWUpKTtcbiAgICAgICAgICByZXMuc3RhdHVzKDIwMCkudHlwZSgnYXBwbGljYXRpb24vanNvbicpLnNlbmQodmFsdWUpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYEdFVCAke3JlcS5wYXRofWAsIGUpKTtcbiAgICAgICAgICBpZihlIGluc3RhbmNlb2YgSFRUUEV4Y2VwdGlvbnMuSFRUUEVycm9yKSB7XG4gICAgICAgICAgICBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGUudG9TdHJpbmcoKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIERpc3BhdGNoIGFjdGlvblxuICAgIGFwcC5wb3N0KCcqJyxcbiAgICAgIC8vIFBhcnNlIGJvZHkgYXMgSlNPTlxuICAgICAgYm9keVBhcnNlci5qc29uKCksXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgYWN0aW9uIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5hY3Rpb25zLm1hdGNoKHJlcS5wYXRoKSA9PT0gbnVsbCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuTm90Rm91bmQocmVxLnBhdGgpKSA6IG5leHQoKSxcbiAgICAgIC8vIHBhcmFtcyBzaG91bGQgYmUgcHJlc2VudFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhXy5pc09iamVjdChyZXEuYm9keS5wYXJhbXMpID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5CYWRSZXF1ZXN0KCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbVxcJycpKSA6IG5leHQoKSxcbiAgICAgIC8vIENoZWNrIGZvciBhIHZhbGlkLCBhY3RpdmUgc2Vzc2lvbiBndWlkIGluIHBhcmFtc1xuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhcmVxLmJvZHkucGFyYW1zLmd1aWQgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLlVuYXV0aG9yaXplZCgnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogXFwncGFyYW1zXFwnLlxcJ2d1aWRcXCcnKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICF0aGlzLmlzQWN0aXZlU2Vzc2lvbihyZXEuYm9keS5wYXJhbXMuZ3VpZCkgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdJbnZhbGlkIFxcJ2d1aWRcXCcuJykpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLmRpc3BhdGNoKHJlcS5wYXRoLCByZXEuYm9keS5wYXJhbXMpXG4gICAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgUE9TVCAke3JlcS5wYXRofWAsIHJlcS5ib2R5LCByZXN1bHQpKTtcbiAgICAgICAgcmVzLnN0YXR1cygyMDApLmpzb24ocmVzdWx0KTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYFBPU1QgJHtyZXEucGF0aH1gLCByZXEuYm9keSwgZSkpO1xuICAgICAgICAgIGlmKGUgaW5zdGFuY2VvZiBIVFRQRXhjZXB0aW9ucy5IVFRQRXJyb3IpIHtcbiAgICAgICAgICAgIEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycjogZS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcbiAgICBzZXJ2ZXIubGlzdGVuKHBvcnQsIGZuKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCkge1xuICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIHJldHVybiB0aGlzLl9kYXRhW3BhdGhdO1xuICAgIH0pO1xuICB9XG5cbiAgKnVwZGF0ZShwYXRoLCB2YWx1ZSkgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdmFsdWUuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgKHRoaXMuc3RvcmVzLm1hdGNoKHBhdGgpICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBoYXNoLCBkaWZmO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIERpZmYgYW5kIEpTT04tZW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAvLyB0aGVzZSBsZW5ndGh5IGNhbGN1bGF0aW9ucyBkb3duIHRoZSBwcm9wYWdhdGlvbiB0cmVlLlxuICAgICAgLy8gSWYgbm8gdmFsdWUgd2FzIHByZXNlbnQgYmVmb3JlLCB0aGVuIG51bGxpZnkgdGhlIGhhc2guIE5vIHZhbHVlIGhhcyBhIG51bGwgaGFzaC5cbiAgICAgIGlmKCF0aGlzLl9kYXRhW3BhdGhdKSB7XG4gICAgICAgIGhhc2ggPSBudWxsO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGhhc2ggPSBfLmhhc2godGhpcy5fZGF0YVtwYXRoXSk7XG4gICAgICAgIGRpZmYgPSBfLmRpZmYodGhpcy5fZGF0YVtwYXRoXSwgdmFsdWUpO1xuICAgICAgfVxuICAgICAgLy8gRGlyZWN0bHkgcGFzcyB0aGUgcGF0Y2gsIHNlc3Npb25zIGRvbid0IG5lZWQgdG8gYmUgYXdhcmVcbiAgICAgIC8vIG9mIHRoZSBhY3R1YWwgY29udGVudHM7IHRoZXkgb25seSBuZWVkIHRvIGZvcndhcmQgdGhlIGRpZmZcbiAgICAgIC8vIHRvIHRoZWlyIGFzc29jaWF0ZWQgY2xpZW50cy5cbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi51cGRhdGUocGF0aCwgeyBoYXNoLCBkaWZmIH0pKTtcbiAgICB9XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBjcmVhdGVkUGF0aDtcbiAgICBpZih0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGxlYWt5IGVudHJ5IGluIHRoaXMuc3Vic2NyaWJlcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0uc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KHNlc3Npb24uaWQpKTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXSA9IHt9O1xuICAgICAgY3JlYXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVycy5zaG91bGQuaGF2ZS5wcm9wZXJ0eShwYXRoKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdLnNob3VsZC5oYXZlLnByb3BlcnR5KHNlc3Npb24uaWQsIHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmliZXJzW3BhdGhdO1xuICAgICAgZGVsZXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiB1bnNidXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gICplbWl0KHJvb20sIHBhcmFtcykgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgICh0aGlzLnJvb21zLm1hdGNoKHJvb20pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBqc29uO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBFbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgIC8vIHRoaXMgb3BlcmF0aW9uIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICBqc29uID0gXy5wcm9sbHlzdHJpbmdpZnkocGFyYW1zKTtcbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgIC5tYXAoKHNlc3Npb24pID0+IHNlc3Npb24uZW1pdChyb29tLCBqc29uKSk7XG4gICAgfVxuICB9XG5cbiAgbGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZFJvb207XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgYSBsZWFreSBlbnRyeSBpbiB0aGlzLmxpc3RlbmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5saXN0ZW5lcnNbcm9vbV0uc2hvdWxkLm5vdC5oYXZlLnByb3BlcnR5KHNlc3Npb24uaWQpKTtcbiAgICAgIGNyZWF0ZWRSb29tID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0gPSB7fTtcbiAgICAgIGNyZWF0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF0gPSBzZXNzaW9uO1xuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgaXMgdGhlIGZpcnN0IGxpc3RlbmVyXG4gICAgLy8gdG8gdGhpcyByb29tOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlLmcuIHN1YnNjcmliZSB0byBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGNyZWF0ZWRSb29tIH07XG4gIH1cblxuICB1bmxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5saXN0ZW5lcnNbcm9vbV0uc2hvdWxkLmhhdmUucHJvcGVydHkoc2Vzc2lvbi5pZCwgc2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBkZWxldGVkUm9vbSA9IGZhbHNlO1xuICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbcm9vbV07XG4gICAgICBkZWxldGVkUm9vbSA9IHRydWU7XG4gICAgfVxuICAgIC8vIFJldHVybiBhIGZsYWcgaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMgd2FzIHRoZSBsYXN0IGxpc3RlbmVyXG4gICAgLy8gdG8gdGhpcyByb29tOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlLmcuIHVuc3VzY3JpYmUgZnJvbSBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGRlbGV0ZWRSb29tIH07XG4gIH1cblxuICBhZGRBY3Rpb25IYW5kbGVyKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgICh0aGlzLmFjdGlvbnMubWF0Y2goYWN0aW9uKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKCF0aGlzLmFjdGlvbnNbYWN0aW9uXSkge1xuICAgICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0gPSBbXTtcbiAgICAgIGNyZWF0ZWRBY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXS5wdXNoKGhhbmRsZXIpO1xuICAgIHJldHVybiB7IGNyZWF0ZWRBY3Rpb24gfTtcbiAgfVxuXG4gIHJlbW92ZUFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0uc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBfLmNvbnRhaW5zKHRoaXMuYWN0aW9uc1thY3Rpb25dLCBoYW5kbGVyKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIC8vIExvb3AgdGhyb3VnaCB0aGUgbGlzdCBvZiBoYW5kbGVycyBoZXJlO1xuICAgIC8vIFdlIGRvbid0IGV4cGVjdCB0byBoYXZlIF90aGF0XyBtdWNoIGRpZmZlcmVudCBoYW5kbGVyc1xuICAgIC8vIGZvciBhIGdpdmVuIGFjdGlvbiwgc28gcGVyZm9ybWFuY2UgaW1wbGljYXRpb25zXG4gICAgLy8gc2hvdWxkIGJlIGNvbXBsZXRlbHkgbmVnbGlnaWJsZS5cbiAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXSA9IF8ud2l0aG91dCh0aGlzLmFjdGlvbnNbYWN0aW9uXSwgaGFuZGxlcik7XG4gICAgbGV0IGRlbGV0ZWRBY3Rpb24gPSBmYWxzZTtcbiAgICBpZih0aGlzLmFjdGlvbnNbYWN0aW9uXS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmFjdGlvbnNbYWN0aW9uXTtcbiAgICAgIGRlbGV0ZWRBY3Rpb24gPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4geyBkZWxldGVkQWN0aW9uIH07XG4gIH1cblxuICAqZGlzcGF0Y2goYWN0aW9uLCBwYXJhbXMgPSB7fSkgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgcGFyYW1zLmd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAodGhpcy5hY3Rpb25zW2FjdGlvbl0ubWF0Y2goYWN0aW9uKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICAvLyBSdW4gYWxsIGhhbmRsZXJzIGNvbmN1cnJlbnRseSBhbmQgcmV0dXJuIHRoZSBsaXN0IG9mIHRoZSByZXN1bHRzXG4gICAgLy8gKGVtcHR5IGxpc3QgaWYgbm8gaGFuZGxlcnMpLlxuICAgIC8vIElmIGFuIGFjdGlvbiBoYW5kbGVyIHRocm93cywgdGhlbiBkaXNwYXRjaCB3aWxsIHRocm93LCBidXQgdGhlIG90aGVycyBoYW5kbGVyc1xuICAgIC8vIGNhbiBzdGlsbCBzdWNjZWVkLlxuICAgIHJldHVybiB5aWVsZCAodGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dID8gdGhpcy5hY3Rpb25IYW5kbGVyc1thY3Rpb25dIDogW10pIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIC5tYXAoKGhhbmRsZXIpID0+IGhhbmRsZXIuY2FsbChudWxsLCBwYXJhbXMpKTtcbiAgfVxuXG4gIGhhc1Nlc3Npb24oZ3VpZCkge1xuICAgIHJldHVybiAhIXRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gIH1cblxuICBjcmVhdGVTZXNzaW9uKGd1aWQpIHtcbiAgICBfLmRldigoKSA9PiBndWlkLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgaWYoIXRoaXMuc2Vzc2lvbnNbZ3VpZF0pIHtcbiAgICAgIHRoaXMuc2Vzc2lvbnNbZ3VpZF0gPSB0aGlzLnNlc3Npb25DcmVhdGVkKG5ldyBTZXNzaW9uKHsgZ3VpZCwgdXBsaW5rOiB0aGlzIH0pKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gIH1cblxuICBkZWxldGVTZXNzaW9uKGd1aWQpIHtcbiAgICBfLmRldigoKSA9PiBndWlkLnNob3VsZC5iZS5hLlN0cmluZyk7XG4gICAgbGV0IHNlc3Npb24gPSB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICAgIHNlc3Npb24uZGVzdHJveSgpO1xuICAgIGRlbGV0ZSB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICAgIHJldHVybiB0aGlzLnNlc3Npb25EZWxldGVkKHNlc3Npb24pO1xuICB9XG5cbiAgLy8gTm8tb3AgcGxhY2Vob2xkZXIsIHRvIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0byBpbml0aWFsaXplXG4gIC8vIHNlc3Npb24tcmVsYXRlZCByZXNvdXJjZXMuXG4gIC8vIEltcGxlbWVudGF0aW9uIHNob3VsZCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgY3JlYXRlZCBzZXNzaW9uLlxuICBzZXNzaW9uQ3JlYXRlZChzZXNzaW9uKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgfVxuXG4gIC8vIE5vLW9wIHBsYWNlaG9sZGVyLCB0byBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdG8gY2xlYW4tdXBcbiAgLy8gc2Vzc2lvbi1yZWxhdGVkIHJlc291cmNlcy5cbiAgLy8gSW1wbGVtZW50YXRpb24gc2hvdWxkIHJldHVybiBhIFByb21pc2UgZm9yIHRoZSBkZWxldGVkIHNlc3Npb24uXG4gIHNlc3Npb25EZWxldGVkKHNlc3Npb24pIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNlc3Npb24pO1xuICB9XG59XG5cbl8uZXh0ZW5kKFVwbGlua1NpbXBsZVNlcnZlci5wcm90b3R5cGUsIHtcbiAgc3RvcmVzOiBudWxsLFxuICByb29tczogbnVsbCxcbiAgYWN0aW9uczogbnVsbCxcbiAgYXBwOiBudWxsLFxuICBzZXJ2ZXI6IG51bGwsXG5cbiAgX2RhdGE6IG51bGwsXG5cbiAgY29ubmVjdGlvbnM6IG51bGwsXG4gIHNlc3Npb25zOiBudWxsLFxuXG4gIHN1YnNjcmliZXJzOiBudWxsLFxuICBsaXN0ZW5lcnM6IG51bGwsXG4gIGFjdGlvbkhhbmRsZXJzOiBudWxsLFxufSk7XG5cbkNvbm5lY3Rpb24gPSByZXF1aXJlKCcuL0Nvbm5lY3Rpb24nKSh7IFVwbGlua1NpbXBsZVNlcnZlciB9KTtcblNlc3Npb24gPSByZXF1aXJlKCcuL1Nlc3Npb24nKSh7IENvbm5lY3Rpb24sIFVwbGlua1NpbXBsZVNlcnZlciB9KTtcblxubW9kdWxlLmV4cG9ydHMgPSBVcGxpbmtTaW1wbGVTZXJ2ZXI7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=