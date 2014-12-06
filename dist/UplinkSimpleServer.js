"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
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
      return instanceOfSocketIO(socket).should.be.ok && (_this.connections[socket.id] === void 0).should.be.ok;
    });
    this.connections[socket.id] = new Connection({ socket: socket, uplink: this });
    socket.on("disconnect", function () {
      return ioHandlers.disconnection.call(_this, socket);
    });
  },

  disconnection: function (socket) {
    var _this2 = this;
    _.dev(function () {
      return socket.should.be.an.Object && socket.on.should.be.a.Function && socket.emit.should.be.a.Function && socket.id.should.be.a.String && (_this2.connections[socket.id] !== void 0).should.be.ok && (_this2.connections[socket.id].socket !== void 0).should.be.ok && _this2.connections[socket.id].socket.should.be.exactly(socket);
    });
    this.connections[socket.id].destroy();
    delete this.connections[socket.id];
  } };

// Most public methods expose an async API
// to enforce consistence with async data backends,
// eg. redis or mysql, although in this implementation
// the backend resides in memory (a simple Object acting
// as an associative map).
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
    var createConstantRouter = function (t) {
      return new ConstantRouter(_.object(t.map(function (v) {
        return [v, v];
      })));
    };
    this.stores = createConstantRouter(stores);
    this.rooms = createConstantRouter(rooms);
    this.actions = createConstantRouter(actions);
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

  UplinkSimpleServer.prototype.listen = function (port, fn) {
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
        return io.on(event, function (params) {
          _.dev(function () {
            return console.warn("nexus-uplink-simple-server", "<<", event);
          });
          ioHandlers[event].call(_this3, params);
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
          _.dev(function () {
            return console.warn("GET " + req.path, value);
          });
          res.status(200).type("application/json").send(value);
        })["catch"](function (e) {
          _.dev(function () {
            return console.warn("GET " + req.path, e, e.stack);
          });
          if (e instanceof HTTPExceptions.HTTPError) {
            HTTPExceptions.forward(res, e);
          } else {
            (function () {
              var json = { err: e.toString() };
              _.dev(function () {
                return json.stack = e.stack;
              });
              res.status(500).json(json);
            })();
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
  };

  UplinkSimpleServer.prototype.pull = function (path) {
    var _this4 = this;
    return Promise["try"](function () {
      _.dev(function () {
        return path.should.be.a.String && (_this4.stores.match(path) !== null).should.be.ok;
      });
      return _this4._data[path];
    });
  };

  UplinkSimpleServer.prototype.push = regeneratorRuntime.mark(function _callee(path, value) {
    var _this5 = this;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (true) switch (_context.prev = _context.next) {
        case 0: _context.next = 2;
          return _this5.update(path, value);
        case 2: return _context.abrupt("return", _context.sent);
        case 3:
        case "end": return _context.stop();
      }
    }, _callee, this);
  });
  UplinkSimpleServer.prototype.update = regeneratorRuntime.mark(function _callee2(path, value) {
    var _this6 = this;
    var hash, diff;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (true) switch (_context2.prev = _context2.next) {
        case 0: // jshint ignore:line
          _.dev(function () {
            return path.should.be.a.String && value.should.be.an.Object && (_this6.stores.match(path) !== null).should.be.ok;
          });
          if (!_this6.subscribers[path]) {
            _context2.next = 8;
            break;
          }
          // Diff and JSON-encode as early as possible to avoid duplicating
          // these lengthy calculations down the propagation tree.
          // If no value was present before, then nullify the hash. No value has a null hash.
          if (!_this6._data[path]) {
            hash = null;
          } else {
            hash = _.hash(_this6._data[path]);
            diff = _.diff(_this6._data[path], value);
          }
          _this6._data[path] = value;
          _context2.next = 6;
          return Object.keys(_this6.subscribers[path]) // jshint ignore:line
          .map(function (k) {
            return _this6.subscribers[path][k].update(path, { hash: hash, diff: diff });
          });
        case 6: _context2.next = 9;
          break;
        case 8:
          _this6._data[path] = value;
        case 9:
        case "end": return _context2.stop();
      }
    }, _callee2, this);
  });
  UplinkSimpleServer.prototype.subscribeTo = function (path, session) {
    var _this7 = this;
    _.dev(function () {
      return path.should.be.a.String && session.should.be.an.instanceOf(Session);
    });
    var createdPath;
    if (this.subscribers[path]) {
      // Fail early to avoid creating leaky entry in this.subscribers
      _.dev(function () {
        return (_this7.subscribers[path][session.id] === void 0).should.be.ok;
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
  };

  UplinkSimpleServer.prototype.unsubscribeFrom = function (path, session) {
    var _this8 = this;
    _.dev(function () {
      return path.should.be.a.String && session.should.be.an.instanceOf(Session) && (_this8.subscribers[path] !== void 0).should.be.ok && _this8.subscribers[path].should.be.an.Object && (_this8.subscribers[path][session.id] !== void 0).should.be.ok && _this8.subscribers[path][session.id].should.be.exactly(session);
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
  };

  UplinkSimpleServer.prototype.emit = regeneratorRuntime.mark(function _callee3(room, params) {
    var _this9 = this;
    var json;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (true) switch (_context3.prev = _context3.next) {
        case 0: // jshint ignore:line
          _.dev(function () {
            return room.should.be.a.String && params.should.be.an.Object && (_this9.rooms.match(room) !== null).should.be.ok;
          });
          if (!_this9.listeners[room]) {
            _context3.next = 5;
            break;
          }
          // Encode as early as possible to avoid duplicating
          // this operation down the propagation tree.
          json = _.prollystringify(params);
          _context3.next = 5;
          return Object.keys(_this9.listeners[room]) // jshint ignore:line
          .map(function (k) {
            return _this9.listeners[room][k].emit(room, json);
          });
        case 5:
        case "end": return _context3.stop();
      }
    }, _callee3, this);
  });
  UplinkSimpleServer.prototype.listenTo = function (room, session) {
    var _this10 = this;
    _.dev(function () {
      return room.should.be.a.String && session.should.be.an.instanceOf(Session);
    });
    var createdRoom;
    if (this.listeners[room]) {
      // Fail early to avoid creating a leaky entry in this.listeners
      _.dev(function () {
        return (_this10.listeners[room][session.id] === void 0).should.be.ok;
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
  };

  UplinkSimpleServer.prototype.unlistenTo = function (room, session) {
    var _this11 = this;
    _.dev(function () {
      return room.should.be.a.String && session.should.be.an.instanceOf(Session) && (_this11.listeners[room] !== void 0).should.be.ok && _this11.listeners[room].should.be.exactly(session);
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
  };

  UplinkSimpleServer.prototype.addActionHandler = function (action, handler) {
    var _this12 = this;
    _.dev(function () {
      return action.should.be.a.String && handler.should.be.a.Function && (_this12.actions.match(action) !== null).should.be.ok;
    });
    var createdAction = false;
    if (!this.actions[action]) {
      this.actions[action] = [];
      createdAction = true;
    }
    this.actions[action].push(handler);
    return { createdAction: createdAction };
  };

  UplinkSimpleServer.prototype.removeActionHandler = function (action, handler) {
    var _this13 = this;
    _.dev(function () {
      return action.should.be.a.String && handler.should.be.a.Function && _this13.actions[action].should.be.an.Array && _.contains(_this13.actions[action], handler).should.be.ok;
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
  };

  UplinkSimpleServer.prototype.dispatch = regeneratorRuntime.mark(function _callee4(action, params) {
    var _this14 = this;
    return regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (true) switch (_context4.prev = _context4.next) {
        case 0:
          if (params === undefined) params = {};
          // jshint ignore:line
          _.dev(function () {
            return action.should.be.a.String && params.should.be.an.Object && params.guid.should.be.a.String && (_this14.actions[action].match(action) !== null).should.be.ok;
          });
          _context4.next = 4;
          return (_this14.actionHandlers[action] ? _this14.actionHandlers[action] : []) // jshint ignore:line
          .map(function (handler) {
            return handler.call(null, params);
          });
        case 4: return _context4.abrupt("return", _context4.sent);
        case 5:
        case "end": return _context4.stop();
      }
    }, _callee4, this);
  });
  UplinkSimpleServer.prototype.hasSession = function (guid) {
    return !!this.sessions[guid];
  };

  UplinkSimpleServer.prototype.getSession = function (guid) {
    _.dev(function () {
      return guid.should.be.a.String;
    });
    if (!this.sessions[guid]) {
      this.sessions[guid] = this.sessionCreated(new Session({ guid: guid, uplink: this }));
    }
    return this.sessions[guid];
  };

  UplinkSimpleServer.prototype.deleteSession = function (guid) {
    _.dev(function () {
      return guid.should.be.a.String;
    });
    var session = this.sessions[guid];
    session.destroy();
    delete this.sessions[guid];
    return this.sessionDeleted(session);
  };

  UplinkSimpleServer.prototype.sessionCreated = function (session) {
    return Promise.resolve(session);
  };

  UplinkSimpleServer.prototype.sessionDeleted = function (session) {
    return Promise.resolve(session);
  };

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