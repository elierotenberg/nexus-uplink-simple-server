const _ = require('lodash-next');
const bodyParser = require('body-parser');
const EngineIO = require('engine.io');
const http = require('http');
const HTTPExceptions = require('http-exceptions');
const { PROTOCOL_VERSION, MESSAGE_TYPES, Message, Remutable } = require('nexus-uplink-common');

const DEFAULT_HANDSHAKE_TIMEOUT = 5000;
const DEFAULT_SESSION_TIMEOUT = 5000;

class Server {
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
    const remutable = this._stores[path];
    return {
      get: _.scope(remutable.working.get, remutable.working),
      set: _.scope(remutable.set, remutable),
      delete: _.scope(remutable.delete, remutable),
      rollback: _.scope(remutable.rollback, remutable),
      commit: () => this.commit(path),
    };
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

  session(clientSecret) {
    _.dev(() => clientSecret.should.be.a.String);
    if(this._sessions[clientSecret] === void 0) {
      this._sessions[clientSecret] = {
        clientSecret,
        connections: {},
        sessionTimeout: null,
        queue: null,
      };
      this.handleSessionCreate(clientSecret);
      this._pause(clientSecret);
    }
    return this._sessions[clientSecret];
  }

  dispatch(action, clientSecret, params) {
    if(!this._actionHandlers[action]) {
      return 0;
    }
    _.each(this._actionHandlers[action], (fn) => fn(this.session(clientSecret), params));
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
      if(this._actionHandlers[action] === void 0) {
        throw new HTTPExceptions.NotFound(path);
      }
      return this.dispatch(path, clientSecret, params);
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
    const connection = this._connections[socketId] = {
      socket,
      handshakeTimeout: setTimeout(() => this.handleHandshakeTimeout(socketId), this._handshakeTimeout),
      clientSecret: null,
    };
    socket.on('close', () => this.handleDisconnection(socketId));
    socket.on('error', (err) => this.handleError(socketId, err));
    socket.on('message', (json) => this.handleMessage(socketId, json));
  }

  handleDisconnection(socketId) {
    _.dev(() =>
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
      this.socketSend(socketId, Message.Error({ err }));
    });
  }

  handleHandshake(socketId, { clientSecret }) {
  }

  handleSubscribe(socketId, { path }) {

  }

  handleUnsubscribe(socketId, { path }) {

  }

  handleDispatch(socketId, { action, params }) {

  }

  handleSessionCreate(clientSecret) {

  }

  handleSessionTimeout(clientSecret) {

  }

  handleSessionDestroy(clientSecret) {

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
      this._sessions[clientSecret].queue.should.be.an.Array;
      _.size(this._sessions[clientSecret].connections).should.be.above(0);
    });
    clearTimeout(this._sessions[clientSecret].sessionTimeout);
    while(this._sessions[clientSecret].queue.length > 0) {
      this.queue(clientSecret, this._sessions[clientSecret].queue.shift());
    }
    this._sessionTimeout[clientSecret].queue = null;
  }
}

module.exports = { Server };
