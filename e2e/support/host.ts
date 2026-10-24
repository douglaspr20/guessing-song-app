import { base32Decode, hotp, totpCounter } from "../../src/lib/access/totp";
import { HOST_TOTP_SECRET } from "./env";

/** Código de 6 cifras que daría la app autenticadora del anfitrión de pruebas. */
export function hostCode(nowMs = Date.now()): string {
  return hotp(base32Decode(HOST_TOTP_SECRET), totpCounter(nowMs));
}
