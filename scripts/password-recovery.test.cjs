const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const authCode = html.split('/* ===== Auth + Init ===== */')[1].split('/* ===== Data bootstrap ===== */')[0];
const userSession = { user: { id: 'synthetic-user', email: 'synthetic@example.test' } };

function harness(url = 'https://example.test/crm/', currentSession = null) {
  const elements = new Map();
  const calls = { boots: 0, updates: [], requests: [], signsOut: 0, logs: [] };
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', open: false, disabled: false,
      showModal() { this.open = true; }, close() { this.open = false; },
      checkValidity() { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.value); },
      focus() { this.focused = true; }
    });
    return elements.get(id);
  };
  const location = new URL(url);
  const service = {
    mode: 'supabase', configure() {},
    async getSession() { return currentSession; },
    onAuthStateChange(callback) { this.listener = callback; },
    async requestPasswordReset(...args) { calls.requests.push(args); },
    async updatePassword(value) { calls.updates.push(value); },
    async signOut() { calls.signsOut++; }
  };
  const context = vm.createContext({
    URL, URLSearchParams, window: { location, history: { replaceState(a, b, value) { calls.cleanUrl = String(value); } } },
    $: element, crmData: service, session: currentSession,
    SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_ANON_KEY: 'synthetic-public-key-for-testing',
    CRM_WORKSPACE_ID: 'synthetic-workspace', IS_PRODUCTION_RUNTIME: true,
    supabase: { createClient() { return {}; } }, sb: null,
    console: { info(...args) { calls.logs.push(args); }, warn(...args) { calls.logs.push(args); }, error(...args) { calls.logs.push(args); } },
    setAppDataState() {}, render() {}, toast() {},
    async bootAfterLogin() { calls.boots++; },
    syncController: { async stop() {}, async resume() {} },
    records: [], profiles: [], recordEvents: [], bootedUserId: null,
    hasInitialRecordSnapshot: false, hasInitialWeeklySnapshot: false,
    setSyncConnectionState() {}
  });
  vm.runInContext(authCode, context);
  return { context, element, service, calls };
}

test('the reported expired-link URL gives a safe, actionable message and removes auth parameters', async () => {
  const h = harness('https://example.test/crm/?keep=1#error=access_denied&error_code=otp_expired&error_description=untrusted');
  await h.context.initSupabase();
  assert.equal(h.element('loginModal').open, true);
  assert.match(h.element('loginNote').textContent, /invalid, expired, or already used/);
  assert.doesNotMatch(h.element('loginNote').textContent, /untrusted/);
  assert.equal(h.calls.cleanUrl, 'https://example.test/crm/?keep=1');
  assert.equal(h.calls.boots, 0);
});

test('recovery is caught before getSession completes and does not load CRM data', async () => {
  const h = harness('https://example.test/crm/#type=recovery', userSession);
  h.service.getSession = async () => {
    assert.equal(typeof h.service.listener, 'function');
    await h.service.listener('PASSWORD_RECOVERY', userSession);
    return userSession;
  };
  await h.context.initSupabase();
  assert.equal(h.element('passwordResetModal').open, true);
  assert.match(h.element('passwordResetEmail').textContent, /synthetic@example.test/);
  assert.equal(h.calls.boots, 0);
  await h.context.handleAuthStateChange('TOKEN_REFRESHED', userSession);
  assert.equal(h.calls.boots, 0);
});

test('a recovery link without an authenticated session cannot set a password', async () => {
  const h = harness('https://example.test/crm/#type=recovery');
  await h.context.initSupabase();
  h.element('resetPassword').value = h.element('resetPasswordConfirm').value = 'synthetic-password';
  await h.context.saveRecoveryPassword();
  assert.equal(h.calls.updates.length, 0);
  assert.equal(h.element('loginModal').open, true);
});

test('password requests validate email and remove stale URL errors from the redirect', async () => {
  const h = harness('https://example.test/crm/?error=old#untrusted');
  h.element('loginEmail').value = 'invalid';
  await h.context.requestPasswordReset();
  assert.equal(h.calls.requests.length, 0);
  h.element('loginEmail').value = ' synthetic@example.test ';
  // Browser email inputs strip leading/trailing whitespace.
  h.element('loginEmail').value = h.element('loginEmail').value.trim();
  await h.context.requestPasswordReset();
  assert.deepEqual(h.calls.requests, [['synthetic@example.test', 'https://example.test/crm/']]);
  assert.match(h.element('loginNote').textContent, /If this email has an account/);
});

test('weak or mismatched confirmation does not submit a password', async () => {
  const h = harness('https://example.test/crm/#type=recovery', userSession);
  await h.context.initSupabase();
  h.element('resetPassword').value = 'short';
  h.element('resetPasswordConfirm').value = 'short';
  await h.context.saveRecoveryPassword();
  assert.equal(h.calls.updates.length, 0);
  h.element('resetPassword').value = 'synthetic-password';
  h.element('resetPasswordConfirm').value = 'different-password';
  await h.context.saveRecoveryPassword();
  assert.equal(h.calls.updates.length, 0);
  assert.match(h.element('passwordResetNote').textContent, /do not match/);
});

test('saving once clears the fields, signs out, and requires a real password login', async () => {
  const h = harness('https://example.test/crm/#type=recovery', userSession);
  await h.context.initSupabase();
  h.element('resetPassword').value = h.element('resetPasswordConfirm').value = 'synthetic-password';
  await h.context.saveRecoveryPassword();
  assert.deepEqual(h.calls.updates, ['synthetic-password']);
  assert.equal(h.calls.signsOut, 1);
  assert.equal(h.element('resetPassword').value, '');
  assert.equal(h.element('resetPasswordConfirm').value, '');
  assert.equal(h.element('passwordResetModal').open, false);
  assert.equal(h.element('loginModal').open, true);
  assert.match(h.element('loginNote').textContent, /Password saved/);
  assert.doesNotMatch(JSON.stringify(h.calls.logs), /synthetic-password/);
});

test('duplicate submissions and USER_UPDATED events cannot reload the CRM while saving', async () => {
  const h = harness('https://example.test/crm/#type=recovery', userSession);
  await h.context.initSupabase();
  let resolveUpdate;
  h.service.updatePassword = () => new Promise(resolve => { resolveUpdate = resolve; h.calls.updates.push('called'); });
  h.element('resetPassword').value = h.element('resetPasswordConfirm').value = 'synthetic-password';
  const first = h.context.saveRecoveryPassword();
  await h.context.saveRecoveryPassword();
  await h.context.handleAuthStateChange('USER_UPDATED', userSession);
  assert.equal(h.calls.updates.length, 1);
  assert.equal(h.calls.boots, 0);
  resolveUpdate();
  await first;
});

test('a saved password is reported correctly even if the subsequent sign-out fails', async () => {
  const h = harness('https://example.test/crm/#type=recovery', userSession);
  await h.context.initSupabase();
  h.service.signOut = async () => { throw new Error('network'); };
  h.element('resetPassword').value = h.element('resetPasswordConfirm').value = 'synthetic-password';
  await h.context.saveRecoveryPassword();
  assert.match(h.element('passwordResetNote').textContent, /password was saved/);
  assert.equal(h.element('btnSavePassword').disabled, true);
  assert.equal(h.element('btnCancelPasswordReset').disabled, false);
});

test('normal sessions still open the CRM without showing password recovery', async () => {
  const h = harness('https://example.test/crm/', userSession);
  await h.context.initSupabase();
  assert.equal(h.calls.boots, 1);
  assert.equal(h.element('passwordResetModal').open, false);
});

test('password changes never fall back to the mock repository after network failure', async () => {
  const context = vm.createContext({ window: {}, console, TypeError });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/data/crm-repository-contract.js'), 'utf8'), context);
  const api = context.window.MarelCRMData;
  let fallbackCalls = 0;
  const repository = Object.fromEntries(api.repositoryContract.methods.map(method => [method, async () => {}]));
  repository.mode = 'supabase';
  repository.updatePassword = async () => { throw new TypeError('Network failed'); };
  api.createSupabaseRepository = () => repository;
  api.createMockRepository = () => { fallbackCalls++; throw new Error('Must not fall back'); };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/data/crm-data-service.js'), 'utf8'), context);
  api.service.configure({ supabaseClient: {}, supabaseUrl: 'https://synthetic.supabase.co' });
  await assert.rejects(api.service.updatePassword('synthetic-password'), /Network failed/);
  assert.equal(fallbackCalls, 0);
});
