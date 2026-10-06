import { buildDpsFromJson } from '@useinvio/nfse-sdk';
import { nationalInvoice } from './payloads.js';

const { id, xml } = buildDpsFromJson(nationalInvoice);
console.log(id);
console.log(xml);
