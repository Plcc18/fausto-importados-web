import { describe, expect, it } from "vitest"
import { aspectRatio, cloudinarySrcSet, cloudinaryUrl } from "./image"
import { isCloudinaryImageUrl } from "./parse"

const BANNER = "https://res.cloudinary.com/fausto/image/upload/v1/campaigns/banner.jpg"
const image = (width: number | null, height: number | null) => ({ url: BANNER, alt: "Banner", width, height })

describe("cloudinaryUrl", () => {
  it("pede formato e qualidade automáticos e uma largura máxima, sem aumentar a original", () => {
    expect(cloudinaryUrl(BANNER, 960)).toBe(
      "https://res.cloudinary.com/fausto/image/upload/f_auto,q_auto,c_limit,w_960/v1/campaigns/banner.jpg",
    )
  })

  it("o resultado continua sendo uma imagem aceita do Cloudinary", () => {
    expect(isCloudinaryImageUrl(cloudinaryUrl(BANNER, 1920))).toBe(true)
  })

  it("entra depois das transformações que a URL já tiver (elas são aplicadas em ordem)", () => {
    const cropped = "https://res.cloudinary.com/fausto/image/upload/c_fill,w_800/e_sharpen/v1/a.jpg"

    expect(cloudinaryUrl(cropped, 480)).toBe(
      "https://res.cloudinary.com/fausto/image/upload/c_fill,w_800/e_sharpen/f_auto,q_auto,c_limit,w_480/v1/a.jpg",
    )
  })

  it("sem versão na URL, entra logo antes do nome do arquivo", () => {
    expect(cloudinaryUrl("https://res.cloudinary.com/demo/image/upload/c_fill,w_1920,h_640/sample.jpg", 960)).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,w_1920,h_640/f_auto,q_auto,c_limit,w_960/sample.jpg",
    )
  })

  it("uma pasta com nome parecido com transformação (bf_2026/) não é confundida com uma", () => {
    expect(cloudinaryUrl("https://res.cloudinary.com/fausto/image/upload/bf_2026/banner.jpg", 480)).toBe(
      "https://res.cloudinary.com/fausto/image/upload/f_auto,q_auto,c_limit,w_480/bf_2026/banner.jpg",
    )
  })

  it("um nome de arquivo parecido com transformação (bf_2026.jpg) não é confundido com uma", () => {
    expect(cloudinaryUrl("https://res.cloudinary.com/fausto/image/upload/bf_2026.jpg", 480)).toBe(
      "https://res.cloudinary.com/fausto/image/upload/f_auto,q_auto,c_limit,w_480/bf_2026.jpg",
    )
  })
})

describe("cloudinarySrcSet", () => {
  it("sem largura conhecida: todas as larguras", () => {
    expect(cloudinarySrcSet(image(null, null), [480, 960]).split(", ")).toEqual([
      `${cloudinaryUrl(BANNER, 480)} 480w`,
      `${cloudinaryUrl(BANNER, 960)} 960w`,
    ])
  })

  it("com largura conhecida: nada maior que a original, e a original como última opção", () => {
    expect(cloudinarySrcSet(image(1200, 400), [960, 1440, 1920]).split(", ")).toEqual([
      `${cloudinaryUrl(BANNER, 960)} 960w`,
      `${cloudinaryUrl(BANNER, 1200)} 1200w`,
    ])
  })

  it("imagem menor que todas as larguras: só a original", () => {
    expect(cloudinarySrcSet(image(300, 300), [480, 960])).toBe(`${cloudinaryUrl(BANNER, 300)} 300w`)
  })
})

describe("aspectRatio", () => {
  it("usa as dimensões reais quando a API as conhece", () => {
    expect(aspectRatio(image(1920, 640), "3 / 1")).toBe("1920 / 640")
  })

  it("sem dimensões, usa a proporção padrão", () => {
    expect(aspectRatio(image(null, 640), "3 / 1")).toBe("3 / 1")
  })
})
