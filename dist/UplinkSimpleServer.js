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
          }).catch(function (e) {
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
          }).catch(function (e) {
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
              json = _.prollystringify(params);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9VcGxpbmtTaW1wbGVTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLElBQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxJQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsY0FBYyxDQUFDO0FBQzlELElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2xELElBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzs7QUFFN0IsSUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUMzRCxJQUFJLFVBQVUsRUFBRSxPQUFPLENBQUM7O0FBRXhCLElBQU0sVUFBVSxHQUFHO0FBQ2pCLFlBQVUsRUFBQSxVQUFDLE1BQU0sRUFBRTs7QUFDakIsS0FBQyxDQUFDLEdBQUcsQ0FBQzthQUFNLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUNqRCxNQUFLLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtLQUFBLENBQzdDLENBQUM7QUFDRixRQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDdkUsVUFBTSxD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QyxPQUFPLENBQUMsQ0FBQztPQUNqQzs7OztTQWpURyxrQkFBa0I7OztBQW9UeEIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLEVBQUU7QUFDckMsUUFBTSxFQUFFLElBQUk7QUFDWixPQUFLLEVBQUUsSUFBSTtBQUNYLFNBQU8sRUFBRSxJQUFJO0FBQ2IsS0FBRyxFQUFFLElBQUk7QUFDVCxRQUFNLEVBQUUsSUFBSTs7QUFFWixPQUFLLEVBQUUsSUFBSTs7QUFFWCxhQUFXLEVBQUUsSUFBSTtBQUNqQixVQUFRLEVBQUUsSUFBSTs7QUFFZCxhQUFXLEVBQUUsSUFBSTtBQUNqQixXQUFTLEVBQUUsSUFBSTtBQUNmLGdCQUFjLEVBQUUsSUFBSSxFQUNyQixDQUFDLENBQUM7O0FBRUgsVUFBVSxHQUFHLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixFQUFsQixrQkFBa0IsRUFBRSxDQUFDLENBQUM7QUFDN0QsT0FBTyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLFVBQVUsRUFBVixVQUFVLEVBQUUsa0JBQWtCLEVBQWxCLGtCQUFrQixFQUFFLENBQUMsQ0FBQzs7QUFFbkUsTUFBTSxDQUFDLE9BQU8sR0FBRyxrQkFBa0IsQ0FBQyIsImZpbGUiOiJVcGxpbmtTaW1wbGVTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJyZXF1aXJlKCc2dG81L3BvbHlmaWxsJyk7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5jb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcbmNvbnN0IGJvZHlQYXJzZXIgPSByZXF1aXJlKCdib2R5LXBhcnNlcicpO1xuY29uc3QgQ29uc3RhbnRSb3V0ZXIgPSByZXF1aXJlKCduZXh1cy1yb3V0ZXInKS5Db25zdGFudFJvdXRlcjtcbmNvbnN0IEhUVFBFeGNlcHRpb25zID0gcmVxdWlyZSgnaHR0cC1leGNlcHRpb25zJyk7XG5jb25zdCBodHRwID0gcmVxdWlyZSgnaHR0cCcpO1xuXG5jb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xubGV0IENvbm5lY3Rpb24sIFNlc3Npb247XG5cbmNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gIGNvbm5lY3Rpb24oc29ja2V0KSB7XG4gICAgXy5kZXYoKCkgPT4gaW5zdGFuY2VPZlNvY2tldElPKHNvY2tldCkuc2hvdWxkLmJlLm9rICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uc2hvdWxkLm5vdC5iZS5va1xuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdID0gbmV3IENvbm5lY3Rpb24oeyBzb2NrZXQsIHVwbGluazogdGhpcyB9KTtcbiAgICBzb2NrZXQub24oJ2Rpc2Nvbm5lY3QnLCAoKSA9PiBpb0hhbmRsZXJzLmRpc2Nvbm5lY3Rpb24uY2FsbCh0aGlzLCBzb2NrZXQpKTtcbiAgfSxcblxuICBkaXNjb25uZWN0aW9uKHNvY2tldCkge1xuICAgIF8uZGV2KCgpID0+IHNvY2tldC5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBzb2NrZXQub24uc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHNvY2tldC5lbWl0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuaWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uc2hvdWxkLmJlLmV4YWN0bHkoc29ja2V0KVxuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdO1xuICB9LFxufTtcblxuLy8gTW9zdCBwdWJsaWMgbWV0aG9kcyBleHBvc2UgYW4gYXN5bmMgQVBJXG4vLyB0byBlbmZvcmNlIGNvbnNpc3RlbmNlIHdpdGggYXN5bmMgZGF0YSBiYWNrZW5kcyxcbi8vIGVnLiByZWRpcyBvciBteXNxbCwgYWx0aG91Z2ggaW4gdGhpcyBpbXBsZW1lbnRhdGlvblxuLy8gdGhlIGJhY2tlbmQgcmVzaWRlcyBpbiBtZW1vcnkgKGEgc2ltcGxlIE9iamVjdCBhY3Rpbmdcbi8vIGFzIGFuIGFzc29jaWF0aXZlIG1hcCkuXG5jbGFzcyBVcGxpbmtTaW1wbGVTZXJ2ZXIge1xuICAvLyBzdG9yZXMsIHJvb21zLCBhbmQgYWN0aW9ucyBhcmUgdGhyZWUgd2hpdGVsaXN0cyBvZlxuICAvLyBzdHJpbmcgcGF0dGVybnMuIEVhY2ggaXMgYW4gYXJyYXkgdGhhdCB3aWxsIGJlIHBhc3NlZFxuICAvLyB0byB0aGUgUm91dGVyIGNvbnN0cnVjdG9yLlxuICBjb25zdHJ1Y3Rvcih7IHBpZCwgc3RvcmVzLCByb29tcywgYWN0aW9ucywgYXBwIH0pIHtcbiAgICBfLmRldigoKSA9PiBzdG9yZXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICByb29tcy5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIGFjdGlvbnMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBhcHAuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgLy8gRHVja3R5cGUtY2hlY2sgZm9yIGFuIGV4cHJlc3MtbGlrZSBhcHBcbiAgICAgIGFwcC5nZXQuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIGFwcC5wb3N0LnNob3VsZC5iZS5hLkZ1bmN0aW9uXG4gICAgKTtcbiAgICAvLyBIZXJlIHdlIHVzZSBDb25zdGFudFJvdXRlciBpbnN0YW5jZXM7IHdlIG9ubHkgbmVlZFxuICAgIC8vIHRvIGtub3cgaWYgYSBnaXZlbiBzdHJpbmcgbWF0Y2ggYSByZWdpc3RlcmVkIHBhdHRlcm4uXG4gICAgdGhpcy5zdG9yZXMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIoc3RvcmVzKTtcbiAgICB0aGlzLnJvb21zID0gbmV3IENvbnN0YW50Um91dGVyKHJvb21zKTtcbiAgICB0aGlzLmFjdGlvbnMgPSBuZXcgQ29uc3RhbnRSb3V0ZXIoYWN0aW9ucyk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5zZXJ2ZXIgPSBodHRwLlNlcnZlcihhcHApO1xuXG4gICAgLy8gU3RvcmUgZGF0YSBjYWNoZVxuICAgIHRoaXMuX2RhdGEgPSB7fTtcblxuICAgIC8vIENvbm5lY3Rpb25zIHJlcHJlc2VudCBhY3R1YWwgbGl2aW5nIHNvY2tldC5pbyBjb25uZWN0aW9ucy5cbiAgICAvLyBTZXNzaW9uIHJlcHJlc2VudCBhIHJlbW90ZSBVcGxpbmsgY2xpZW50IGluc3RhbmNlLCB3aXRoIGEgdW5pcXVlIGd1aWQuXG4gICAgLy8gVGhlIGNvbmNlcHQgb2Ygc2Vzc2lvbiBlbmZvcmNlcyBjb25zaXN0ZW5jeSBiZXR3ZWVuIGl0cyBhdHRhY2hlZCBzb2NrZXQgY29ubmVjdGlvbnMsXG4gICAgLy8gYW5kIEhUVFAgcmVxdWVzdHMuXG4gICAgLy8gQSBzaW5nbGUgc2Vzc2lvbiBjYW4gYmUgYXR0YWNoZWQgdG8gemVybyBvciBtb3JlIHRoYW4gb25lIGNvbm5lY3Rpb24uXG4gICAgLy8gVXBsaW5rIGZyYW1lcyBhcmUgcmVjZWl2ZWQgZnJvbSBhbmQgc2VudCB0byBzZXNzaW9ucywgbm90IGNvbm5lY3Rpb24uXG4gICAgLy8gRWFjaCBzZXNzaW9uIG11c3Qga2VlcCByZWZlcmVuY2VzIHRvIGl0cyBhdHRhY2hlZCBjb25uZWN0aW9ucyBhbmQgcHJvcGFnYXRlXG4gICAgLy8gcmVsZXZhbnQgZnJhbWVzIGFjY29yZGluZ2x5LlxuICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fTtcbiAgICB0aGlzLnNlc3Npb25zID0ge307XG5cbiAgICB0aGlzLnN1YnNjcmliZXJzID0ge307XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLmFjdGlvbkhhbmRsZXJzID0ge307XG4gIH1cblxuICBsaXN0ZW4ocG9ydCkge1xuICAgIF8uZGV2KCgpID0+IHBvcnQuc2hvdWxkLmJlLmEuTnVtYmVyKTtcbiAgICBsZXQgeyBhcHAsIHNlcnZlciB9ID0gdGhpcztcbiAgICAvLyBzb2NrZXQuaW8gaGFuZGxlcnMgYXJlIGluc3RhbGxlZCBmaXJzdCwgdG8gcHJlLWVtcHQgc29tZSBwYXRocyBvdmVyIHRoZSBodHRwIGhhbmRsZXJzLlxuICAgIGxldCBpbyA9IHJlcXVpcmUoJ3NvY2tldC5pbycpKHNlcnZlcik7XG4gICAgLy8gRGVsZWdhdGUgdG8gc3RhdGljIGlvSGFuZGxlciBtZXRob2RzLCBidXQgY2FsbCB0aGVtIHdpdGggY29udGV4dC5cbiAgICBPYmplY3Qua2V5cyhpb0hhbmRsZXJzKVxuICAgIC5mb3JFYWNoKChldmVudCkgPT4gaW8ub24oZXZlbnQsIF8uc2NvcGUoaW9IYW5kbGVyc1tldmVudF0sIHRoaXMpKSk7XG5cbiAgICAvLyBGZXRjaCBmcm9tIHN0b3JlXG4gICAgYXBwLmdldCgnKicsXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgc3RvcmUgcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLnN0b3Jlcy5tYXRjaChyZXEucGF0aCkgPT09IG51bGwgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLk5vdEZvdW5kKHJlcS5wYXRoKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMucHVsbChyZXEucGF0aClcbiAgICAgICAgLnRoZW4oKHZhbHVlKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2spO1xuICAgICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgR0VUICR7cmVxLnBhdGh9YCwgdmFsdWUpKTtcbiAgICAgICAgICByZXMuc3RhdHVzKDIwMCkudHlwZSgnYXBwbGljYXRpb24vanNvbicpLnNlbmQodmFsdWUpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYEdFVCAke3JlcS5wYXRofWAsIGUpKTtcbiAgICAgICAgICBpZihlIGluc3RhbmNlb2YgSFRUUEV4Y2VwdGlvbnMuSFRUUEVycm9yKSB7XG4gICAgICAgICAgICBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGUudG9TdHJpbmcoKSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIERpc3BhdGNoIGFjdGlvblxuICAgIGFwcC5wb3N0KCcqJyxcbiAgICAgIC8vIFBhcnNlIGJvZHkgYXMgSlNPTlxuICAgICAgYm9keVBhcnNlci5qc29uKCksXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgYWN0aW9uIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5hY3Rpb25zLm1hdGNoKHJlcS5wYXRoKSA9PT0gbnVsbCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuTm90Rm91bmQocmVxLnBhdGgpKSA6IG5leHQoKSxcbiAgICAgIC8vIHBhcmFtcyBzaG91bGQgYmUgcHJlc2VudFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhXy5pc09iamVjdChyZXEuYm9keS5wYXJhbXMpID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5CYWRSZXF1ZXN0KCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbVxcJycpKSA6IG5leHQoKSxcbiAgICAgIC8vIENoZWNrIGZvciBhIHZhbGlkLCBhY3RpdmUgc2Vzc2lvbiBndWlkIGluIHBhcmFtc1xuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhcmVxLmJvZHkucGFyYW1zLmd1aWQgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLlVuYXV0aG9yaXplZCgnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogXFwncGFyYW1zXFwnLlxcJ2d1aWRcXCcnKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICF0aGlzLmlzQWN0aXZlU2Vzc2lvbihyZXEuYm9keS5wYXJhbXMuZ3VpZCkgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdJbnZhbGlkIFxcJ2d1aWRcXCcuJykpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLmRpc3BhdGNoKHJlcS5wYXRoLCByZXEuYm9keS5wYXJhbXMpXG4gICAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgIF8uZGV2KCgpID0+IGNvbnNvbGUud2FybihgUE9TVCAke3JlcS5wYXRofWAsIHJlcS5ib2R5LCByZXN1bHQpKTtcbiAgICAgICAgcmVzLnN0YXR1cygyMDApLmpzb24ocmVzdWx0KTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHtcbiAgICAgICAgICBfLmRldigoKSA9PiBjb25zb2xlLndhcm4oYFBPU1QgJHtyZXEucGF0aH1gLCByZXEuYm9keSwgZSkpO1xuICAgICAgICAgIGlmKGUgaW5zdGFuY2VvZiBIVFRQRXhjZXB0aW9ucy5IVFRQRXJyb3IpIHtcbiAgICAgICAgICAgIEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycjogZS50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcbiAgICBzZXJ2ZXIubGlzdGVuKHBvcnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVsbChwYXRoKSB7XG4gICAgcmV0dXJuIFByb21pc2UudHJ5KCgpID0+IHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgICh0aGlzLnN0b3Jlcy5tYXRjaChwYXRoKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRoaXMuX2RhdGFbcGF0aF07XG4gICAgfSk7XG4gIH1cblxuICAqdXBkYXRlKHBhdGgsIHZhbHVlKSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICB2YWx1ZS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgbGV0IGhhc2gsIGRpZmY7XG4gICAgaWYodGhpcy5zdWJzY3JpYmVyc1twYXRoXSkge1xuICAgICAgLy8gRGlmZiBhbmQgSlNPTi1lbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgIC8vIHRoZXNlIGxlbmd0aHkgY2FsY3VsYXRpb25zIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICAvLyBJZiBubyB2YWx1ZSB3YXMgcHJlc2VudCBiZWZvcmUsIHRoZW4gbnVsbGlmeSB0aGUgaGFzaC4gTm8gdmFsdWUgaGFzIGEgbnVsbCBoYXNoLlxuICAgICAgaWYoIXRoaXMuX2RhdGFbcGF0aF0pIHtcbiAgICAgICAgaGFzaCA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaGFzaCA9IF8uaGFzaCh0aGlzLl9kYXRhW3BhdGhdKTtcbiAgICAgICAgZGlmZiA9IF8uZGlmZih0aGlzLl9kYXRhW3BhdGhdLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgICAvLyBEaXJlY3RseSBwYXNzIHRoZSBwYXRjaCwgc2Vzc2lvbnMgZG9uJ3QgbmVlZCB0byBiZSBhd2FyZVxuICAgICAgLy8gb2YgdGhlIGFjdHVhbCBjb250ZW50czsgdGhleSBvbmx5IG5lZWQgdG8gZm9yd2FyZCB0aGUgZGlmZlxuICAgICAgLy8gdG8gdGhlaXIgYXNzb2NpYXRlZCBjbGllbnRzLlxuICAgICAgeWllbGQgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAubWFwKChzZXNzaW9uKSA9PiBzZXNzaW9uLnVwZGF0ZShwYXRoLCB7IGhhc2gsIGRpZmYgfSkpO1xuICAgIH1cbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRQYXRoO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgbGVha3kgZW50cnkgaW4gdGhpcy5zdWJzY3JpYmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQubm90LmJlLm9rKTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXSA9IHt9O1xuICAgICAgY3JlYXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdLnNob3VsZC5iZS5leGFjdGx5KHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmliZXJzW3BhdGhdO1xuICAgICAgZGVsZXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiB1bnNidXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gICplbWl0KHJvb20sIHBhcmFtcykgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgICh0aGlzLnJvb21zLm1hdGNoKHJvb20pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBqc29uO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBFbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgIC8vIHRoaXMgb3BlcmF0aW9uIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICBqc29uID0gXy5wcm9sbHlzdHJpbmdpZnkocGFyYW1zKTtcbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgIC5tYXAoKHNlc3Npb24pID0+IHNlc3Npb24uZW1pdChyb29tLCBqc29uKSk7XG4gICAgfVxuICB9XG5cbiAgbGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZFJvb207XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgYSBsZWFreSBlbnRyeSBpbiB0aGlzLmxpc3RlbmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF0uc2hvdWxkLm5vdC5iZS5vayk7XG4gICAgICBjcmVhdGVkUm9vbSA9IGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dID0ge307XG4gICAgICBjcmVhdGVkUm9vbSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBsaXN0ZW5lclxuICAgIC8vIHRvIHRoaXMgcm9vbTsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZS5nLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUm9vbSB9O1xuICB9XG5cbiAgdW5saXN0ZW5Ubyhyb29tLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbikgJiZcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdLnNob3VsZC5iZS5leGFjdGx5KHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFJvb20gPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF07XG4gICAgaWYoT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcm9vbV0pLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dO1xuICAgICAgZGVsZXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBsaXN0ZW5lclxuICAgIC8vIHRvIHRoaXMgcm9vbTsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZS5nLiB1bnN1c2NyaWJlIGZyb20gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBkZWxldGVkUm9vbSB9O1xuICB9XG5cbiAgYWRkQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICAodGhpcy5hY3Rpb25zLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRBY3Rpb24gPSBmYWxzZTtcbiAgICBpZighdGhpcy5hY3Rpb25zW2FjdGlvbl0pIHtcbiAgICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dID0gW107XG4gICAgICBjcmVhdGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0ucHVzaChoYW5kbGVyKTtcbiAgICByZXR1cm4geyBjcmVhdGVkQWN0aW9uIH07XG4gIH1cblxuICByZW1vdmVBY3Rpb25IYW5kbGVyKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgXy5jb250YWlucyh0aGlzLmFjdGlvbnNbYWN0aW9uXSwgaGFuZGxlcikuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICAvLyBMb29wIHRocm91Z2ggdGhlIGxpc3Qgb2YgaGFuZGxlcnMgaGVyZTtcbiAgICAvLyBXZSBkb24ndCBleHBlY3QgdG8gaGF2ZSBfdGhhdF8gbXVjaCBkaWZmZXJlbnQgaGFuZGxlcnNcbiAgICAvLyBmb3IgYSBnaXZlbiBhY3Rpb24sIHNvIHBlcmZvcm1hbmNlIGltcGxpY2F0aW9uc1xuICAgIC8vIHNob3VsZCBiZSBjb21wbGV0ZWx5IG5lZ2xpZ2libGUuXG4gICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0gPSBfLndpdGhvdXQodGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpO1xuICAgIGxldCBkZWxldGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYodGhpcy5hY3Rpb25zW2FjdGlvbl0ubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5hY3Rpb25zW2FjdGlvbl07XG4gICAgICBkZWxldGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHsgZGVsZXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgKmRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zID0ge30pIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHBhcmFtcy5ndWlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgKHRoaXMuYWN0aW9uc1thY3Rpb25dLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gUnVuIGFsbCBoYW5kbGVycyBjb25jdXJyZW50bHkgYW5kIHJldHVybiB0aGUgbGlzdCBvZiB0aGUgcmVzdWx0c1xuICAgIC8vIChlbXB0eSBsaXN0IGlmIG5vIGhhbmRsZXJzKS5cbiAgICAvLyBJZiBhbiBhY3Rpb24gaGFuZGxlciB0aHJvd3MsIHRoZW4gZGlzcGF0Y2ggd2lsbCB0aHJvdywgYnV0IHRoZSBvdGhlcnMgaGFuZGxlcnNcbiAgICAvLyBjYW4gc3RpbGwgc3VjY2VlZC5cbiAgICByZXR1cm4geWllbGQgKHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA/IHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA6IFtdKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAubWFwKChoYW5kbGVyKSA9PiBoYW5kbGVyLmNhbGwobnVsbCwgcGFyYW1zKSk7XG4gIH1cblxuICBoYXNTZXNzaW9uKGd1aWQpIHtcbiAgICByZXR1cm4gISF0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgY3JlYXRlU2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnNlc3Npb25zW2d1aWRdKSB7XG4gICAgICB0aGlzLnNlc3Npb25zW2d1aWRdID0gdGhpcy5zZXNzaW9uQ3JlYXRlZChuZXcgU2Vzc2lvbih7IGd1aWQsIHVwbGluazogdGhpcyB9KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgZGVsZXRlU2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGxldCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uRGVsZXRlZChzZXNzaW9uKTtcbiAgfVxuXG4gIC8vIE5vLW9wIHBsYWNlaG9sZGVyLCB0byBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdG8gaW5pdGlhbGl6ZVxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGNyZWF0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkNyZWF0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGNsZWFuLXVwXG4gIC8vIHNlc3Npb24tcmVsYXRlZCByZXNvdXJjZXMuXG4gIC8vIEltcGxlbWVudGF0aW9uIHNob3VsZCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgZGVsZXRlZCBzZXNzaW9uLlxuICBzZXNzaW9uRGVsZXRlZChzZXNzaW9uKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgfVxufVxuXG5fLmV4dGVuZChVcGxpbmtTaW1wbGVTZXJ2ZXIucHJvdG90eXBlLCB7XG4gIHN0b3JlczogbnVsbCxcbiAgcm9vbXM6IG51bGwsXG4gIGFjdGlvbnM6IG51bGwsXG4gIGFwcDogbnVsbCxcbiAgc2VydmVyOiBudWxsLFxuXG4gIF9kYXRhOiBudWxsLFxuXG4gIGNvbm5lY3Rpb25zOiBudWxsLFxuICBzZXNzaW9uczogbnVsbCxcblxuICBzdWJzY3JpYmVyczogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBhY3Rpb25IYW5kbGVyczogbnVsbCxcbn0pO1xuXG5Db25uZWN0aW9uID0gcmVxdWlyZSgnLi9Db25uZWN0aW9uJykoeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5TZXNzaW9uID0gcmVxdWlyZSgnLi9TZXNzaW9uJykoeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rU2ltcGxlU2VydmVyO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9