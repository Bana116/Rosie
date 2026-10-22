// Rosie's voice without a server (e.g. on Cloudflare Pages).
// With server.py running, everything goes to the server as usual. If the server isn't there,
// Rosie plays Sarah's saved lines from voice-cache/ (named by the same fingerprint server.py uses),
// and the browser's built-in voice reads any line that was never saved.
(() => {
  const VID = 'EXAVITQu4vr4xnSDxMaL', MODEL = 'eleven_turbo_v2_5', f0 = window.fetch.bind(window);
  const ROUTES = ['/tts', '/tts-status', '/notes-list', '/photos-list'];
  const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'Content-Type': 'application/json'}});
  async function saved(text){
    const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${VID}|${MODEL}|${text}`));
    const h = [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
    const r = await f0('voice-cache/' + h + '.mp3');
    return r.ok ? r : json({error: 'uncached'}, 404);
  }
  window.fetch = async (u, o) => {
    const p = typeof u === 'string' ? u : u.url;
    if (!ROUTES.includes(p)) return f0(u, o);
    let r = null; try { r = await f0(u, o); } catch(e){}
    if (r && r.ok) return r;                                  // the local server answered
    if (p === '/tts-status') return json({ok: true, tts: true, notes: false});
    if (p === '/notes-list') return json({});
    if (p === '/photos-list') return json([]);
    try { return await saved(JSON.parse(o.body).text); } catch(e){ return json({error: 'uncached'}, 404); }
  };
})();
