// Shared pool of demo portrait photos, one CDN face-crop per entry. People
// across the app draw from here: customers and team take one per seed slot,
// and guest reviewers - who have no stored record to carry an image - resolve
// one deterministically from a stable key, so every avatar shows a portrait
// rather than falling back to initials. The list is longer than any single
// roster so a roster can grow without repeating a face, and every URL is a
// verified stock image (see the catalog image audit).
export const FACE_AVATARS = [
  "https://images.unsplash.com/photo-1463453091185-61582044d556?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1517070208541-6ddc4d3efbcb?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1541101767792-f9b2b1c4f127?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1541823709867-1b206113eafd?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1546525848-3ce03ca516f6?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1557862921-37829c790f19?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1583864697784-a0efc8379f70?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1587397845856-e6cf49176c70?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1592621385612-4d7129426394?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1596815064285-45ed8a9c0463?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1610088441520-4352457e7095?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1610216705422-caa3fcb6d158?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1611432579699-484f7990b127?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1611695434398-4f4b330623e6?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1615109398623-88346a601842?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1616805765352-beedbad46b2a?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1618085222100-93f0eecad0aa?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1618835962148-cf177563c6c0?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1620122303020-87ec826cf70d?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1621784563330-caee0b138a00?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1626248801379-51a0748a5f96?w=96&h=96&dpr=2&q=80&fit=crop&crop=faces",
] as const

// Deterministic pick from a stable string key (an email, say): the same key
// always maps to the same face across reloads without persisting one. Not
// cryptographic - just a stable spread over the pool.
export function avatarForKey(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (Math.imul(hash, 31) + key.charCodeAt(i)) | 0
  }
  return FACE_AVATARS[Math.abs(hash) % FACE_AVATARS.length]
}
