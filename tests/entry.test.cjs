'use strict';

const {
    test
  } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
test('saved-message hook returns immediately and coalesces an update arriving during background work', async () => {
  const hooks = new Map(),
    scheduled = [],
    received = [],
    notices = [];
  let release;
  const gate = new Promise(resolve => release = resolve);
  const app = {
    load: async () => {},
    close() {},
    notice: text => notices.push(text),
    onSaved: async event => {
      received.push(event);
      if (received.length === 1) await gate;
    }
  };
  const host = {
    document: {},
    dispatchEvent() {},
    setTimeout: callback => scheduled.push(callback)
  };
  host.top = host;
  const tavo = {
    plugin: {
      on: (name, callback) => hooks.set(name, callback),
      onInputAction() {},
      onSidebarAction() {}
    },
    utils: {
      toast: async () => {}
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/entry.js'), 'utf8'), {
    window: host,
    tavo,
    Core: {},
    Assets: {},
    createStore: () => ({}),
    createProvider: () => ({}),
    createApp: () => app
  });
  assert.equal(hooks.get('message:added')({
    chatId: 1,
    message: {
      id: 2
    }
  }), undefined);
  assert.equal(scheduled.length, 1);
  scheduled.shift()();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(received.length, 1);
  assert.equal(hooks.get('message:updated')({
    chatId: 1,
    message: {
      id: 2,
      updated: true
    }
  }), undefined);
  assert.equal(scheduled.length, 0);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(received.length, 2);
  assert.equal(received[1].message.updated, true);
  assert.deepEqual(notices, []);
});

