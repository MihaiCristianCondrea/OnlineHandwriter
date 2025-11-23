export const QUICK_CHARSET = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(''),
  ...'0123456789'.split(''),
  ' '
];

export const CHARSET = [
  ...QUICK_CHARSET,
  'ă','â','î','ș','ț','Ă','Â','Î','Ș','Ț',
  '.',',',';',':','?','!','-','_','(',')','[',']','{','}','/','\\','@','#','$','%','^','&','*','+','=','<','>','~','`','"',"'",',
«','»','“','”','…','—','·',
  '⎵','↵'
];

export const CONFIG = {
  calib: { perChar: 3, squareSize: 128 },
  feature: { size: 28 },
  scan: {
    maxDim: 800,
    avgThrScale: 0.9,
    minInkCols: 2,
    colInkFrac: 0.01,
    estCharWidth: 18,
  },
  quality: {
    brightMin: 60,
    brightMax: 200,
    minInkPct: 2,
    minEdgeAvg: 6,
  },
};
