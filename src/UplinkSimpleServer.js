const _ = require('lodash-next');
const bodyParser = require('body-parser');
const ConstantRouter = require('nexus-router').ConstantRouter;
const HTTPExceptions = require('http-exceptions');

const Connection = require('./Connection');
const Session = require('./Session');

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
    let io = require('socket.io')(app);
    Object.keys(ioHandlers)
    .forEach((event) => io.on(event, () => ioHandlers[event].apply(this, arguments)));

    app.get((req, res, next) => httpHandlers.get.call(this, req, res, next));
    app.post((req, res, next) => httpHandlers.post.call(this, req, res, next));
    return this;
  }

  pull(path) {
    return Promise.try(() => {
      if(this.stores.match(path) === null) {
        throw new HTTPExceptions.NotFound(path);
      }
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
    // for a given action.
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
        (this.actions[action].match(action) !== null).should.be.ok
      );
      // Run all handlers concurrently and return the list of the results
      // (empty list if no handlers).
      return yield (this.actionHandlers[action] ? this.actionHandlers[action] : [])
      .map((handler) => handler.call(null, params));
    }, this);
  }
}

_.extend(UplinkSimpleServer.prototype, {
  stores: null,
  rooms: null,
  actions: null,
  _data: null,
  subscribers: null,
  listeners: null,
  actionHandlers: null,
});

module.exports = UplinkSimpleServer;
