window.galaxiaAudioSources = {};
window.galaxiaAudioReady = Promise.all(Array.from({length: 23}, async (_, index) => {
  const id = String(index + 1).padStart(3, '0');
  const url = './assets/audio/' + id + '.mp3';
  try {
    const response = await fetch(url, {method: 'HEAD', cache: 'no-store'});
    if (response.ok && /^(audio\/|application\/octet-stream)/i.test(response.headers.get('Content-Type') || '')) {
      window.galaxiaAudioSources[id] = url;
    }
  } catch {
    // Leave the recording pending when the request fails.
  }
}));
