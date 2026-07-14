import { getSignatureById, getDefaultSignature } from './db.js';

const FALLBACK_SIGNATURE = 'Ayinla, Tedmark Digital Agency';

export async function resolveSignatureText(signatureId) {
  const signature = signatureId ? await getSignatureById(signatureId) : await getDefaultSignature();
  return signature?.body ?? FALLBACK_SIGNATURE;
}

export function applySignature(promptText, signatureText) {
  return promptText.replaceAll('{{SIGNATURE}}', signatureText);
}
