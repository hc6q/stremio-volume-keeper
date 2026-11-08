(function() {
  const STORAGE_KEY = 'stremio_volume_keeper_volume';
  let savedVolume = null;

  // Carrega o volume salvo assim que a extensão inicia
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (result[STORAGE_KEY] !== undefined) {
      savedVolume = result[STORAGE_KEY];
    }
  });

  // Função para encontrar o elemento <video> principal da página
  function getVideoElement() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    // Retorna o vídeo com a maior área visível (o player principal)
    return videos.reduce((largest, current) => {
      const largestRect = largest.getBoundingClientRect();
      const currentRect = current.getBoundingClientRect();
      return (currentRect.width * currentRect.height) > (largestRect.width * largestRect.height) ? current : largest;
    });
  }

  // Aplica o volume salvo ao elemento de vídeo
  function applySavedVolume(video) {
    if (savedVolume !== null && video && Math.abs(video.volume - savedVolume) > 0.01) {
      video.volume = savedVolume;
    }
  }

  // Configura os ouvintes de evento para um elemento de vídeo
  function observeVideo(video) {
    if (!video || video.dataset.volumeKeeperAttached) return;
    video.dataset.volumeKeeperAttached = 'true';

    // 1. Monitora mudanças de volume
    video.addEventListener('volumechange', () => {
      // Se o volume foi para 100% (ou perto disso) e temos um volume salvo menor, restaura
      if (video.volume > 0.99 && savedVolume !== null && savedVolume < 0.99) {
        video.volume = savedVolume;
        return;
      }
      // Se o usuário ajustou o volume para um valor abaixo de 100%, salva esse valor
      if (video.volume < 0.99) {
        savedVolume = video.volume;
        chrome.storage.local.set({ [STORAGE_KEY]: savedVolume });
      }
    });

    // 2. Reaplica o volume quando um novo episódio é carregado
    video.addEventListener('loadedmetadata', () => {
      applySavedVolume(video);
    });

    // 3. Tenta aplicar o volume imediatamente caso o vídeo já esteja pronto
    if (video.readyState >= 1) { // HAVE_METADATA
      applySavedVolume(video);
    }
  }

  // Observa o surgimento de novos elementos <video> na página
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'VIDEO') {
          observeVideo(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll('video').forEach(observeVideo);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Tenta observar um vídeo que já exista na página
  const existingVideo = getVideoElement();
  if (existingVideo) {
    observeVideo(existingVideo);
  }
})();