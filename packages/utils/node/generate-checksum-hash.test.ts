import { expect, test } from 'vitest';
import { generateChecksumHash } from './generate-checksum-hash.js';

test('Generates checksum hash', () => {
	const checksumHash = generateChecksumHash('This is only a test.');

	expect(checksumHash).toEqual('3d57d0d7d5817e272a533c8ef6e3be9d');
});
