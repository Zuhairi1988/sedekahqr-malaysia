const allowedOrigins = new Set([
  'https://zuhairi1988.github.io',
  'http://127.0.0.1:8010',
  'http://localhost:8010'
]);

export const corsHeaders = (request: Request) => {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://zuhairi1988.github.io',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
};

export const jsonResponse = (request: Request, body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders(request), 'Content-Type': 'application/json' } }
);

export const isAllowedOrigin = (request: Request) => {
  const origin = request.headers.get('origin');
  return origin !== null && allowedOrigins.has(origin);
};
