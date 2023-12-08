import { addressPattern } from "./config";

export {
  validateAddress
};

/**
 * @deprecated use contacts
 * @see https://academy.binance.com/uk/articles/what-is-taproot-and-how-it-will-benefit-bitcoin
 * @see https://bitcoin.design/guide/glossary/address/
 */
function validateAddress(address: string) {
  return addressPattern.test(address);
}