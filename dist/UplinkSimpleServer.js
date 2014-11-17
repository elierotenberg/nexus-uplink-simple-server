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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImY6L1VzZXJzL0VsaWUvZ2l0L3JlYWN0L25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9VcGxpbmtTaW1wbGVTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLElBQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxJQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsY0FBYyxDQUFDO0FBQzlELElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2xELElBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQzs7QUFFN0IsSUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQUMzRCxJQUFJLFVBQVUsRUFBRSxPQUFPLENBQUM7O0FBRXhCLElBQU0sVUFBVSxHQUFHO0FBQ2pCLFlBQVUsRUFBQSxVQUFDLE1BQU0sRUFBRTs7QUFDakIsS0FBQyxDQUFDLEdBQUcsQ0FBQzthQUFNLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUNqRCxNQUFLLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtLQUFBLENBQzdDLENBQUM7QUFDRixRQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxFQUFFLE1BQU0sRUFBTixNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDdkUsVUFBTSxD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QUFFLElBQUk7QUFDakIsVUFBUSxFQUFFLElBQUk7O0FBRWQsYUFBVyxFQUFFLElBQUk7QUFDakIsV0FBUyxFQUFFLElBQUk7QUFDZixnQkFBYyxFQUFFLElBQUksRUFDckIsQ0FBQyxDQUFDOztBQUVILFVBQVUsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsRUFBbEIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0FBQzdELE9BQU8sR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQVYsVUFBVSxFQUFFLGtCQUFrQixFQUFsQixrQkFBa0IsRUFBRSxDQUFDLENBQUM7O0FBRW5FLE1BQU0sQ0FBQyxPQUFPLEdBQUcsa0JBQWtCLENBQUMiLCJmaWxlIjoiVXBsaW5rU2ltcGxlU2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG5jb25zdCBib2R5UGFyc2VyID0gcmVxdWlyZSgnYm9keS1wYXJzZXInKTtcbmNvbnN0IENvbnN0YW50Um91dGVyID0gcmVxdWlyZSgnbmV4dXMtcm91dGVyJykuQ29uc3RhbnRSb3V0ZXI7XG5jb25zdCBIVFRQRXhjZXB0aW9ucyA9IHJlcXVpcmUoJ2h0dHAtZXhjZXB0aW9ucycpO1xuY29uc3QgaHR0cCA9IHJlcXVpcmUoJ2h0dHAnKTtcblxuY29uc3QgaW5zdGFuY2VPZlNvY2tldElPID0gcmVxdWlyZSgnLi9pbnN0YW5jZU9mU29ja2V0SU8nKTtcbmxldCBDb25uZWN0aW9uLCBTZXNzaW9uO1xuXG5jb25zdCBpb0hhbmRsZXJzID0ge1xuICBjb25uZWN0aW9uKHNvY2tldCkge1xuICAgIF8uZGV2KCgpID0+IGluc3RhbmNlT2ZTb2NrZXRJTyhzb2NrZXQpLnNob3VsZC5iZS5vayAmJlxuICAgICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLnNob3VsZC5ub3QuYmUub2tcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXSA9IG5ldyBDb25uZWN0aW9uKHsgc29ja2V0LCB1cGxpbms6IHRoaXMgfSk7XG4gICAgc29ja2V0Lm9uKCdkaXNjb25uZWN0JywgKCkgPT4gaW9IYW5kbGVycy5kaXNjb25uZWN0aW9uLmNhbGwodGhpcywgc29ja2V0KSk7XG4gIH0sXG5cbiAgZGlzY29ubmVjdGlvbihzb2NrZXQpIHtcbiAgICBfLmRldigoKSA9PiBzb2NrZXQuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgc29ja2V0Lm9uLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuZW1pdC5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgc29ja2V0LmlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLnNob3VsZC5iZS5leGFjdGx5KHNvY2tldClcbiAgICApO1xuICAgIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXS5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbnNbc29ja2V0LmlkXTtcbiAgfSxcbn07XG5cbi8vIE1vc3QgcHVibGljIG1ldGhvZHMgZXhwb3NlIGFuIGFzeW5jIEFQSVxuLy8gdG8gZW5mb3JjZSBjb25zaXN0ZW5jZSB3aXRoIGFzeW5jIGRhdGEgYmFja2VuZHMsXG4vLyBlZy4gcmVkaXMgb3IgbXlzcWwsIGFsdGhvdWdoIGluIHRoaXMgaW1wbGVtZW50YXRpb25cbi8vIHRoZSBiYWNrZW5kIHJlc2lkZXMgaW4gbWVtb3J5IChhIHNpbXBsZSBPYmplY3QgYWN0aW5nXG4vLyBhcyBhbiBhc3NvY2lhdGl2ZSBtYXApLlxuY2xhc3MgVXBsaW5rU2ltcGxlU2VydmVyIHtcbiAgLy8gc3RvcmVzLCByb29tcywgYW5kIGFjdGlvbnMgYXJlIHRocmVlIHdoaXRlbGlzdHMgb2ZcbiAgLy8gc3RyaW5nIHBhdHRlcm5zLiBFYWNoIGlzIGFuIGFycmF5IHRoYXQgd2lsbCBiZSBwYXNzZWRcbiAgLy8gdG8gdGhlIFJvdXRlciBjb25zdHJ1Y3Rvci5cbiAgY29uc3RydWN0b3IoeyBwaWQsIHN0b3Jlcywgcm9vbXMsIGFjdGlvbnMsIGFwcCB9KSB7XG4gICAgXy5kZXYoKCkgPT4gc3RvcmVzLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgcm9vbXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBhY3Rpb25zLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgYXBwLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIC8vIER1Y2t0eXBlLWNoZWNrIGZvciBhbiBleHByZXNzLWxpa2UgYXBwXG4gICAgICBhcHAuZ2V0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBhcHAucG9zdC5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgLy8gSGVyZSB3ZSB1c2UgQ29uc3RhbnRSb3V0ZXIgaW5zdGFuY2VzOyB3ZSBvbmx5IG5lZWRcbiAgICAvLyB0byBrbm93IGlmIGEgZ2l2ZW4gc3RyaW5nIG1hdGNoIGEgcmVnaXN0ZXJlZCBwYXR0ZXJuLlxuICAgIHRoaXMuc3RvcmVzID0gbmV3IENvbnN0YW50Um91dGVyKHN0b3Jlcyk7XG4gICAgdGhpcy5yb29tcyA9IG5ldyBDb25zdGFudFJvdXRlcihyb29tcyk7XG4gICAgdGhpcy5hY3Rpb25zID0gbmV3IENvbnN0YW50Um91dGVyKGFjdGlvbnMpO1xuICAgIHRoaXMuYXBwID0gYXBwO1xuICAgIHRoaXMuc2VydmVyID0gaHR0cC5TZXJ2ZXIoYXBwKTtcblxuICAgIC8vIFN0b3JlIGRhdGEgY2FjaGVcbiAgICB0aGlzLl9kYXRhID0ge307XG5cbiAgICAvLyBDb25uZWN0aW9ucyByZXByZXNlbnQgYWN0dWFsIGxpdmluZyBzb2NrZXQuaW8gY29ubmVjdGlvbnMuXG4gICAgLy8gU2Vzc2lvbiByZXByZXNlbnQgYSByZW1vdGUgVXBsaW5rIGNsaWVudCBpbnN0YW5jZSwgd2l0aCBhIHVuaXF1ZSBndWlkLlxuICAgIC8vIFRoZSBjb25jZXB0IG9mIHNlc3Npb24gZW5mb3JjZXMgY29uc2lzdGVuY3kgYmV0d2VlbiBpdHMgYXR0YWNoZWQgc29ja2V0IGNvbm5lY3Rpb25zLFxuICAgIC8vIGFuZCBIVFRQIHJlcXVlc3RzLlxuICAgIC8vIEEgc2luZ2xlIHNlc3Npb24gY2FuIGJlIGF0dGFjaGVkIHRvIHplcm8gb3IgbW9yZSB0aGFuIG9uZSBjb25uZWN0aW9uLlxuICAgIC8vIFVwbGluayBmcmFtZXMgYXJlIHJlY2VpdmVkIGZyb20gYW5kIHNlbnQgdG8gc2Vzc2lvbnMsIG5vdCBjb25uZWN0aW9uLlxuICAgIC8vIEVhY2ggc2Vzc2lvbiBtdXN0IGtlZXAgcmVmZXJlbmNlcyB0byBpdHMgYXR0YWNoZWQgY29ubmVjdGlvbnMgYW5kIHByb3BhZ2F0ZVxuICAgIC8vIHJlbGV2YW50IGZyYW1lcyBhY2NvcmRpbmdseS5cbiAgICB0aGlzLmNvbm5lY3Rpb25zID0ge307XG4gICAgdGhpcy5zZXNzaW9ucyA9IHt9O1xuXG4gICAgdGhpcy5zdWJzY3JpYmVycyA9IHt9O1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gICAgdGhpcy5hY3Rpb25IYW5kbGVycyA9IHt9O1xuICB9XG5cbiAgbGlzdGVuKHBvcnQpIHtcbiAgICBfLmRldigoKSA9PiBwb3J0LnNob3VsZC5iZS5hLk51bWJlcik7XG4gICAgbGV0IHsgYXBwLCBzZXJ2ZXIgfSA9IHRoaXM7XG4gICAgLy8gc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBpbnN0YWxsZWQgZmlyc3QsIHRvIHByZS1lbXB0IHNvbWUgcGF0aHMgb3ZlciB0aGUgaHR0cCBoYW5kbGVycy5cbiAgICBsZXQgaW8gPSByZXF1aXJlKCdzb2NrZXQuaW8nKShzZXJ2ZXIpO1xuICAgIC8vIERlbGVnYXRlIHRvIHN0YXRpYyBpb0hhbmRsZXIgbWV0aG9kcywgYnV0IGNhbGwgdGhlbSB3aXRoIGNvbnRleHQuXG4gICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAuZm9yRWFjaCgoZXZlbnQpID0+IGlvLm9uKGV2ZW50LCBfLnNjb3BlKGlvSGFuZGxlcnNbZXZlbnRdLCB0aGlzKSkpO1xuXG4gICAgLy8gRmV0Y2ggZnJvbSBzdG9yZVxuICAgIGFwcC5nZXQoJyonLFxuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGlzIHN0b3JlIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5zdG9yZXMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLnB1bGwocmVxLnBhdGgpXG4gICAgICAgIC50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+ICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rKTtcbiAgICAgICAgICByZXMuc3RhdHVzKDIwMCkudHlwZSgnYXBwbGljYXRpb24vanNvbicpLnNlbmQodmFsdWUpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IHsgY29uc29sZS5lcnJvcihlcnIsIGVyci5zdGFjayk7IH0pO1xuICAgICAgICAgIGlmKGVyciBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gRGlzcGF0Y2ggYWN0aW9uXG4gICAgYXBwLnBvc3QoJyonLFxuICAgICAgLy8gUGFyc2UgYm9keSBhcyBKU09OXG4gICAgICBib2R5UGFyc2VyLmpzb24oKSxcbiAgICAgIC8vIENoZWNrIHRoYXQgdGhpcyBhY3Rpb24gcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLmFjdGlvbnMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgLy8gcGFyYW1zIHNob3VsZCBiZSBwcmVzZW50XG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFfLmlzT2JqZWN0KHJlcS5ib2R5LnBhcmFtcykgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLkJhZFJlcXVlc3QoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IFxcJ3BhcmFtXFwnJykpIDogbmV4dCgpLFxuICAgICAgLy8gQ2hlY2sgZm9yIGEgdmFsaWQsIGFjdGl2ZSBzZXNzaW9uIGd1aWQgaW4gcGFyYW1zXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFyZXEuYm9keS5wYXJhbXMuZ3VpZCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbXNcXCcuXFwnZ3VpZFxcJycpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIXRoaXMuaXNBY3RpdmVTZXNzaW9uKHJlcS5ib2R5LnBhcmFtcy5ndWlkKSA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBIVFRQRXhjZXB0aW9ucy5VbmF1dGhvcml6ZWQoJ0ludmFsaWQgXFwnZ3VpZFxcJy4nKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMuZGlzcGF0Y2gocmVxLnBhdGgsIHJlcS5ib2R5LnBhcmFtcylcbiAgICAgIC50aGVuKChyZXN1bHQpID0+IHJlcy5zdGF0dXMoMjAwKS5qc29uKHJlc3VsdCkpXG4gICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IHsgY29uc29sZS5lcnJvcihlcnIsIGVyci5zdGFjayk7IH0pO1xuICAgICAgICAgIGlmKGVyciBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcbiAgICBzZXJ2ZXIubGlzdGVuKHBvcnQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVsbChwYXRoKSB7XG4gICAgcmV0dXJuIFByb21pc2UudHJ5KCgpID0+IHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgICh0aGlzLnN0b3Jlcy5tYXRjaChwYXRoKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRoaXMuX2RhdGFbcGF0aF07XG4gICAgfSk7XG4gIH1cblxuICAqdXBkYXRlKHBhdGgsIHZhbHVlKSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICB2YWx1ZS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgbGV0IGhhc2gsIGRpZmY7XG4gICAgaWYodGhpcy5zdWJzY3JpYmVyc1twYXRoXSkge1xuICAgICAgLy8gRGlmZiBhbmQgSlNPTi1lbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgIC8vIHRoZXNlIGxlbmd0aHkgY2FsY3VsYXRpb25zIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICAvLyBJZiBubyB2YWx1ZSB3YXMgcHJlc2VudCBiZWZvcmUsIHRoZW4gbnVsbGlmeSB0aGUgaGFzaC4gTm8gdmFsdWUgaGFzIGEgbnVsbCBoYXNoLlxuICAgICAgaWYoIXRoaXMuX2RhdGFbcGF0aF0pIHtcbiAgICAgICAgaGFzaCA9IG51bGw7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaGFzaCA9IF8uaGFzaCh0aGlzLl9kYXRhW3BhdGhdKTtcbiAgICAgICAgZGlmZiA9IF8uZGlmZih0aGlzLl9kYXRhW3BhdGhdLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgICAvLyBEaXJlY3RseSBwYXNzIHRoZSBwYXRjaCwgc2Vzc2lvbnMgZG9uJ3QgbmVlZCB0byBiZSBhd2FyZVxuICAgICAgLy8gb2YgdGhlIGFjdHVhbCBjb250ZW50czsgdGhleSBvbmx5IG5lZWQgdG8gZm9yd2FyZCB0aGUgZGlmZlxuICAgICAgLy8gdG8gdGhlaXIgYXNzb2NpYXRlZCBjbGllbnRzLlxuICAgICAgeWllbGQgT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAubWFwKChzZXNzaW9uKSA9PiBzZXNzaW9uLnVwZGF0ZShwYXRoLCB7IGhhc2gsIGRpZmYgfSkpO1xuICAgIH1cbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRQYXRoO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgbGVha3kgZW50cnkgaW4gdGhpcy5zdWJzY3JpYmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQubm90LmJlLm9rKTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXSA9IHt9O1xuICAgICAgY3JlYXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdLnNob3VsZC5iZS5leGFjdGx5KHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmliZXJzW3BhdGhdO1xuICAgICAgZGVsZXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiB1bnNidXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gICplbWl0KHJvb20sIHBhcmFtcykgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgICh0aGlzLnJvb21zLm1hdGNoKHJvb20pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBqc29uO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBFbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgIC8vIHRoaXMgb3BlcmF0aW9uIGRvd24gdGhlIHByb3BhZ2F0aW9uIHRyZWUuXG4gICAgICBqc29uID0gXy5wcm9sbHlzdHJpbmdpZnkocGFyYW1zKTtcbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAgIC5tYXAoKHNlc3Npb24pID0+IHNlc3Npb24uZW1pdChyb29tLCBqc29uKSk7XG4gICAgfVxuICB9XG5cbiAgbGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgY3JlYXRlZFJvb207XG4gICAgaWYodGhpcy5saXN0ZW5lcnNbcm9vbV0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgYSBsZWFreSBlbnRyeSBpbiB0aGlzLmxpc3RlbmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF0uc2hvdWxkLm5vdC5iZS5vayk7XG4gICAgICBjcmVhdGVkUm9vbSA9IGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dID0ge307XG4gICAgICBjcmVhdGVkUm9vbSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBsaXN0ZW5lclxuICAgIC8vIHRvIHRoaXMgcm9vbTsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZS5nLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUm9vbSB9O1xuICB9XG5cbiAgdW5saXN0ZW5Ubyhyb29tLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbikgJiZcbiAgICAgIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdLnNob3VsZC5iZS5leGFjdGx5KHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFJvb20gPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnNbcm9vbV1bc2Vzc2lvbi5pZF07XG4gICAgaWYoT2JqZWN0LmtleXModGhpcy5saXN0ZW5lcnNbcm9vbV0pLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dO1xuICAgICAgZGVsZXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBsaXN0ZW5lclxuICAgIC8vIHRvIHRoaXMgcm9vbTsgY2FuIGJlIHVzZWZ1bCB0byBpbXBsZW1lbnQgc3ViY2xhc3Mtc3BlY2lmaWMgaGFuZGxpbmdcbiAgICAvLyAoZS5nLiB1bnN1c2NyaWJlIGZyb20gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBkZWxldGVkUm9vbSB9O1xuICB9XG5cbiAgYWRkQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICAodGhpcy5hY3Rpb25zLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRBY3Rpb24gPSBmYWxzZTtcbiAgICBpZighdGhpcy5hY3Rpb25zW2FjdGlvbl0pIHtcbiAgICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dID0gW107XG4gICAgICBjcmVhdGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0ucHVzaChoYW5kbGVyKTtcbiAgICByZXR1cm4geyBjcmVhdGVkQWN0aW9uIH07XG4gIH1cblxuICByZW1vdmVBY3Rpb25IYW5kbGVyKGFjdGlvbiwgaGFuZGxlcikge1xuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIGhhbmRsZXIuc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgXy5jb250YWlucyh0aGlzLmFjdGlvbnNbYWN0aW9uXSwgaGFuZGxlcikuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICAvLyBMb29wIHRocm91Z2ggdGhlIGxpc3Qgb2YgaGFuZGxlcnMgaGVyZTtcbiAgICAvLyBXZSBkb24ndCBleHBlY3QgdG8gaGF2ZSBfdGhhdF8gbXVjaCBkaWZmZXJlbnQgaGFuZGxlcnNcbiAgICAvLyBmb3IgYSBnaXZlbiBhY3Rpb24sIHNvIHBlcmZvcm1hbmNlIGltcGxpY2F0aW9uc1xuICAgIC8vIHNob3VsZCBiZSBjb21wbGV0ZWx5IG5lZ2xpZ2libGUuXG4gICAgdGhpcy5hY3Rpb25zW2FjdGlvbl0gPSBfLndpdGhvdXQodGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpO1xuICAgIGxldCBkZWxldGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYodGhpcy5hY3Rpb25zW2FjdGlvbl0ubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5hY3Rpb25zW2FjdGlvbl07XG4gICAgICBkZWxldGVkQWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHsgZGVsZXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgKmRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zID0ge30pIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgcGFyYW1zLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIHBhcmFtcy5ndWlkLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgKHRoaXMuYWN0aW9uc1thY3Rpb25dLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gUnVuIGFsbCBoYW5kbGVycyBjb25jdXJyZW50bHkgYW5kIHJldHVybiB0aGUgbGlzdCBvZiB0aGUgcmVzdWx0c1xuICAgIC8vIChlbXB0eSBsaXN0IGlmIG5vIGhhbmRsZXJzKS5cbiAgICAvLyBJZiBhbiBhY3Rpb24gaGFuZGxlciB0aHJvd3MsIHRoZW4gZGlzcGF0Y2ggd2lsbCB0aHJvdywgYnV0IHRoZSBvdGhlcnMgaGFuZGxlcnNcbiAgICAvLyBjYW4gc3RpbGwgc3VjY2VlZC5cbiAgICByZXR1cm4geWllbGQgKHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA/IHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA6IFtdKSAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICAubWFwKChoYW5kbGVyKSA9PiBoYW5kbGVyLmNhbGwobnVsbCwgcGFyYW1zKSk7XG4gIH1cblxuICBoYXNTZXNzaW9uKGd1aWQpIHtcbiAgICByZXR1cm4gISF0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgY3JlYXRlU2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGlmKCF0aGlzLnNlc3Npb25zW2d1aWRdKSB7XG4gICAgICB0aGlzLnNlc3Npb25zW2d1aWRdID0gdGhpcy5zZXNzaW9uQ3JlYXRlZChuZXcgU2Vzc2lvbih7IGd1aWQsIHVwbGluazogdGhpcyB9KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNlc3Npb25zW2d1aWRdO1xuICB9XG5cbiAgZGVsZXRlU2Vzc2lvbihndWlkKSB7XG4gICAgXy5kZXYoKCkgPT4gZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcpO1xuICAgIGxldCBzZXNzaW9uID0gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICBzZXNzaW9uLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uRGVsZXRlZChzZXNzaW9uKTtcbiAgfVxuXG4gIC8vIE5vLW9wIHBsYWNlaG9sZGVyLCB0byBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdG8gaW5pdGlhbGl6ZVxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGNyZWF0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkNyZWF0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGNsZWFuLXVwXG4gIC8vIHNlc3Npb24tcmVsYXRlZCByZXNvdXJjZXMuXG4gIC8vIEltcGxlbWVudGF0aW9uIHNob3VsZCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgZGVsZXRlZCBzZXNzaW9uLlxuICBzZXNzaW9uRGVsZXRlZChzZXNzaW9uKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShzZXNzaW9uKTtcbiAgfVxufVxuXG5fLmV4dGVuZChVcGxpbmtTaW1wbGVTZXJ2ZXIucHJvdG90eXBlLCB7XG4gIHN0b3JlczogbnVsbCxcbiAgcm9vbXM6IG51bGwsXG4gIGFjdGlvbnM6IG51bGwsXG4gIGFwcDogbnVsbCxcbiAgc2VydmVyOiBudWxsLFxuXG4gIF9kYXRhOiBudWxsLFxuXG4gIGNvbm5lY3Rpb25zOiBudWxsLFxuICBzZXNzaW9uczogbnVsbCxcblxuICBzdWJzY3JpYmVyczogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBhY3Rpb25IYW5kbGVyczogbnVsbCxcbn0pO1xuXG5Db25uZWN0aW9uID0gcmVxdWlyZSgnLi9Db25uZWN0aW9uJykoeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5TZXNzaW9uID0gcmVxdWlyZSgnLi9TZXNzaW9uJykoeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rU2ltcGxlU2VydmVyO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9