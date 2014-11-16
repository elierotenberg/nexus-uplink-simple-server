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
  var UplinkSimpleServer =
  // stores, rooms, and actions are three whitelists of
  // string patterns. Each is an array that will be passed
  // to the Router constructor.
  function UplinkSimpleServer(_ref) {
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
        var io = require("socket.io")(http.Server(app));
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
          })["catch"](function (err) {
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
          })["catch"](function (err) {
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

  _data: null,

  connections: null,
  sessions: null,

  subscribers: null,
  listeners: null,
  actionHandlers: null });

Connection = require("./Connection")({ UplinkSimpleServer: UplinkSimpleServer });
Session = require("./Session")({ Connection: Connection, UplinkSimpleServer: UplinkSimpleServer });

module.exports = UplinkSimpleServer;
//# sourceMappingURL=data:application/json;base64,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QyIsImZpbGUiOiJVcGxpbmtTaW1wbGVTZXJ2ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoLW5leHQnKTtcbmNvbnN0IGJvZHlQYXJzZXIgPSByZXF1aXJlKCdib2R5LXBhcnNlcicpO1xuY29uc3QgQ29uc3RhbnRSb3V0ZXIgPSByZXF1aXJlKCduZXh1cy1yb3V0ZXInKS5Db25zdGFudFJvdXRlcjtcbmNvbnN0IEhUVFBFeGNlcHRpb25zID0gcmVxdWlyZSgnaHR0cC1leGNlcHRpb25zJyk7XG5jb25zdCBodHRwID0gcmVxdWlyZSgnaHR0cCcpO1xuXG5jb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xubGV0IENvbm5lY3Rpb24sIFNlc3Npb247XG5cbmNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gIGNvbm5lY3Rpb24oc29ja2V0KSB7XG4gICAgXy5kZXYoKCkgPT4gaW5zdGFuY2VPZlNvY2tldElPKHNvY2tldCkuc2hvdWxkLmJlLm9rICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uc2hvdWxkLm5vdC5iZS5va1xuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdID0gbmV3IENvbm5lY3Rpb24oeyBzb2NrZXQsIHVwbGluazogdGhpcyB9KTtcbiAgICBzb2NrZXQub24oJ2Rpc2Nvbm5lY3QnLCAoKSA9PiBpb0hhbmRsZXJzLmRpc2Nvbm5lY3Rpb24uY2FsbCh0aGlzLCBzb2NrZXQpKTtcbiAgfSxcblxuICBkaXNjb25uZWN0aW9uKHNvY2tldCkge1xuICAgIF8uZGV2KCgpID0+IHNvY2tldC5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBzb2NrZXQub24uc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHNvY2tldC5lbWl0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuaWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uc2hvdWxkLmJlLmV4YWN0bHkoc29ja2V0KVxuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdO1xuICB9LFxufTtcblxuLy8gTW9zdCBwdWJsaWMgbWV0aG9kcyBleHBvc2UgYW4gYXN5bmMgQVBJXG4vLyB0byBlbmZvcmNlIGNvbnNpc3RlbmNlIHdpdGggYXN5bmMgZGF0YSBiYWNrZW5kcyxcbi8vIGVnLiByZWRpcyBvciBteXNxbCwgYWx0aG91Z2ggaW4gdGhpcyBpbXBsZW1lbnRhdGlvblxuLy8gdGhlIGJhY2tlbmQgcmVzaWRlcyBpbiBtZW1vcnkgKGEgc2ltcGxlIE9iamVjdCBhY3Rpbmdcbi8vIGFzIGFuIGFzc29jaWF0aXZlIG1hcCkuXG5jbGFzcyBVcGxpbmtTaW1wbGVTZXJ2ZXIge1xuICAvLyBzdG9yZXMsIHJvb21zLCBhbmQgYWN0aW9ucyBhcmUgdGhyZWUgd2hpdGVsaXN0cyBvZlxuICAvLyBzdHJpbmcgcGF0dGVybnMuIEVhY2ggaXMgYW4gYXJyYXkgdGhhdCB3aWxsIGJlIHBhc3NlZFxuICAvLyB0byB0aGUgUm91dGVyIGNvbnN0cnVjdG9yLlxuICBjb25zdHJ1Y3Rvcih7IHBpZCwgc3RvcmVzLCByb29tcywgYWN0aW9ucyB9KSB7XG4gICAgXy5kZXYoKCkgPT4gc3RvcmVzLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgcm9vbXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBhY3Rpb25zLnNob3VsZC5iZS5hbi5BcnJheVxuICAgICk7XG4gICAgLy8gSGVyZSB3ZSB1c2UgQ29uc3RhbnRSb3V0ZXIgaW5zdGFuY2VzOyB3ZSBvbmx5IG5lZWRcbiAgICAvLyB0byBrbm93IGlmIGEgZ2l2ZW4gc3RyaW5nIG1hdGNoIGEgcmVnaXN0ZXJlZCBwYXR0ZXJuLlxuICAgIHRoaXMuc3RvcmVzID0gbmV3IENvbnN0YW50Um91dGVyKHN0b3Jlcyk7XG4gICAgdGhpcy5yb29tcyA9IG5ldyBDb25zdGFudFJvdXRlcihyb29tcyk7XG4gICAgdGhpcy5hY3Rpb25zID0gbmV3IENvbnN0YW50Um91dGVyKGFjdGlvbnMpO1xuXG4gICAgLy8gU3RvcmUgZGF0YSBjYWNoZVxuICAgIHRoaXMuX2RhdGEgPSB7fTtcblxuICAgIC8vIENvbm5lY3Rpb25zIHJlcHJlc2VudCBhY3R1YWwgbGl2aW5nIHNvY2tldC5pbyBjb25uZWN0aW9ucy5cbiAgICAvLyBTZXNzaW9uIHJlcHJlc2VudCBhIHJlbW90ZSBVcGxpbmsgY2xpZW50IGluc3RhbmNlLCB3aXRoIGEgdW5pcXVlIGd1aWQuXG4gICAgLy8gVGhlIGNvbmNlcHQgb2Ygc2Vzc2lvbiBlbmZvcmNlcyBjb25zaXN0ZW5jeSBiZXR3ZWVuIGl0cyBhdHRhY2hlZCBzb2NrZXQgY29ubmVjdGlvbnMsXG4gICAgLy8gYW5kIEhUVFAgcmVxdWVzdHMuXG4gICAgLy8gQSBzaW5nbGUgc2Vzc2lvbiBjYW4gYmUgYXR0YWNoZWQgdG8gemVybyBvciBtb3JlIHRoYW4gb25lIGNvbm5lY3Rpb24uXG4gICAgLy8gVXBsaW5rIGZyYW1lcyBhcmUgcmVjZWl2ZWQgZnJvbSBhbmQgc2VudCB0byBzZXNzaW9ucywgbm90IGNvbm5lY3Rpb24uXG4gICAgLy8gRWFjaCBzZXNzaW9uIG11c3Qga2VlcCByZWZlcmVuY2VzIHRvIGl0cyBhdHRhY2hlZCBjb25uZWN0aW9ucyBhbmQgcHJvcGFnYXRlXG4gICAgLy8gcmVsZXZhbnQgZnJhbWVzIGFjY29yZGluZ2x5LlxuICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fTtcbiAgICB0aGlzLnNlc3Npb25zID0ge307XG5cbiAgICB0aGlzLnN1YnNjcmliZXJzID0ge307XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLmFjdGlvbkhhbmRsZXJzID0ge307XG4gIH1cblxuICBhdHRhY2goYXBwKSB7XG4gICAgXy5kZXYoKCkgPT4gYXBwLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIC8vIER1Y2t0eXBlLWNoZWNrIGZvciBhbiBleHByZXNzLWxpa2UgYXBwXG4gICAgICBhcHAuZ2V0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBhcHAucG9zdC5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgLy8gc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBpbnN0YWxsZWQgZmlyc3QsIHRvIHByZS1lbXB0IHNvbWUgcGF0aHMgb3ZlciB0aGUgaHR0cCBoYW5kbGVycy5cbiAgICBsZXQgaW8gPSByZXF1aXJlKCdzb2NrZXQuaW8nKShodHRwLlNlcnZlcihhcHApKTtcbiAgICAvLyBEZWxlZ2F0ZSB0byBzdGF0aWMgaW9IYW5kbGVyIG1ldGhvZHMsIGJ1dCBjYWxsIHRoZW0gd2l0aCBjb250ZXh0LlxuICAgIE9iamVjdC5rZXlzKGlvSGFuZGxlcnMpXG4gICAgLmZvckVhY2goKGV2ZW50KSA9PiBpby5vbihldmVudCwgKCkgPT4gaW9IYW5kbGVyc1tldmVudF0uYXBwbHkodGhpcywgYXJndW1lbnRzKSkpO1xuXG4gICAgLy8gRmV0Y2ggZnJvbSBzdG9yZVxuICAgIGFwcC5nZXQoJyonLFxuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGlzIHN0b3JlIHBhdGggaXMgd2hpdGVsaXN0ZWRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gdGhpcy5zdG9yZXMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzKSA9PiB0aGlzLnB1bGwocmVxLnBhdGgpXG4gICAgICAgIC50aGVuKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+ICh2YWx1ZSA9PT0gbnVsbCB8fCBfLmlzT2JqZWN0KHZhbHVlKSkuc2hvdWxkLmJlLm9rKTtcbiAgICAgICAgICByZXMuc3RhdHVzKDIwMCkudHlwZSgnYXBwbGljYXRpb24vanNvbicpLnNlbmQodmFsdWUpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IHsgY29uc29sZS5lcnJvcihlcnIsIGVyci5zdGFjayk7IH0pO1xuICAgICAgICAgIGlmKGVyciBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gRGlzcGF0Y2ggYWN0aW9uXG4gICAgYXBwLnBvc3QoJyonLFxuICAgICAgLy8gUGFyc2UgYm9keSBhcyBKU09OXG4gICAgICBib2R5UGFyc2VyLmpzb24oKSxcbiAgICAgIC8vIENoZWNrIHRoYXQgdGhpcyBhY3Rpb24gcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLmFjdGlvbnMubWF0Y2gocmVxLnBhdGgpID09PSBudWxsID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5Ob3RGb3VuZChyZXEucGF0aCkpIDogbmV4dCgpLFxuICAgICAgLy8gcGFyYW1zIHNob3VsZCBiZSBwcmVzZW50XG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFfLmlzT2JqZWN0KHJlcS5ib2R5LnBhcmFtcykgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLkJhZFJlcXVlc3QoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IFxcJ3BhcmFtXFwnJykpIDogbmV4dCgpLFxuICAgICAgLy8gQ2hlY2sgZm9yIGEgdmFsaWQsIGFjdGl2ZSBzZXNzaW9uIGd1aWQgaW4gcGFyYW1zXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+ICFyZXEuYm9keS5wYXJhbXMuZ3VpZCA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuVW5hdXRob3JpemVkKCdNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiBcXCdwYXJhbXNcXCcuXFwnZ3VpZFxcJycpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIXRoaXMuaXNBY3RpdmVTZXNzaW9uKHJlcS5ib2R5LnBhcmFtcy5ndWlkKSA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBIVFRQRXhjZXB0aW9ucy5VbmF1dGhvcml6ZWQoJ0ludmFsaWQgXFwnZ3VpZFxcJy4nKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMuZGlzcGF0Y2gocmVxLnBhdGgsIHJlcS5ib2R5LnBhcmFtcylcbiAgICAgIC50aGVuKChyZXN1bHQpID0+IHJlcy5zdGF0dXMoMjAwKS5qc29uKHJlc3VsdCkpXG4gICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIF8uZGV2KCgpID0+IHsgY29uc29sZS5lcnJvcihlcnIsIGVyci5zdGFjayk7IH0pO1xuICAgICAgICAgIGlmKGVyciBpbnN0YW5jZW9mIEhUVFBFeGNlcHRpb25zLkhUVFBFcnJvcikge1xuICAgICAgICAgICAgSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIGVycik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnI6IGVyci50b1N0cmluZygpIH0pO1xuICAgICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1bGwocGF0aCkge1xuICAgIHJldHVybiBQcm9taXNlLnRyeSgoKSA9PiB7XG4gICAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIHJldHVybiB0aGlzLl9kYXRhW3BhdGhdO1xuICAgIH0pO1xuICB9XG5cbiAgKnVwZGF0ZShwYXRoLCB2YWx1ZSkgeyAvLyBqc2hpbnQgaWdub3JlOmxpbmVcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgdmFsdWUuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgKHRoaXMuc3RvcmVzLm1hdGNoKHBhdGgpICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBoYXNoLCBkaWZmO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIERpZmYgYW5kIEpTT04tZW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAvLyB0aGVzZSBsZW5ndGh5IGNhbGN1bGF0aW9ucyBkb3duIHRoZSBwcm9wYWdhdGlvbiB0cmVlLlxuICAgICAgLy8gSWYgbm8gdmFsdWUgd2FzIHByZXNlbnQgYmVmb3JlLCB0aGVuIG51bGxpZnkgdGhlIGhhc2guIE5vIHZhbHVlIGhhcyBhIG51bGwgaGFzaC5cbiAgICAgIGlmKCF0aGlzLl9kYXRhW3BhdGhdKSB7XG4gICAgICAgIGhhc2ggPSBudWxsO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGhhc2ggPSBfLmhhc2godGhpcy5fZGF0YVtwYXRoXSk7XG4gICAgICAgIGRpZmYgPSBfLmRpZmYodGhpcy5fZGF0YVtwYXRoXSwgdmFsdWUpO1xuICAgICAgfVxuICAgICAgLy8gRGlyZWN0bHkgcGFzcyB0aGUgcGF0Y2gsIHNlc3Npb25zIGRvbid0IG5lZWQgdG8gYmUgYXdhcmVcbiAgICAgIC8vIG9mIHRoZSBhY3R1YWwgY29udGVudHM7IHRoZXkgb25seSBuZWVkIHRvIGZvcndhcmQgdGhlIGRpZmZcbiAgICAgIC8vIHRvIHRoZWlyIGFzc29jaWF0ZWQgY2xpZW50cy5cbiAgICAgIHlpZWxkIE9iamVjdC5rZXlzKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi51cGRhdGUocGF0aCwgeyBoYXNoLCBkaWZmIH0pKTtcbiAgICB9XG4gIH1cblxuICBzdWJzY3JpYmVUbyhwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbilcbiAgICApO1xuICAgIGxldCBjcmVhdGVkUGF0aDtcbiAgICBpZih0aGlzLnN1YnNjcmliZXJzW3BhdGhdKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGxlYWt5IGVudHJ5IGluIHRoaXMuc3Vic2NyaWJlcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF0uc2hvdWxkLm5vdC5iZS5vayk7XG4gICAgICBjcmVhdGVkUGF0aCA9IGZhbHNlO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0gPSB7fTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFBhdGggfTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlRnJvbShwYXRoLCBzZXNzaW9uKSB7XG4gICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHNlc3Npb24uc2hvdWxkLmJlLmFuLmluc3RhbmNlT2YoU2Vzc2lvbikgJiZcbiAgICAgIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0uc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRQYXRoID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMuc3Vic2NyaWJlcnNbcGF0aF1bc2Vzc2lvbi5pZF07XG4gICAgaWYoT2JqZWN0LmtleXModGhpcy5zdWJzY3JpYmVyc1twYXRoXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXTtcbiAgICAgIGRlbGV0ZWRQYXRoID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3Qgc3Vic2NyaXB0aW9uXG4gICAgLy8gdG8gdGhpcyBwYXRoOyBjYW4gYmUgdXNlZnVsIHRvIGltcGxlbWVudCBzdWJjbGFzcy1zcGVjaWZpYyBoYW5kbGluZ1xuICAgIC8vIChlZy4gdW5zYnVzY3JpYmUgZnJvbSBhbiBleHRlcm5hbCBiYWNrZW5kKVxuICAgIHJldHVybiB7IGRlbGV0ZWRQYXRoIH07XG4gIH1cblxuICAqZW1pdChyb29tLCBwYXJhbXMpIHsgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgXy5kZXYoKCkgPT4gcm9vbS5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAodGhpcy5yb29tcy5tYXRjaChyb29tKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgKTtcbiAgICBsZXQganNvbjtcbiAgICBpZih0aGlzLmxpc3RlbmVyc1tyb29tXSkge1xuICAgICAgLy8gRW5jb2RlIGFzIGVhcmx5IGFzIHBvc3NpYmxlIHRvIGF2b2lkIGR1cGxpY2F0aW5nXG4gICAgICAvLyB0aGlzIG9wZXJhdGlvbiBkb3duIHRoZSBwcm9wYWdhdGlvbiB0cmVlLlxuICAgICAganNvbiA9IEpTT04uc3RyaW5naWZ5KHBhcmFtcyk7XG4gICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgICAubWFwKChzZXNzaW9uKSA9PiBzZXNzaW9uLmVtaXQocm9vbSwganNvbikpO1xuICAgIH1cbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRSb29tO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGEgbGVha3kgZW50cnkgaW4gdGhpcy5saXN0ZW5lcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdLnNob3VsZC5ub3QuYmUub2spO1xuICAgICAgY3JlYXRlZFJvb20gPSBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXSA9IHt9O1xuICAgICAgY3JlYXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pICYmXG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcbiAgICAgIGRlbGV0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gdW5zdXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFJvb20gfTtcbiAgfVxuXG4gIGFkZEFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgKHRoaXMuYWN0aW9ucy5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBjcmVhdGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYoIXRoaXMuYWN0aW9uc1thY3Rpb25dKSB7XG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXSA9IFtdO1xuICAgICAgY3JlYXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dLnB1c2goaGFuZGxlcik7XG4gICAgcmV0dXJuIHsgY3JlYXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgcmVtb3ZlQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXS5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIF8uY29udGFpbnModGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBsaXN0IG9mIGhhbmRsZXJzIGhlcmU7XG4gICAgLy8gV2UgZG9uJ3QgZXhwZWN0IHRvIGhhdmUgX3RoYXRfIG11Y2ggZGlmZmVyZW50IGhhbmRsZXJzXG4gICAgLy8gZm9yIGEgZ2l2ZW4gYWN0aW9uLCBzbyBwZXJmb3JtYW5jZSBpbXBsaWNhdGlvbnNcbiAgICAvLyBzaG91bGQgYmUgY29tcGxldGVseSBuZWdsaWdpYmxlLlxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dID0gXy53aXRob3V0KHRoaXMuYWN0aW9uc1thY3Rpb25dLCBoYW5kbGVyKTtcbiAgICBsZXQgZGVsZXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKHRoaXMuYWN0aW9uc1thY3Rpb25dLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMuYWN0aW9uc1thY3Rpb25dO1xuICAgICAgZGVsZXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiB7IGRlbGV0ZWRBY3Rpb24gfTtcbiAgfVxuXG4gICpkaXNwYXRjaChhY3Rpb24sIHBhcmFtcyA9IHt9KSB7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuICAgIF8uZGV2KCgpID0+IGFjdGlvbi5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBwYXJhbXMuZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICh0aGlzLmFjdGlvbnNbYWN0aW9uXS5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIC8vIFJ1biBhbGwgaGFuZGxlcnMgY29uY3VycmVudGx5IGFuZCByZXR1cm4gdGhlIGxpc3Qgb2YgdGhlIHJlc3VsdHNcbiAgICAvLyAoZW1wdHkgbGlzdCBpZiBubyBoYW5kbGVycykuXG4gICAgLy8gSWYgYW4gYWN0aW9uIGhhbmRsZXIgdGhyb3dzLCB0aGVuIGRpc3BhdGNoIHdpbGwgdGhyb3csIGJ1dCB0aGUgb3RoZXJzIGhhbmRsZXJzXG4gICAgLy8gY2FuIHN0aWxsIHN1Y2NlZWQuXG4gICAgcmV0dXJuIHlpZWxkICh0aGlzLmFjdGlvbkhhbmRsZXJzW2FjdGlvbl0gPyB0aGlzLmFjdGlvbkhhbmRsZXJzW2FjdGlvbl0gOiBbXSkgLy8ganNoaW50IGlnbm9yZTpsaW5lXG4gICAgLm1hcCgoaGFuZGxlcikgPT4gaGFuZGxlci5jYWxsKG51bGwsIHBhcmFtcykpO1xuICB9XG5cbiAgaGFzU2Vzc2lvbihndWlkKSB7XG4gICAgcmV0dXJuICEhdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGNyZWF0ZVNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBpZighdGhpcy5zZXNzaW9uc1tndWlkXSkge1xuICAgICAgdGhpcy5zZXNzaW9uc1tndWlkXSA9IHRoaXMuc2Vzc2lvbkNyZWF0ZWQobmV3IFNlc3Npb24oeyBndWlkLCB1cGxpbms6IHRoaXMgfSkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGRlbGV0ZVNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBsZXQgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGluaXRpYWxpemVcbiAgLy8gc2Vzc2lvbi1yZWxhdGVkIHJlc291cmNlcy5cbiAgLy8gSW1wbGVtZW50YXRpb24gc2hvdWxkIHJldHVybiBhIFByb21pc2UgZm9yIHRoZSBjcmVhdGVkIHNlc3Npb24uXG4gIHNlc3Npb25DcmVhdGVkKHNlc3Npb24pIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNlc3Npb24pO1xuICB9XG5cbiAgLy8gTm8tb3AgcGxhY2Vob2xkZXIsIHRvIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0byBjbGVhbi11cFxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGRlbGV0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rU2ltcGxlU2VydmVyLnByb3RvdHlwZSwge1xuICBzdG9yZXM6IG51bGwsXG4gIHJvb21zOiBudWxsLFxuICBhY3Rpb25zOiBudWxsLFxuXG4gIF9kYXRhOiBudWxsLFxuXG4gIGNvbm5lY3Rpb25zOiBudWxsLFxuICBzZXNzaW9uczogbnVsbCxcblxuICBzdWJzY3JpYmVyczogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBhY3Rpb25IYW5kbGVyczogbnVsbCxcbn0pO1xuXG5Db25uZWN0aW9uID0gcmVxdWlyZSgnLi9Db25uZWN0aW9uJykoeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5TZXNzaW9uID0gcmVxdWlyZSgnLi9TZXNzaW9uJykoeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rU2ltcGxlU2VydmVyO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9