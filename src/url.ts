import { isEmptyObject } from "./assoc"

export 

function urlBuild({
  protocol,
  user,
  pass,
  host,
  port,
  path,
  search,
}: Partial<{
  "protocol": true|string
  "host": string
  "port": string|number
  "user": string
  "pass": string
  "path": string
  "search": ConstructorParameters<typeof URLSearchParams>[0]
}>) {
    const uri = `${
      !protocol ? ""
      : `${
        protocol === true ? ""
        : `${protocol}:`
      }//`
    }${
      !user ? ""
      : `${user}${
        !pass ? ""
        : `:${pass}`
      }@`
    }${
      host ? host
      : !protocol && !user && !port ? ""
      : "localhost"
    }${
      !port ? "" : `:${port}`
    }`
    , q = search
    && (typeof search !== "object" || !isEmptyObject(search))
    && new URLSearchParams(search)

    return `${uri}${
      !path ? "" : `/${path}`
    }${
      !q ? "" : `?${q}` 
    }`
}