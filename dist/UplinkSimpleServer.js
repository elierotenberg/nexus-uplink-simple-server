"use strict";

var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = (process.env.NODE_ENV !== "production");var __PROD__ = !__DEV__;var __BROWSER__ = (typeof window === "object");var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var bodyParser = require("body-parser");
var ConstantRouter = require("nexus-router").ConstantRouter;
var EngineIO = require("engine.io");
var EventEmitter = require("events").EventEmitter;
var http = require("http");
var HTTPExceptions = require("http-exceptions");

var instanceOfEngineIOSocket = require("./instanceOfEngineIOSocket");
var JSONCache = require("./JSONCache");
var Connection = require("./Connection");
var Session = require("./Session")({ Connection: Connection });

var DEFAULT_JSON_CACHE_MAX_SIZE = 10000;
var DEFAULT_HANDSHAKE_TIMEOUT = 5000;
var DEFAULT_ACTIVITY_TIMEOUT = 10000;

// Here we use ConstantRouter instances; we only need
// to know if a given string match a registered pattern.
function createConstantRouter(t) {
  return new ConstantRouter(_.object(t.map(function (v) {
    return [v, v];
  })));
}

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
    var jsonCacheMaxSize = _ref.jsonCacheMaxSize;
    var handshakeTimeout = _ref.handshakeTimeout;
    var activityTimeout = _ref.activityTimeout;
    jsonCacheMaxSize = jsonCacheMaxSize === void 0 ? DEFAULT_JSON_CACHE_MAX_SIZE : jsonCacheMaxSize;
    handshakeTimeout = handshakeTimeout === void 0 ? DEFAULT_HANDSHAKE_TIMEOUT : handshakeTimeout;
    activityTimeout = activityTimeout === void 0 ? DEFAULT_ACTIVITY_TIMEOUT : activityTimeout;
    _.dev(function () {
      return (pid !== void 0).should.be.ok && stores.should.be.an.Array && rooms.should.be.an.Array && actions.should.be.an.Array &&
      // Ducktype-check for an express-like app
      app.get.should.be.a.Function && app.post.should.be.a.Function &&
      // Other typechecks
      jsonCacheMaxSize.should.be.a.Number.and.not.be.below(0) && handshakeTimeout.should.be.a.Number.and.not.be.below(0) && activityTimeout.should.be.a.Number.and.not.be.below(0);
    });

    _.extend(this, {
      events: new EventEmitter(),
      actions: new EventEmitter(),
      _pid: pid,
      _stores: createConstantRouter(stores),
      _rooms: createConstantRouter(rooms),
      _actions: createConstantRouter(actions),
      _storesCache: {},
      _jsonCache: new JSONCache({ maxSize: jsonCacheMaxSize }),
      _handshakeTimeout: handshakeTimeout,
      _activityTimeout: activityTimeout,
      _app: app,
      _server: http.Server(app),
      _io: EngineIO.Server(),
      _connections: {},
      _sessions: {},
      _subscribers: {},
      _listeners: {} });
  };

  UplinkSimpleServer.prototype.listen = function (port, fn) {
    var _this = this;
    if (fn === undefined) fn = _.noop;
    return (function () {
      _.dev(function () {
        return port.should.be.a.Number;
      });

      _this._bindIOHandlers();
      _this._bindHTTPHandlers();

      // Attach the EngineIO handlers first
      _this._server.listen(port, fn);
      return _this;
    })();
  };

  UplinkSimpleServer.prototype.pull = function (_ref2) {
    var _this2 = this;
    var path = _ref2.path;
    return Promise["try"](function () {
      _.dev(function () {
        return path.should.be.a.String && (_this2._stores.match(path) !== null).should.be.ok;
      });
      var value = _this2._storesCache[path];
      return value === void 0 ? null : value;
    });
  };

  UplinkSimpleServer.prototype.update = function (_ref3) {
    var _this3 = this;
    var path = _ref3.path;
    var value = _ref3.value;
    return Promise["try"](function () {
      _.dev(function () {
        return path.should.be.a.String && (value === null || _.isObject(value)).should.be.ok && (_this3._stores.match(path) !== null).should.be.ok;
      });
      var previousValue = _this3._storesCache[path];
      _this3._storesCache[path] = value;
      if (_this3._subscribers[path] !== void 0) {
        var _ref4 = (previousValue !== void 0 && previousValue !== null && value !== null) ? [_.hash(previousValue), _.diff(previousValue, value)] : [null, {}];
        var _ref5 = _toArray(_ref4);

        var hash = _ref5[0];
        var diff = _ref5[1];
        return Promise.map(Object.keys(_this3._subscribers[path]), function (k) {
          return _this3._subscribers[path][k].update({ path: path, diff: diff, hash: hash });
        });
      }
    });
  };

  UplinkSimpleServer.prototype.emit = function (_ref6) {
    var _this4 = this;
    var room = _ref6.room;
    var params = _ref6.params;
    return Promise["try"](function () {
      _.dev(function () {
        return room.should.be.a.String && (params === null || _.isObject(params)).should.be.ok && (_this4._rooms.match(room) !== null).should.be.ok;
      });
      if (_this4._listeners[room] !== void 0) {
        return Promise.map(Object.keys(_this4._listeners[room]), function (k) {
          return _this4._listeners[room][k].emit({ room: room, params: params });
        });
      }
    });
  };

  UplinkSimpleServer.prototype.dispatch = function (_ref7) {
    var _this5 = this;
    var action = _ref7.action;
    var params = _ref7.params;
    return Promise["try"](function () {
      params = params === void 0 ? {} : params;
      _.dev(function () {
        return action.should.be.a.String && (params === null || _.isObject(params)).should.be.ok && (_this5._actions.match(action) !== null).should.be.ok;
      });
      var handlers = _this5.actions.listeners(action).length;
      _this5.actions.emit(action, params);
      return { handlers: handlers };
    });
  };

  UplinkSimpleServer.prototype._bindIOHandlers = function () {
    var _this6 = this;
    this._io.attach(this._server);
    this._io.on("connection", function (socket) {
      return _this6._handleConnection(socket);
    });
  };

  UplinkSimpleServer.prototype._handleGET = function (req, res) {
    var _this7 = this;
    Promise["try"](function () {
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", "<<", "GET", req.path);
      });
      if (_this7._stores.match(req.path) === null) {
        throw new HTTPExceptions.NotFound(req.path);
      }
      return _this7.pull({ path: req.path }).then(function (value) {
        _.dev(function () {
          return (value === null || _.isObject(value)).should.be.ok;
        });
        _.dev(function () {
          return console.warn("nexus-uplink-simple-server", ">>", "GET", req.path, value);
        });
        res.status(200).type("application/json").send(value);
      });
    })["catch"](function (err) {
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", ">>", "GET", req.path, err.toString(), err.stack);
      });
      if (err instanceof HTTPExceptions.HTTPError) {
        return HTTPExceptions.forward(res, err);
      }
      var json = { err: err.toString() };
      _.dev(function () {
        return json.stack = err.stack;
      });
      res.status(500).json(json);
    });
  };

  UplinkSimpleServer.prototype._handlePOST = function (req, res) {
    var _this8 = this;
    Promise["try"](function () {
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", "<<", "POST", req.path, req.body);
      });
      if (_this8._actions.match(req.path) === null) {
        throw new HTTPExceptions.NotFound(req.path);
      }
      if (req.body.params === void 0) {
        throw new HTTPExceptions.BadRequest("Missing required field: 'params'.");
      }
      if (!_.isObject(req.body.params)) {
        throw new HTTPExceptions.BadRequest("Field 'params' should be an Object.");
      }
      if (req.body.params.guid === void 0) {
        throw new HTTPExceptions.BadRequest("Missing required field: 'params'.'guid'.");
      }
      if (!_this8.isActiveSession(req.body.params.guid)) {
        throw new HTTPExceptions.Unauthorized("Invalid guid: " + req.body.params.guid);
      }
      return _this8.dispatch({ path: req.path, params: req.body.params }).then(function (result) {
        _.dev(function () {
          return console.warn("nexus-uplink-simple-server", ">>", "POST", req.path, req.body, result);
        });
        res.status(200).json(result);
      });
    })["catch"](function (err) {
      _.dev(function () {
        return console.warn("nexus-uplink-simple-server", ">>", "POST", req.path, req.body, err.toString(), err.stack);
      });
      if (err instanceof HTTPExceptions.HTTPError) {
        return HTTPExceptions.forward(res, err);
      }
      var json = { err: err.toString() };
      _.dev(function () {
        return json.stack = err.stack;
      });
      res.status(500).json(json);
    });
  };

  UplinkSimpleServer.prototype._bindHTTPHandlers = function () {
    var _this9 = this;
    this._app.get("*", function (req, res) {
      return _this9._handleGET(req, res);
    });
    this._app.post("*", bodyParser.json(), function (req, res) {
      return _this9._handlePOST(req, res);
    });
  };

  UplinkSimpleServer.prototype._handleConnection = function (socket) {
    var _this10 = this;
    _.dev(function () {
      return console.warn("nexus-uplink-simple-server", "<<", "connection", socket.id);
    });
    _.dev(function () {
      return instanceOfEngineIOSocket(socket).should.be.ok && (_this10._connections[socket.id] === void 0).should.be.ok;
    });
    var connection = new Connection({
      pid: this._pid,
      socket: socket,
      stringify: function (obj) {
        return _this10._stringify(obj);
      },
      handshakeTimeout: this._handshakeTimeout });
    var handlers = {
      close: function () {
        return _this10._handleDisconnection(socket.id);
      },
      handshake: function (_ref8) {
        var guid = _ref8.guid;
        return _this10._handleHandshake(socket.id, { guid: guid });
      } };
    Object.keys(handlers).forEach(function (event) {
      return connection.events.addListener(event, handlers[event]);
    });
    this._connections[socket.id] = { connection: connection, handlers: handlers };
  };

  UplinkSimpleServer.prototype._handleDisconnection = function (socketId) {
    var _this11 = this;
    _.dev(function () {
      return console.warn("nexus-uplink-simple-server", "<<", "disconnection", socketId);
    });
    _.dev(function () {
      return socketId.should.be.a.String && (_this11._connections[socketId] !== void 0).should.be.ok && _this11._connections[socketId].connection.id.should.be.exactly(socketId);
    });
    var connection = this._connections[socketId].connection;
    var handlers = this._connections[socketId].handlers;
    if (connection.isConnected) {
      this._sessions[connection.guid].session.detachConnection(connection);
    }
    Object.keys(handlers).forEach(function (event) {
      return connection.events.removeListener(event, handlers[event]);
    });
    delete this._connections[socketId];
    connection.destroy();
  };

  UplinkSimpleServer.prototype._handleHandshake = function (socketId, _ref9) {
    var _this12 = this;
    var guid = _ref9.guid;
    _.dev(function () {
      return socketId.should.be.a.String && guid.should.be.a.String && (_this12._connections[socketId] !== void 0).should.be.ok;
    });
    var connection = this._connections[socketId].connection;
    _.dev(function () {
      return connection.guid.should.be.exactly(guid);
    });
    if (this._sessions[guid] === void 0) {
      (function () {
        var session = new Session({ guid: guid, activityTimeout: _this12._activityTimeout });
        var handlers = {
          expire: function () {
            return _this12._handleExpire(guid);
          },
          pause: function () {
            return _this12._handlePause(guid);
          },
          resume: function () {
            return _this12._handleResume(guid);
          },
          subscribeTo: function (_ref10) {
            var path = _ref10.path;
            return _this12._handleSubscribeTo(guid, { path: path });
          },
          unsubscribeFrom: function (_ref11) {
            var path = _ref11.path;
            return _this12._handleUnsubscribeFrom(guid, { path: path });
          },
          listenTo: function (_ref12) {
            var room = _ref12.room;
            return _this12._handleListenTo(guid, { room: room });
          },
          unlistenFrom: function (_ref13) {
            var room = _ref13.room;
            return _this12._handleUnlistenFrom(guid, { room: room });
          } };
        _this12._sessions[guid] = { session: session, handlers: handlers };
        Object.keys(handlers).forEach(function (event) {
          return session.events.addListener(event, handlers[event]);
        });
        _this12.events.emit("create", { guid: guid });
      })();
    }
    this._sessions[guid].session.attachConnection(connection);
  };

  UplinkSimpleServer.prototype._handleExpire = function (guid) {
    var _this13 = this;
    _.dev(function () {
      return guid.should.be.a.String && (_this13._sessions[guid] !== void 0).should.be.ok;
    });
    var session = this._sessions[guid].session;
    var handlers = this._sessions[guid].handlers;
    Object.keys(handlers).forEach(function (event) {
      return session.events.removeListener(event, handlers[event]);
    });
    delete this._sessions[guid];
    session.destroy();
    this.events.emit("delete", { guid: guid });
  };

  UplinkSimpleServer.prototype._handlePause = function (guid) {
    var _this14 = this;
    _.dev(function () {
      return guid.should.be.a.String && (_this14._sessions[guid] !== void 0).should.be.ok;
    });
    this.events.emit("pause", guid);
  };

  UplinkSimpleServer.prototype._handleResume = function (guid) {
    var _this15 = this;
    _.dev(function () {
      return guid.should.be.a.String && (_this15._sessions[guid] !== void 0).should.be.ok;
    });
    this.events.emit("resume", guid);
  };

  UplinkSimpleServer.prototype._handleSubscribeTo = function (guid, _ref14) {
    var _this16 = this;
    var path = _ref14.path;
    _.dev(function () {
      return guid.should.be.a.String && path.should.be.a.String && (_this16._sessions[guid] !== void 0).should.be.ok;
    });
    if (this._subscribers[path] === void 0) {
      this._subscribers[path] = {};
    }
    if (this._subscribers[path][guid] === void 0) {
      var session = this._sessions[guid].session;
      this._subscribers[path][guid] = session;
      this.events.emit("subscribeTo", [guid, { path: path }]);
    }
  };

  UplinkSimpleServer.prototype._handleUnsubscribeFrom = function (guid, _ref15) {
    var _this17 = this;
    var path = _ref15.path;
    _.dev(function () {
      return guid.should.be.a.String && path.should.be.a.String && (_this17._sessions[guid] !== void 0).should.be.ok;
    });
    if (this._subscribers[path] !== void 0) {
      if (this._subscribers[path][guid] !== void 0) {
        delete this._subscribers[path][guid];
        this.events.emit("unsubscribeFrom", [guid, { path: path }]);
      }
      if (Object.keys(this._subscribers[path]).length === 0) {
        delete this._subscribers[path];
      }
    }
  };

  UplinkSimpleServer.prototype._handleListenTo = function (guid, _ref16) {
    var _this18 = this;
    var room = _ref16.room;
    _.dev(function () {
      return guid.should.be.a.String && room.should.be.a.String && (_this18._sessions[guid] !== void 0).should.be.ok;
    });
    if (this._listeners[room] === void 0) {
      this._listeners[room] = {};
    }
    if (this._listeners[room][guid] === void 0) {
      var session = this._sessions[guid].session;
      this._listeners[room][guid] = session;
      this.events.emit("listenTo", [guid, { room: room }]);
    }
  };

  UplinkSimpleServer.prototype._handleUnlistenFrom = function (guid, _ref17) {
    var _this19 = this;
    var room = _ref17.room;
    _.dev(function () {
      return guid.should.be.a.String && room.should.be.a.String && (_this19._sessions[guid] !== void 0).should.be.ok;
    });
    if (this._listeners[room] !== void 0) {
      if (this._listeners[room][guid] !== void 0) {
        delete this._listeners[room][guid];
        this.events.emit("unlistenFrom", [guid, { room: room }]);
      }
      if (Object.keys(this._listeners[room]).length === 0) {
        delete this._listeners[room];
      }
    }
  };

  UplinkSimpleServer.prototype._stringify = function (object) {
    _.dev(function () {
      return object.should.be.an.Object;
    });
    return this._jsonCache.stringify(object);
  };

  return UplinkSimpleServer;
})();

_.extend(UplinkSimpleServer.prototype, {
  _pid: null,

  events: null,
  actions: null,

  _stores: null,
  _rooms: null,
  _actions: null,
  _storesCache: null,
  _jsonCache: null,
  _handshakeTimeout: null,
  _activityTimeout: null,

  _app: null,
  _server: null,
  _io: null,

  _connections: null,
  _sessions: null,
  _subscribers: null,
  _listeners: null });


module.exports = UplinkSimpleServer;