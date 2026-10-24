import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { HOST_PASSWORD } from "./support/env";
import { hostCode } from "./support/host";

async function fillLogin(page: Page, password: string, code: string) {
  await page.goto("/anfitrion");
  await page.getByLabel("Contraseña").fill(password);
  await page.getByLabel("Código de 6 dígitos").fill(code);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("el anfitrión entra con su contraseña y su código y crea una invitación", async ({ page }) => {
  await fillLogin(page, HOST_PASSWORD, hostCode());
  await expect(page.getByRole("heading", { name: "Panel del anfitrión" })).toBeVisible();

  await page.getByPlaceholder("Para quién es (opcional)").fill("Tía Marta");
  await page.getByRole("button", { name: "Crear invitación" }).click();
  await expect(page.getByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)).toBeVisible();
});

test("con una contraseña equivocada no entra", async ({ page }) => {
  await fillLogin(page, "no-es-la-contraseña", hostCode());
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Panel del anfitrión" })).toHaveCount(0);
});
