const _ = require('lodash-next');
const should = _.should;
const bodyParser = require('body-parser');
const ConstantRouter = require('nexus-router').ConstantRouter;
const HTTPExceptions = require('http-exceptions');

const Connection = require('./Connection')({ UplinkSimpleServer });
const Session = require('./Session')({ Connection, UplinkSimpleServer });
const instanceOfSocketIO = require('./instanceOfSocketIO');

const ioHandlers = {
  connection(socket) {
    _.dev(() => instanceOfSocketIO(socket).should.be.ok &&
      this.connections[socket.id].should.not.be.ok
    );
    this.connections[socket.id] = new Connection({ socket, uplink: this });
    socket.on('disconnect', () => ioHandlers.disconnection.call(this, socket));
  },

  disconnection(socket) {
    _.dev(() => socket.should.be.an.Object &&
      socket.on.should.be.a.Function &&
      socket.emit.should.be.a.Function &&
      socket.id.should.be.a.String &&
      this.connections[socket.id].should.be.exactly(socket)
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
  constructor({ pid, stores, rooms, actions }) {
    _.dev(() => stores.should.be.an.Array &&
      rooms.should.be.an.Array &&
      actions.should.be.an.Array
    );
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
  }

  attach(app) {
    _.dev(() => app.should.be.an.Object &&
      // Ducktype-check for an express-like app
      app.get.should.be.a.Function &&
      app.post.should.be.a.Function
    );
    // socket.io handlers are installed first, to pre-empt some paths over the http handlers.
    let io = require('socket.io')(app);
    // Delegate to static ioHandler methods, but call them with context.
    Object.keys(ioHandlers)
    .forEach((event) => io.on(event, () => ioHandlers[event].apply(this, arguments)));

    // Fetch from store
    app.get('*',
      // Check that this store path is whitelisted
      (req, res, next) => this.stores.match(req.path) === null ? HTTPExceptions.forward(res, new HTTPExceptions.NotFound(req.path)) : next(),
      (req, res) => this.pull(req.path)
        .then((value) => {
          _.dev(() => (value === null || _.isObject(value)).should.be.ok);
          res.status(200).type('application/json').send(value);
        })
        .catch((err) => {
          _.dev(() => { console.error(err, err.stack); });
          if(err instanceof HTTPExceptions.HTTPError) {
            HTTPExceptions.forward(res, err);
          }
          else {
            res.status(500).json({ err: err.toString() });
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
      .then((result) => res.status(200).json(result))
      .catch((err) => {
          _.dev(() => { console.error(err, err.stack); });
          if(err instanceof HTTPExceptions.HTTPError) {
            HTTPExceptions.forward(res, err);
          }
          else {
            res.status(500).json({ err: err.toString() });
          }
      })
    );
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

  update(path, value) {
    return _.copromise(function*() {
      _.dev(() => path.should.be.a.String &&
        value.should.be.an.Object &&
        (this.stores.match(path) !== null).should.be.ok
      );
      if(this.subscribers[path]) {
        // Diff and JSON-encode as early as possible to avoid duplicating
        // these lengthy calculations down the propagation tree.
        let hash, diff;
        // If no value was present before, then nullify the hash. No value has a null hash.
        if(!this._data[path]) {
          hash = null;
        }
        else {
          hash = _.hash(this._data[path]);
          diff = _.diff(this._data[path], value);
        }
        yield Object.keys(this.subscribers[path])
        // Directly pass the patch, sessions don't need to be aware
        // of the actual contents; they only need to forward the diff
        // to their associated clients.
        .map((session) => session.update(path, { hash, diff }));
      }
    }, this);
  }

  subscribeTo(path, session) {
    _.dev(() => path.should.be.a.String &&
      session.should.be.an.instanceOf(Session)
    );
    let createdPath;
    if(this.subscribers[path]) {
      // Fail early to avoid creating leaky entry in this.subscribers
      _.dev(() => this.subscribers[path][session.id].should.not.be.ok);
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
      this.subscribers[path].should.be.an.Object &&
      this.subscribers[path][session.id].should.be.exactly(session)
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

  emit(room, params) {
    return _.copromise(function*() {
      _.dev(() => room.should.be.a.String &&
        params.should.be.an.Object &&
        (this.rooms.match(room) !== null).should.be.ok
      );
      if(this.listeners[path]) {
        // Encode as early as possible to avoid duplicating
        // this operation down the propagation tree.
        let json = JSON.stringify(params);
        yield Object.keys(this.listeners[path])
        .map((session) => session.emit(room, json));
      }
    }, this);
  }

  listenTo(room, session) {
    _.dev(() => room.should.be.a.String &&
      session.should.be.an.instanceOf(Session)
    );
    let createdRoom;
    if(this.listeners[path]) {
      // Fail early to avoid creating a leaky entry in this.listeners
      _.dev(() => this.listeners[path][session.id].should.not.be.ok);
      createdRoom = false;
    }
    else {
      this.listeners[path] = {};
      createdRoom = true;
    }
    this.listeners[path][session.id] = session;
    // Return a flag indicating whether this is the first listener
    // to this room; can be useful to implement subclass-specific handling
    // (e.g. subscribe to an external backend)
    return { createdRoom };
  }

  unlistenTo(room, session) {
    _.dev(() => room.should.be.a.String &&
      session.should.be.an.instanceOf(Session) &&
      this.listeners[room][session.id].should.be.exactly(session)
    );
    let deletedRoom = false;
    delete this.listeners[room][session.id];
    if(Object.keys(this.listeners[room]).length === 0) {
      delete this.listeners[path];
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
    if(!this.actions[path]) {
      this.actions[path] = [];
      createdAction = true;
    }
    this.actions[path].push(handler);
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
    this.actions[path] = _.without(this.actions[path], handler);
    let deletedAction = false;
    if(this.actions[path].length === 0) {
      delete this.actions[path];
      deletedAction = true;
    }
    return { deletedAction };
  }

  dispatch(action, params = {}) {
    return _.copromise(function*() {
      _.dev(() => action.should.be.a.String &&
        params.should.be.an.Object &&
        params.guid.should.be.a.String &&
        (this.actions[action].match(action) !== null).should.be.ok
      );
      // Run all handlers concurrently and return the list of the results
      // (empty list if no handlers).
      // If an action handler throws, then dispatch will throw, but the others handlers
      // can still succeed.
      return yield (this.actionHandlers[action] ? this.actionHandlers[action] : [])
      .map((handler) => handler.call(null, params));
    }, this);
  }

  hasSession(guid) {
    return !!this.sessions[guid];
  }

  getSession(guid) {
    _.dev(() => guid.should.be.a.String);
    if(!this.sessions[guid]) {
      this.sessions[guid] = new Session({ guid, uplink: this });
    }
    return this.sessions[guid];
  }

  expireSession(guid) {
    _.dev(() => guid.should.be.a.String);
    this.sessions[guid].destroy();
    delete this.sessions[guid];
  }
}

_.extend(UplinkSimpleServer.prototype, {
  stores: null,
  rooms: null,
  actions: null,

  _data: null,

  connections: null,
  sessions: null,

  subscribers: null,
  listeners: null,
  actionHandlers: null,
});

module.exports = UplinkSimpleServer;