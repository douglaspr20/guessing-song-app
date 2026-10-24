import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { createInvite } from "./support/invite";

const PASSWORD = "una frase larga de prueba";

async function openInviteForm(page: Page, invite: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Tengo una invitación" }).click();
  await page.getByLabel("Código de invitación").fill(invite);
}

async function register(page: Page, username: string) {
  await page.getByLabel("Usuario").fill(username);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

test("un miembro se registra con una invitación, sale y vuelve a entrar", async ({ page }) => {
  await openInviteForm(page, await createInvite());
  await register(page, "marta");
  await expect(page.getByRole("heading", { name: "Tu estantería" })).toBeVisible();

  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jugar sin cuenta" })).toBeVisible();

  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("Usuario").fill("marta");
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Tu estantería" })).toBeVisible();
});

test("una invitación que ya se usó no sirve", async ({ page }) => {
  const invite = await createInvite("ZYXWVTSRQPNM");

  await openInviteForm(page, invite);
  await register(page, "primera");
  await expect(page.getByRole("heading", { name: "Tu estantería" })).toBeVisible();
  await page.context().clearCookies();

  await openInviteForm(page, invite);
  await register(page, "segunda");
  await expect(page.getByRole("alert")).toBeVisible();
});
