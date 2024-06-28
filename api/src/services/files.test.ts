import { Readable } from 'node:stream';
import { StorageManager } from '@directus/storage';
import { InvalidPayloadError } from '@directus/errors';
import type { Knex } from 'knex';
import knex from 'knex';
import { createTracker, MockClient, Tracker } from 'knex-mock-client';
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type MockedFunction,
	type MockInstance,
} from 'vitest';
import { FilesService, ItemsService } from './index.js';
import { _cache } from '../storage/index.js';

vi.mock('@directus/storage');

vi.mock('../../src/database/index', () => ({
	getDatabaseClient: vi.fn().mockReturnValue('postgres'),
}));

vi.mock('../database/helpers/index', () => ({
	getHelpers: vi.fn().mockImplementation(() => ({
		date: {
			writeTimestamp: vi.fn().mockReturnValue(new Date('2024-06-28T14:00:00.000Z')),
		},
	})),
}));

describe('Integration Tests', () => {
	let db: MockedFunction<Knex>;
	let tracker: Tracker;

	beforeAll(() => {
		db = vi.mocked(knex.default({ client: MockClient }));
		tracker = createTracker(db);
	});

	afterEach(() => {
		tracker.reset();
		vi.clearAllMocks();
	});

	describe('Services / Files', () => {
		describe('createOne', () => {
			let service: FilesService;
			let superCreateOne: MockInstance;

			beforeEach(() => {
				service = new FilesService({
					knex: db,
					schema: { collections: {}, relations: [] },
				});

				superCreateOne = vi.spyOn(ItemsService.prototype, 'createOne').mockReturnValue(Promise.resolve(1));
			});

			it('throws InvalidPayloadError when "type" is not provided', async () => {
				try {
					await service.createOne({
						title: 'Test File',
						storage: 'local',
						filename_download: 'test_file',
					});
				} catch (err: any) {
					expect(err).toBeInstanceOf(InvalidPayloadError);
					expect(err.message).toBe('Invalid payload. "type" is required.');
				}

				expect(superCreateOne).not.toHaveBeenCalled();
			});

			it('creates a file entry when "type" is provided', async () => {
				await service.createOne({
					title: 'Test File',
					storage: 'local',
					filename_download: 'test_file',
					type: 'application/octet-stream',
				});

				expect(superCreateOne).toHaveBeenCalled();
			});
		});

		describe('uploadOne', () => {
			let service: FilesService;
			let superUploadOne: MockInstance;
			let superUpdateOne: MockInstance;
			let superGetMetadata: MockInstance;
			let mockStorage: StorageManager;

			const mockAsyncIterator = {
				async *[Symbol.asyncIterator]() {
					yield* await Promise.resolve([]);
				},
			};

			const mockFileData = {
				id: 'test_image_id',
				storage: 'local',
				filename_disk: 'test_image_id.png',
				filename_download: 'test_image.png',
				title: 'Test Image',
				type: 'image/png',
				folder: null,
				hash: '098f6bcd4621d373cade4e832627b4f6',
			};

			beforeEach(() => {
				service = new FilesService({
					knex: db,
					schema: {
						collections: {},
						relations: [],
					},
				});

				mockStorage = {
					registerDriver: vi.fn(),
					registerLocation: vi.fn(),
					location: vi.fn(() => ({
						write: vi.fn(),
						stat: vi.fn().mockReturnValue({
							size: 200,
							modified: '2024-06-14T23:59:59.001Z',
						}),
						read: vi.fn((value) => Readable.from(value)),
						list: vi.fn().mockReturnValue(mockAsyncIterator),
						move: vi.fn(),
					})),
				} as unknown as StorageManager;

				_cache.storage = mockStorage;

				vi.mocked(StorageManager).mockReturnValue(mockStorage);

				superGetMetadata = vi.spyOn(FilesService.prototype, 'getMetadata').mockResolvedValue({
					height: 100,
					width: 100,
					description: null,
					title: null,
					tags: null,
					metadata: {},
				});

				superUploadOne = vi.spyOn(FilesService.prototype, 'uploadOne');
				superUpdateOne = vi.spyOn(ItemsService.prototype, 'updateOne').mockResolvedValue(1);
			});

			it('should update the file `hash`, `filename_download`, & `filename_disk` if primary key exists', async () => {
				tracker.on.select('select "storage_default_folder" from "directus_settings"').response([]);

				tracker.on
					.select(
						'select "folder", "filename_download", "filename_disk", "title", "description", "metadata", "hash" from "directus_files" where "id" = ?',
					)
					.response(mockFileData);

				const readableData = Readable.from('test_image.jpeg', { encoding: 'utf8' });

				await service.uploadOne(
					readableData,
					{
						storage: 'local',
						type: 'image/jpeg',
						filename_download: 'test_image',
						filename_disk: 'test_image.jpeg',
						title: 'Test Image',
					},
					'test_image_id',
				);

				expect(superUploadOne).toHaveBeenCalled();
				expect(superGetMetadata).toHaveBeenCalled();

				expect(superUpdateOne).toHaveBeenCalledWith(
					'test_image_id',
					expect.objectContaining({
						...mockFileData,
						filesize: 200,
						height: 100,
						width: 100,
						metadata: {},
						type: 'image/jpeg',
						filename_download: 'test_image.jpeg',
						filename_disk: 'test_image.jpeg',
						hash: '748b1e867b4a45b5b07003dce0e5081e',
					}),
					expect.objectContaining({
						emitEvents: false,
					}),
				);
			});

			it('should not update file `hash` if primary key does not exist', async () => {
				tracker.on.select('select "storage_default_folder" from "directus_settings"').response([]);

				tracker.on
					.select(
						'select "folder", "filename_download", "filename_disk", "title", "description", "metadata", "hash" from "directus_files" where "id" = ?',
					)
					.response(null);

				const readableData = Readable.from('test_image.png', { encoding: 'utf8' });

				await service.uploadOne(readableData, {
					storage: 'local',
					type: 'image/png',
					filename_download: 'test_image',
					title: 'Test Image',
				});

				expect(superUploadOne).toHaveBeenCalled();
				expect(superGetMetadata).toHaveBeenCalled();

				expect(superUpdateOne).toHaveBeenCalledWith(
					1,
					expect.objectContaining({
						storage: 'local',
						filename_download: 'test_image.png',
						title: 'Test Image',
						type: 'image/png',
						filename_disk: '1.png',
						filesize: 200,
						height: 100,
						width: 100,
						metadata: {},
						hash: '4a47a0db6e60853dedfcfdf08a5ca249',
					}),
					expect.objectContaining({
						emitEvents: false,
					}),
				);
			});

			it('should use default filename_disk if filename_disk is not supplied', async () => {
				tracker.on.select('select "storage_default_folder" from "directus_settings"').response([]);

				const readableData = Readable.from('test_image.png', { encoding: 'utf8' });

				await service.uploadOne(readableData, {
					storage: 'local',
					type: 'image/png',
					filename_download: 'test_image.png',
					title: 'Test Image',
				});

				expect(superUploadOne).toHaveBeenCalled();
				expect(superGetMetadata).toHaveBeenCalled();

				expect(superUpdateOne).toHaveBeenCalledWith(
					1,
					expect.objectContaining({
						storage: 'local',
						filename_download: 'test_image.png',
						title: 'Test Image',
						type: 'image/png',
						filename_disk: '1.png',
						filesize: 200,
						height: 100,
						width: 100,
						metadata: {},
						hash: '4a47a0db6e60853dedfcfdf08a5ca249',
					}),
					expect.objectContaining({
						emitEvents: false,
					}),
				);
			});

			it('should use supplied filename_disk', async () => {
				tracker.on.select('select "storage_default_folder" from "directus_settings"').response([]);

				const readableData = Readable.from('test_image.png', { encoding: 'utf8' });

				await service.uploadOne(readableData, {
					storage: 'local',
					type: 'image/png',
					filename_download: 'test_image.png',
					filename_disk: 'test_image.png',
					title: 'Test Image',
				});

				expect(superUploadOne).toHaveBeenCalled();
				expect(superGetMetadata).toHaveBeenCalled();

				expect(superUpdateOne).toHaveBeenCalledWith(
					1,
					expect.objectContaining({
						storage: 'local',
						filename_download: 'test_image.png',
						title: 'Test Image',
						type: 'image/png',
						filename_disk: 'test_image.png',
						filesize: 200,
						height: 100,
						width: 100,
						metadata: {},
						hash: '91594c5b277f1588749f2f2a63c3480a',
					}),
					expect.objectContaining({
						emitEvents: false,
					}),
				);
			});
		});
	});
});
