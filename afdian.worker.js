// cloudflare workers
const afdianUserId = "YOUR_USER_ID_HERE";
const afdianToken = "YOUR_API_TOKEN_HERE";

function setOrigin(response, originalReq) {
  const res = new Response(response.body, response);
  var headers = res.headers;
  headers.set('Access-Control-Allow-Origin', originalReq.headers.get('Origin'));
  headers.append('Vary', 'Origin');
  headers.delete("X-Permitted-Cross-Domain-Policies");
  if (headers.has("Cross-Origin-Opener-Policy")) headers.set("Cross-Origin-Opener-Policy", "cross-origin");
  if (headers.has("Cross-Origin-Resource-Policy")) headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  return res;
}

/**
 * @param {string} url
 * @param {any} params
 */
async function afdianRequest(req, url, params) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsStr = JSON.stringify(params);
  const signStr = afdianToken + "params" + paramsStr + "ts" + timestamp + "user_id" + afdianUserId;

  const buffer = await crypto.subtle.digest("MD5", new TextEncoder().encode(signStr));
  const hexArr = new Array(buffer.byteLength).fill('');
  const view = new DataView(buffer);
 
  for (let i = 0; i !== buffer.byteLength; ++i) {
    hexArr[i] = view.getUint8(i).toString(16).padStart(2, '0');
  }
  const sign = hexArr.join('');
  const json = JSON.stringify({
    user_id: afdianUserId,
    params: paramsStr,
    ts: timestamp,
    sign: sign,
  });
  const response = await fetch(new Request(url, req), {
    method: "POST",
    body: json,
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  });
  return setOrigin(response, req);
}

/**
 * @param {Request<unknown, CfProperties<unknown>> | RequestInit<CfProperties<unknown>>} req
 * @param {string} origin
 * @param {Headers} headers
 * @param {string} pathname
 * @param {URLSearchParams} searchParams
 */
async function handleRequest(req, origin, headers, pathname, searchParams) {
  if (!pathname.startsWith("/")) pathname = "/" + pathname;
  if (pathname.endsWith("/")) pathname = pathname.substring(0, pathname.length - 1);
  if (pathname == "/afdian/ping") {
    return await afdianRequest(req, "https://afdian.net/api/open/ping", {
      a: 333
    });
  }
  if (pathname.startsWith("/afdian/sponsors/") && pathname.length > 17) {
    var userId = pathname.substring(17);
    return await afdianRequest(req, "https://afdian.com/api/open/query-sponsor", {
      user_id: userId
    });
  }
  if (pathname == "/afdian/sponsors") {
    return await afdianRequest(req, "https://afdian.net/api/open/query-sponsor", {
      page: Number.parseInt(searchParams.get("page")) || 1,
      per_page: 100,
    });
  }
  if (pathname == "/afdian/avatar") {
    var url = searchParams.get('url') || '';
    var i = url.indexOf('.afdiancdn.com/');
    if (i < 0 || i > 18) return new Response(null, {status: 404});
    const response = await fetch(new Request(url), { method: 'GET' });
    return setOrigin(response, req);
  }
  return new Response(null, {status: 404});
}

addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const pathname = url.pathname;
  const searchParams = url.searchParams;
  return event.respondWith(handleRequest(request, origin, request.headers, pathname, searchParams));
});
