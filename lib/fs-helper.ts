import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';

import { decrypt, encrypt } from './crypto-helper';

const fsp = fs.promises;
const pipeline = promisify(stream.pipeline);

// #region Public Types
export enum FileStatus {
  Unknown,
  NotExists,
  IsFile,
  IsDirectory,
}
// #endregion Public Types

// #region Public Functions
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

export async function writeJsonFile<T>(fileName: string, data: T, space?: number): Promise<void> {
  await fsp.writeFile(fileName, JSON.stringify(data, null, space), { encoding: 'utf8' });
}

export async function readJsonFile<T>(fileName: string): Promise<T> {
  return JSON.parse(await fsp.readFile(fileName, { encoding: 'utf8' })) as T;
}

export async function writeEncryptedJsonFile<T>(fileName: string, data: T): Promise<void> {
  const plaintext = Buffer.from(JSON.stringify(data));
  const encrypted = encrypt(plaintext);
  await fsp.writeFile(fileName, encrypted);
}

export async function readEncryptedJsonFile<T>(fileName: string): Promise<T> {
  const encrypted = await fsp.readFile(fileName);
  const decrypted = decrypt(encrypted);
  return JSON.parse(decrypted.toString('utf8'));
}

export async function writeFromStream(fileName: string, readStream: NodeJS.ReadableStream, overwrite?: boolean) {
  const status = await getFileStatus(fileName);

  switch (status) {
    case FileStatus.NotExists: {
      // Specified file does not exist
      return await pipeline(readStream, fs.createWriteStream(fileName));
    }
    case FileStatus.IsDirectory: {
      // Cannot write to an existing directory with the same path.
      throw (new Error(`Specified fileName ${fileName} exists as a directory and cannot be written to.`));
    }
    case FileStatus.IsFile: {
      if (!overwrite) {
        // Cannot write to an existing file with the same path if overwrite is not specified
        throw (new Error(`Specified fileName ${fileName} exists as a file and was not allowed to be overwritten.`));
      }
      return await pipeline(readStream, fs.createWriteStream(fileName));
    }
    default: {
      // Cannot write to a fileName of unknown status
      throw (new Error(`Specified fileName ${fileName} status is unknown.`));
    }
  }
}

export async function getFileStatus(fileName: string): Promise<FileStatus> {
  try {
    const stat = await fsp.stat(fileName);
    if (stat.isDirectory()) {
      return FileStatus.IsDirectory;
    }
    if (stat.isFile()) {
      return FileStatus.IsFile;
    }
    return FileStatus.Unknown;
  } catch (err) {
    // File does not exist
    return FileStatus.NotExists;
  }
}
// #endregion Public Functions
