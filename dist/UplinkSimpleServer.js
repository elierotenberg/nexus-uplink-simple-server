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
                if (this.listeners[room]) {
                  (function () {
                    // Encode as early as possible to avoid duplicating
                    // this operation down the propagation tree.
                    var json = JSON.stringify(params);
                    yield Object.keys(_this8.listeners[room]).map(function (session) {
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

Connection = require("./Connection")({ UplinkSimpleServer: UplinkSimpleServer });
Session = require("./Session")({ Connection: Connection, UplinkSimpleServer: UplinkSimpleServer });

module.exports = UplinkSimpleServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImc6L3JlYWN0LW5leHVzL25leHVzLXVwbGluay1zaW1wbGUtc2VydmVyL3NyYy9VcGxpbmtTaW1wbGVTZXJ2ZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUFBLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDbEMsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2pDLElBQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxJQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsY0FBYyxDQUFDO0FBQzlELElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDOztBQUVsRCxJQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0FBQzNELElBQUksVUFBVSxFQUFFLE9BQU8sQ0FBQzs7QUFFeEIsSUFBTSxVQUFVLEdBQUc7QUFDakIsWUFBVSxFQUFBLFVBQUMsTUFBTSxFQUFFOztBQUNqQixLQUFDLENBQUMsR0FBRyxDQUFDO2FBQU0sa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQ2pELE1BQUssV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0tBQUEsQ0FDN0MsQ0FBQztBQUNGLFFBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksVUFBVSxDQUFDLEVBQUUsTUFBTSxFQUFOLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUN2RSxVQUFNLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRTthQUFNLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxR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LENBQUMsY0FBYyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsRUFBbEIsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0FBQzdELE9BQU8sR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQVYsVUFBVSxFQUFFLGtCQUFrQixFQUFsQixrQkFBa0IsRUFBRSxDQUFDLENBQUM7O0FBRW5FLE1BQU0sQ0FBQyxPQUFPLEdBQUcsa0JBQWtCLENBQUMiLCJmaWxlIjoiVXBsaW5rU2ltcGxlU2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsicmVxdWlyZSgnNnRvNS9wb2x5ZmlsbCcpO1xudmFyIFByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaC1uZXh0Jyk7XG5jb25zdCBib2R5UGFyc2VyID0gcmVxdWlyZSgnYm9keS1wYXJzZXInKTtcbmNvbnN0IENvbnN0YW50Um91dGVyID0gcmVxdWlyZSgnbmV4dXMtcm91dGVyJykuQ29uc3RhbnRSb3V0ZXI7XG5jb25zdCBIVFRQRXhjZXB0aW9ucyA9IHJlcXVpcmUoJ2h0dHAtZXhjZXB0aW9ucycpO1xuXG5jb25zdCBpbnN0YW5jZU9mU29ja2V0SU8gPSByZXF1aXJlKCcuL2luc3RhbmNlT2ZTb2NrZXRJTycpO1xubGV0IENvbm5lY3Rpb24sIFNlc3Npb247XG5cbmNvbnN0IGlvSGFuZGxlcnMgPSB7XG4gIGNvbm5lY3Rpb24oc29ja2V0KSB7XG4gICAgXy5kZXYoKCkgPT4gaW5zdGFuY2VPZlNvY2tldElPKHNvY2tldCkuc2hvdWxkLmJlLm9rICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uc2hvdWxkLm5vdC5iZS5va1xuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdID0gbmV3IENvbm5lY3Rpb24oeyBzb2NrZXQsIHVwbGluazogdGhpcyB9KTtcbiAgICBzb2NrZXQub24oJ2Rpc2Nvbm5lY3QnLCAoKSA9PiBpb0hhbmRsZXJzLmRpc2Nvbm5lY3Rpb24uY2FsbCh0aGlzLCBzb2NrZXQpKTtcbiAgfSxcblxuICBkaXNjb25uZWN0aW9uKHNvY2tldCkge1xuICAgIF8uZGV2KCgpID0+IHNvY2tldC5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICBzb2NrZXQub24uc2hvdWxkLmJlLmEuRnVuY3Rpb24gJiZcbiAgICAgIHNvY2tldC5lbWl0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBzb2NrZXQuaWQuc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICB0aGlzLmNvbm5lY3Rpb25zW3NvY2tldC5pZF0uc2hvdWxkLmJlLmV4YWN0bHkoc29ja2V0KVxuICAgICk7XG4gICAgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdLmRlc3Ryb3koKTtcbiAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uc1tzb2NrZXQuaWRdO1xuICB9LFxufTtcblxuLy8gTW9zdCBwdWJsaWMgbWV0aG9kcyBleHBvc2UgYW4gYXN5bmMgQVBJXG4vLyB0byBlbmZvcmNlIGNvbnNpc3RlbmNlIHdpdGggYXN5bmMgZGF0YSBiYWNrZW5kcyxcbi8vIGVnLiByZWRpcyBvciBteXNxbCwgYWx0aG91Z2ggaW4gdGhpcyBpbXBsZW1lbnRhdGlvblxuLy8gdGhlIGJhY2tlbmQgcmVzaWRlcyBpbiBtZW1vcnkgKGEgc2ltcGxlIE9iamVjdCBhY3Rpbmdcbi8vIGFzIGFuIGFzc29jaWF0aXZlIG1hcCkuXG5jbGFzcyBVcGxpbmtTaW1wbGVTZXJ2ZXIge1xuICAvLyBzdG9yZXMsIHJvb21zLCBhbmQgYWN0aW9ucyBhcmUgdGhyZWUgd2hpdGVsaXN0cyBvZlxuICAvLyBzdHJpbmcgcGF0dGVybnMuIEVhY2ggaXMgYW4gYXJyYXkgdGhhdCB3aWxsIGJlIHBhc3NlZFxuICAvLyB0byB0aGUgUm91dGVyIGNvbnN0cnVjdG9yLlxuICBjb25zdHJ1Y3Rvcih7IHBpZCwgc3RvcmVzLCByb29tcywgYWN0aW9ucyB9KSB7XG4gICAgXy5kZXYoKCkgPT4gc3RvcmVzLnNob3VsZC5iZS5hbi5BcnJheSAmJlxuICAgICAgcm9vbXMuc2hvdWxkLmJlLmFuLkFycmF5ICYmXG4gICAgICBhY3Rpb25zLnNob3VsZC5iZS5hbi5BcnJheVxuICAgICk7XG4gICAgLy8gSGVyZSB3ZSB1c2UgQ29uc3RhbnRSb3V0ZXIgaW5zdGFuY2VzOyB3ZSBvbmx5IG5lZWRcbiAgICAvLyB0byBrbm93IGlmIGEgZ2l2ZW4gc3RyaW5nIG1hdGNoIGEgcmVnaXN0ZXJlZCBwYXR0ZXJuLlxuICAgIHRoaXMuc3RvcmVzID0gbmV3IENvbnN0YW50Um91dGVyKHN0b3Jlcyk7XG4gICAgdGhpcy5yb29tcyA9IG5ldyBDb25zdGFudFJvdXRlcihyb29tcyk7XG4gICAgdGhpcy5hY3Rpb25zID0gbmV3IENvbnN0YW50Um91dGVyKGFjdGlvbnMpO1xuXG4gICAgLy8gU3RvcmUgZGF0YSBjYWNoZVxuICAgIHRoaXMuX2RhdGEgPSB7fTtcblxuICAgIC8vIENvbm5lY3Rpb25zIHJlcHJlc2VudCBhY3R1YWwgbGl2aW5nIHNvY2tldC5pbyBjb25uZWN0aW9ucy5cbiAgICAvLyBTZXNzaW9uIHJlcHJlc2VudCBhIHJlbW90ZSBVcGxpbmsgY2xpZW50IGluc3RhbmNlLCB3aXRoIGEgdW5pcXVlIGd1aWQuXG4gICAgLy8gVGhlIGNvbmNlcHQgb2Ygc2Vzc2lvbiBlbmZvcmNlcyBjb25zaXN0ZW5jeSBiZXR3ZWVuIGl0cyBhdHRhY2hlZCBzb2NrZXQgY29ubmVjdGlvbnMsXG4gICAgLy8gYW5kIEhUVFAgcmVxdWVzdHMuXG4gICAgLy8gQSBzaW5nbGUgc2Vzc2lvbiBjYW4gYmUgYXR0YWNoZWQgdG8gemVybyBvciBtb3JlIHRoYW4gb25lIGNvbm5lY3Rpb24uXG4gICAgLy8gVXBsaW5rIGZyYW1lcyBhcmUgcmVjZWl2ZWQgZnJvbSBhbmQgc2VudCB0byBzZXNzaW9ucywgbm90IGNvbm5lY3Rpb24uXG4gICAgLy8gRWFjaCBzZXNzaW9uIG11c3Qga2VlcCByZWZlcmVuY2VzIHRvIGl0cyBhdHRhY2hlZCBjb25uZWN0aW9ucyBhbmQgcHJvcGFnYXRlXG4gICAgLy8gcmVsZXZhbnQgZnJhbWVzIGFjY29yZGluZ2x5LlxuICAgIHRoaXMuY29ubmVjdGlvbnMgPSB7fTtcbiAgICB0aGlzLnNlc3Npb25zID0ge307XG5cbiAgICB0aGlzLnN1YnNjcmliZXJzID0ge307XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgICB0aGlzLmFjdGlvbkhhbmRsZXJzID0ge307XG4gIH1cblxuICBhdHRhY2goYXBwKSB7XG4gICAgXy5kZXYoKCkgPT4gYXBwLnNob3VsZC5iZS5hbi5PYmplY3QgJiZcbiAgICAgIC8vIER1Y2t0eXBlLWNoZWNrIGZvciBhbiBleHByZXNzLWxpa2UgYXBwXG4gICAgICBhcHAuZ2V0LnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICBhcHAucG9zdC5zaG91bGQuYmUuYS5GdW5jdGlvblxuICAgICk7XG4gICAgLy8gc29ja2V0LmlvIGhhbmRsZXJzIGFyZSBpbnN0YWxsZWQgZmlyc3QsIHRvIHByZS1lbXB0IHNvbWUgcGF0aHMgb3ZlciB0aGUgaHR0cCBoYW5kbGVycy5cbiAgICBsZXQgaW8gPSByZXF1aXJlKCdzb2NrZXQuaW8nKShhcHApO1xuICAgIC8vIERlbGVnYXRlIHRvIHN0YXRpYyBpb0hhbmRsZXIgbWV0aG9kcywgYnV0IGNhbGwgdGhlbSB3aXRoIGNvbnRleHQuXG4gICAgT2JqZWN0LmtleXMoaW9IYW5kbGVycylcbiAgICAuZm9yRWFjaCgoZXZlbnQpID0+IGlvLm9uKGV2ZW50LCAoKSA9PiBpb0hhbmRsZXJzW2V2ZW50XS5hcHBseSh0aGlzLCBhcmd1bWVudHMpKSk7XG5cbiAgICAvLyBGZXRjaCBmcm9tIHN0b3JlXG4gICAgYXBwLmdldCgnKicsXG4gICAgICAvLyBDaGVjayB0aGF0IHRoaXMgc3RvcmUgcGF0aCBpcyB3aGl0ZWxpc3RlZFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiB0aGlzLnN0b3Jlcy5tYXRjaChyZXEucGF0aCkgPT09IG51bGwgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLk5vdEZvdW5kKHJlcS5wYXRoKSkgOiBuZXh0KCksXG4gICAgICAocmVxLCByZXMpID0+IHRoaXMucHVsbChyZXEucGF0aClcbiAgICAgICAgLnRoZW4oKHZhbHVlKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4gKHZhbHVlID09PSBudWxsIHx8IF8uaXNPYmplY3QodmFsdWUpKS5zaG91bGQuYmUub2spO1xuICAgICAgICAgIHJlcy5zdGF0dXMoMjAwKS50eXBlKCdhcHBsaWNhdGlvbi9qc29uJykuc2VuZCh2YWx1ZSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4geyBjb25zb2xlLmVycm9yKGVyciwgZXJyLnN0YWNrKTsgfSk7XG4gICAgICAgICAgaWYoZXJyIGluc3RhbmNlb2YgSFRUUEV4Y2VwdGlvbnMuSFRUUEVycm9yKSB7XG4gICAgICAgICAgICBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycjogZXJyLnRvU3RyaW5nKCkgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBEaXNwYXRjaCBhY3Rpb25cbiAgICBhcHAucG9zdCgnKicsXG4gICAgICAvLyBQYXJzZSBib2R5IGFzIEpTT05cbiAgICAgIGJvZHlQYXJzZXIuanNvbigpLFxuICAgICAgLy8gQ2hlY2sgdGhhdCB0aGlzIGFjdGlvbiBwYXRoIGlzIHdoaXRlbGlzdGVkXG4gICAgICAocmVxLCByZXMsIG5leHQpID0+IHRoaXMuYWN0aW9ucy5tYXRjaChyZXEucGF0aCkgPT09IG51bGwgPyBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgbmV3IEhUVFBFeGNlcHRpb25zLk5vdEZvdW5kKHJlcS5wYXRoKSkgOiBuZXh0KCksXG4gICAgICAvLyBwYXJhbXMgc2hvdWxkIGJlIHByZXNlbnRcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIV8uaXNPYmplY3QocmVxLmJvZHkucGFyYW1zKSA/IEhUVFBFeGNlcHRpb25zLmZvcndhcmQocmVzLCBuZXcgSFRUUEV4Y2VwdGlvbnMuQmFkUmVxdWVzdCgnTWlzc2luZyByZXF1aXJlZCBmaWVsZDogXFwncGFyYW1cXCcnKSkgOiBuZXh0KCksXG4gICAgICAvLyBDaGVjayBmb3IgYSB2YWxpZCwgYWN0aXZlIHNlc3Npb24gZ3VpZCBpbiBwYXJhbXNcbiAgICAgIChyZXEsIHJlcywgbmV4dCkgPT4gIXJlcS5ib2R5LnBhcmFtcy5ndWlkID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIG5ldyBIVFRQRXhjZXB0aW9ucy5VbmF1dGhvcml6ZWQoJ01pc3NpbmcgcmVxdWlyZWQgZmllbGQ6IFxcJ3BhcmFtc1xcJy5cXCdndWlkXFwnJykpIDogbmV4dCgpLFxuICAgICAgKHJlcSwgcmVzLCBuZXh0KSA9PiAhdGhpcy5pc0FjdGl2ZVNlc3Npb24ocmVxLmJvZHkucGFyYW1zLmd1aWQpID8gSFRUUEV4Y2VwdGlvbnMuZm9yd2FyZChyZXMsIEhUVFBFeGNlcHRpb25zLlVuYXV0aG9yaXplZCgnSW52YWxpZCBcXCdndWlkXFwnLicpKSA6IG5leHQoKSxcbiAgICAgIChyZXEsIHJlcykgPT4gdGhpcy5kaXNwYXRjaChyZXEucGF0aCwgcmVxLmJvZHkucGFyYW1zKVxuICAgICAgLnRoZW4oKHJlc3VsdCkgPT4gcmVzLnN0YXR1cygyMDApLmpzb24ocmVzdWx0KSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgXy5kZXYoKCkgPT4geyBjb25zb2xlLmVycm9yKGVyciwgZXJyLnN0YWNrKTsgfSk7XG4gICAgICAgICAgaWYoZXJyIGluc3RhbmNlb2YgSFRUUEV4Y2VwdGlvbnMuSFRUUEVycm9yKSB7XG4gICAgICAgICAgICBIVFRQRXhjZXB0aW9ucy5mb3J3YXJkKHJlcywgZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycjogZXJyLnRvU3RyaW5nKCkgfSk7XG4gICAgICAgICAgfVxuICAgICAgfSlcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVsbChwYXRoKSB7XG4gICAgcmV0dXJuIFByb21pc2UudHJ5KCgpID0+IHtcbiAgICAgIF8uZGV2KCgpID0+IHBhdGguc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgICh0aGlzLnN0b3Jlcy5tYXRjaChwYXRoKSAhPT0gbnVsbCkuc2hvdWxkLmJlLm9rXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRoaXMuX2RhdGFbcGF0aF07XG4gICAgfSk7XG4gIH1cblxuICB1cGRhdGUocGF0aCwgdmFsdWUpIHtcbiAgICByZXR1cm4gXy5jb3Byb21pc2UoZnVuY3Rpb24qKCkge1xuICAgICAgXy5kZXYoKCkgPT4gcGF0aC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgdmFsdWUuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgICAodGhpcy5zdG9yZXMubWF0Y2gocGF0aCkgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgICAgLy8gRGlmZiBhbmQgSlNPTi1lbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgICAgLy8gdGhlc2UgbGVuZ3RoeSBjYWxjdWxhdGlvbnMgZG93biB0aGUgcHJvcGFnYXRpb24gdHJlZS5cbiAgICAgICAgbGV0IGhhc2gsIGRpZmY7XG4gICAgICAgIC8vIElmIG5vIHZhbHVlIHdhcyBwcmVzZW50IGJlZm9yZSwgdGhlbiBudWxsaWZ5IHRoZSBoYXNoLiBObyB2YWx1ZSBoYXMgYSBudWxsIGhhc2guXG4gICAgICAgIGlmKCF0aGlzLl9kYXRhW3BhdGhdKSB7XG4gICAgICAgICAgaGFzaCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaGFzaCA9IF8uaGFzaCh0aGlzLl9kYXRhW3BhdGhdKTtcbiAgICAgICAgICBkaWZmID0gXy5kaWZmKHRoaXMuX2RhdGFbcGF0aF0sIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKVxuICAgICAgICAvLyBEaXJlY3RseSBwYXNzIHRoZSBwYXRjaCwgc2Vzc2lvbnMgZG9uJ3QgbmVlZCB0byBiZSBhd2FyZVxuICAgICAgICAvLyBvZiB0aGUgYWN0dWFsIGNvbnRlbnRzOyB0aGV5IG9ubHkgbmVlZCB0byBmb3J3YXJkIHRoZSBkaWZmXG4gICAgICAgIC8vIHRvIHRoZWlyIGFzc29jaWF0ZWQgY2xpZW50cy5cbiAgICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi51cGRhdGUocGF0aCwgeyBoYXNoLCBkaWZmIH0pKTtcbiAgICAgIH1cbiAgICB9LCB0aGlzKTtcbiAgfVxuXG4gIHN1YnNjcmliZVRvKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRQYXRoO1xuICAgIGlmKHRoaXMuc3Vic2NyaWJlcnNbcGF0aF0pIHtcbiAgICAgIC8vIEZhaWwgZWFybHkgdG8gYXZvaWQgY3JlYXRpbmcgbGVha3kgZW50cnkgaW4gdGhpcy5zdWJzY3JpYmVyc1xuICAgICAgXy5kZXYoKCkgPT4gdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXS5zaG91bGQubm90LmJlLm9rKTtcbiAgICAgIGNyZWF0ZWRQYXRoID0gZmFsc2U7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXSA9IHt9O1xuICAgICAgY3JlYXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdID0gc2Vzc2lvbjtcbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIGlzIHRoZSBmaXJzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiBzdWJzY3JpYmUgdG8gYW4gZXh0ZXJuYWwgYmFja2VuZClcbiAgICByZXR1cm4geyBjcmVhdGVkUGF0aCB9O1xuICB9XG5cbiAgdW5zdWJzY3JpYmVGcm9tKHBhdGgsIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiBwYXRoLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKSAmJlxuICAgICAgdGhpcy5zdWJzY3JpYmVyc1twYXRoXS5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICB0aGlzLnN1YnNjcmliZXJzW3BhdGhdW3Nlc3Npb24uaWRdLnNob3VsZC5iZS5leGFjdGx5KHNlc3Npb24pXG4gICAgKTtcbiAgICBsZXQgZGVsZXRlZFBhdGggPSBmYWxzZTtcbiAgICBkZWxldGUgdGhpcy5zdWJzY3JpYmVyc1twYXRoXVtzZXNzaW9uLmlkXTtcbiAgICBpZihPYmplY3Qua2V5cyh0aGlzLnN1YnNjcmliZXJzW3BhdGhdKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLnN1YnNjcmliZXJzW3BhdGhdO1xuICAgICAgZGVsZXRlZFBhdGggPSB0cnVlO1xuICAgIH1cbiAgICAvLyBSZXR1cm4gYSBmbGFnIGluZGljYXRpbmcgd2hldGhlciB0aGlzIHdhcyB0aGUgbGFzdCBzdWJzY3JpcHRpb25cbiAgICAvLyB0byB0aGlzIHBhdGg7IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGVnLiB1bnNidXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFBhdGggfTtcbiAgfVxuXG4gIGVtaXQocm9vbSwgcGFyYW1zKSB7XG4gICAgcmV0dXJuIF8uY29wcm9taXNlKGZ1bmN0aW9uKigpIHtcbiAgICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICAgIHBhcmFtcy5zaG91bGQuYmUuYW4uT2JqZWN0ICYmXG4gICAgICAgICh0aGlzLnJvb21zLm1hdGNoKHJvb20pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICAgICk7XG4gICAgICBpZih0aGlzLmxpc3RlbmVyc1tyb29tXSkge1xuICAgICAgICAvLyBFbmNvZGUgYXMgZWFybHkgYXMgcG9zc2libGUgdG8gYXZvaWQgZHVwbGljYXRpbmdcbiAgICAgICAgLy8gdGhpcyBvcGVyYXRpb24gZG93biB0aGUgcHJvcGFnYXRpb24gdHJlZS5cbiAgICAgICAgbGV0IGpzb24gPSBKU09OLnN0cmluZ2lmeShwYXJhbXMpO1xuICAgICAgICB5aWVsZCBPYmplY3Qua2V5cyh0aGlzLmxpc3RlbmVyc1tyb29tXSlcbiAgICAgICAgLm1hcCgoc2Vzc2lvbikgPT4gc2Vzc2lvbi5lbWl0KHJvb20sIGpzb24pKTtcbiAgICAgIH1cbiAgICB9LCB0aGlzKTtcbiAgfVxuXG4gIGxpc3RlblRvKHJvb20sIHNlc3Npb24pIHtcbiAgICBfLmRldigoKSA9PiByb29tLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgc2Vzc2lvbi5zaG91bGQuYmUuYW4uaW5zdGFuY2VPZihTZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGNyZWF0ZWRSb29tO1xuICAgIGlmKHRoaXMubGlzdGVuZXJzW3Jvb21dKSB7XG4gICAgICAvLyBGYWlsIGVhcmx5IHRvIGF2b2lkIGNyZWF0aW5nIGEgbGVha3kgZW50cnkgaW4gdGhpcy5saXN0ZW5lcnNcbiAgICAgIF8uZGV2KCgpID0+IHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdLnNob3VsZC5ub3QuYmUub2spO1xuICAgICAgY3JlYXRlZFJvb20gPSBmYWxzZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXSA9IHt9O1xuICAgICAgY3JlYXRlZFJvb20gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXSA9IHNlc3Npb247XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyBpcyB0aGUgZmlyc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gc3Vic2NyaWJlIHRvIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgY3JlYXRlZFJvb20gfTtcbiAgfVxuXG4gIHVubGlzdGVuVG8ocm9vbSwgc2Vzc2lvbikge1xuICAgIF8uZGV2KCgpID0+IHJvb20uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBzZXNzaW9uLnNob3VsZC5iZS5hbi5pbnN0YW5jZU9mKFNlc3Npb24pICYmXG4gICAgICB0aGlzLmxpc3RlbmVyc1tyb29tXVtzZXNzaW9uLmlkXS5zaG91bGQuYmUuZXhhY3RseShzZXNzaW9uKVxuICAgICk7XG4gICAgbGV0IGRlbGV0ZWRSb29tID0gZmFsc2U7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzW3Jvb21dW3Nlc3Npb24uaWRdO1xuICAgIGlmKE9iamVjdC5rZXlzKHRoaXMubGlzdGVuZXJzW3Jvb21dKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGRlbGV0ZSB0aGlzLmxpc3RlbmVyc1tyb29tXTtcbiAgICAgIGRlbGV0ZWRSb29tID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gUmV0dXJuIGEgZmxhZyBpbmRpY2F0aW5nIHdoZXRoZXIgdGhpcyB3YXMgdGhlIGxhc3QgbGlzdGVuZXJcbiAgICAvLyB0byB0aGlzIHJvb207IGNhbiBiZSB1c2VmdWwgdG8gaW1wbGVtZW50IHN1YmNsYXNzLXNwZWNpZmljIGhhbmRsaW5nXG4gICAgLy8gKGUuZy4gdW5zdXNjcmliZSBmcm9tIGFuIGV4dGVybmFsIGJhY2tlbmQpXG4gICAgcmV0dXJuIHsgZGVsZXRlZFJvb20gfTtcbiAgfVxuXG4gIGFkZEFjdGlvbkhhbmRsZXIoYWN0aW9uLCBoYW5kbGVyKSB7XG4gICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgaGFuZGxlci5zaG91bGQuYmUuYS5GdW5jdGlvbiAmJlxuICAgICAgKHRoaXMuYWN0aW9ucy5tYXRjaChhY3Rpb24pICE9PSBudWxsKS5zaG91bGQuYmUub2tcbiAgICApO1xuICAgIGxldCBjcmVhdGVkQWN0aW9uID0gZmFsc2U7XG4gICAgaWYoIXRoaXMuYWN0aW9uc1thY3Rpb25dKSB7XG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXSA9IFtdO1xuICAgICAgY3JlYXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dLnB1c2goaGFuZGxlcik7XG4gICAgcmV0dXJuIHsgY3JlYXRlZEFjdGlvbiB9O1xuICB9XG5cbiAgcmVtb3ZlQWN0aW9uSGFuZGxlcihhY3Rpb24sIGhhbmRsZXIpIHtcbiAgICBfLmRldigoKSA9PiBhY3Rpb24uc2hvdWxkLmJlLmEuU3RyaW5nICYmXG4gICAgICBoYW5kbGVyLnNob3VsZC5iZS5hLkZ1bmN0aW9uICYmXG4gICAgICB0aGlzLmFjdGlvbnNbYWN0aW9uXS5zaG91bGQuYmUuYW4uQXJyYXkgJiZcbiAgICAgIF8uY29udGFpbnModGhpcy5hY3Rpb25zW2FjdGlvbl0sIGhhbmRsZXIpLnNob3VsZC5iZS5va1xuICAgICk7XG4gICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBsaXN0IG9mIGhhbmRsZXJzIGhlcmU7XG4gICAgLy8gV2UgZG9uJ3QgZXhwZWN0IHRvIGhhdmUgX3RoYXRfIG11Y2ggZGlmZmVyZW50IGhhbmRsZXJzXG4gICAgLy8gZm9yIGEgZ2l2ZW4gYWN0aW9uLCBzbyBwZXJmb3JtYW5jZSBpbXBsaWNhdGlvbnNcbiAgICAvLyBzaG91bGQgYmUgY29tcGxldGVseSBuZWdsaWdpYmxlLlxuICAgIHRoaXMuYWN0aW9uc1thY3Rpb25dID0gXy53aXRob3V0KHRoaXMuYWN0aW9uc1thY3Rpb25dLCBoYW5kbGVyKTtcbiAgICBsZXQgZGVsZXRlZEFjdGlvbiA9IGZhbHNlO1xuICAgIGlmKHRoaXMuYWN0aW9uc1thY3Rpb25dLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZGVsZXRlIHRoaXMuYWN0aW9uc1thY3Rpb25dO1xuICAgICAgZGVsZXRlZEFjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiB7IGRlbGV0ZWRBY3Rpb24gfTtcbiAgfVxuXG4gIGRpc3BhdGNoKGFjdGlvbiwgcGFyYW1zID0ge30pIHtcbiAgICByZXR1cm4gXy5jb3Byb21pc2UoZnVuY3Rpb24qKCkge1xuICAgICAgXy5kZXYoKCkgPT4gYWN0aW9uLnNob3VsZC5iZS5hLlN0cmluZyAmJlxuICAgICAgICBwYXJhbXMuc2hvdWxkLmJlLmFuLk9iamVjdCAmJlxuICAgICAgICBwYXJhbXMuZ3VpZC5zaG91bGQuYmUuYS5TdHJpbmcgJiZcbiAgICAgICAgKHRoaXMuYWN0aW9uc1thY3Rpb25dLm1hdGNoKGFjdGlvbikgIT09IG51bGwpLnNob3VsZC5iZS5va1xuICAgICAgKTtcbiAgICAgIC8vIFJ1biBhbGwgaGFuZGxlcnMgY29uY3VycmVudGx5IGFuZCByZXR1cm4gdGhlIGxpc3Qgb2YgdGhlIHJlc3VsdHNcbiAgICAgIC8vIChlbXB0eSBsaXN0IGlmIG5vIGhhbmRsZXJzKS5cbiAgICAgIC8vIElmIGFuIGFjdGlvbiBoYW5kbGVyIHRocm93cywgdGhlbiBkaXNwYXRjaCB3aWxsIHRocm93LCBidXQgdGhlIG90aGVycyBoYW5kbGVyc1xuICAgICAgLy8gY2FuIHN0aWxsIHN1Y2NlZWQuXG4gICAgICByZXR1cm4geWllbGQgKHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA/IHRoaXMuYWN0aW9uSGFuZGxlcnNbYWN0aW9uXSA6IFtdKVxuICAgICAgLm1hcCgoaGFuZGxlcikgPT4gaGFuZGxlci5jYWxsKG51bGwsIHBhcmFtcykpO1xuICAgIH0sIHRoaXMpO1xuICB9XG5cbiAgaGFzU2Vzc2lvbihndWlkKSB7XG4gICAgcmV0dXJuICEhdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGNyZWF0ZVNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBpZighdGhpcy5zZXNzaW9uc1tndWlkXSkge1xuICAgICAgdGhpcy5zZXNzaW9uc1tndWlkXSA9IHRoaXMuc2Vzc2lvbkNyZWF0ZWQobmV3IFNlc3Npb24oeyBndWlkLCB1cGxpbms6IHRoaXMgfSkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uc1tndWlkXTtcbiAgfVxuXG4gIGRlbGV0ZVNlc3Npb24oZ3VpZCkge1xuICAgIF8uZGV2KCgpID0+IGd1aWQuc2hvdWxkLmJlLmEuU3RyaW5nKTtcbiAgICBsZXQgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgc2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgZGVsZXRlIHRoaXMuc2Vzc2lvbnNbZ3VpZF07XG4gICAgcmV0dXJuIHRoaXMuc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbik7XG4gIH1cblxuICAvLyBOby1vcCBwbGFjZWhvbGRlciwgdG8gYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRvIGluaXRpYWxpemVcbiAgLy8gc2Vzc2lvbi1yZWxhdGVkIHJlc291cmNlcy5cbiAgLy8gSW1wbGVtZW50YXRpb24gc2hvdWxkIHJldHVybiBhIFByb21pc2UgZm9yIHRoZSBjcmVhdGVkIHNlc3Npb24uXG4gIHNlc3Npb25DcmVhdGVkKHNlc3Npb24pIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNlc3Npb24pO1xuICB9XG5cbiAgLy8gTm8tb3AgcGxhY2Vob2xkZXIsIHRvIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0byBjbGVhbi11cFxuICAvLyBzZXNzaW9uLXJlbGF0ZWQgcmVzb3VyY2VzLlxuICAvLyBJbXBsZW1lbnRhdGlvbiBzaG91bGQgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIGRlbGV0ZWQgc2Vzc2lvbi5cbiAgc2Vzc2lvbkRlbGV0ZWQoc2Vzc2lvbikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbik7XG4gIH1cbn1cblxuXy5leHRlbmQoVXBsaW5rU2ltcGxlU2VydmVyLnByb3RvdHlwZSwge1xuICBzdG9yZXM6IG51bGwsXG4gIHJvb21zOiBudWxsLFxuICBhY3Rpb25zOiBudWxsLFxuXG4gIF9kYXRhOiBudWxsLFxuXG4gIGNvbm5lY3Rpb25zOiBudWxsLFxuICBzZXNzaW9uczogbnVsbCxcblxuICBzdWJzY3JpYmVyczogbnVsbCxcbiAgbGlzdGVuZXJzOiBudWxsLFxuICBhY3Rpb25IYW5kbGVyczogbnVsbCxcbn0pO1xuXG5Db25uZWN0aW9uID0gcmVxdWlyZSgnLi9Db25uZWN0aW9uJykoeyBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5TZXNzaW9uID0gcmVxdWlyZSgnLi9TZXNzaW9uJykoeyBDb25uZWN0aW9uLCBVcGxpbmtTaW1wbGVTZXJ2ZXIgfSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVXBsaW5rU2ltcGxlU2VydmVyO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9