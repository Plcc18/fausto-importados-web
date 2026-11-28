// @vitest-environment jsdom
import { useState } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { CampaignType } from "@/lib/campaign/types"
import { ThemeEditor } from "./ThemeEditor"
import { templateTheme } from "./templates"
import type { ThemeDraft } from "./themeDraft"

/** O tema como o formulário guarda: o último valor que o editor entregou. */
let current: ThemeDraft | null

function renderEditor({
  initial = null,
  campaignType = "",
  errors = {},
}: { initial?: ThemeDraft | null; campaignType?: CampaignType | ""; errors?: Record<string, string> } = {}) {
  current = initial
  function Harness() {
    const [theme, setTheme] = useState(initial)
    return (
      <ThemeEditor
        theme={theme}
        campaignType={campaignType}
        errors={errors}
        onChange={(next) => { current = next; setTheme(next) }}
      />
    )
  }
  return render(<Harness />)
}

const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement
const click = (name: string | RegExp) => fireEvent.click(button(name))
const field = (label: string) => screen.getByRole("textbox", { name: new RegExp(`^${label}(\\s*\\(opcional\\))?$`) }) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const previewColor = (variable: string) => screen.getByTestId("theme-preview").style.getPropertyValue(variable)
const confirm = (name: string) => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name }))
const template = () => screen.getByLabelText("Modelo") as HTMLSelectElement

afterEach(cleanup)

describe("começar por um modelo", () => {
  it("sem tema, explica como começar e não mostra os campos", () => {
    renderEditor()

    expect(screen.getByText(/Sem tema\. Escolha um modelo/)).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(template().value).toBe("CUSTOM")
  })

  it("sugere o modelo do tipo da campanha e o aplica", () => {
    renderEditor({ campaignType: "CHRISTMAS" })
    expect(template().value).toBe("CHRISTMAS")

    click("Aplicar modelo")

    expect(current).toEqual(templateTheme("CHRISTMAS"))
    expect(field("Destaque").value).toBe("#B3202A")
    expect(previewColor("--primary")).toBe("#B3202A")
    expect(screen.queryByRole("dialog")).toBeNull() // não havia o que perder
  })

  it("com um tema já montado, pergunta antes de trocar as cores", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })
    fireEvent.change(template(), { target: { value: "EASTER" } })

    click("Aplicar modelo")
    confirm("Cancelar")
    expect(current).toEqual(templateTheme("CHRISTMAS"))

    click("Aplicar modelo")
    confirm("Aplicar")
    expect(current).toEqual(templateTheme("EASTER"))
  })
})

describe("cores", () => {
  it("muda pelo código ou pelo seletor, com a prévia ao vivo", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })

    type("Fundo", "#112233")
    expect(previewColor("--background")).toBe("#112233")
    fireEvent.change(screen.getByLabelText("Destaque: abrir o seletor"), { target: { value: "#abcdef" } })

    expect(field("Destaque").value).toBe("#ABCDEF")
    expect(previewColor("--primary")).toBe("#ABCDEF")
    expect(current!.dark!.primary).toBe("#ABCDEF")
    expect(current!.light).toEqual(templateTheme("CHRISTMAS").light) // o outro modo não muda
  })

  it("restaurar padrão volta o obrigatório à cor da loja e esvazia o opcional", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })

    click("Restaurar padrão: Destaque")
    expect(field("Destaque").value).toBe("#d9bc78")
    expect(button("Restaurar padrão: Destaque").disabled).toBe(true)

    click("Restaurar padrão: Cartões")
    expect(field("Cartões").value).toBe("")
    expect(field("Cartões").placeholder).toBe("Padrão da loja")
    expect(previewColor("--card")).toBe("#121214")
  })

  it("restaura todas as cores do modo, depois de confirmar", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })

    click("Restaurar todas as cores deste modo")
    confirm("Restaurar")

    expect(current!.dark).toMatchObject({ background: "#09090a", primary: "#d9bc78", surface: "", gold: null })
    expect(current!.light).toEqual(templateTheme("CHRISTMAS").light)
  })

  it("personaliza o dourado e volta ao da marca", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })

    click("Personalizar o dourado")
    expect(field("Dourado: tom principal").value).toBe("#d9bc78")
    type("Dourado: tom principal", "#FF0000")
    expect(previewColor("--gold-mid")).toBe("#FF0000")

    click("Usar o dourado da marca")
    expect(current!.dark!.gold).toBeNull()
    expect(previewColor("--gold-mid")).toBe("#d9bc78")
  })

  it("Enter num código de cor não envia o formulário", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })

    // `false` = o navegador não faria o envio implícito
    expect(fireEvent.keyDown(field("Fundo"), { key: "Enter" })).toBe(false)
    expect(fireEvent.keyDown(field("Fundo"), { key: "a" })).toBe(true)
  })

  it("mostra o erro junto da cor", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS"), errors: { "theme.dark.primary": "Use uma cor no formato #RRGGBB." } })

    expect(field("Destaque").getAttribute("aria-invalid")).toBe("true")
    expect(document.getElementById(field("Destaque").getAttribute("aria-describedby")!)!.textContent)
      .toBe("Use uma cor no formato #RRGGBB.")
    expect(button(/^Modo escuro\s*: com erros/)).toBeTruthy()
  })
})

describe("modo claro", () => {
  const darkOnly = (): ThemeDraft => ({ dark: templateTheme("CHRISTMAS").dark, light: null })

  it("é opcional: sem ele a prévia mostra a loja padrão", () => {
    renderEditor({ initial: darkOnly() })

    click(/^Modo claro/)

    expect(screen.getByText("No modo claro, a loja usa o tema padrão.")).toBeTruthy()
    expect(previewColor("--background")).toBe("#f7f3ea")
  })

  it("personalizar parte do modelo escolhido; remover volta ao padrão, depois de confirmar", () => {
    renderEditor({ initial: darkOnly(), campaignType: "CHRISTMAS" })
    click(/^Modo claro/)

    click("Personalizar o modo claro")
    expect(current!.light).toEqual(templateTheme("CHRISTMAS").light)
    expect(previewColor("--background")).toBe("#F8F5EC")

    click("Usar o padrão da loja no modo claro")
    confirm("Remover")
    expect(current).toEqual(darkOnly())
  })

  it("remove o tema inteiro, depois de confirmar", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })

    click("Remover o tema")
    confirm("Remover")

    expect(current).toBeNull()
  })
})

describe("contraste", () => {
  it("avisa quando um texto fica difícil de ler e some quando corrigem", () => {
    renderEditor({ initial: templateTheme("CHRISTMAS") })
    expect(screen.getByText("Contraste adequado neste modo.")).toBeTruthy()

    type("Texto sobre o destaque", "#B3202A") // igual ao destaque

    expect(screen.getByText(/Texto dos botões de destaque: 1:1 \(mínimo 4,5:1\)/)).toBeTruthy()
    expect(button(/^Modo escuro\s*: .*alerta/)).toBeTruthy()
    type("Texto sobre o destaque", "#FFFFFF")
    expect(screen.getByText("Contraste adequado neste modo.")).toBeTruthy()
  })

  it("marca no botão o modo que tem alerta, mesmo escondido", () => {
    const theme = templateTheme("CHRISTMAS")
    theme.light!.foreground = theme.light!.background

    renderEditor({ initial: theme })

    expect(button(/^Modo claro\s*: .*alertas? de contraste/)).toBeTruthy()
    expect(button("Modo escuro")).toBeTruthy()
  })
})
