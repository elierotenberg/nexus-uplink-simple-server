const _ = require('lodash-next');
const bodyParser = require('body-parser');
const ConstantRouter = require('nexus-router').ConstantRouter;
const HTTPExceptions = require('http-exceptions');
const http = require('http');
const EngineIO = require('engine.io');
const instanceOfEngineIOSocket = require('./instanceOfEngineIOSocket');
const JSONCache = require('./JSONCache');
const EventEmitter = require('events').EventEmitter;

let Connection, Session;

const DEFAULT_JSON_CACHE_MAX_SIZE = 10000;
const DEFAULT_HANDSHAKE_TIMEOUT = 5000;
const DEFAULT_ACTIVITY_TIMEOUT = 10000;

// Here we use ConstantRouter instances; we only need
// to know if a given string match a registered pattern.
function createConstantRouter(t) {
  return new ConstantRouter(_.object(t.map((v) => [v, v])));
}

// Most public methods expose an async API
// to enforce consistence with async data backends,
// eg. redis or mysql, although in this implementation
// the backend resides in memory (a simple Object acting
// as an associative map).
class UplinkSimpleServer {
  // stores, rooms, and actions are three whitelists of
  // string patterns. Each is an array that will be passed
  // to the Router constructor.
  constructor({ pid, stores, rooms, actions, app, jsonCacheMaxSize, handshakeTimeout, activityTimeout }) {
    jsonCacheMaxSize = jsonCacheMaxSize === void 0 ? DEFAULT_JSONCACHE_SIZE : jsonCacheMaxSize;
    handshakeTimeout = handshakeTimeout === void 0 ? DEFAULT_HANDSHAKE_TIMEOUT : handshakeTimeout;
    activityTimeout = activityTimeout === void 0 ? DEFAULT_ACTIVITY_TIMEOUT : activityTimeout;
    _.dev(() => (pid !== void 0).should.be.ok &&
      stores.should.be.an.Array &&
      rooms.should.be.an.Array &&
      actions.should.be.an.Array &&
      // Ducktype-check for an express-like app
      app.get.should.be.a.Function &&
      app.post.should.be.a.Function &&
      // Other typechecks
      jsonCacheMaxSize.should.be.a.Number.and.not.be.below(0) &&
      handshakeTimeout.should.be.a.Number.and.not.be.below(0) &&
      activityTimeout.should.be.a.Number.and.not.be.below(0)
    );

    _.extend(this, {
      events: new EventEmitter(),
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
      _listeners: {},
      _actionHandlers: {},
    });

    // Connections represent actual living socket.io connections.
    // Session represent a remote Uplink client instance, with a unique guid.
    // The concept of session enforces consistency between its attached socket connections,
    // and HTTP requests.
    // A single session can be attached to zero or more than one connection.
    // Uplink frames are received from and sent to sessions, not connection.
    // Each session must keep references to its attached connections and propagate
    // relevant frames accordingly.
  }

  listen(port, fn = _.noop) {
    _.dev(() => port.should.be.a.Number);

    this._bindIOHandlers();
    this._bindHTTPHandlers();

    // Attach the EngineIO handlers first
    this._server.listen(port, fn);
    return this;
  }

  _bindIOHandlers() {
    this._io.attach(this.server);
    this._io.on('connection', (socket) => this._handleConnection(socket));
  }

  _handleGET(req, res) {
    Promise.try(() => {
      _.dev(() => console.warn('nexus-uplink-simple-server', '<<', 'GET', req.path));
      if(this._stores.match(req.path) === null) {
        throw new HTTPExceptions.NotFound(req.path);
      }
      return this._pull(req.path)
      .then((value) => {
        _.dev(() => (value === null || _.isObject(value)).should.be.ok);
        _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'GET', req.path, value));
        res.status(200).type('application/json').send(value);
      });
    })
    .catch((err) => {
      _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'GET', req.path, err));
      if(err instanceof HTTPExceptions.HTTPError) {
        return HTTPExceptions.forward(res, err);
      }
      const json = { err: err.toString() };
      _.dev(() => json.stack = err.stack);
      res.status(500).json(json);
    });
  }

  _handlePOST(req, res) {
    Promise.try(() => {
      _.dev(() => console.warn('nexus-uplink-simple-server', '<<', 'POST', req.path, req.body));
      if(this._actions.match(req.path) === null) {
        throw new HTTPExceptions.NotFound(req.path);
      }
      if(req.body.params === void 0) {
        throw new HTTPExceptions.BadRequest(`Missing required field: 'params'.`);
      }
      if(!_.isObject(req.body.params)) {
        throw new HTTPExceptions.BadRequest(`Field 'params' should be an Object.`);
      }
      if(req.body.params.guid === void 0) {
        throw new HTTPExceptions.BadRequest(`Missing required field: 'params'.'guid'.`);
      }
      if(!this.isActiveSession(req.body.params.guid)) {
        throw new HTTPExceptions.Unauthorized(`Invalid guid: ${req.body.params.guid}`);
      }
      return this._dispatch(req.path, req.body.params)
      .then((result) => {
        _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'POST', req.path, req.body, result));
        res.status(200).json(result);
      });
    })
    .catch((err) => {
      _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'POST', req.path, req.body, err));
      if(err instanceof HTTPExceptions.HTTPError) {
        return HTTPExceptions.forward(res, err);
      }
      const json = { err: err.toString() };
      _.dev(() => json.stack = err.stack);
      res.status(500).json(json);
    });
  }

  _bindHTTPHandlers() {
    this._app.get('*', (req, res) => this._handleGET(req, res));
    this._app.post('*', bodyParser.json(), (req, res) => this._handlePOST(req, res));
  }

  _handleConnection(socket) {
    _.dev(() => console.warn('nexus-uplink-simple-server', '<<', 'connection', socket.id));
    _.dev(() => instanceOfEngineIOSocket(socket).should.be.ok &&
      (this._connections[socket.id] === void 0).should.be.ok
    );
    const connection = new Connection({
      socket,
      stringify: (obj) => this._stringify(obj),
      handshakeTimeout: this._handshakeTimeout,
    });
    const handlers = {
      close: () => this._handleDisconnection(socket.id),
      handshake: ({ guid }) => this._handleHandshake(socket.id, { guid }),
    };
    Object.keys(handlers).forEach((event) => connection.events.addListener(event, handlers[event]));
    this._connections[socket.id] = { connection, handlers };
  }

  _handleDisconnection(socketId) {
    _.dev(() => socketId.should.be.a.String &&
      (this._connections[socketId] !== void 0).should.be.ok &&
      this._connections[socketId].connection.id.should.be.exactly(socketId)
    );
    const { connection, handlers } = this._connections[socketId];
    if(connection.isConnected) {
      this._sessions[connection.guid].session.detachConnection(connection);
    }
    connection.destroy();
    Object.keys(handlers).forEach((event) => connection.events.removeListener(event, handlers[event]));
    delete this._connections[socketId];
  }

  _handleHandshake(socketId, { guid }) {
    _.dev(() => socketId.should.be.a.String &&
      guid.should.be.a.String &&
      (this._connections[socketId] !== void 0).should.be.ok
    );
    const { connection } = this._connections[socketId];
    if(this._sessions[guid] === void 0) {
      const session = new Session({ guid, activityTimeout: this._activityTimeout });
      const handlers = {
        expire: () => this._handleExpire(guid),
        pause: () => this._handlePause(guid),
        resume: () => this._handleResume(guid),
        subscribeTo: (path) => this._handleSubscribeTo(guid, path),
        unsubscribeFrom: (path) => this._handleUnsubscribeFrom(guid, path),
        listenTo: (room) => this._handleListenTo(guid, room),
        unlistenFrom: (room) => this._handleUnlistenFrom(guid, room),
      };
      this._sessions[guid] = { session, handlers };
      Object.keys(handlers).forEach((event) => session.events.addListener(event, handlers[event]));
      this.events.emit('create', { guid });
    }
    this._sessions[guid].session.attachConnection(connection);
  }

  _handleExpire(guid) {
    _.dev(() => guid.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    const { session, handlers } = this._sessions[guid];
    session.destroy();
    Object.keys(handlers).forEach((event) => session.events.removeListener(event, handlers[event]));
    delete this._sessions[guid];
    this.events.emit('delete', { guid });
  }

  _handlePause(guid) {
    _.dev(() => guid.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    this.events.emit('pause', guid);
  }

  _handleResume(guid) {
    _.dev(() => guid.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    this.events.emit('resume', guid);
  }

  _handleSubscribeTo(guid, path) {
    _.dev(() => guid.should.be.a.String &&
      path.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    if(this._subscribers[path] === void 0) {
      this._subscribers[path] = {};
    }
    if(this._subscribers[path][guid] === void 0) {
      const { session } = this._sessions[guid];
      this._subscribers[path][guid] = session;
      this.events.emit('subscribeTo', { guid, path });
    }
  }

  _handleUnsubscribeFrom(guid, path) {
    _.dev(() => guid.should.be.a.String &&
      path.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    if(this._subscribers[path] !== void 0) {
      if(this._subscribers[path][guid] !== void 0) {
        delete this._subscribers[path][guid];
        this.events.emit('unsubscribeFrom', { guid, path });
      }
      if(Object.keys(this._subscribers[path]).length === 0) {
        delete this._subscribers[path];
      }
    }
  }

  _handleListenTo(guid, room) {
    _.dev(() => guid.should.be.a.String &&
      room.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    if(this._listeners[path] === void 0) {
      this._listeners[path] = {};
    }
    if(this._listeners[path][guid] === void 0) {
      const { session } = this._sessions[guid];
      this._listeners[path][guid] = session;
      this.events.emit('listenTo', { guid, room });
    }
  }

  _handleUnlistenFrom(guid, room) {
    _.dev(() => guid.should.be.a.String &&
      room.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    if(this._listeners[room] !== void 0) {
      if(this._listeners[room][guid] !== void 0) {
        delete this._listeners[room][guid];
        this.events.emit('unlistenFrom', { guid, path });
      }
      if(Object.keys(this._listeners[room]).length === 0) {
        delete this._listeners[room];
      }
    }
  }

  _stringify(object) {
    _.dev(() => object.should.be.an.Object);
    return this._jsonCache.stringify(object);
  }

  pull(path) {
    return Promise.try(() => {
      _.dev(() => path.should.be.a.String &&
        (this._stores.match(path) !== null).should.be.ok
      );
      const value = this._storesCache[path];
      return value === void 0 ? null : value;
    });
  }

  update(path, value) {
    return Promise.try(() => {
      _.dev(() => path.should.be.a.String &&
        (value === null || _.isObject(value)).should.be.ok &&
        (this._stores.match(path) !== null).should.be.ok
      );
      const previousValue = this._storesCache[path];
      this._storesCache[path] = value;
      if(this._subscribers[path] !== void 0) {
        const [hash, diff] =
          (previousValue !== void 0 && previousValue !== null && value !== null) ?
          [_.hash(previousValue), _.diff(previousValue, value)] : [null, {}];
        return Promise.map(Object.keys(this._subscribers[path]), (k) => this._subscribers[path][k].update({ path, diff, hash }));
      }
    });
  }

  emit(room, params) {
    return Promise.try(() => {
      _.dev(() => room.should.be.a.String &&
        (params === null || _.isObject(params)).should.be.ok &&
        (this._rooms.match(room) !== null).should.be.ok
      );
      if(this._listeners[room] !== void 0) {
        return Promise.map(Object.keys(this._listeners[room]), (k) => this._listeners[room][k].emit({ room, params }));
      }
    });
  }

  addActionHandler(action, handler) {
    _.dev(() => action.should.be.a.String &&
      handler.should.be.a.Function &&
      (this.actions.match(action) !== null).should.be.ok
    );
    let createdAction = false;
    if(!this.actions[action]) {
      this.actions[action] = [];
      createdAction = true;
    }
    this.actions[action].push(handler);
    return { createdAction };
  }

  removeActionHandler(action, handler) {
    _.dev(() => action.should.be.a.String &&
      handler.should.be.a.Function &&
      this.actions[action].should.be.an.Array &&
      _.contains(this.actions[action], handler).should.be.ok
    );
    // Loop through the list of handlers here;
    // We don't expect to have _that_ much different handlers
    // for a given action, so performance implications
    // should be completely negligible.
    this.actions[action] = _.without(this.actions[action], handler);
    let deletedAction = false;
    if(this.actions[action].length === 0) {
      delete this.actions[action];
      deletedAction = true;
    }
    return { deletedAction };
  }

  *dispatch(action, params = {}) { // jshint ignore:line
    _.dev(() => action.should.be.a.String &&
      params.should.be.an.Object &&
      params.guid.should.be.a.String &&
      (this.actions[action].match(action) !== null).should.be.ok
    );
    // Run all handlers concurrently and return the list of the results
    // (empty list if no handlers).
    // If an action handler throws, then dispatch will throw, but the others handlers
    // can still succeed.
    return yield (this.actionHandlers[action] ? this.actionHandlers[action] : []) // jshint ignore:line
    .map((handler) => handler.call(null, params));
  }

  hasSession(guid) {
    return !!this.sessions[guid];
  }

  getSession(guid) {
    _.dev(() => guid.should.be.a.String);
    if(!this.sessions[guid]) {
      this.sessions[guid] = this.sessionCreated(new Session({ guid, uplink: this, timeout: this.timeout })).cancellable();
    }
    return this.sessions[guid];
  }

  deleteSession(session) {
    _.dev(() => session.should.be.an.instanceOf(Session) &&
      (this.sessions[session.guid] !== void 0).should.be.ok
    );
    this.sessions[session.guid].cancel(new Error('Session deleted.'));
    delete this.sessions[session.guid];
    session.destroy();
    return this.sessionDeleted(session);
  }

  // No-op placeholder, to be overridden by subclasses to initialize
  // session-related resources.
  // Implementation should return a Promise for the created session.
  sessionCreated(session) {
    return Promise.resolve(session);
  }

  // No-op placeholder, to be overridden by subclasses to clean-up
  // session-related resources.
  // Implementation should return a Promise for the deleted session.
  sessionDeleted(session) {
    return Promise.resolve(session);
  }
}

_.extend(UplinkSimpleServer.prototype, {
  events: null,
  stores: null,
  rooms: null,
  actions: null,
  app: null,
  timeout: null,
  server: null,

  jsonCache: null,
  _data: null,

  connections: null,
  sessions: null,

  subscribers: null,
  listeners: null,
  actionHandlers: null,
});

Connection = require('./Connection')({ UplinkSimpleServer });
Session = require('./Session')({ Connection, UplinkSimpleServer });

module.exports = UplinkSimpleServer;
