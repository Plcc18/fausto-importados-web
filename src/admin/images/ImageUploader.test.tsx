// @vitest-environment jsdom
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ImageUploader } from "./ImageUploader"
import { MAX_IMAGE_BYTES, type ImageKind, type UploadedImage } from "./upload"
import { API_URL } from "@/lib/api"
import { authClient } from "@/lib/auth"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const URL_NEW = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/nova.webp"
const URL_OLD = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/antiga.webp"

let fetchMock: ReturnType<typeof vi.fn>
/** Respostas dos próximos envios. */
let answers: (() => Response | Promise<Response>)[]

const uploads = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/upload"))
const file = (name = "banner.webp", type = "image/webp", size = 10) =>
  new File([new Uint8Array(size)], name, { type })

/** Uma tela com o campo, guardando o valor como um formulário faria. */
function Field({
  label = "Imagem",
  kind = "campaign",
  initial = "",
  onImage,
  onUploading,
}: {
  label?: string
  kind?: ImageKind
  initial?: string
  onImage?: (image: UploadedImage | null) => void
  onUploading?: (uploading: boolean) => void
}) {
  const [url, setUrl] = useState(initial)
  return (
    <ImageUploader
      label={label}
      kind={kind}
      value={url}
      previewAlt={`Prévia de ${label}`}
      onUploadingChange={onUploading}
      onChange={(image) => { setUrl(image?.url ?? ""); onImage?.(image) }}
    />
  )
}

const group = (label = "Imagem") => screen.getByRole("group", { name: label })
const preview = (label = "Imagem") => screen.queryByRole("img", { name: `Prévia de ${label}` }) as HTMLImageElement | null
const choose = (chosen: File, label = "Imagem") =>
  fireEvent.change(within(group(label)).getByTestId("image-input"), { target: { files: [chosen] } })
const dropOn = (target: Element, dropped: File) => fireEvent.drop(target, { dataTransfer: { files: [dropped] } })
const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement

/** Segura a próxima resposta até o teste liberar. */
function hold() {
  let finish!: (res: Response) => void
  answers.push(() => new Promise<Response>((resolve) => { finish = resolve }))
  return (res: Response) => finish(res)
}

beforeEach(async () => {
  localStorage.clear()
  answers = []
  fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/auth/login")) return json({ status: "AUTHENTICATED", accessToken: "access-1", expiresIn: 900 })
    const next = answers.shift()
    return next ? next() : json({ url: URL_NEW, width: 1920, height: 640 })
  })
  vi.stubGlobal("fetch", fetchMock)
  URL.createObjectURL = vi.fn(() => "blob:previa")
  URL.revokeObjectURL = vi.fn()
  await authClient.login("dono@loja.com", "x")
})

afterEach(() => {
  cleanup()
  authClient.dispose()
  vi.unstubAllGlobals()
})

describe("envio", () => {
  it.each([
    ["campaign", `${API_URL}/api/upload?folder=campaigns`, "file"],
    ["product", `${API_URL}/api/upload`, "image"],
  ] as const)("de %s usa o endereço e o campo certos, autenticado", async (kind, url, field) => {
    const onImage = vi.fn()
    render(<Field kind={kind} onImage={onImage} />)

    choose(file())

    await waitFor(() => expect(onImage).toHaveBeenCalled())
    const [called, init] = uploads()[0]
    expect(called).toBe(url)
    expect(((init as RequestInit).body as FormData).get(field)).toBeInstanceOf(File)
    expect(new Headers((init as RequestInit).headers).get("Authorization")).toBe("Bearer access-1")
    expect(onImage).toHaveBeenCalledWith({ url: URL_NEW, width: 1920, height: 640 })
    expect(preview()!.getAttribute("src")).toBe(URL_NEW)
  })

  it("o upload de produtos, que só devolve o endereço, fica sem dimensões", async () => {
    answers = [() => json({ url: URL_NEW })]
    const onImage = vi.fn()
    render(<Field kind="product" onImage={onImage} />)

    choose(file())

    await waitFor(() => expect(onImage).toHaveBeenCalledWith({ url: URL_NEW, width: null, height: null }))
  })

  it("aceita a imagem arrastada, no campo vazio e por cima da atual", async () => {
    render(<Field />)
    dropOn(button(/Arraste ou clique/), file())
    await waitFor(() => expect(preview()!.getAttribute("src")).toBe(URL_NEW))

    dropOn(preview()!, file("outra.png", "image/png"))

    await waitFor(() => expect(uploads()).toHaveLength(2))
  })

  it("mostra o arquivo enquanto sobe, bloqueia os botões e avisa quem acompanha", async () => {
    const finish = hold()
    const onUploading = vi.fn()
    render(<Field initial={URL_OLD} onUploading={onUploading} />)

    choose(file())

    await waitFor(() => expect(preview()!.getAttribute("src")).toBe("blob:previa"))
    expect(screen.getByRole("status").textContent).toBe("Enviando imagem...")
    expect(button("Trocar imagem: Imagem").disabled).toBe(true)
    expect(button("Remover imagem: Imagem").disabled).toBe(true)
    expect(onUploading.mock.calls).toEqual([[true]])
    finish(json({ url: URL_NEW }))
    await waitFor(() => expect(onUploading.mock.calls).toEqual([[true], [false]]))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa")
  })

  it("remove a imagem", () => {
    const onImage = vi.fn()
    render(<Field initial={URL_OLD} onImage={onImage} />)

    fireEvent.click(button("Remover imagem: Imagem"))

    expect(onImage).toHaveBeenCalledWith(null)
    expect(preview()).toBeNull()
    expect(button(/Arraste ou clique/)).toBeTruthy()
  })

  it("avisa quando o navegador não consegue mostrar a imagem", () => {
    render(<Field initial={URL_OLD} />)

    fireEvent.error(preview()!)

    expect(screen.getByText("Não foi possível mostrar esta imagem.")).toBeTruthy()
  })
})

describe("recusas", () => {
  it.each([
    ["campaign", file("a.svg", "image/svg+xml"), "Use uma imagem JPEG, PNG ou WebP."],
    ["campaign", file("a.gif", "image/gif"), "Use uma imagem JPEG, PNG ou WebP."],
    ["product", file("a.pdf", "application/pdf"), "Apenas imagens são permitidas."],
    ["campaign", file("vazia.png", "image/png", 0), "O arquivo está vazio."],
    ["campaign", file("grande.png", "image/png", MAX_IMAGE_BYTES + 1), "A imagem passa de 5 MB."],
    ["product", file("grande.png", "image/png", MAX_IMAGE_BYTES + 1), "A imagem passa de 5 MB."],
  ] as const)("em %s, recusa %o antes de enviar", (kind, chosen, message) => {
    render(<Field kind={kind} />)

    choose(chosen)

    expect(screen.getByRole("alert").textContent).toBe(message)
    expect(uploads()).toHaveLength(0)
  })

  it("aceita exatamente 5 MB", async () => {
    render(<Field />)
    choose(file("limite.png", "image/png", MAX_IMAGE_BYTES))
    await waitFor(() => expect(uploads()).toHaveLength(1))
  })

  it.each([
    [413, { code: "file_too_large" }, "A imagem passa de 5 MB."],
    [400, { code: "validation_failed", fields: [{ field: "file", message: "A imagem está corrompida." }] }, "A imagem está corrompida."],
    [502, { code: "upload_failed" }, "O serviço de imagens não recebeu o arquivo. Tente novamente."],
    [500, "Erro no upload", "Não foi possível enviar a imagem. Tente novamente."],
    [200, { semUrl: true }, "Não foi possível enviar a imagem. Tente novamente."],
  ])("resposta %i %o: explica e mantém a imagem anterior", async (status, body, message) => {
    answers = [() => json(body, status)]
    const onImage = vi.fn()
    render(<Field initial={URL_OLD} onImage={onImage} />)

    choose(file())

    expect((await screen.findByRole("alert")).textContent).toBe(message)
    expect(preview()!.getAttribute("src")).toBe(URL_OLD)
    expect(onImage).not.toHaveBeenCalled()
    expect(button("Trocar imagem: Imagem").disabled).toBe(false)
  })

  it("sem conexão, avisa; a tentativa seguinte limpa o aviso", async () => {
    answers = [() => { throw new TypeError("Failed to fetch") }]
    render(<Field />)
    choose(file())
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível enviar")

    choose(file())

    await waitFor(() => expect(preview()).toBeTruthy())
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("num formulário bloqueado, arrastar não envia", () => {
    render(<fieldset disabled><Field /></fieldset>)

    dropOn(button(/Arraste ou clique/), file())

    expect(uploads()).toHaveLength(0)
  })
})

describe("vários campos e telas que fecham", () => {
  it("dois campos na mesma tela não se confundem", async () => {
    const desktop = vi.fn()
    const mobile = vi.fn()
    render(<><Field label="Computador" onImage={desktop} /><Field label="Celular" onImage={mobile} /></>)
    const inputs = screen.getAllByTestId("image-input")
    expect(inputs).toHaveLength(2)

    choose(file(), "Celular")

    await waitFor(() => expect(mobile).toHaveBeenCalled())
    expect(desktop).not.toHaveBeenCalled()
    expect(preview("Computador")).toBeNull()
    // nenhum identificador repetido na tela
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("fechado no meio do envio, ignora o resultado e avisa que o envio acabou", async () => {
    const finish = hold()
    const onImage = vi.fn()
    const onUploading = vi.fn()
    const view = render(<Field onImage={onImage} onUploading={onUploading} />)
    choose(file())
    await waitFor(() => expect(uploads()).toHaveLength(1))

    view.unmount()
    finish(json({ url: URL_NEW }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onImage).not.toHaveBeenCalled()
    expect(onUploading.mock.calls).toEqual([[true], [false]])
  })

  it("entrega o resultado à função mais recente do formulário", async () => {
    const finish = hold()
    const first = vi.fn()
    const second = vi.fn()
    const view = render(<Field onImage={first} />)
    choose(file())
    await waitFor(() => expect(uploads()).toHaveLength(1))

    view.rerender(<Field onImage={second} />)
    finish(json({ url: URL_NEW }))

    await waitFor(() => expect(second).toHaveBeenCalled())
    expect(first).not.toHaveBeenCalled()
  })
})
