import fs from 'fs';

const fsp = fs.promises;

//#region Public Functions
export async function ensureDir(dirName: string) {
  try {
    await fsp.access(dirName, fs.constants.R_OK | fs.constants.W_OK);
    const stat = await fsp.stat(dirName);
    if (!stat.isDirectory() && !stat.isFile()) {
      await fsp.mkdir(dirName);
    }
  } catch (err) {
    console.log(err);
    await fsp.mkdir(dirName);
  }
}

export async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  await fsp.writeFile(fileName, JSON.stringify(data), { encoding: 'utf8' });
}

export async function readJsonFile<T>(fileName: string): Promise<T> {
  return JSON.parse(await fsp.readFile(fileName, { encoding: 'utf8' })) as T;
}
//#endregion Public Functions
