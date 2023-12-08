import { urlBuild } from "./url";

export { arangoUrl };

function arangoUrl({
  protocol,
  user,
  pass,
  host,
  port
}: {
  "host": string,
  "user": string,
  "pass": string
} & Partial<{
  "protocol": string,
  "port": string|number
}>) {
  return urlBuild({
    "protocol": protocol || "http",
    user,
    pass,
    host,
    port  
  })
}
