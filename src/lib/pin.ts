/** PIN nuevo o cambiado: exactamente 6 dígitos (el servidor también lo exige). */
export function pinNuevoValido(pin: string): boolean {
  return /^[0-9]{6}$/.test(pin);
}

/** Para entrar: 4 a 6 dígitos, porque los PIN anteriores pueden tener 4 hasta que Admin los cambie. */
export function pinIngresoValido(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin);
}
