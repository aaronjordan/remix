# fetch-router

A minimal, composable router built on the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`route-pattern`](../route-pattern). Ideal for building APIs, web services, and server-rendered applications across any JavaScript runtime.

## Features

- **Fetch API**: Built on standard web APIs that work everywhere - Node.js, Bun, Deno, Cloudflare Workers, and browsers
- **Type-Safe Routing**: Leverage TypeScript for compile-time route validation and parameter inference
- **Composable Architecture**: Nest routers, combine middleware, and organize routes hierarchically
- **Declarative Route Maps**: Define your entire route structure upfront with type-safe route names and request methods
- **Flexible Middleware**: Apply middleware globally, per-route, or to entire route hierarchies
- **Easy Testing**: Use standard `fetch()` to test your routes - no special test harness required

## Goals

- **Simplicity**: A router should be simple to understand and use. The entire API surface fits in your head.
- **Composability**: Small routers combine to build large applications. Middleware and nested routers make organization natural.
- **Standards-Based**: Built on web standards that work across runtimes. No proprietary APIs or Node.js-specific code.

## Usage

The main purpose of the router is to map incoming requests to route handler functions. The router uses the `fetch()` API to accept a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and return a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).

The example below is a small site with a home page, an "about" page, and a blog.

```ts
import { createRouter, route } from '@remix-run/fetch-router'
import { logger } from '@remix-run/fetch-router/logger-middleware'

// `route()` creates a "route map" that organizes routes by name. The keys
// of the map may be any name, and may be nested to group related routes.
let routes = route({
  home: '/',
  about: '/about',
  blog: {
    index: '/blog',
    show: '/blog/:slug',
  },
})

let router = createRouter()

// Middleware may be used to run code before and/or after route handlers run.
// In this case, the `logger()` middleware will log the request to the console.
router.use(logger())

// Map the routes to "handlers" for each route. The structure of the route
// handlers object mirrors the structure of the route map, with full type safety.
router.map(routes, {
  home() {
    return new Response('Home')
  },
  about() {
    return new Response('About')
  },
  blog: {
    index() {
      return new Response('Blog')
    },
    show({ params }) {
      // params is a type-safe object with the parameters from the route pattern
      return new Response(`Post ${params.slug}`)
    },
  },
})

let response = await router.fetch('https://remix.run/blog/hello-remix')
console.log(await response.text()) // "Post hello-remix"
```

The route map is an object of the same shape as the object pass into `route()`, including nested objects. The leaves of the map are `Route` objects, which you can see if you inspect the type of the `routes` variable in your IDE.

```ts
type Routes = typeof routes
// {
//   home: Route<'ANY', '/'>
//   about: Route<'ANY', '/about'>
//   blog: {
//     index: Route<'ANY', '/blog'>
//     show: Route<'ANY', '/blog/:slug'>
//   },
// }
```

The `routes.home` route is a `Route<'ANY', '/'>`, which means it serves any request method (`GET`, `POST`, `PUT`, `DELETE`, etc.) when the URL path is `/`. We'll discuss [routing based on request method](#routing-based-on-request-method) in detail later. But first, let's talk about navigation.

### Links and Form Actions

In addition to describing the structure of your routes, route maps also make it easy to generate type-safe links and form actions using the `href()` function on a route. The example below is a small site with a home page and a "Contact Us" page.

Note: We're using the [`html` response helper](#response-helpers) below to create `Response`s with `Content-Type: text/html`.

```ts
import { createRouter, route, html } from '@remix-run/fetch-router'

let routes = route({
  home: '/',
  contact: '/contact',
})

let router = createRouter()

// Register a handler for `GET /`
router.get(routes.home, () => {
  return html`
    <html>
      <body>
        <h1>Home</h1>
        <p>
          <a href="${routes.contact.href()}">Contact Us</a>
        </p>
      </body>
    </html>
  `
})

// Register a handler for `GET /contact`
router.get(routes.contact, () => {
  return html`
    <html>
      <body>
        <h1>Contact Us</h1>
        <form method="POST" action="${routes.contact.href()}">
          <div>
            <label for="message">Message</label>
            <input type="text" name="message" />
          </div>
          <button type="submit">Send</button>
        </form>
        <footer>
          <p>
            <a href="${routes.home.href()}">Home</a>
          </p>
        </footer>
      </body>
    </html>
  `
})

// Register a handler for `POST /contact`
router.post(routes.contact, ({ formData }) => {
  // POST handlers receive a `context` object with a `formData` property that
  // contains the `FormData` from the form submission. It is automatically
  // parsed from the request body and available in all POST handlers.
  let message = formData.get('message') as string

  return html`
    <html>
      <body>
        <h1>Thanks!</h1>
        <div>
          <p>You said: ${message}</p>
        </div>
        <footer>
          <p>
            <a href="${routes.home.href()}">Home</a>
          </p>
        </footer>
      </body>
    </html>
  `
})
```

### Routing Based on Request Method

In the example above, both the `home` and `contact` routes are able to be registered for any incoming [`request.method`](https://developer.mozilla.org/en-US/docs/Web/API/Request/method). If you inspect their types, you'll see:

```tsx
type HomeRoute = typeof routes.home // Route<'ANY', '/'>
type ContactRoute = typeof routes.contact // Route<'ANY', '/contact'>
```

We used `router.get()` and `router.post()` to register handlers on each route specifically for the `GET` and `POST` request methods.

However, we can also encode the request method into the route definition itself using the `method` property on the route. When you include the `method` in the route definition, `router.map()` will register the handler only for that specific request method. This can be more convenient than using `router.get()` and `router.post()` to register handlers one at a time.

```ts
import * as assert from 'node:assert/strict'
import { createRouter, route } from '@remix-run/fetch-router'

let routes = route({
  home: { method: 'GET', pattern: '/' },
  contact: {
    index: { method: 'GET', pattern: '/contact' },
    action: { method: 'POST', pattern: '/contact' },
  },
})

type Routes = typeof routes
// Each route is now typed with a specific request method.
// {
//   home: Route<'GET', '/'>,
//   contact: {
//     index: Route<'GET', '/contact'>,
//     action: Route<'POST', '/contact'>,
//   },
// }

let router = createRouter()

router.map(routes, {
  home({ method }) {
    assert.equal(method, 'GET')
    return new Response('Home')
  },
  contact: {
    index({ method }) {
      assert.equal(method, 'GET')
      return new Response('Contact')
    },
    action({ method }) {
      assert.equal(method, 'POST')
      return new Response('Contact Action')
    },
  },
})
```

### Declaring Routes

In additon to the `{ method, pattern }` syntax shown above, the router provides a few shorthand methods that help to eliminate some of the boilerplate when building complex route maps:

- [`formAction`](#declaring-form-routes) - creates a route map with an `index` (`GET`) and `action` (`POST`) route. This is well-suited to showing a standard HTML `<form>` and handling its submit action at the same URL.
- [`resources` (and `resource`)](#resource-based-routes) - creates a route map with a set of resource-based routes, useful when defining RESTful API routes or [Rails-style resource-based routes](https://guides.rubyonrails.org/routing.html#resource-routing-the-rails-default).

#### Declaring Form Routes

Continuing with [the example of the contact page](#routing-based-on-request-method), let's use the `formAction` shorthand to make the route map a little less verbose.

A `formAction()` route map contains two routes: `index` and `action`. The `index` route is a `GET` route that shows the form, and the `action` route is a `POST` route that handles the form submission.

```tsx
import { createRouter, route, formAction, html } from '@remix-run/fetch-router'

let routes = route({
  home: '/',
  contact: formAction('contact'),
})

type Routes = typeof routes
// {
//   home: Route<'ANY', '/'>
//   contact: {
//     index: Route<'GET', '/contact'> - Shows the form
//     action: Route<'POST', '/contact'> - Handles the form submission
//   },
// }

let router = createRouter()

router.map(routes, {
  home() {
    return html`
      <html>
        <body>
          <h1>Home</h1>
          <footer>
            <p>
              <a href="${routes.contact.index.href()}">Contact Us</a>
            </p>
          </footer>
        </body>
      </html>
    `
  },
  contact: {
    // GET /contact - shows the form
    index() {
      return html`
        <html>
          <body>
            <h1>Contact Us</h1>
            <form method="POST" action="${routes.contact.action.href()}">
              <label for="message">Message</label>
              <input type="text" name="message" />
              <button type="submit">Send</button>
            </form>
          </body>
        </html>
      `
    },
    // POST /contact - handles the form submission
    action({ formData }) {
      let message = formData.get('message') as string

      return html`
        <html>
          <body>
            <h1>Thanks!</h1>
            <p>You said: ${message}</p>

            <p>
              Got more to say? <a href="${routes.contact.index.href()}">Send another message</a>
            </p>
          </body>
        </html>
      `
    },
  },
})
```

#### Resource-based Routes

The router provides a `resources()` helper that creates a route map with a set of resource-based routes, useful when defining RESTful API routes or modeling resources in a web application ([similar to Rails' `resources` helper](https://guides.rubyonrails.org/routing.html#resource-routing-the-rails-default)). You can think of "resources" as a way to define routes for a collection of related resources, like products, books, users, etc.

```ts
import { createRouter, route, resources } from '@remix-run/fetch-router'

let routes = route({
  brands: {
    ...resources('brands', { only: ['index', 'show'] }),
    products: resources('brands/:brandId/products', {
      only: ['index', 'show'],
    }),
  },
})

type Routes = typeof routes
// {
//   brands: {
//     index: Route<'GET', '/brands'>
//     show: Route<'GET', '/brands/:id'>
//     products: {
//       index: Route<'GET', '/brands/:brandId/products'>
//       show: Route<'GET', '/brands/:brandId/products/:id'>
//     },
//   },
// }

let router = createRouter()

router.map(routes.brands, {
  // GET /brands
  index() {
    return new Response('Brands Index')
  },
  // GET /brands/:id
  show({ params }) {
    return new Response(`Brand ${params.id}`)
  },
  products: {
    // GET /brands/:brandId/products
    index() {
      return new Response('Products Index')
    },
    // GET /brands/:brandId/products/:id
    show({ params }) {
      return new Response(`Brand ${params.brandId}, Product ${params.id}`)
    },
  },
})
```

The `resource()` helper creates a route map for a single resource (i.e. not something that is part of a collection). This is useful when defining operations on a singleton resource, like a user profile.

```tsx
import { createRouter, route, resources, resource } from '@remix-run/fetch-router'

let routes = route({
  user: {
    ...resources('users', { only: ['index', 'show'] }),
    profile: resource('users/:userId/profile', { only: ['show', 'edit', 'update'] }),
  },
})

type Routes = typeof routes
// {
//   user: {
//     index: Route<'GET', '/users'>
//     show: Route<'GET', '/users/:id'>
//     profile: {
//       show: Route<'GET', '/users/:userId/profile'>
//       edit: Route<'GET', '/users/:userId/profile/edit'>
//       update: Route<'PUT', '/users/:userId/profile'>
//     },
//   },
// }
```

In both of the examples above we used the `only` option to limit the routes generated by `resources()`/`resource()` to only the routes we needed. Without the `only` option, a `resources('users')` route map contains 7 routes: `index`, `new`, `show`, `create`, `edit`, `update`, and `destroy`.

```tsx
let routes = resources('users')
type Routes = typeof routes
// {
//   index: Route<'GET', '/users'> - Lists all users
//   new: Route<'GET', '/users/new'> - Shows a form to create a new user
//   show: Route<'GET', '/users/:id'> - Shows a single user
//   create: Route<'POST', '/users'> - Creates a new user
//   edit: Route<'GET', '/users/:id/edit'> - Shows a form to edit a user
//   update: Route<'PUT', '/users/:id'> - Updates a user
//   destroy: Route<'DELETE', '/users/:id'> - Deletes a user
// }
```

Similarly, a `resource('profile')` route map contains 6 routes: `new`, `show`, `create`, `edit`, `update`, and `destroy`. There is no `index` route because a `resource()` represents a singleton resource, not a collection, so there is no collection view.

```tsx
let routes = resource('profile')
type Routes = typeof routes
// {
//   new: Route<'GET', '/profile/new'> - Shows a form to create the profile
//   show: Route<'GET', '/profile'> - Shows the profile
//   create: Route<'POST', '/profile'> - Creates the profile
//   edit: Route<'GET', '/profile/edit'> - Shows a form to edit the profile
//   update: Route<'PUT', '/profile'> - Updates the profile
//   destroy: Route<'DELETE', '/profile'> - Deletes the profile
// }
```

Resource route names may be customized using the `names` option when you'd prefer not to use the default `index`/`new`/`show`/`create`/`edit`/`update`/`destroy` route names.

```tsx
import { createRouter, route, resources } from '@remix-run/fetch-router'

let routes = route({
  users: resources('users', {
    only: ['index', 'show'],
    names: { index: 'list', show: 'view' },
  }),
})
type Routes = typeof routes.users
// {
//   list: Route<'GET', '/users'> - Lists all users
//   view: Route<'GET', '/users/:id'> - Shows a single user
// }
```

If you want to use a param name other than `id`, you can use the `param` option.

```tsx
import { createRouter, route, resources } from '@remix-run/fetch-router'

let routes = route({
  users: resources('users', {
    only: ['index', 'show', 'edit', 'update'],
    param: 'userId',
  }),
})
type Routes = typeof routes.users
// {
//   index: Route<'GET', '/users'> - Lists all users
//   show: Route<'GET', '/users/:userId'> - Shows a single user
//   edit: Route<'GET', '/users/:userId/edit'> - Shows a form to edit a user
//   update: Route<'PUT', '/users/:userId'> - Updates a user
// }
```

### Route Handlers and Middleware

- request context
- error handling in middleware

### Request Context

Every middleware and request handler receives a `context` object with useful properties:

```ts
router.get('/posts/:id', ({ request, url, params, storage }) => {
  // request: The original Request object
  console.log(request.method) // "GET"
  console.log(request.headers.get('Accept'))

  // url: Parsed URL object
  console.log(url.pathname) // "/posts/123"
  console.log(url.searchParams.get('sort'))

  // params: Route parameters (fully typed!)
  console.log(params.id) // "123"

  // storage: AppStorage for type-safe access to request-scoped data
  storage.set('user', currentUser)

  return new Response(`Post ${params.id}`)
})
```

### Additional Topics

#### Scaling Your Application

- how to use a TrieMatcher
- how to spread route handlers across multiple files
- use `mount` to mount sub-routers at a specific path

#### Error Handling and Aborted Requests

- wrap `router.fetch()` in a try/catch to handle errors
- `AbortError` is thrown when a request is aborted

#### Request Method Override

- use a `_method` hidden input to override the request method
- use the router's `methodOverride` option to enable/disable request method override

#### Content Negotiation

- use `headers.accept.accepts()` to serve different responses based on the client's `Accept` header
  - maybe put this on `context.accepts()` for convenience?

#### Sessions

- use a custom `sessionStorage` implementation to store session data
- use `session.get()` and `session.set()` to get and set session data
- use `session.flash()` to set a flash message
- use `session.destroy()` to destroy the session

#### Handling File Uploads

- use the `formData` property of the context object to access the form data
- use the `files` property of the context object to access the uploaded files
- use the router's `uploadHandler` option to handle file uploads

### Response Helpers

The router provides a few response helpers that make it easy to return responses with common formats:

- `html(body, init?)` - returns a `Response` with `Content-Type: text/html`
- `json(data, init?)` - returns a `Response` with `Content-Type: application/json`
- `redirect(location, init?)` - returns a `Response` with `Location` header

These helpers are provided for consistency between different JavaScript runtime environments and also help fill in the gaps when working with standard web APIs like `Response.redirect()`.

#### Working with HTML

The `html` helper supports sending HTML from any type supported by the `Response` constructor including strings, `ReadableStream`, `File`, `Blob`, and more.

When working with HTML strings, the `html` helper supports tagged template literals and `html.raw()` for inserting raw (safe) HTML into a response.

```ts
import { html } from '@remix-run/fetch-router'

let unsafe = '<script>alert(1)</script>'

// Use the tagged template literal form to escape the HTML and create a Response.
let response = html`<h1>${unsafe}</h1>`

// If you need to use a response init for custom status, headers, etc., use `html.esc`
// to escape the HTML and the `html()` helper to create the Response.
let response = html(html.esc`<h1>${unsafe}</h1>`, { status: 400 })

// If you have safe HTML to insert into a response, use `html.raw()` to insert it directly.
let icon = html.raw('<b>OK</b>')
let response = html`<div>${icon}</div>` // Inserts raw (safe) HTML into a Response
```

### Testing

Testing is straightforward because `fetch-router` uses the standard `fetch()` API:

```ts
import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('blog routes', () => {
  it('creates a new post', async () => {
    let response = await router.fetch('https://api.remix.run/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hello', content: 'World' }),
    })

    assert.equal(response.status, 201)
    let post = await response.json()
    assert.equal(post.title, 'Hello')
  })

  it('returns 404 for missing posts', async () => {
    let response = await router.fetch('https://api.remix.run/posts/not-found')
    assert.equal(response.status, 404)
  })
})
```

No special test harness or mocking required! Just use `fetch()` like you would in production.

## Related Work

- [@remix-run/headers](../headers) - A library for working with HTTP headers
- [@remix-run/form-data-parser](../form-data-parser) - A library for parsing multipart/form-data requests
- [@remix-run/route-pattern](../route-pattern) - The pattern matching library that powers `fetch-router`
- [Express](https://expressjs.com/) - The classic Node.js web framework

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
