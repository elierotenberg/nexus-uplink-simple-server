const _ = require('lodash-next');
const bodyParser = require('body-parser');
const EngineIO = require('engine.io');
const http = require('http');
const express = require('express');

const Engine = require('./Engine');

class Server {
  constructor(engine, options) {
    options = options || {};
    _.dev(() => engine.should.be.an.instanceOf(Engine));
    this._engine = engine;
    // If custom app is provided, it really should use bodyParser.json() or
    // something equivalent.
    this._app = options.app || express().use(bodyParser.json());
    // I don't really see a use case for these too but let's make it
    // configurable too
    this._io = options.io || EngineIO.Server();
    this._http = options.http || http.Server(this._app);
    this._bindIOHandlers();
    this._bindHTTPHandlers();
    this.listen = Promise.promisify(this._http.listen.bind(this._http));
  }

  _bindIOHandlers() {
    this._io.attach(this._http);
    this._io.on('connection', (socket) => this._engine.handleConnection(socket));
  }

  _bindHTTPHandlers() {
    this._app.get('*', (req, res) => this._engine.handleGET(req, res));
    this._app.post('*', (req, res) => this._engine.handlePOST(req, res));
  }
}

_.extend(Server.prototype, {
  _engine: null,
  listen: null,
});
