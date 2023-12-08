import { fetch } from "./fetch";
import { idfn, invoke } from "./fn";
import type {
    Arg0,
    OmitStrict
} from "./ts-utils.types";

export function createRpcClient<
    Api extends { [k: string]: (...args: any[]) => Promise<any> }
>(params: OmitStrict<Arg0<typeof fetch>, "method" | "data"> & {
    "transformPayload": <M extends keyof Api>(method: M, data: Arg0<Api[M]>) => any
    "transformResponse"?: (response: any) => any
}) {
    const { transformPayload, transformResponse = idfn } = params

    return new Proxy({} as Api, {
        get(target, method, _) {
            if (typeof method !== "string")
                return Reflect.get(target, method)

            //@ts-expect-error Check how it was done for RMQ
            return target[method as keyof Api] ??= (...args) => invoke(async () => {
                // @ts-ignore
                const { data } = await fetch({
                    ...params,
                    "method": "POST",
                    "data": transformPayload(method, args),
                })

                return transformResponse(data)
            })
        }
    })
}