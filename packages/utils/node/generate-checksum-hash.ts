import { createHash } from 'node:crypto';

export const generateChecksumHash = (data: string) => createHash('md5').update(data).digest('hex');
