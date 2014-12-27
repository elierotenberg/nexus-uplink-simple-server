const _ = require('lodash-next');
const bodyParser = require('body-parser');
const ConstantRouter = require('nexus-router').ConstantRouter;
const EngineIO = require('engine.io');
const EventEmitter = require('events').EventEmitter;
const http = require('http');
const HTTPExceptions = require('http-exceptions');
const { PROTOCOL_VERSION, MESSAGE_TYPES, Message, Remutable } = require('nexus-uplink-common');

const instanceOfEngineIOSocket = require('./instanceOfEngineIOSocket');
const Connection = require('./Connection');
const Session = require('./Session')({ Connection });

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
  constructor({ pid, stores, rooms, actions, app, handshakeTimeout, activityTimeout }) {
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
      handshakeTimeout.should.be.a.Number.and.not.be.below(0) &&
      activityTimeout.should.be.a.Number.and.not.be.below(0)
    );

    _.extend(this, {
      events: new EventEmitter(),
      actions: new EventEmitter(),
      _pid: pid,
      _stores: createConstantRouter(stores),
      _rooms: createConstantRouter(rooms),
      _actions: createConstantRouter(actions),
      _storesCache: {},
      _handshakeTimeout: handshakeTimeout,
      _activityTimeout: activityTimeout,
      _app: app,
      _server: http.Server(app),
      _io: EngineIO.Server(),
      _connections: {},
      _sessions: {},
      _subscribers: {},
      _listeners: {},
    });
  }

  // Public methods

  listen(port, fn = _.noop) {
    _.dev(() => port.should.be.a.Number);

    this._bindIOHandlers();
    this._bindHTTPHandlers();

    // Attach the EngineIO handlers first
    this._server.listen(port, fn);
    return this;
  }

  init(path) {
    _.dev(() => path.should.be.a.string &&
      (this._stores.match(path) !== null).should.be.ok &&
      (this._storesCache[path] === void 0).should.be.ok
    );
    const r = this._storesCache[path] = new Remutable();
    return r;
  }

  select(path) {
    _.dev(() => path.should.be.a.String &&
      (this._stores.match(path) !== null).should.be.ok
    );
    return this._storesCache[path];
  }

  commit(path) {
    _.dev(() => path.should.be.a.String &&
      (this._stores.match(path) !== null).should.be.ok &&
      (this._storesCache[path] !== void 0).should.be.ok
    );
    if(!this._storesCache[path].dirty) {
      return;
    }
    return { path, patch: this._storesCache[path].commit() };
  }

  update({ path, patch }) {
    _.dev(() => path.should.be.a.String &&
      patch.should.be.an.instanceOf(Remutable.Patch)
    );
    if(this._subscribers[path] === void 0) {
      return 0;
    }
    const subscribersCount = Object.keys(this._subscribers[path]).length;
    const message = new Message(Message.TYPES.UPDATE, { path, patch: patch.serialize() });
    Object.keys(this._subscribers[path])
    .forEach((k) => this._subscribers[path][k].queue(message));
    return subscribersCount;
  }

  emit({ room, params }) {
    _.dev(() => room.should.be.a.String &&
      (params === null || _.isObject(params)).should.be.ok &&
      (this._rooms.match(room) !== null).should.be.ok
    );
    if(this._listeners[room] === void 0) {
      return 0;
    }
    const listenersCount = Object.keys(this._listeners[room]).length;
    const message = new Message(Message.TYPES.EMIT, { room, params });
    Object.keys(this._listeners[room])
    .forEach((k) => this._listeners[room][k].queue(message));
    return listenersCount;
  }

  dispatch({ action, params }) {
    params = params === void 0 ? {} : params;
    _.dev(() => action.should.be.a.String &&
      (params === null || _.isObject(params)).should.be.ok &&
      (this._actions.match(action) !== null).should.be.ok
    );
    const handlersCount = this.actions.listeners(action).length;
    this.actions.emit(action, params);
    return handlersCount;
  }

  isActiveSession(guid) {
    return this._sessions[guid] !== void 0;
  }

  // Private methods

  _bindIOHandlers() {
    this._io.attach(this._server);
    this._io.on('connection', (socket) => this._handleConnection(socket));
  }

  _handleGET(req, res) {
    Promise.try(() => {
      _.dev(() => console.warn('nexus-uplink-simple-server', '<<', 'GET', req.path));
      if(this._stores.match(req.path) === null || this.select(path) === void 0) {
        throw new HTTPExceptions.NotFound(req.path);
      }
      const json = this.select(path).serialize();
      _.dev(() => json.should.be.a.String);
      res.status(200).type('application/json').send(json);
      _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'GET', req.path, json));
    })
    .catch((err) => {
      _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'GET', req.path, err.toString(), err.stack));
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
      const { path, body } = req;
      const [action, params] = [path, body];
      if(this._actions.match(action) === null) {
        throw new HTTPExceptions.NotFound(req.path);
      }
      if(params === void 0) {
        throw new HTTPExceptions.BadRequest(`Missing required field: 'params'.`);
      }
      if(!_.isObject(params)) {
        throw new HTTPExceptions.BadRequest(`Field 'params' should be an Object.`);
      }
      if(params.guid === void 0) {
        throw new HTTPExceptions.BadRequest(`Missing required field: 'params'.'guid'.`);
      }
      if(!this.isActiveSession(params.guid)) {
        throw new HTTPExceptions.Unauthorized(`Invalid guid: ${params.guid}`);
      }
      return this.dispatch({ action, params })
      .then((result) => {
        _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'POST', req.path, req.body, result));
        res.status(200).json(result);
      });
    })
    .catch((err) => {
      _.dev(() => console.warn('nexus-uplink-simple-server', '>>', 'POST', req.path, req.body, err.toString(), err.stack));
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
      pid: this._pid,
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
    _.dev(() => console.warn('nexus-uplink-simple-server', '<<', 'disconnection', socketId));
    _.dev(() => socketId.should.be.a.String &&
      (this._connections[socketId] !== void 0).should.be.ok &&
      this._connections[socketId].connection.id.should.be.exactly(socketId)
    );
    const { connection, handlers } = this._connections[socketId];
    if(connection.isConnected) {
      this._sessions[connection.guid].session.detachConnection(connection);
    }
    Object.keys(handlers).forEach((event) => connection.events.removeListener(event, handlers[event]));
    delete this._connections[socketId];
    connection.destroy();
  }

  _handleHandshake(socketId, { guid }) {
    _.dev(() => socketId.should.be.a.String &&
      guid.should.be.a.String &&
      (this._connections[socketId] !== void 0).should.be.ok
    );
    const { connection } = this._connections[socketId];
    _.dev(() => connection.guid.should.be.exactly(guid));
    if(this._sessions[guid] === void 0) {
      const session = new Session({ guid, activityTimeout: this._activityTimeout });
      const handlers = {
        expire: () => this._handleExpire(guid),
        pause: () => this._handlePause(guid),
        resume: () => this._handleResume(guid),
        subscribeTo: ({ path }) => this._handleSubscribeTo(guid, { path }),
        unsubscribeFrom: ({ path }) => this._handleUnsubscribeFrom(guid, { path }),
        listenTo: ({ room }) => this._handleListenTo(guid, { room }),
        unlistenFrom: ({ room }) => this._handleUnlistenFrom(guid, { room }),
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

  _handleSubscribeTo(guid, { path }) {
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
      this.events.emit('subscribeTo', [guid, { path }]);
    }
  }

  _handleUnsubscribeFrom(guid, { path }) {
    _.dev(() => guid.should.be.a.String &&
      path.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    if(this._subscribers[path] !== void 0) {
      if(this._subscribers[path][guid] !== void 0) {
        delete this._subscribers[path][guid];
        this.events.emit('unsubscribeFrom', [guid, { path }]);
      }
      if(Object.keys(this._subscribers[path]).length === 0) {
        delete this._subscribers[path];
      }
    }
  }

  _handleListenTo(guid, { room }) {
    _.dev(() => guid.should.be.a.String &&
      room.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    if(this._listeners[room] === void 0) {
      this._listeners[room] = {};
    }
    if(this._listeners[room][guid] === void 0) {
      const { session } = this._sessions[guid];
      this._listeners[room][guid] = session;
      this.events.emit('listenTo', [guid, { room }]);
    }
  }

  _handleUnlistenFrom(guid, { room }) {
    _.dev(() => guid.should.be.a.String &&
      room.should.be.a.String &&
      (this._sessions[guid] !== void 0).should.be.ok
    );
    if(this._listeners[room] !== void 0) {
      if(this._listeners[room][guid] !== void 0) {
        delete this._listeners[room][guid];
        this.events.emit('unlistenFrom', [guid, { room }]);
      }
      if(Object.keys(this._listeners[room]).length === 0) {
        delete this._listeners[room];
      }
    }
  }
}

_.extend(UplinkSimpleServer.prototype, {
  _pid: null,

  events: null,
  actions: null,

  _stores: null,
  _rooms: null,
  _actions: null,
  _storesCache: null,
  _handshakeTimeout: null,
  _activityTimeout: null,

  _app: null,
  _server: null,
  _io: null,

  _connections: null,
  _sessions: null,
  _subscribers: null,
  _listeners: null,
});

_.extend(UplinkSimpleServer, { Message });


module.exports = UplinkSimpleServer;
