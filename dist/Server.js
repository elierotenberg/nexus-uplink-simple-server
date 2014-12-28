"use strict";

require("6to5/polyfill");var Promise = (global || window).Promise = require("lodash-next").Promise;var __DEV__ = process.env.NODE_ENV !== "production";var __PROD__ = !__DEV__;var __BROWSER__ = typeof window === "object";var __NODE__ = !__BROWSER__;var _ = require("lodash-next");
var bodyParser = require("body-parser");
var EngineIO = require("engine.io");
var http = require("http");
var express = require("express");

var Engine = require("./Engine");

var Server = function Server(engine, options) {
  options = options || {};
  _.dev(function () {
    return engine.should.be.an.instanceOf(Engine);
  });
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
};

Server.prototype._bindIOHandlers = function () {
  var _this = this;
  this._io.attach(this._http);
  this._io.on("connection", function (socket) {
    return _this._engine.handleConnection(socket);
  });
};

Server.prototype._bindHTTPHandlers = function () {
  var _this2 = this;
  this._app.get("*", function (req, res) {
    return _this2._engine.handleGET(req, res);
  });
  this._app.post("*", function (req, res) {
    return _this2._engine.handlePOST(req, res);
  });
};

_.extend(Server.prototype, {
  _engine: null,
  listen: null });