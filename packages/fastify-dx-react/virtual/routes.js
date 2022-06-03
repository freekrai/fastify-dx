import { lazy } from 'react'

export default import.meta.env.SSR
  ? createRoutes(import.meta.globEager('/pages/**/*.jsx'))
  : hydrateRoutes(import.meta.glob('/pages/**/*.jsx'))

async function createRoutes (from, { param } = { param: /\[(\w+)\]/ }) {
  // Otherwise we get a ReferenceError, but since
  // this function is only ran once, there's no overhead
  class Routes extends Array {
    toJSON () {
      return this.map((route) => {
        return {
          id: route.id,
          path: route.path,
          getData: !!route.getData,
          getMeta: !!route.getMeta,
          onEnter: !!route.onEnter,
        }
      })
    }
  }
  const importPaths = Object.keys(from)
  const promises = []
  // Ensure that static routes have precedence over the dynamic ones
  for (const path of importPaths.sort((a, b) => a > b ? -1 : 1)) {
    promises.push(
      getRouteModule(path, from[path])
        .then((routeModule) => {
          return {
            id: path,
            path: path
              // Remove /pages and .jsx extension
              .slice(6, -4)
              // Replace [id] with :id
              .replace(param, (_, m) => `:${m}`)
              // Replace '/index' with '/'
              .replace(/\/index$/, '/'),
            ...routeModule,
          }
        }),
    )
  }
  return new Routes(...await Promise.all(promises))
}

async function hydrateRoutes (from) {
  return window.routes.map((route) => {
    route.loader = memoImport(from[route.id])
    route.component = lazy(() => route.loader())
    return route
  })
}

function getRouteModuleExports (routeModule) {
  return {
    // The Route component (default export)
    component: routeModule.default,
    // Route-level hooks
    getData: routeModule.getData,
    getMeta: routeModule.getMeta,
    onEnter: routeModule.onEnter,
    // Other Route-level settings
    streaming: routeModule.streaming,
    clientOnly: routeModule.clientOnly,
    serverOnly: routeModule.serverOnly,
  }
}

async function getRouteModule (path, routeModule) {
  // const isServer = typeof process !== 'undefined'
  if (typeof routeModule === 'function') {
    routeModule = await routeModule()
    return getRouteModuleExports(routeModule)
  } else {
    return getRouteModuleExports(routeModule)
  }
}

function memoImport (func) {
  // Otherwise we get a ReferenceError, but since this function 
  // is only ran once for each route, there's no overhead
  const kFuncExecuted = Symbol('kFuncExecuted')
  const kFuncValue = Symbol('kFuncValue')
  func[kFuncExecuted] = false
  return async function () {
    if (!func[kFuncExecuted]) {
      func[kFuncValue] = await func()
      func[kFuncExecuted] = true
    }
    return func[kFuncValue]
  }
}