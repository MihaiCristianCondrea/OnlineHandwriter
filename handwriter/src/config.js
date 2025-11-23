export const CHARSET = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(''),
  'ă','â','î','ș','ț','Ă','Â','Î','Ș','Ț',
  ...'0123456789'.split(''),
  '.',',',';',':','?','!','-','_','(',')','[',']','{','}','/','\\','@','#','$','%','^','&','*','+','=','<','>','~','`','"',"'",'«','»','“','”','…','—','·',
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
};
