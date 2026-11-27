// Fill links with complete https:// URLs. Empty values stay off the page.
// Set SITE to the public origin (https://your-domain.example) for absolute social images.
window.DUK_CONFIG = {
  CA: 'DG2EJSEtPBge5F7zBCTZG78p27LTCiq8tUkJ39qupump',
  X: 'https://x.com/justdukfun',
  INSTAGRAM: 'https://www.instagram.com/justdukfun/',
  X_LIST: '', // x list of members curated by @justdukfun; hidden when empty
  // telegram sticker packs (stickers2/TELEGRAM.md). 'packs' = the stickers.html pack ids each one holds.
  TELEGRAM_STICKERS: [
    { name: 'just duk.', url: 'https://t.me/addstickers/justduk', packs: ['react'] },
    { name: 'duk daily.', url: 'https://t.me/addstickers/dukdaily', packs: ['daily'] },
    { name: 'duk trenches.', url: 'https://t.me/addstickers/duktrench', packs: ['trench'] },
    { name: 'duk moves (animated)', url: 'https://t.me/addstickers/dukmoves', packs: ['motion_a', 'motion_b'] }
  ],
  POND: '', // community site (on hold). when set, the pond tab and [data-pond-only] sections appear
  CULT_API: '', // pond read api (on hold); nothing on the site reads it yet
  DUK_HOUR_UTC: '21:00', // daily ritual; header countdown flips to "duk hour. say duk." for 10 minutes
  PUMP: 'https://pump.fun/coin/DG2EJSEtPBge5F7zBCTZG78p27LTCiq8tUkJ39qupump',
  DEX: 'https://dexscreener.com/solana/DG2EJSEtPBge5F7zBCTZG78p27LTCiq8tUkJ39qupump',
  SITE: 'https://duk.fun',
  KEEPER_URL: 'https://keeper-production-90ba5543.up.railway.app', // public keeper origin; /log supplies pool totals and burn transactions.
  memes: [
    { src: 'assets/memes/duk.png', title: 'just duk.', alt: 'a red chart falls. duk is already on the floor.' },
    { src: 'assets/memes/pfp.png', title: 'the face.', alt: 'duk staring blankly. huge orange bill. no thoughts.' }
  ]
};
