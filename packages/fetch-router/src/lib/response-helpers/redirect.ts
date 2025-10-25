/**
 * A helper for working with redirect [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.
 *
 * @param location The location to redirect to.
 * @param init (optional) The `ResponseInit` object for the response (or a status code).
 * @returns A `Response` object with a redirect header.
 */
export function redirect(location: string | URL, init?: ResponseInit | number): Response {
  let status = 302
  if (typeof init === 'number') {
    status = init
    init = undefined
  }

  let headers = new Headers(init?.headers)
  if (!headers.has('Location')) {
    headers.set('Location', typeof location === 'string' ? location : location.toString())
  }

  return new Response(null, { status, ...init, headers })
}
