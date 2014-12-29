const _ = require('lodash-next');
const HTTPExceptions = require('http-exceptions');
const { MESSAGE_TYPES, Message, Remutable } = require('nexus-uplink-common');
const sha256 = require('sha256');

const DEFAULT_HANDSHAKE_TIMEOUT = 5000;
const DEFAULT_SESSION_TIMEOUT = 5000;

const RESERVED_ACTIONS = {
  SESSION_CREATE: '/session/create',
  SESSION_TIMEOUT: '/session/timeout',
  SESSION_DESTROY: '/session/destroy',
};

const INT_MAX = 9007199254740992;
const ALLOW_RESERVED_ACTION = _.random(1, INT_MAX - 1);

// Alias for class Engine, to shut-up jshint
let _Engine;

class BoundRemutable {
  constructor(path, remutable, engine) {
    _.dev(() => {
      path.should.be.a.String;
      remutable.should.be.an.instanceOf(Remutable);
      engine.should.be.an.instanceOf(_Engine);
    });
    _.extend(this, {
      _path: path,
      _remutable: remutable,
      _engine: engine,
    });
  }

  get working() {
    return this._remutable.working;
  }

  get head() {
    return this._remutable.head;
  }

  set() {
    return this._remutable.set.apply(this._remutable, arguments);
  }

  delete() {
    return this._remutable.delete.apply(this._remutable, arguments);
  }

  rollback() {
    return this._remutable.rollback.apply(this._remutable, arguments);
  }

  commit() {
    return this._engine.commit(this._path);
  }
}

_.extend(BoundRemutable.prototype, {
  _path: null,
  _remutable: null,
  _engine: null,
});

class Engine {
  constructor(options) {
    options = options || {};
    _.dev(() => options.should.be.an.Object);
    this._pid = options.pid || _.guid();
    _.dev(() => this._pid.should.be.a.String);
    this._handshakeTimeout = options._handshakeTimeout || DEFAULT_HANDSHAKE_TIMEOUT;
    _.dev(() => this._handshakeTimeout.should.be.a.Number);
    this._sessionTimeout = options._sessionTimeout || DEFAULT_SESSION_TIMEOUT;
    _.dev(() => this._sessionTimeout.should.be.a.Number);
    this._stores = {}; // path -> remutable
    this._subscribers = {}; // path -> secretId -> session
    this._connections = {}; // socketId -> connection
    this._sessions = {}; // secretId -> session
    this._actionHandlers = {}; // action -> actionHandlerId -> Function
  }

  addActionHandler(action, fn) {
    _.dev(() => {
      action.should.be.a.String;
      fn.should.be.a.Function;
    });
    if(this._actionHandlers[action] === void 0) {
      this._actionHandlers[action] = {};
    }
    const id = _.uniqueId('a');
    this._actionHandlers[action][id] = fn;
    return { action, id };
  }

  removeActionHandler({ action, id }) {
    _.dev(() => {
      action.should.be.a.String;
      id.should.be.a.String;
      (this._actionHandlers[action] !== void 0).should.be.ok;
      (this._actionHandlers[action][id] !== void 0).should.be.ok;
    });
    delete this._actionHandlers[action][id];
    if(_.size(this._actionHandlers[action]) === 0) {
      delete this._actionHandlers[action];
    }
  }

  get(path) {
    if(this._stores[path] === void 0) {
      this._stores[path] = new Remutable();
    }
    return new BoundRemutable(path, this._stores[path], this);
  }

  delete(path) {
    _.dev(() => (this._stores[path] !== void 0).should.be.ok);
    if(this._subscribers[path] !== void 0) {
      const message = Message.Delete({ path });
      _.each(this._subscribers[path], (session) => session.queue(message));
      delete this._subscribers[path];
    }
  }

  commit(path) {
    _.dev(() => (this._stores[path] !== void 0).should.be.ok);
    if(!this._stores[path].dirty) {
      return;
    }
    const patch = this._stores[path].commit();
    if(this._subscribers[path] !== void 0) {
      const message = Message.Update({ path, patch });
      _.each(this._subscribers[path], (session) => session.queue(message));
    }
  }

  commitAll() {
    return () => Object.keys(this._stores).forEach((path) => this.commit(path));
  }

  commitEvery(period) {
    _.dev(() => period.should.be.a.Number);
    return setInterval(this.comitAll(), period);
  }

  session(clientSecret) {
    _.dev(() => clientSecret.should.be.a.String);
    if(this._sessions[clientSecret] === void 0) {
      this._sessions[clientSecret] = {
        clientSecret,
        // invariant: _.size(connections) > 0 XOR (sessionTimeout === null && queue === null)
        connections: {},
        sessionTimeout: null,
        queue: null,
      };
      this.handleSessionCreate(clientSecret);
      this._pause(clientSecret);
    }
    return this._sessions[clientSecret];
  }

  dispatch(clientSecret, action, params, _allowReservedAction = false) {
    if(_.contains(RESERVED_ACTIONS, action)) {
      _allowReservedAction.should.be.exactly(ALLOW_RESERVED_ACTION);
    }
    if(!this._actionHandlers[action]) {
      return 0;
    }
    if(!_allowReservedAction) {
      // Ensure session exists
      this.session(clientSecret);
      // Reset the timer in case the session was about to expire
      this.resetTimeout(clientSecret);
    }
    _.each(this._actionHandlers[action], (fn) => fn(Engine.clientID(clientSecret), params));
    return this._actionHandlers[action].length;
  }

  handleGET(req, res) {
    Promise.try(() => {
      const { path } = req;
      if(this._stores[path] === void 0) {
        throw new HTTPExceptions.NotFound(path);
      }
      return this._stores[path].toJSON();
    })
    .then((json) => {
      _.dev(() => console.log(`nexus-uplink-server << GET ${req.path} >> ${json}`));
      res.status(200).json(json);
    })
    .catch((err) => {
      _.dev(() => console.log(`nexus-uplink-server << GET ${req.path} >> ${err.stack}`));
      if(err instanceof HTTPExceptions.HTTPError) {
        return HTTPExceptions.forward(err, res);
      }
      const json = { err: err.toString(), stack: __DEV__ ? err.stack : null };
      res.status(500).json(json);
    });
  }

  handlePOST(req, res) { // req should have its body parsed, eg. using bodyParser.json()
    Promise.try(() => {
      const { path, body } = req;
      const { clientSecret, params } = body;
      if(this._actionHandlers[path] === void 0) {
        throw new HTTPExceptions.NotFound(path);
      }
      return this.dispatch(clientSecret, path, params);
    })
    .then((n) => {
      _.dev(() => console.log(`nexus-uplink-server << POST ${req.path} >> ${n}`));
      res.status(200).json({ n });
    })
    .catch((err) => {
      _.dev(() => console.log(`nexus-uplink-server << POST ${req.path} >> ${err.stack}`));
      if(err instanceof HTTPExceptions.HTTPError) {
        return HTTPExceptions.forward(err, res);
      }
      const json = { err: err.toString(), stack: __DEV__ ? err.stack : null };
      res.status(500).json(json);
    });
  }

  handleConnection(socket) {
    const socketId = socket.id;
    this._connections[socketId] = {
      socket,
      // invariant: handshakeTimeout === null XOR clientSecret === null
      handshakeTimeout: setTimeout(() => this.handleHandshakeTimeout(socketId), this._handshakeTimeout),
      clientSecret: null,
    };
    socket.on('close', () => this.handleDisconnection(socketId));
    socket.on('error', (err) => this.handleError(socketId, err));
    socket.on('message', (json) => this.handleMessage(socketId, json));
  }

  handleDisconnection(socketId) {
    _.dev(() => {
      socketId.should.be.a.String;
      (this._connections[socketId] !== void 0);
    });
    const { clientSecret, handshakeTimeout } = this._connections[socketId];
    if(clientSecret !== null) {
      _.dev(() => (handshakeTimeout === null).should.be.ok);
      _.dev(() => (this._sessions[clientSecret] !== void 0).should.be.ok);
      delete this._sessions[clientSecret].connections[socketId];
      if(_.size(this._sessions[clientSecret].connections) === 0) {
        this._pause(clientSecret);
      }
    }
    else {
      _.dev(() => (handshakeTimeout !== null).should.be.ok);
      clearTimeout(handshakeTimeout);
      this._connections[socketId].handshakeTimeout = null;
    }
    delete this._connections[socketId];
  }

  handleError(socketId, err) {
    _.dev(() => console.warn(`Socket ${socketId} error:`, err));
  }

  handleMessage(socketId, json) {
    // Wrap in a Promise.try to avoid polluting the main execution stack
    // and catch any async error correctly
    Promise.try(() => {
      const message = Message.fromJSON(json);
      const interpretation = message.interpret();
      if(message.type === MESSAGE_TYPES.HANDSHAKE) {
        return this.handleHandshake(socketId, interpretation);
      }
      else if(message.type === MESSAGE_TYPES.SUBSCRIBE) {
        return this.handleSubscribe(socketId, interpretation);
      }
      else if(message.type === MESSAGE_TYPES.UNSUBSCRIBE) {
        return this.handleUnsubscribe(socketId, interpretation);
      }
      else if(message.type === MESSAGE_TYPES.DISPATCH) {
        return this.handleDispatch(socketId, interpretation);
      }
      else {
        throw new Error(`Unknown message type: ${message.type}`);
      }
    })
    .catch((err) => {
      this.send(socketId, Message.Error({ err }));
    });
  }

  handleHandshake(socketId, { clientSecret }) {
    (this._connections[socketId].clientSecret === null).should.be.ok;
    _.dev(() => (this._connections[socketId].handshakeTimeout !== null).should.be.ok);
    clearTimeout(this._connections[socketId].handshakeTimeout);
    this._connections[socketId].handshakeTimeout = null;
    this._connections[socketId].clientSecret = clientSecret;
    const session = this.session(clientSecret);
    session.connections[socketId] = socketId;
    if(_.size(session.connections) === 1) {
      this._resume(clientSecret);
    }
  }

  handleSubscribe(socketId, { path }) {
    (this._connections[socketId].clientSecret !== null).should.be.ok;
    (this._stores[path] !== void 0).should.be.ok;
    const { clientSecret } = this._connections[socketId];
    if(this._subscribers[path] === void 0) {
      this._subscribers[path] = {};
    }
    this._subscribers[path][clientSecret] = clientSecret;
  }

  handleUnsubscribe(socketId, { path }) {
    (this._connections[socketId].clientSecret !== null).should.be.ok;
    (this._stores[path] !== void 0).should.be.ok;
    const { clientSecret } = this._connections[socketId];
    if(this._subscribers[path] === void 0) {
      return;
    }
    if(this._subscribers[path][clientSecret] !== void 0) {
      delete this._subscribers[path][clientSecret];
    }
    if(_.size(this._subscribers[path]) === 0) {
      delete this._subscribers[path];
    }
  }

  handleDispatch(socketId, { action, params }) {
    (this._connections[socketId].clientSecret !== null).should.be.ok;
    const { clientSecret } = this._connections[socketId];
    this.dispatch(clientSecret, action, params);
  }

  handleSessionCreate(clientSecret) {
    this.dispatch(clientSecret, RESERVED_ACTIONS.SESSION_CREATE, {}, ALLOW_RESERVED_ACTION);
  }

  handleSessionTimeout(clientSecret) {
    this.dispatch(clientSecret, RESERVED_ACTIONS.SESSION_TIMEOUT, {}, ALLOW_RESERVED_ACTION);
    const err = new Error(`Session timeout`);
    this.kill(clientSecret, { message: err.message, stack: __DEV__ ? err.stack : null });
  }

  handleSessionDestroy(clientSecret) {
    this.dispatch(clientSecret, RESERVED_ACTIONS.SESSION_DESTROY, {}, ALLOW_RESERVED_ACTION);
  }

  handleHandshakeTimeout(socketId) {
    const err = new Error(`Handshake timeout`);
    const message = Message.Error({ message: err.message, stack: __DEV__ ? err.stack : null });
    this.send(socketId, message);
    this.close(socketId);
  }

  close(socketId) {
    _.dev(() => {
      socketId.should.be.a.String;
      (this._connections[socketId] !== void 0).should.be.ok;
    });
    // Resource freeing is done in handleDisconnection()
    this._connections[socketId].socket.close();
  }

  send(socketId, message) {
    _.dev(() => {
      socketId.should.be.a.String;
      (this._connections[socketId] !== void 0).should.be.ok;
      message.should.be.an.instanceOf(Message);
    });
    this._connections[socketId].socket.send(message.toJSON());
  }

  queue(clientSecret, message) {
    _.dev(() => {
      clientSecret.should.be.a.String;
      (this._sessions[clientSecret] !== void 0).should.be.ok;
      message.should.be.an.instanceOf(Message);
    });
    if(this._sessions[clientSecret].queue === null) {
      Object.keys(this._sessions[clientSecret].connections)
      .forEach((socketId) => this.send(socketId, message));
    }
    else {
      this._sessions[clientSecret].queue.push(message);
    }
  }

  kill(clientSecret, err) {
    _.dev(() => {
      clientSecret.should.be.a.String;
      err.should.be.an.Object;
    });
    if(!this._sessions[clientSecret]) {
      return;
    }
    // Send an error message to all connected clients and close them
    if(_.size(this._sessions[clientSecret].connections) > 0) {
      const message = Message.Error({ err });
      _.each(this._sessions[clientSecret].connections, (socketId) => {
        this.send(socketId, message);
        this.close(socketId);
      });
      this._sessions[clientSecret].connections = null;
    }
    // Remove the session timeout
    if(this._sessions[clientSecret].sessionTimeout !== null) {
      clearTimeout(this._sessions[clientSecret].sessionTimeout);
      this._sessions[clientSecret].sessionTimeout = null;
    }
    // Dereference the message queue, for clarity
    if(this._sessions[clientSecret].queue !== null) {
      this._sessions[clientSecret].queue = null;
    }
    // Dereference the clientSecret, for clarity
    this._sessions[clientSecret].clientSecret = null;
    delete this._sessions[clientSecret];
    this.handleSessionDestroy(clientSecret);
  }

  // If the session is about to expire, reset its expiration timer.
  resetTimeout(clientSecret) {
    _.dev(() => (this._sessions[clientSecret] !== void 0).should.be.ok);
    if(this._sessions[clientSecret].sessionTimeout !== null) {
      clearTimeout(this._sessions[clientSecret].sessionTimeout);
      this._sessions[clientSecret]
      .sessionTimeout = setTimeout(() => this.handleSessionTimeout(clientSecret), this._sessionTimeout);
    }
  }

  static clientID(clientSecret) {
    _.dev(() => clientSecret.should.be.a.String);
    return sha256(clientSecret);
  }

  _pause(clientSecret) {
    _.dev(() => {
      clientSecret.should.be.a.String;
      (this._sessions[clientSecret] !== void 0).should.be.ok;
      (this._sessions[clientSecret].sessionTimeout === null).should.be.ok;
      (this._sessions[clientSecret].queue === null).should.be.ok;
      _.size(this._sessions[clientSecret].connections).should.be.exactly(0);
    });
    this._sessions[clientSecret]
    .sessionTimeout = setTimeout(() => this.handleSessionTimeout(clientSecret), this._sessionTimeout);
    this._sessions[clientSecret].queue = [];
  }

  _resume(clientSecret) {
    _.dev(() => {
      clientSecret.should.be.a.String;
      (this._sessions[clientSecret] !== void 0).should.be.ok;
      (this._sessions[clientSecret].sessionTimeout !== null).should.be.ok;
      (this._sessions[clientSecret].queue !== null).should.be.ok;
      _.size(this._sessions[clientSecret].connections).should.be.above(0);
    });
    clearTimeout(this._sessions[clientSecret].sessionTimeout);
    while(this._sessions[clientSecret].queue.length > 0) {
      this.queue(clientSecret, this._sessions[clientSecret].queue.shift());
    }
    this._sessionTimeout[clientSecret].queue = null;
  }
}

_Engine = Engine;

module.exports = { Engine };
