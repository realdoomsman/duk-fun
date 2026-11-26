from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import subprocess, tempfile, socket, time, json, urllib.request, threading, websocket, base64

site = Path(__file__).resolve().parent
out = site / 'screenshots'
mode = 'normal'
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        if 'config.js' in self.path: print('config route', self.path, mode, flush=True)
        if self.path == '/assets/config.js' and mode != 'normal':
            body = (site / 'assets/config.js').read_text() + f"\nwindow.DUK_CONFIG.CA='test-address';window.DUK_CONFIG.X='https://x.com/example';window.DUK_CONFIG.KEEPER_URL='http://127.0.0.1:{self.server.server_port}/keeper';"
            self.send_response(200); self.end_headers(); self.wfile.write(body.encode()); return
        if self.path == '/keeper/log':
            if mode == 'failed': self.send_error(503); return
            body = {'state': 'active' if mode == 'active' else 'waiting_for_pool', 'totals': {'solAdded': 12.5, 'dukAdded': 98765, 'lpBurned': 42}, 'recent': [{'signature': 'test-burn-receipt', 'timestamp': 1700000000, 'solAdded': 1, 'dukAdded': 500, 'lpBurned': 2}]}
            self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(body).encode()); return
        super().do_GET()
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(site)))
server.handle_error = lambda *args: None
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
profile = tempfile.TemporaryDirectory(prefix='duk-final-')
process = subprocess.Popen(['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '--headless=new', '--hide-scrollbars', f'--remote-debugging-port={port}', '--remote-allow-origins=*', f'--user-data-dir={profile.name}', '--no-first-run', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(150):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json', timeout=1))
            tab = next(t for t in tabs if t.get('type') == 'page' and t.get('url', '').startswith(url)); break
        except Exception: time.sleep(.05)
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=8)
    counter = 0
    def command(method, params={}):
        global counter
        counter += 1; ws.send(json.dumps({'id': counter, 'method': method, 'params': params}))
        while True:
            result = json.loads(ws.recv())
            if result.get('id') == counter:
                if 'error' in result: raise RuntimeError(result['error'])
                return result.get('result', {})
    def js(expression):
        result = command('Runtime.evaluate', {'expression': expression, 'returnByValue': True})
        if 'exceptionDetails' in result: raise RuntimeError(result['exceptionDetails'])
        return result['result'].get('value')
    def wait(expression):
        for _ in range(150):
            if js(expression): return
            time.sleep(.04)
        print('diagnostic', js("JSON.stringify({url:location.href,config:window.DUK_CONFIG,floor:document.getElementById('floor-state')?.textContent,sol:document.getElementById('floor-sol')?.textContent})"), flush=True)
        raise AssertionError(expression)
    def screenshot(name):
        (out / f'{name}.png').write_bytes(base64.b64decode(command('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})['data']))
    command('Network.enable')
    command('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]})
    for name, width, height in [('desktop', 1440, 900), ('mobile', 390, 844)]:
        command('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': name == 'mobile'})
        command('Page.navigate', {'url': url})
        wait("document.readyState==='complete' && document.querySelectorAll('.meme-item').length>=26")
        print(name, js("JSON.stringify({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,memes:document.querySelectorAll('.meme-item').length})"), flush=True)
        assert js('document.documentElement.scrollWidth<=innerWidth'), 'horizontal overflow'
        assert js("getComputedStyle(document.querySelector('.flying-object')).animationName==='none'"), 'reduced motion'
        assert js("document.getElementById('floor-state').textContent==='starts after graduation' && document.getElementById('floor-sol').textContent==='—'"), 'default keeper state'
        for suffix, anchor in [('hero', None), ('doctrine', 'doctrine'), ('how', 'how'), ('ducked', 'ducked'), ('dictionary', 'dictionary'), ('floor', 'the-floor'), ('memes', 'memes')]:
            js(f"document.getElementById('{anchor}').scrollIntoView();window.scrollBy(0,-20)" if anchor else 'window.scrollTo(0,0)')
            time.sleep(.15); screenshot(f'{name}-{suffix}')
            if suffix == 'hero': screenshot(name)
        js("document.querySelector('.meme-item').click()")
        wait("document.getElementById('lightbox').open && document.getElementById('lightbox-image').complete")
        assert js("document.getElementById('download-meme').href.endsWith('/assets/memes/duk.png')"), 'download'
        screenshot(f'{name}-lightbox')
        for event in ['keyDown', 'keyUp']: command('Input.dispatchKeyEvent', {'type': event, 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
        wait("!document.getElementById('lightbox').open")
        assert js("document.activeElement.classList.contains('meme-item') && document.body.style.overflow===''")
    for mode in ['active', 'pending', 'failed']:
        command('Network.setCacheDisabled', {'cacheDisabled': True})
        command('Page.navigate', {'url': url + f'?verify={mode}'})
        wait("document.readyState==='complete' && document.querySelectorAll('.meme-item').length>=26")
        if mode == 'active':
            wait("document.getElementById('floor-sol').textContent==='12.5'")
            assert js("document.getElementById('floor-duk').textContent==='98,765' && document.getElementById('floor-lp').textContent==='42'")
            assert js("document.querySelector('#floor-transactions a').href==='https://solscan.io/tx/test-burn-receipt'")
            assert js("document.querySelectorAll('[data-links] a').length===2 && document.getElementById('ca').value==='test-address'")
        else:
            time.sleep(.15)
            assert js("document.getElementById('floor-sol').textContent==='—' && document.getElementById('floor-state').textContent==='starts after graduation' && document.getElementById('floor-transactions').hidden")
        print('keeper fixture', mode, 'passed', flush=True)
    ws.close()
finally:
    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    process.wait(timeout=10)
    server.shutdown(); server.server_close()
    try: profile.cleanup()
    except PermissionError: pass
    print('own server and headless browser stopped; parent server untouched', flush=True)
