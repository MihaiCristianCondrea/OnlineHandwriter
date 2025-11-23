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
  feature: {
    size: 28,
    padding: 2,
    minComponentArea: 6,
    morphology: {
      open: true,
    },
  },
  scan: {
    maxDim: 800,
    minInkCols: 2,
    colInkFrac: 0.01,
    estCharWidth: 18,
    minInkRows: 2,
    rowInkFrac: 0.008,
    minimaDrop: 0.35,
    minCharWidth: 8,
    minComponentArea: 12,
    morphology: {
      open: true,
    },
  },
  quality: {
    brightMin: 60,
    brightMax: 200,
    minInkPct: 2,
    minEdgeAvg: 6,
  },
};
