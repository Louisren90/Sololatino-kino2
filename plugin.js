const BASE_URL = "https://sololatino.net";

/**
 * Búsqueda de contenido utilizando el navegador web interno de Kino.
 */
export async function search(query) {
  // Esperar a que la llamada async responda
  await kino.sleep(100);

  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query || "")}`;
  
  try {
    // Usar el navegador headless para saltarse protecciones anti-bot
    const html = await kino.browser.fetch(searchUrl, {
      timeout: 12000
    });

    if (!html) return [];

    const results = [];
    const seenUrls = new Set();

    // Capturar tarjetas de películas y series
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let articleMatch;

    while ((articleMatch = articleRegex.exec(html)) !== null) {
      const content = articleMatch[1];
      const linkMatch = /href="([^"]+)"/i.exec(content);
      const titleMatch = /<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(content) || /alt="([^"]+)"/i.exec(content);
      const imgMatch = /src="([^"]+)"/i.exec(content) || /data-src="([^"]+)"/i.exec(content);

      if (linkMatch && titleMatch) {
        const itemUrl = linkMatch[1];
        if (seenUrls.has(itemUrl)) continue;

        const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
        const poster = imgMatch ? imgMatch[1] : "";
        const isTv = itemUrl.includes("/series/") || itemUrl.includes("/tvshows/") || itemUrl.includes("/animes/");

        seenUrls.add(itemUrl);
        results.push({
          id: itemUrl,
          title: title,
          poster: poster,
          type: isTv ? "tv" : "movie"
        });
      }
    }

    return results;
  } catch (error) {
    return [];
  }
}

/**
 * Obtener fuentes de video para reproducción y descarga.
 */
export async function resolve(id) {
  await kino.sleep(100);

  const targetUrl = id.startsWith("http") ? id : `${BASE_URL}/${id}`;

  try {
    const html = await kino.browser.fetch(targetUrl, {
      timeout: 12000
    });

    if (!html) {
      throw kino.error("not_found", "No se pudo cargar la página.", { userMessage: "No se pudo cargar la página." });
    }

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
      throw kino.error("unavailable", "No se encontraron servidores.", { userMessage: "No se encontraron servidores." });
    }

    return sources;
  } catch (err) {
    throw kino.error("unavailable", "Error al procesar el enlace.", { userMessage: "Error al procesar el enlace." });
  }
}
