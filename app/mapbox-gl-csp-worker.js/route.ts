const MAPBOX_GL_VERSION = "3.26.0";
const WORKER_URL = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp-worker.js`;

export async function GET() {
  const response = await fetch(WORKER_URL, {
    headers: {
      Accept: "application/javascript,text/javascript,*/*;q=0.1",
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    return new Response("Mapbox worker unavailable", { status: 502 });
  }

  return new Response(await response.text(), {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
    },
  });
}
