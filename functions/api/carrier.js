// Thai mobile/landline carrier lookup by number prefix.
// Prefix indicates the original issuing network; numbers may have been ported.

const CARRIER_LABELS = {
  ais: 'AIS',
  true: 'ทรู',
  dtac: 'ดีแทค',
  nt: 'NT',
  shared: 'หลายค่าย',
  landline: 'เบอร์บ้าน/สำนักงาน',
  unknown: 'ไม่ทราบค่าย'
};

// First 3 digits (including leading 0) -> carrier id
const PREFIX_MAP = {
  '060': 'true',
  '061': 'ais',
  '062': 'true',
  '063': 'ais',
  '064': 'true',
  '065': 'ais',
  '066': 'dtac',
  '067': 'dtac',
  '068': 'nt',
  '069': 'dtac',
  '080': 'shared',
  '081': 'ais',
  '082': 'ais',
  '083': 'true',
  '084': 'ais',
  '085': 'dtac',
  '086': 'true',
  '087': 'dtac',
  '088': 'true',
  '089': 'true',
  '090': 'dtac',
  '091': 'true',
  '092': 'ais',
  '093': 'ais',
  '094': 'dtac',
  '095': 'true',
  '096': 'true',
  '097': 'true',
  '098': 'ais',
  '099': 'ais'
};

export function normalizeThaiNumber(number) {
  let digits = String(number || '').replace(/\D/g, '');
  if (digits.startsWith('66')) digits = '0' + digits.slice(2);
  if (digits.length === 9 && !digits.startsWith('0')) digits = '0' + digits;
  return digits;
}

export function identifyCarrier(number) {
  const digits = normalizeThaiNumber(number);

  if (digits.length < 9 || digits.length > 10 || !digits.startsWith('0')) {
    return { carrier: null, carrierLabel: null, networkType: null };
  }

  const prefix2 = digits.slice(0, 2);
  const prefix3 = digits.slice(0, 3);

  // Bangkok (02) and provincial landlines (03x–07x, excluding mobile 06x/08x/09x)
  if (prefix2 === '02' || /^0[3-57]/.test(prefix3)) {
    return {
      carrier: 'landline',
      carrierLabel: CARRIER_LABELS.landline,
      networkType: 'landline'
    };
  }

  const carrier = PREFIX_MAP[prefix3];
  if (carrier) {
    return {
      carrier,
      carrierLabel: CARRIER_LABELS[carrier],
      networkType: 'mobile'
    };
  }

  return {
    carrier: 'unknown',
    carrierLabel: CARRIER_LABELS.unknown,
    networkType: 'unknown'
  };
}
