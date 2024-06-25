import api from '@/api';
import type { GlobalMountOptions } from '@/__utils__/types';
import { mount } from '@vue/test-utils';
import { expect, test, beforeEach, vi, describe } from 'vitest';
import { createI18n } from 'vue-i18n';
import { Tooltip } from '../__utils__/tooltip';
import { createTestingPinia } from '@pinia/testing';
import { setActivePinia } from 'pinia';

import VUpload from './v-upload.vue';

const i18n = createI18n({
	legacy: false,
	messages: {
		'en-US': {
			click_to_browse: 'Click to Browse',
			drag_file_here: 'Drag & Drop a File Here',
			import_from_url: 'Import File from URL',
			folders: 'Folders',
		},
	},
});

const global: GlobalMountOptions = {
	stubs: [
		'v-icon',
		'v-progress-linear',
		'v-card-title',
		'v-input',
		'v-card-text',
		'v-card-actions',
		'v-card',
		'v-dialog',
	],
	plugins: [i18n],
	directives: {
		Tooltip,
	},
};

Object.defineProperty(window, 'FormData', {
	writable: true,
	value: FormData,
});

vi.mock('@/utils/notify', () => ({
	notify: vi.fn(),
}));

vi.mock('@/api', () => {
	return {
		default: {
			post: vi.fn(),
			patch: vi.fn(),
		},
	};
});

describe('V-Upload', () => {
	beforeEach(() => {
		setActivePinia(
			createTestingPinia({
				createSpy: vi.fn,
				stubActions: false,
			}),
		);
	});

	const props = {
		multiple: false,
		preset: undefined,
		fileId: undefined,
		fileVersion: undefined,
		fromUser: true,
		fromUrl: false,
		fromLibrary: false,
	};

	const fileMock = {
		id: 'unique_id',
		storage: 'local',
		filename_disk: 'image.png',
		filename_download: 'image.png',
		title: 'Test Image',
		type: null,
		folder: null,
		uploaded_by: 'user',
		uploaded_on: '2024-06-14T23:59:59.000Z',
		modified_by: null,
		modified_on: '2024-06-14T23:59:59.001Z',
		charset: null,
		filesize: 100,
		width: null,
		height: null,
		duration: null,
		embed: null,
		description: null,
		location: null,
		tags: null,
		metadata: null,
		focal_point_x: null,
		focal_point_y: null,
		version: 0,
	};

	test('Mount component', () => {
		expect(VUpload).toBeTruthy();

		const wrapper = mount(VUpload, {
			props,
			global,
		});

		expect(wrapper.html()).toMatchSnapshot();
	});

	test('Should upload new file', async () => {
		const wrapper = mount(VUpload, {
			props,
			global,
		});

		const file = new File(['image'], 'image.png', { type: 'image/png' });

		const fileUpload = wrapper.get<HTMLInputElement>('input[type="file"]');

		expect(fileUpload).toBeTruthy();

		Object.defineProperty(fileUpload.element, 'files', {
			value: [file],
			writable: false,
		});

		await fileUpload.trigger('change');
		await wrapper.vm.$nextTick();

		expect(fileUpload.element.files).toEqual([file]);
	});

	test('Should update the version value if fileId is present', async () => {
		const apiPatchSpy = vi.spyOn(api, 'patch');

		apiPatchSpy.mockResolvedValue({
			data: {
				data: {
					...fileMock,
					version: 1,
				},
			},
		});

		const wrapper = mount(VUpload, {
			props: {
				...props,
				fileId: 'unique_id',
			},
			global,
		});

		const file = new File(['image'], 'image.png', { type: 'image/png' });

		const fileUpload = wrapper.get<HTMLInputElement>('input[type="file"]');

		expect(fileUpload).toBeTruthy();

		Object.defineProperty(fileUpload.element, 'files', {
			value: [file],
			writable: false,
		});

		await fileUpload.trigger('change');
		await wrapper.vm.$nextTick();

		const { upload } = wrapper.vm.useUpload();

		await upload([file]);

		expect(apiPatchSpy).toHaveBeenCalledOnce();

		expect(wrapper.emitted()['input']?.[0]).toEqual([{ ...fileMock, version: 1 }]);
	});
});
