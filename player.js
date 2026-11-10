(() => {
  const byId = id => document.getElementById(id);
  const audio = byId('galaxia-audio');
  const mini = byId('player-mini');
  const dialog = byId('player-dialog');
  const sources = window.galaxiaAudioSources;
  const key = 'tu-galaxia-player-v1';
  const cover = id => './assets/covers/' + id + '.webp';
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const length = seconds => Number.isFinite(seconds) ? Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0') : '0:00';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
  const playlists = Array.isArray(saved.playlists) ? saved.playlists.filter(item =>
    item && typeof item.name === 'string' && Array.isArray(item.ids)) : [];
  let tracks = [];
  let current;
  let queue = [];
  let baseQueue = [];
  let shuffle = saved.shuffle === true;
  let repeat = saved.repeat === true;
  let playlistIndex = -1;
  let panel;
  const persist = () => {
    try { localStorage.setItem(key, JSON.stringify({playlists, shuffle, repeat, last: current?.id})); } catch {}
  };
  const canPlay = id => typeof sources[id] === 'string' && sources[id].trim() !== '';
  const session = navigator.mediaSession;
  const status = message => { byId('player-status').textContent = message; };
  const image = (node, track) => {
    const url = cover(track.id);
    if (node.getAttribute('src') !== url) node.src = url;
  };
  function render() {
    if (!current) return;
    const playing = !audio.paused;
    for (const [id, text] of [['player-title', current.title], ['mini-title', current.title],
      ['player-number', 'Canción ' + current.id], ['player-toggle', playing ? '⏸' : '▶'],
      ['mini-toggle', playing ? '⏸' : '▶']]) byId(id).textContent = text;
    for (const id of ['player-toggle', 'mini-toggle']) {
      const button = byId(id);
      button.disabled = !canPlay(current.id);
      button.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    }
    image(byId('player-cover'), current);
    image(byId('mini-cover'), current);
    byId('player-prev').disabled = byId('player-next').disabled = queue.length < 2;
    byId('player-shuffle').setAttribute('aria-pressed', String(shuffle));
    byId('player-repeat').setAttribute('aria-pressed', String(repeat));
    syncTime();
    if (panel) panel.querySelector('[data-player-open]').textContent = 'Ver reproductor';
  }
  function syncTime() {
    const slider = byId('player-seek');
    const hasDuration = Number.isFinite(audio.duration) && audio.duration > 0;
    slider.disabled = !hasDuration;
    slider.max = hasDuration ? audio.duration : 0;
    slider.value = hasDuration ? audio.currentTime : 0;
    byId('player-time').textContent = length(audio.currentTime);
    byId('player-duration').textContent = length(audio.duration);
  }
  function updateSession() {
    if (!session) return;
    if (current && canPlay(current.id) && 'MediaMetadata' in window) {
      session.metadata = new MediaMetadata({
        title: current.title, artist: 'Amane', album: 'Mi estrella fugaz',
        artwork: [{src: new URL(cover(current.id), document.baseURI).href, sizes: '420x420', type: 'image/webp'}]
      });
    } else session.metadata = null;
    session.playbackState = !current || !canPlay(current.id) ? 'none' : audio.paused ? 'paused' : 'playing';
  }
  function play() {
    if (!current || !canPlay(current.id)) return;
    audio.play().catch(() => status('No se pudo reproducir. Toca Reproducir para intentarlo de nuevo.'));
  }
  function toggle() {
    if (audio.paused) play(); else audio.pause();
  }
  function orderQueue() {
    queue = [...baseQueue];
    if (!shuffle || !current) return;
    const index = queue.findIndex(track => track.id === current.id);
    if (index >= 0) queue.splice(index, 1);
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    queue.unshift(current);
  }
  function select(track, autoplay = false, nextQueue = null) {
    if (track.id !== current?.id || (canPlay(track.id) && !audio.getAttribute('src'))) {
      audio.pause();
      current = track;
      if (canPlay(track.id)) audio.src = sources[track.id];
      else { audio.removeAttribute('src'); audio.load(); }
      status(canPlay(track.id) ? '' : 'Grabación pendiente. La portada y la letra ya están disponibles.');
    }
    if (nextQueue) { baseQueue = nextQueue; orderQueue(); }
    mini.hidden = false;
    render();
    updateSession();
    persist();
    if (autoplay) play();
  }
  function step(direction, ended = false) {
    const eligible = queue.filter(track => canPlay(track.id));
    const pool = eligible.length && (ended || canPlay(current.id)) ? eligible : queue;
    if (!pool.length) return;
    const index = pool.findIndex(track => track.id === current.id);
    if (ended && !repeat && index === pool.length - 1) return;
    const next = pool[((index < 0 ? (direction > 0 ? -1 : 0) : index) + direction + pool.length) % pool.length];
    if (ended && next.id === current.id) audio.currentTime = 0;
    select(next, ended || !audio.paused);
  }
  function openPlayer() {
    if (!current && tracks.length) select(tracks[0], false, tracks);
    if (current && !dialog.open) dialog.showModal();
  }
  function renderLibrary() {
    const list = panel.querySelector('[data-player-list]');
    const filter = panel.querySelector('[data-player-search]');
    const pick = panel.querySelector('[data-player-playlist]');
    pick.replaceChildren(new Option('Todas las canciones', '-1'), ...playlists.map((p, i) => new Option(p.name, i)));
    pick.value = String(playlistIndex);
    const playlist = playlists[playlistIndex];
    const library = playlist ? playlist.ids.map(id => tracks.find(t => t.id === id)).filter(Boolean) : tracks;
    const term = normalize(filter.value);
    const visible = library.filter(t => /^\d+$/.test(term) ? Number(t.id) === Number(term) : normalize(t.title).includes(term));
    panel.querySelector('[data-player-count]').textContent = visible.length + (visible.length === 1 ? ' canción' : ' canciones');
    list.replaceChildren();
    for (const track of visible) {
      const li = document.createElement('li');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'player-row';
      const art = document.createElement('img');
      art.alt = ''; art.loading = 'lazy'; art.width = 48; art.height = 48; image(art, track);
      const label = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = track.title;
      const detail = document.createElement('small');
      const available = canPlay(track.id);
      const icon = document.createElement('span');
      icon.className = available ? 'track-ready' : 'track-pending';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = available ? '▶' : '◷';
      detail.append(track.id + ' · ', icon, available ? ' Disponible' : ' Grabación pendiente');
      label.append(title, detail);
      row.append(art, label);
      row.addEventListener('click', () => { select(track, canPlay(track.id), library); openPlayer(); });
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'player-list-action';
      edit.textContent = playlist ? '−' : '+';
      edit.setAttribute('aria-label', (playlist ? 'Quitar de la playlist: ' : 'Añadir a una playlist: ') + track.title);
      edit.addEventListener('click', () => {
        if (!playlist) { openPlaylistPicker(track); return; }
        playlist.ids = playlist.ids.filter(id => id !== track.id);
        persist();
        renderLibrary();
        pick.focus();
      });
      li.append(row, edit);
      list.append(li);
    }
  }
  const picker = byId('playlist-dialog');
  let pendingTrack;
  function openPlaylistPicker(track) {
    pendingTrack = track;
    byId('playlist-title').textContent = 'Guardar «' + track.title + '»';
    const select = byId('playlist-existing');
    select.replaceChildren(...playlists.map((p, i) => new Option(p.name, i)));
    byId('playlist-add').hidden = playlists.length === 0;
    byId('playlist-name').value = '';
    byId('playlist-status').textContent = '';
    picker.showModal();
  }
  function saveToPlaylist(playlist) {
    if (!playlist || !pendingTrack) return;
    if (!playlist.ids.includes(pendingTrack.id)) playlist.ids.push(pendingTrack.id);
    persist();
    picker.close();
    if (panel?.isConnected) renderLibrary();
    if (dialog.open) status('Guardada en «' + playlist.name + '».');
    else if (panel?.isConnected) panel.querySelector('[data-player-notice]').textContent = 'Guardada en «' + playlist.name + '».';
  }
  byId('playlist-add').addEventListener('submit', event => {
    event.preventDefault();
    saveToPlaylist(playlists[Number(byId('playlist-existing').value)]);
  });
  byId('playlist-create').addEventListener('submit', event => {
    event.preventDefault();
    const name = byId('playlist-name').value.trim();
    if (!name) { byId('playlist-status').textContent = 'Escribe un nombre para la playlist.'; return; }
    if (playlists.some(p => normalize(p.name) === normalize(name))) {
      byId('playlist-status').textContent = 'Ya tienes una playlist con ese nombre.';
      return;
    }
    const playlist = {name, ids: []};
    playlists.push(playlist);
    saveToPlaylist(playlist);
  });
  byId('mini-open').addEventListener('click', openPlayer);
  byId('mini-toggle').addEventListener('click', toggle);
  byId('player-toggle').addEventListener('click', toggle);
  byId('player-prev').addEventListener('click', () => step(-1));
  byId('player-next').addEventListener('click', () => step(1));
  byId('player-save').addEventListener('click', () => openPlaylistPicker(current));
  byId('player-shuffle').addEventListener('click', () => { shuffle = !shuffle; orderQueue(); persist(); render(); });
  byId('player-repeat').addEventListener('click', () => { repeat = !repeat; persist(); render(); });
  byId('player-seek').addEventListener('input', event => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value); });
  for (const name of ['loadedmetadata', 'timeupdate', 'durationchange']) audio.addEventListener(name, syncTime);
  for (const name of ['play', 'pause']) audio.addEventListener(name, () => { render(); updateSession(); });
  audio.addEventListener('ended', () => { step(1, true); render(); updateSession(); });
  audio.addEventListener('error', () => { if (current && canPlay(current.id)) status('El archivo de audio no está disponible en este momento.'); });
  if (session) {
    const actions = {play, pause: () => audio.pause(), previoustrack: () => step(-1), nexttrack: () => step(1),
      seekto: ({seekTime}) => { if (Number.isFinite(seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, Math.max(0, seekTime)); }};
    for (const [name, handler] of Object.entries(actions)) {
      try { session.setActionHandler(name, handler); } catch {}
    }
  }
  window.galaxiaPlayer = {
    open(root) {
      panel = root.querySelector('[data-player-library]');
      tracks = [...root.querySelectorAll('.track > summary')].map(summary => {
        const [id, ...title] = summary.textContent.split(' · ');
        return {id, title: title.join(' · ')};
      });
      if (!current && saved.last) {
        const last = tracks.find(track => track.id === saved.last);
        if (last) select(last, false, tracks);
      }
      panel.querySelector('[data-player-open]').addEventListener('click', openPlayer);
      panel.querySelector('[data-player-search]').addEventListener('input', renderLibrary);
      panel.querySelector('[data-player-playlist]').addEventListener('change', event => {
        playlistIndex = Number(event.target.value);
        renderLibrary();
      });
      renderLibrary();
    }
  };
  window.galaxiaAudioReady?.then(() => {
    if (current && canPlay(current.id)) select(current);
    if (panel?.isConnected) renderLibrary();
  });
})();
