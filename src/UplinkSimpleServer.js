const _ = require('lodash-next');
const bodyParser = require('body-parser');
const ConstantRouter = require('nexus-router').ConstantRouter;
const HTTPExceptions = require('http-exceptions');
const http = require('http');

const instanceOfSocketIO = require('./instanceOfSocketIO');
let Connection, Session;

const ioHandlers = {
  connection(socket) {
    _.dev(() => instanceOfSocketIO(socket).should.be.ok &&
      this.connections.should.not.have.property(socket.id)
    );
    this.connections[socket.id] = new Connection({ socket, uplink: this });
    socket.on('disconnect', () => ioHandlers.disconnection.call(this, socket));
  },

  disconnection(socket) {
    _.dev(() => socket.should.be.an.Object &&
      socket.on.should.be.a.Function &&
      socket.emit.should.be.a.Function &&
      socket.id.should.be.a.String &&
      this.connections.should.have.property(socket.id, socket)
    );
    this.connections[socket.id].destroy();
    delete this.connections[socket.id];
  },
};

// Most public methods expose an async API
// to enforce consistence with async data backends,
// eg. redis or mysql, although in this implementation
// the backend resides in memory (a simple Object acting
// as an associative map).
class UplinkSimpleServer {
  // stores, rooms, and actions are three whitelists of
  // string patterns. Each is an array that will be passed
  // to the Router constructor.
  constructor({ pid, stores, rooms, actions, app }) {
    _.dev(() => (pid !== undefined).should.be.ok &&
      stores.should.be.an.Array &&
      rooms.should.be.an.Array &&
      actions.should.be.an.Array &&
      // Ducktype-check for an express-like app
      app.get.should.be.a.Function &&
      app.post.should.be.a.Function
    );
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
  }

  listen(port, fn = _.noop) {
    _.dev(() => port.should.be.a.Number);
    let { app, server } = this;
    // socket.io handlers are installed first, to pre-empt some paths over the http handlers.
    let io = require('socket.io')(server);
    // Delegate to static ioHandler methods, but call them with context.
    Object.keys(ioHandlers)
    .forEach((event) => io.on(event, _.scope(ioHandlers[event], this)));

    // Fetch from store
    app.get('*',
      // Check that this store path is whitelisted
      (req, res, next) => this.stores.match(req.path) === null ? HTTPExceptions.forward(res, new HTTPExceptions.NotFound(req.path)) : next(),
      (req, res) => this.pull(req.path)
        .then((value) => {
          _.dev(() => (value === null || _.isObject(value)).should.be.ok);
          _.dev(() => console.warn(`GET ${req.path}`, value));
          res.status(200).type('application/json').send(value);
        })
        .catch((e) => {
          _.dev(() => console.warn(`GET ${req.path}`, e));
          if(e instanceof HTTPExceptions.HTTPError) {
            HTTPExceptions.forward(res, e);
          }
          else {
            res.status(500).json({ err: e.toString() });
          }
        })
    );

    // Dispatch action
    app.post('*',
      // Parse body as JSON
      bodyParser.json(),
      // Check that this action path is whitelisted
      (req, res, next) => this.actions.match(req.path) === null ? HTTPExceptions.forward(res, new HTTPExceptions.NotFound(req.path)) : next(),
      // params should be present
      (req, res, next) => !_.isObject(req.body.params) ? HTTPExceptions.forward(res, new HTTPExceptions.BadRequest('Missing required field: \'param\'')) : next(),
      // Check for a valid, active session guid in params
      (req, res, next) => !req.body.params.guid ? HTTPExceptions.forward(res, new HTTPExceptions.Unauthorized('Missing required field: \'params\'.\'guid\'')) : next(),
      (req, res, next) => !this.isActiveSession(req.body.params.guid) ? HTTPExceptions.forward(res, HTTPExceptions.Unauthorized('Invalid \'guid\'.')) : next(),
      (req, res) => this.dispatch(req.path, req.body.params)
      .then((result) => {
        _.dev(() => console.warn(`POST ${req.path}`, req.body, result));
        res.status(200).json(result);
      })
      .catch((e) => {
          _.dev(() => console.warn(`POST ${req.path}`, req.body, e));
          if(e instanceof HTTPExceptions.HTTPError) {
            HTTPExceptions.forward(res, e);
          }
          else {
            res.status(500).json({ err: e.toString() });
          }
      })
    );
    server.listen(port, fn);
    return this;
  }

  pull(path) {
    return Promise.try(() => {
      _.dev(() => path.should.be.a.String &&
        (this.stores.match(path) !== null).should.be.ok
      );
      return this._data[path];
    });
  }

  *update(path, value) { // jshint ignore:line
    _.dev(() => path.should.be.a.String &&
      value.should.be.an.Object &&
      (this.stores.match(path) !== null).should.be.ok
    );
    let hash, diff;
    if(this.subscribers[path]) {
      // Diff and JSON-encode as early as possible to avoid duplicating
      // these lengthy calculations down the propagation tree.
      // If no value was present before, then nullify the hash. No value has a null hash.
      if(!this._data[path]) {
        hash = null;
      }
      else {
        hash = _.hash(this._data[path]);
        diff = _.diff(this._data[path], value);
      }
      // Directly pass the patch, sessions don't need to be aware
      // of the actual contents; they only need to forward the diff
      // to their associated clients.
      yield Object.keys(this.subscribers[path]) // jshint ignore:line
      .map((session) => session.update(path, { hash, diff }));
    }
  }

  subscribeTo(path, session) {
    _.dev(() => path.should.be.a.String &&
      session.should.be.an.instanceOf(Session)
    );
    let createdPath;
    if(this.subscribers[path]) {
      // Fail early to avoid creating leaky entry in this.subscribers
      _.dev(() => this.subscribers[path].should.not.have.property(session.id));
      createdPath = false;
    }
    else {
      this.subscribers[path] = {};
      createdPath = true;
    }
    this.subscribers[path][session.id] = session;
    // Return a flag indicating whether this is the first subscription
    // to this path; can be useful to implement subclass-specific handling
    // (eg. subscribe to an external backend)
    return { createdPath };
  }

  unsubscribeFrom(path, session) {
    _.dev(() => path.should.be.a.String &&
      session.should.be.an.instanceOf(Session) &&
      this.subscribers.should.have.property(path) &&
      this.subscribers[path].should.be.an.Object &&
      this.subscribers[path].should.have.property(session.id, session)
    );
    let deletedPath = false;
    delete this.subscribers[path][session.id];
    if(Object.keys(this.subscribers[path]).length === 0) {
      delete this.subscribers[path];
      deletedPath = true;
    }
    // Return a flag indicating whether this was the last subscription
    // to this path; can be useful to implement subclass-specific handling
    // (eg. unsbuscribe from an external backend)
    return { deletedPath };
  }

  *emit(room, params) { // jshint ignore:line
    _.dev(() => room.should.be.a.String &&
      params.should.be.an.Object &&
      (this.rooms.match(room) !== null).should.be.ok
    );
    let json;
    if(this.listeners[room]) {
      // Encode as early as possible to avoid duplicating
      // this operation down the propagation tree.
      json = _.prollystringify(params);
      yield Object.keys(this.listeners[room]) // jshint ignore:line
      .map((session) => session.emit(room, json));
    }
  }

  listenTo(room, session) {
    _.dev(() => room.should.be.a.String &&
      session.should.be.an.instanceOf(Session)
    );
    let createdRoom;
    if(this.listeners[room]) {
      // Fail early to avoid creating a leaky entry in this.listeners
      _.dev(() => this.listeners[room].should.not.have.property(session.id));
      createdRoom = false;
    }
    else {
      this.listeners[room] = {};
      createdRoom = true;
    }
    this.listeners[room][session.id] = session;
    // Return a flag indicating whether this is the first listener
    // to this room; can be useful to implement subclass-specific handling
    // (e.g. subscribe to an external backend)
    return { createdRoom };
  }

  unlistenTo(room, session) {
    _.dev(() => room.should.be.a.String &&
      session.should.be.an.instanceOf(Session) &&
      this.listeners[room].should.have.property(session.id, session)
    );
    let deletedRoom = false;
    delete this.listeners[room][session.id];
    if(Object.keys(this.listeners[room]).length === 0) {
      delete this.listeners[room];
      deletedRoom = true;
    }
    // Return a flag indicating whether this was the last listener
    // to this room; can be useful to implement subclass-specific handling
    // (e.g. unsuscribe from an external backend)
    return { deletedRoom };
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
      this.sessions[guid] = this.sessionCreated(new Session({ guid, uplink: this }));
    }
    return this.sessions[guid];
  }

  deleteSession(guid) {
    _.dev(() => guid.should.be.a.String);
    let session = this.sessions[guid];
    session.destroy();
    delete this.sessions[guid];
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
  actionHandlers: null,
});

Connection = require('./Connection')({ UplinkSimpleServer });
Session = require('./Session')({ Connection, UplinkSimpleServer });

module.exports = UplinkSimpleServer;
