const BASE_URL = "https://sololatino.net";

/**
 * Busca películas y series en SoloLatino.
 * @param {string} query
 */
export async function search(query) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query || "")}`;
  
  // En Kino TV no existe 'fetch' global, se usa 'kino.fetch'
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
  const itemRegex = /<article[^>]*class="[^"]*item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = itemRegex.exec(html)) !== null) {
    const itemHtml = match[1];
    const linkMatch = /href="([^"]+)"/i.exec(itemHtml);
    const titleMatch = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(itemHtml) || /alt="([^"]+)"/i.exec(itemHtml);
    const imgMatch = /src="([^"]+)"/i.exec(itemHtml) || /data-src="([^"]+)"/i.exec(itemHtml);

    if (linkMatch && titleMatch) {
      const itemUrl = linkMatch[1];
      const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      const poster = imgMatch ? imgMatch[1] : "";
      const isTv = itemUrl.includes("/tvshows/") || itemUrl.includes("/series/");

      results.push({
        id: itemUrl,
        title: title,
        poster: poster,
        type: isTv ? "tv" : "movie"
      });
    }
  }

  return results;
}

/**
 * Resuelve las fuentes y enlaces de reproducción/descarga.
 * @param {string} id
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

    // Filtrar scripts sociales o no relacionados
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
