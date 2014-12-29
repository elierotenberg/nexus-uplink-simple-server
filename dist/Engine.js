"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var HTTPExceptions = require("http-exceptions");
var _ref = require("nexus-uplink-common");

var MESSAGE_TYPES = _ref.MESSAGE_TYPES;
var Message = _ref.Message;
var Remutable = _ref.Remutable;
var sha256 = require("sha256");

var DEFAULT_HANDSHAKE_TIMEOUT = 5000;
var DEFAULT_SESSION_TIMEOUT = 5000;

var RESERVED_ACTIONS = {
  SESSION_CREATE: "/session/create",
  SESSION_TIMEOUT: "/session/timeout",
  SESSION_DESTROY: "/session/destroy" };

var INT_MAX = 9007199254740992;
var ALLOW_RESERVED_ACTION = _.random(1, INT_MAX - 1);

// Alias for class Engine, to shut-up jshint
var _Engine = undefined;

var BoundRemutable = function BoundRemutable(path, remutable, engine) {
  _.dev(function () {
    path.should.be.a.String;
    remutable.should.be.an.instanceOf(Remutable);
    engine.should.be.an.instanceOf(_Engine);
  });
  _.extend(this, {
    _path: path,
    _remutable: remutable,
    _engine: engine });
};

BoundRemutable.prototype.set = function () {
  return this._remutable.set.apply(this._remutable, arguments);
};

BoundRemutable.prototype["delete"] = function () {
  return this._remutable["delete"].apply(this._remutable, arguments);
};

BoundRemutable.prototype.rollback = function () {
  return this._remutable.rollback.apply(this._remutable, arguments);
};

BoundRemutable.prototype.commit = function () {
  return this._engine.commit(this._path);
};

_prototypeProperties(BoundRemutable, null, {
  working: {
    get: function () {
      return this._remutable.working;
    },
    enumerable: true
  },
  head: {
    get: function () {
      return this._remutable.head;
    },
    enumerable: true
  }
});

_.extend(BoundRemutable.prototype, {
  _path: null,
  _remutable: null,
  _engine: null });

var Engine = function Engine(options) {
  var _this = this;
  options = options || {};
  _.dev(function () {
    return options.should.be.an.Object;
  });
  this._pid = options.pid || _.guid();
  _.dev(function () {
    return _this._pid.should.be.a.String;
  });
  this._handshakeTimeout = options._handshakeTimeout || DEFAULT_HANDSHAKE_TIMEOUT;
  _.dev(function () {
    return _this._handshakeTimeout.should.be.a.Number;
  });
  this._sessionTimeout = options._sessionTimeout || DEFAULT_SESSION_TIMEOUT;
  _.dev(function () {
    return _this._sessionTimeout.should.be.a.Number;
  });
  this._stores = {}; // path -> remutable
  this._subscribers = {}; // path -> secretId -> session
  this._connections = {}; // socketId -> connection
  this._sessions = {}; // secretId -> session
  this._actionHandlers = {}; // action -> actionHandlerId -> Function
};

Engine.prototype.addActionHandler = function (action, fn) {
  _.dev(function () {
    action.should.be.a.String;
    fn.should.be.a.Function;
  });
  if (this._actionHandlers[action] === void 0) {
    this._actionHandlers[action] = {};
  }
  var id = _.uniqueId("a");
  this._actionHandlers[action][id] = fn;
  return { action: action, id: id };
};

Engine.prototype.removeActionHandler = function (_ref2) {
  var _this2 = this;
  var action = _ref2.action;
  var id = _ref2.id;
  _.dev(function () {
    action.should.be.a.String;
    id.should.be.a.String;
    (_this2._actionHandlers[action] !== void 0).should.be.ok;
    (_this2._actionHandlers[action][id] !== void 0).should.be.ok;
  });
  delete this._actionHandlers[action][id];
  if (_.size(this._actionHandlers[action]) === 0) {
    delete this._actionHandlers[action];
  }
};

Engine.prototype.get = function (path) {
  if (this._stores[path] === void 0) {
    this._stores[path] = new Remutable();
  }
  return new BoundRemutable(path, this._stores[path], this);
};

Engine.prototype["delete"] = function (path) {
  var _this3 = this;
  _.dev(function () {
    return (_this3._stores[path] !== void 0).should.be.ok;
  });
  if (this._subscribers[path] !== void 0) {
    (function () {
      var message = Message.Delete({ path: path });
      _.each(_this3._subscribers[path], function (session) {
        return session.queue(message);
      });
      delete _this3._subscribers[path];
    })();
  }
};

Engine.prototype.commit = function (path) {
  var _this4 = this;
  _.dev(function () {
    return (_this4._stores[path] !== void 0).should.be.ok;
  });
  if (!this._stores[path].dirty) {
    return;
  }
  var patch = this._stores[path].commit();
  if (this._subscribers[path] !== void 0) {
    (function () {
      var message = Message.Update({ path: path, patch: patch });
      _.each(_this4._subscribers[path], function (session) {
        return session.queue(message);
      });
    })();
  }
};

Engine.prototype.session = function (clientSecret) {
  _.dev(function () {
    return clientSecret.should.be.a.String;
  });
  if (this._sessions[clientSecret] === void 0) {
    this._sessions[clientSecret] = {
      clientSecret: clientSecret,
      // invariant: _.size(connections) > 0 XOR (sessionTimeout === null && queue === null)
      connections: {},
      sessionTimeout: null,
      queue: null };
    this.handleSessionCreate(clientSecret);
    this._pause(clientSecret);
  }
  return this._sessions[clientSecret];
};

Engine.prototype.dispatch = function (clientSecret, action, params, _allowReservedAction) {
  if (_allowReservedAction === undefined) _allowReservedAction = false;
  if (_.contains(RESERVED_ACTIONS, action)) {
    _allowReservedAction.should.be.exactly(ALLOW_RESERVED_ACTION);
  }
  if (!this._actionHandlers[action]) {
    return 0;
  }
  if (!_allowReservedAction) {
    // Ensure session exists
    this.session(clientSecret);
    // Reset the timer in case the session was about to expire
    this.resetTimeout(clientSecret);
  }
  _.each(this._actionHandlers[action], function (fn) {
    return fn(Engine.clientID(clientSecret), params);
  });
  return this._actionHandlers[action].length;
};

Engine.prototype.handleGET = function (req, res) {
  var _this5 = this;
  Promise["try"](function () {
    var path = req.path;
    if (_this5._stores[path] === void 0) {
      throw new HTTPExceptions.NotFound(path);
    }
    return _this5._stores[path].toJSON();
  }).then(function (json) {
    _.dev(function () {
      return console.log("nexus-uplink-server << GET " + req.path + " >> " + json);
    });
    res.status(200).json(json);
  })["catch"](function (err) {
    _.dev(function () {
      return console.log("nexus-uplink-server << GET " + req.path + " >> " + err.stack);
    });
    if (err instanceof HTTPExceptions.HTTPError) {
      return HTTPExceptions.forward(err, res);
    }
    var json = { err: err.toString(), stack: __DEV__ ? err.stack : null };
    res.status(500).json(json);
  });
};

Engine.prototype.handlePOST = function (req, res) {
  var _this6 = this;
  // req should have its body parsed, eg. using bodyParser.json()
  Promise["try"](function () {
    var path = req.path;
    var body = req.body;
    var clientSecret = body.clientSecret;
    var params = body.params;
    if (_this6._actionHandlers[path] === void 0) {
      throw new HTTPExceptions.NotFound(path);
    }
    return _this6.dispatch(clientSecret, path, params);
  }).then(function (n) {
    _.dev(function () {
      return console.log("nexus-uplink-server << POST " + req.path + " >> " + n);
    });
    res.status(200).json({ n: n });
  })["catch"](function (err) {
    _.dev(function () {
      return console.log("nexus-uplink-server << POST " + req.path + " >> " + err.stack);
    });
    if (err instanceof HTTPExceptions.HTTPError) {
      return HTTPExceptions.forward(err, res);
    }
    var json = { err: err.toString(), stack: __DEV__ ? err.stack : null };
    res.status(500).json(json);
  });
};

Engine.prototype.handleConnection = function (socket) {
  var _this7 = this;
  var socketId = socket.id;
  this._connections[socketId] = {
    socket: socket,
    // invariant: handshakeTimeout === null XOR clientSecret === null
    handshakeTimeout: setTimeout(function () {
      return _this7.handleHandshakeTimeout(socketId);
    }, this._handshakeTimeout),
    clientSecret: null };
  socket.on("close", function () {
    return _this7.handleDisconnection(socketId);
  });
  socket.on("error", function (err) {
    return _this7.handleError(socketId, err);
  });
  socket.on("message", function (json) {
    return _this7.handleMessage(socketId, json);
  });
};

Engine.prototype.handleDisconnection = function (socketId) {
  var _this8 = this;
  _.dev(function () {
    socketId.should.be.a.String;
    _this8._connections[socketId] !== void 0;
  });
  var clientSecret = this._connections[socketId].clientSecret;
  var handshakeTimeout = this._connections[socketId].handshakeTimeout;
  if (clientSecret !== null) {
    _.dev(function () {
      return (handshakeTimeout === null).should.be.ok;
    });
    _.dev(function () {
      return (_this8._sessions[clientSecret] !== void 0).should.be.ok;
    });
    delete this._sessions[clientSecret].connections[socketId];
    if (_.size(this._sessions[clientSecret].connections) === 0) {
      this._pause(clientSecret);
    }
  } else {
    _.dev(function () {
      return (handshakeTimeout !== null).should.be.ok;
    });
    clearTimeout(handshakeTimeout);
    this._connections[socketId].handshakeTimeout = null;
  }
  delete this._connections[socketId];
};

Engine.prototype.handleError = function (socketId, err) {
  _.dev(function () {
    return console.warn("Socket " + socketId + " error:", err);
  });
};

Engine.prototype.handleMessage = function (socketId, json) {
  var _this9 = this;
  // Wrap in a Promise.try to avoid polluting the main execution stack
  // and catch any async error correctly
  Promise["try"](function () {
    var message = Message.fromJSON(json);
    var interpretation = message.interpret();
    if (message.type === MESSAGE_TYPES.HANDSHAKE) {
      return _this9.handleHandshake(socketId, interpretation);
    } else if (message.type === MESSAGE_TYPES.SUBSCRIBE) {
      return _this9.handleSubscribe(socketId, interpretation);
    } else if (message.type === MESSAGE_TYPES.UNSUBSCRIBE) {
      return _this9.handleUnsubscribe(socketId, interpretation);
    } else if (message.type === MESSAGE_TYPES.DISPATCH) {
      return _this9.handleDispatch(socketId, interpretation);
    } else {
      throw new Error("Unknown message type: " + message.type);
    }
  })["catch"](function (err) {
    _this9.send(socketId, Message.Error({ err: err }));
  });
};

Engine.prototype.handleHandshake = function (socketId, _ref3) {
  var _this10 = this;
  var clientSecret = _ref3.clientSecret;
  (this._connections[socketId].clientSecret === null).should.be.ok;
  _.dev(function () {
    return (_this10._connections[socketId].handshakeTimeout !== null).should.be.ok;
  });
  clearTimeout(this._connections[socketId].handshakeTimeout);
  this._connections[socketId].handshakeTimeout = null;
  this._connections[socketId].clientSecret = clientSecret;
  var _session = this.session(clientSecret);
  _session.connections[socketId] = socketId;
  if (_.size(_session.connections) === 1) {
    this._resume(clientSecret);
  }
};

Engine.prototype.handleSubscribe = function (socketId, _ref4) {
  var path = _ref4.path;
  (this._connections[socketId].clientSecret !== null).should.be.ok;
  (this._stores[path] !== void 0).should.be.ok;
  var clientSecret = this._connections[socketId].clientSecret;
  if (this._subscribers[path] === void 0) {
    this._subscribers[path] = {};
  }
  this._subscribers[path][clientSecret] = clientSecret;
};

Engine.prototype.handleUnsubscribe = function (socketId, _ref5) {
  var path = _ref5.path;
  (this._connections[socketId].clientSecret !== null).should.be.ok;
  (this._stores[path] !== void 0).should.be.ok;
  var clientSecret = this._connections[socketId].clientSecret;
  if (this._subscribers[path] === void 0) {
    return;
  }
  if (this._subscribers[path][clientSecret] !== void 0) {
    delete this._subscribers[path][clientSecret];
  }
  if (_.size(this._subscribers[path]) === 0) {
    delete this._subscribers[path];
  }
};

Engine.prototype.handleDispatch = function (socketId, _ref6) {
  var action = _ref6.action;
  var params = _ref6.params;
  (this._connections[socketId].clientSecret !== null).should.be.ok;
  var clientSecret = this._connections[socketId].clientSecret;
  this.dispatch(clientSecret, action, params);
};

Engine.prototype.handleSessionCreate = function (clientSecret) {
  this.dispatch(clientSecret, "create", {}, ALLOW_RESERVED_ACTION);
};

Engine.prototype.handleSessionTimeout = function (clientSecret) {
  this.dispatch(clientSecret, "timeout", {}, ALLOW_RESERVED_ACTION);
  var err = new Error("Session timeout");
  this.kill(clientSecret, { message: err.message, stack: __DEV__ ? err.stack : null });
};

Engine.prototype.handleSessionDestroy = function (clientSecret) {
  this.dispatch(clientSecret, "destroy", {}, ALLOW_RESERVED_ACTION);
};

Engine.prototype.handleHandshakeTimeout = function (socketId) {
  var err = new Error("Handshake timeout");
  var message = Message.Error({ message: err.message, stack: __DEV__ ? err.stack : null });
  this.send(socketId, message);
  this.close(socketId);
};

Engine.prototype.close = function (socketId) {
  var _this11 = this;
  _.dev(function () {
    socketId.should.be.a.String;
    (_this11._connections[socketId] !== void 0).should.be.ok;
  });
  // Resource freeing is done in handleDisconnection()
  this._connections[socketId].socket.close();
};

Engine.prototype.send = function (socketId, message) {
  var _this12 = this;
  _.dev(function () {
    socketId.should.be.a.String;
    (_this12._connections[socketId] !== void 0).should.be.ok;
    message.should.be.an.instanceOf(Message);
  });
  this._connections[socketId].socket.send(message.toJSON());
};

Engine.prototype.queue = function (clientSecret, message) {
  var _this13 = this;
  _.dev(function () {
    clientSecret.should.be.a.String;
    (_this13._sessions[clientSecret] !== void 0).should.be.ok;
    message.should.be.an.instanceOf(Message);
  });
  if (this._sessions[clientSecret].queue === null) {
    Object.keys(this._sessions[clientSecret].connections).forEach(function (socketId) {
      return _this13.send(socketId, message);
    });
  } else {
    this._sessions[clientSecret].queue.push(message);
  }
};

Engine.prototype.kill = function (clientSecret, err) {
  var _this14 = this;
  _.dev(function () {
    clientSecret.should.be.a.String;
    err.should.be.an.Object;
  });
  if (!this._sessions[clientSecret]) {
    return;
  }
  // Send an error message to all connected clients
  if (_.size(this._sessions[clientSecret].connections) > 0) {
    (function () {
      var message = Message.Error({ err: err });
      _.each(_this14._sessions[clientSecret].connections, function (socketId) {
        return _this14.send(socketId, message);
      });
      _this14._sessions[clientSecret].connections = null;
    })();
  }
  // Remove the session timeout
  if (this._sessions[clientSecret].sessionTimeout !== null) {
    clearTimeout(this._sessions[clientSecret].sessionTimeout);
    this._sessions[clientSecret].sessionTimeout = null;
  }
  // Dereference the message queue, for clarity
  if (this._sessions[clientSecret].queue !== null) {
    this._sessions[clientSecret].queue = null;
  }
  // Dereference the clientSecret, for clarity
  this._sessions[clientSecret].clientSecret = null;
  delete this._sessions[clientSecret];
  this.handleSessionDestroy(clientSecret);
};

// If the session is about to expire, reset its expiration timer.
Engine.prototype.resetTimeout = function (clientSecret) {
  var _this15 = this;
  _.dev(function () {
    return (_this15._sessions[clientSecret] !== void 0).should.be.ok;
  });
  if (this._sessions[clientSecret].sessionTimeout !== null) {
    clearTimeout(this._sessions[clientSecret].sessionTimeout);
    this._sessions[clientSecret].sessionTimeout = setTimeout(function () {
      return _this15.handleSessionTimeout(clientSecret);
    }, this._sessionTimeout);
  }
};

Engine.clientID = function (clientSecret) {
  _.dev(function () {
    return clientSecret.should.be.a.String;
  });
  return sha256(clientSecret);
};

Engine.prototype._pause = function (clientSecret) {
  var _this16 = this;
  _.dev(function () {
    clientSecret.should.be.a.String;
    (_this16._sessions[clientSecret] !== void 0).should.be.ok;
    (_this16._sessions[clientSecret].sessionTimeout === null).should.be.ok;
    (_this16._sessions[clientSecret].queue === null).should.be.ok;
    _.size(_this16._sessions[clientSecret].connections).should.be.exactly(0);
  });
  this._sessions[clientSecret].sessionTimeout = setTimeout(function () {
    return _this16.handleSessionTimeout(clientSecret);
  }, this._sessionTimeout);
  this._sessions[clientSecret].queue = [];
};

Engine.prototype._resume = function (clientSecret) {
  var _this17 = this;
  _.dev(function () {
    clientSecret.should.be.a.String;
    (_this17._sessions[clientSecret] !== void 0).should.be.ok;
    (_this17._sessions[clientSecret].sessionTimeout !== null).should.be.ok;
    (_this17._sessions[clientSecret].queue !== null).should.be.ok;
    _.size(_this17._sessions[clientSecret].connections).should.be.above(0);
  });
  clearTimeout(this._sessions[clientSecret].sessionTimeout);
  while (this._sessions[clientSecret].queue.length > 0) {
    this.queue(clientSecret, this._sessions[clientSecret].queue.shift());
  }
  this._sessionTimeout[clientSecret].queue = null;
};

_Engine = Engine;

module.exports = { Engine: Engine };