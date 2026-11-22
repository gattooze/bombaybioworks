/**
 * Lightweight JSON-file state store.
 * Used only for progress checkpointing during history ingestion
 * (which message offset we've processed so far).
 * No native compilation required.
 */
const fs = require('fs');
const path = require('path');
const { cfg } = require('./config');

function statePath() {
  const dir = path.dirname(cfg.dbPath);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'state.json');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function getState(key) {
  return readState()[key] ?? null;
}

function setState(key, value) {
  const state = readState();
  state[key] = value;
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
}

module.exports = { getState, setState };
