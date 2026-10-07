const BASE_URL = "https://sololatino.net";

/**
 * Busca películas y series en SoloLatino.
 */
export async function search(query) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query || "")}`;
  
  const response = await kino.fetch(searchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "es-CO,es;q=0.9"
    }
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const results = [];
  const seenUrls = new Set();

  // Búsqueda flexible de enlaces con imagen/título dentro del HTML
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const itemUrl = match[1];
    const innerHtml = match[2];

    // Validar enlaces relevantes de películas, series o animes
    const isContent = itemUrl.includes("/peliculas/") || 
                      itemUrl.includes("/series/") || 
                      itemUrl.includes("/tvshows/") || 
                      itemUrl.includes("/animes/");

    if (isContent && !seenUrls.has(itemUrl)) {
      const imgMatch = /src="([^"]+)"/i.exec(innerHtml) || /data-src="([^"]+)"/i.exec(innerHtml);
      const titleMatch = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(innerHtml) || 
                         /alt="([^"]+)"/i.exec(innerHtml) || 
                         /title="([^"]+)"/i.exec(innerHtml);

      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      
      if (title) {
        seenUrls.add(itemUrl);
        const poster = imgMatch ? imgMatch[1] : "";
        const isTv = itemUrl.includes("/series/") || itemUrl.includes("/tvshows/") || itemUrl.includes("/animes/");

        results.push({
          id: itemUrl,
          title: title,
          poster: poster,
          type: isTv ? "tv" : "movie"
        });
      }
    }
  }

  return results;
}

/**
 * Resuelve las fuentes y enlaces de reproducción/descarga.
 */
export async function resolve(id) {
  const targetUrl = id.startsWith("http") ? id : `${BASE_URL}/${id}`;
  
  const response = await kino.fetch(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": BASE_URL
    }
  });

  if (!response.ok) {
    throw kino.error("not_found", "No se pudo acceder al contenido.");
  }

  const html = await response.text();
  const sources = [];
  const iframeRegex = /<iframe[^>]+src="([^"]+)"/gi;
  let match;

  while ((match = iframeRegex.exec(html)) !== null) {
    let embedUrl = match[1];

    if (embedUrl.startsWith("//")) {
      embedUrl = "https:" + embedUrl;
    }

    if (embedUrl.includes("facebook") || embedUrl.includes("twitter") || embedUrl.includes("disqus")) {
      continue;
    }

    let serverName = "Servidor Web";
    if (embedUrl.includes("streamwish") || embedUrl.includes("swish")) serverName = "StreamWish (Latino)";
    else if (embedUrl.includes("filemoon")) serverName = "Filemoon (Latino)";
    else if (embedUrl.includes("voe")) serverName = "VOE (Latino)";
    else if (embedUrl.includes("dood") || embedUrl.includes("ds2play")) serverName = "DoodStream (Latino)";
    else if (embedUrl.includes("vidhide") || embedUrl.includes("streamhide")) serverName = "VidHide (Latino)";
    else if (embedUrl.includes("mixdrop")) serverName = "MixDrop (Latino)";

    sources.push({
      name: serverName,
      url: embedUrl,
      quality: "HD",
      isEmbed: true
    });
  }

  if (sources.length === 0) {
    throw kino.error("unavailable", "No se encontraron servidores disponibles para este título.");
  }

  return sources;
}
