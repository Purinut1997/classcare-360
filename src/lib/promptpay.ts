import QRCode from 'qrcode';

type PromptPayIdentifierType = 'national_id' | 'phone';

interface PromptPayPayloadOptions {
  amount?: number | null;
  identifier: string;
  identifierType: PromptPayIdentifierType;
}

const promptPayAid = 'A000000677010111';

function tlv(id: string, value: string) {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

function crc16CcittFalse(payload: string) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizePromptPayIdentifier(identifier: string, identifierType: PromptPayIdentifierType) {
  const digits = digitsOnly(identifier);

  if (identifierType === 'phone') {
    if (digits.length !== 10 || !digits.startsWith('0')) {
      throw new Error('เบอร์พร้อมเพย์ต้องเป็นเบอร์มือถือไทย 10 หลัก เช่น 0812345678');
    }

    return `0066${digits.slice(1)}`;
  }

  if (digits.length !== 13) {
    throw new Error('เลขบัตร/เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก');
  }

  return digits;
}

export function buildPromptPayPayload({ amount, identifier, identifierType }: PromptPayPayloadOptions) {
  const normalizedIdentifier = normalizePromptPayIdentifier(identifier, identifierType);
  const accountInfo = tlv('00', promptPayAid) + tlv(identifierType === 'phone' ? '01' : '02', normalizedIdentifier);
  const fields = [
    tlv('00', '01'),
    tlv('01', amount && amount > 0 ? '12' : '11'),
    tlv('29', accountInfo),
    tlv('53', '764'),
    tlv('58', 'TH'),
  ];

  if (amount && amount > 0) {
    fields.push(tlv('54', amount.toFixed(2)));
  }

  const payloadWithoutCrc = `${fields.join('')}6304`;
  return `${payloadWithoutCrc}${crc16CcittFalse(payloadWithoutCrc)}`;
}

export async function promptPayPayloadToPngDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    type: 'image/png',
  });
}

export function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mime });
}
