Nexus Uplink Server (Simple)
============================

Nexus Uplink is an dead-simple, lightweight protocol on top of which [Flux over the Wire](codepen.io/write/flux-over-the-wire-part-1) can be implemented.

This package contains the implementation of the __server side__ component of Nexus Uplink.
For the __client side__ component, see [nexus-uplink-client](https://github.com/elierotenberg/nexus-uplink-client).

Nexus Uplink combines very well with [React](http://facebook.github.io/react/) views on the client, and particularly with [React Nexus](https://github.com/elierotenberg/react-nexus), but it is not tied to either of these projects.


## Core principles

Nexus Uplink is a simple communication protocol to allow:
- Clients to fetch values, and receive updates, from a server-side store
- Clients to send actions, to a server-side dispatcher
- Server to respond to actions, and mutate the store

Implementation roughly is:
- Store values are exposed via HTTP GET: clients can simply fire an HTTP GET request to retrieve them.
- Actions are send via HTTP POST: clients can simply fire an HTTP POST request to send them.
- Updates are dispatched via Websockets (or socket.io fallback)

```
+--- stringify action ---> HTTP POST request --- parse action ---+
^                                                                |
|                                                                v
Nexus Uplink Client                            Nexus Uplink Server
^                                                                |
|                                                                v
+--- parse update --- Websocket message <--- stringify update ---+
```


## Performance first

Nexus Uplink is designed and implemented with strong performance concerns in minds.
It is built from the ground up to support:
- Tens of thousands of concurrent users (more with the upcoming redis-based server implementation)
- Thousands of updates per second
- Thousands of actions per second

This bleeding edge performance is achieved using:
- [Immutable](https://github.com/facebook/immutable-js) internals, wrapped in [Remutable](https://github.com/elierotenberg/remutable) for ultra efficient patch broadcasting
- Easy caching without cache invalidation pain (handled by the protocol), just put the server behind Varnish/nginx/whatever caching proxy and you're good to go
- Optimized lazy memoization of message and patches JSON-encoding
- One-way data flow
- Action fast-path using the client-server Websocket channel when available
- Easy and configurable transaction-based updates batching


## About this package

This is a prototype, yet fully-functional implementation of the server side component of Nexus Uplink.
It is single-process, but extremely straightforward, and provides a very simple setup to deploy moderately large applications (think thousands of concurrents users and not millions, which is already quite a lot).
To scale further, we need to leverage multiple processes (ideally multiple machines), which involves dealing with [IPC](http://en.wikipedia.org/wiki/Inter-process_communication). IPC is hard, but thanks to the one-way data flow of the Nexus Uplink protocol, it is relatively straightforward using an efficient message queue such as [redis](http://redis.io/) or [RabbitMQ](http://www.rabbitmq.com/).


## Example (server-side)

```js
const { Engine, Server } = require('nexus-uplink-server');
const engine = new Engine();
const server = new Server(engine);
const todoList = engine.get('/todoList');
const counters = engine.get('/counters');
// send batch updates every 100ms
// you can commit on every mutation if you feel like so,
// but batch updates are really the proper way to scale
setInterval(() => {
  todoList.dirty || todoList.commit();
  counters.dirty || counters.commit();
}, 100);
engine.addActionHandler('/add-todo-item', (clientID, { name, description }) => {
  todoList.set(name, {
    description,
    addedBy: clientID,
  });
});
engine.addActionHandler('/complete-todo-item', (clientID, { name }) => {
  if(todoList.has(name) && todoList.get(name).addedBy === sha256(clientID)) {
    todoList.delete(name);
  }
});
// /session/create and /session/destroy are special, reserved actions
engine.addActionHandler('/sessions/create', (clientID) => {
  counters.set('active', counters.get('active') + 1);
  counters.set('total', counters.get('total') + 1);
});
engine.addActionHandler('/sessions/destroy', (clientID) => {
  counters.set('active', counters.get('active') - 1);
});
server.listen(8888);
```

## Example (client-side)

```js
const { Engine, Client } = require('nexus-uplink-client');
// clientSecret must be a globally unique, cryptographic secret
// it is typically generated at server-side rendering time
const Engine = new Engine(clientSecret);
const client = new Client(engine);
const todoList = client.subscribe('/todoList');
const counters = client.subscribe('/counters');
todoList.afterUpdate(() => {
  console.log('todoList has been updated to', todoList);
});
counters.afterUpdate(() => {
  console.log('active users:', counters.get('active'));
  console.log('total users:', counters.get('total'));
});
client.dispatch('/add-todo-item', {
  name: 'My first item', description: 'This is my first item!'
});
counters.unsubscribe();
```
