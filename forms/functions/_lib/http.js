export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
      ...(init.headers || {})
    }
  });
}

export function methodNotAllowed() {
  return json({ message: 'Method not allowed' }, { status: 405 });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
