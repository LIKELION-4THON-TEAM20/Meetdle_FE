// Run against Vite dev server with Chrome installed (override with MEETDLE_CHROME_BIN).
const keepAlive = setInterval(() => {}, 1000);
setTimeout(() => process.exit(1), 35000).unref();
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const origin = new URL(process.env.MEETDLE_DEV_URL ?? 'http://localhost:5173').origin;
const profile = mkdtempSync(join(tmpdir(), 'meetdle-chrome-'));
const chrome = spawn(
  process.env.MEETDLE_CHROME_BIN ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--no-first-run',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
(async () => {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      target = (
        await (
          await fetch(
            `http://127.0.0.1:${readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split(/\s/)[0]}/json/list`,
          )
        ).json()
      ).find((x) => x.type === 'page');
    } catch {}
    if (!target) await sleep(100);
  }
  assert(target, 'Chrome DevTools unavailable');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  ws.onclose = () => {
    for (const [, j] of pending.values()) j(Error('DevTools disconnected'));
  };
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) {
      const [r, j] = pending.get(m.id);
      pending.delete(m.id);
      m.error ? j(new Error(m.error.message)) : r(m.result);
    }
  };
  const call = (method, params = {}) =>
    new Promise((r, j) => {
      pending.set(++id, [r, j]);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await call('Runtime.evaluate', {
      expression,
      userGesture: true,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 80; i++) {
      if (await evaluate(expression)) return;
      await sleep(50);
    }
    throw Error('Timed out: ' + expression);
  };

  const dialog = 'document.querySelector(".common-modal[open]")';
  const button = 'document.querySelector(".invite-code-copy__button")';
  await call('Browser.grantPermissions', {
    origin,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  await call('Page.navigate', { url: origin + '/rooms/create/complete' });
  await until('!!' + button);
  await call('Page.bringToFront');
  await until('document.hasFocus()');
  for (const width of [320, 390, 440]) {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height: 667,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await evaluate(button + '.focus();' + button + '.click()');
    await until('!!' + dialog);
    const info = await evaluate(
      `(()=>{const d=${dialog};const p=d.firstElementChild;const r=p.getBoundingClientRect();const [share,confirm]=p.querySelectorAll('button');return {x:r.x,y:r.y,w:r.width,h:r.height,radius:getComputedStyle(p).borderRadius,padding:getComputedStyle(p).padding,gap:getComputedStyle(p).gap, scrim:getComputedStyle(d,'::backdrop').backgroundColor,icon:p.querySelector('img').naturalWidth, title:document.getElementById(d.getAttribute('aria-labelledby')).textContent.trim(),description:document.getElementById(d.getAttribute('aria-describedby')).textContent.trim(),share:share.textContent,sh:share.offsetHeight,ch:confirm.offsetHeight,sc:getComputedStyle(share).backgroundColor,cc:getComputedStyle(confirm).backgroundColor}})()`,
    );
    assert.deepEqual(info, {
      x: (width - Math.min(328, width - 32)) / 2,
      y: 215,
      w: Math.min(328, width - 32),
      h: 237,
      radius: '20px',
      padding: '24px',
      gap: '12px',
      scrim: 'rgba(217, 217, 217, 0.75)',
      icon: 30,
      title: '초대코드가 복사 되었어요',
      description: '친구들에게 공유해보세요!',
      share: '카카오톡으로 전송하기',
      sh: 52,
      ch: 52,
      sc: 'rgb(124, 92, 255)',
      cc: 'rgba(0, 0, 0, 0)',
    });
    assert.equal(
      await evaluate('navigator.clipboard.readText()'),
      await evaluate('document.querySelector(".invite-code-copy__code").textContent'),
    );
    if (width === 390) {
      await sleep(2750);
      assert(await evaluate('!!' + dialog));
      await evaluate('window.alertMessages=[];window.alert=(message)=>alertMessages.push(message)');
      await evaluate(dialog + '.querySelector("button").click()');
      assert(await evaluate('!!' + dialog));
    }
    await evaluate(dialog + '.querySelector("button:last-child").click()');
    await until('!' + dialog);
    assert(await evaluate('document.activeElement === ' + button));
    if (width === 390) {
      await evaluate('document.querySelector(".room-created__action").click()');
      const alerts = await evaluate('alertMessages');
      assert.equal(alerts.length, 2);
      assert.equal(alerts[0], alerts[1]);
      assert.match(alerts[0], /아직 연동되지 않았어요/);
    }
    console.log(width + 'px: Figma geometry/colors, clipboard, confirmation and focus verified');
  }
  await evaluate(
    'navigator.clipboard.writeText=()=>Promise.reject(new DOMException("Denied","NotAllowedError"));' +
      button +
      '.click()',
  );
  await until('!!document.querySelector(".common-toast__panel")');
  assert(await evaluate('!' + dialog));
  assert.match(
    await evaluate('document.querySelector(".common-toast [role=alert]").textContent'),
    /복사하지 못했어요/,
  );
  await until('!document.querySelector(".common-toast__panel")');
  console.log('Persistence beyond 2.5s, same Kakao alert, and dismissing failure toast verified');
  ws.close();
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    chrome.kill();
    clearInterval(keepAlive);
  });
